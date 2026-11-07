import { Controller, Get, HttpException, Param } from '@nestjs/common';
import { SpanStatusCode } from '@opentelemetry/api';
import { InMemorySpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { crearProveedorDeTrazas } from './proveedor.js';

// Trazas sobre una aplicación Nest REAL: un span por solicitud con la empresa del token verificado y nada más.
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USUARIO = '44444444-4444-4444-8444-444444444444';

@Controller('prueba')
class TrazasController {
  @Get('trabajo') trabajo() { return { ok: true }; }
  @Get('item/:id') item(@Param('id') id: string) { return { id }; }
  @Get('falla') falla(): never { throw new Error('detalle-interno-que-no-debe-salir'); }
  @Get('prohibido') prohibido(): never { throw new HttpException('x', 418); }
}

describe('trazas en la API (tarea 12.1)', () => {
  let arnes: Arnes;
  const exportador = new InMemorySpanExporter();
  const proveedor = crearProveedorDeTrazas({ exportador });
  const bitacora = hechosEnMemoria();
  let n = 0;
  const token = (e: string, u = USUARIO) => arnes.firmar(e, u, { sid: `t-${++n}` });

  beforeAll(async () => {
    arnes = await crearArnes({ controladores: [TrazasController], hechos: bitacora.hechos, trazador: proveedor.getTracer('prueba') });
  });
  afterAll(async () => { await arnes.cerrar(); await proveedor.shutdown(); });
  beforeEach(() => exportador.reset());

  /** El span se cierra al terminar la respuesta, un instante después de que el cliente la recibe. */
  const spans = async (): Promise<ReadableSpan[]> => {
    for (let i = 0; i < 50 && exportador.getFinishedSpans().length === 0; i++) await new Promise((r) => setTimeout(r, 5));
    return exportador.getFinishedSpans();
  };
  const atributos = (s: ReadableSpan) => s.attributes as Record<string, unknown>;

  it('una solicitud autenticada deja UN span con método, patrón de ruta, estado y empresa_id del token', async () => {
    expect((await arnes.pedir('/prueba/trabajo', await token(A))).status).toBe(200);
    const [span] = await spans();
    expect(span!.name).toBe('GET /prueba/trabajo');
    expect(atributos(span!)).toEqual({ 'http.request.method': 'GET', 'http.route': '/prueba/trabajo', 'http.response.status_code': 200, empresa_id: A });
  });

  it('la empresa del span es la del token aunque el cliente pida otra por consulta o por encabezado', async () => {
    await fetch(`${arnes.base}/prueba/trabajo?empresa=${B}&tenant=${B}`, { headers: { authorization: `Bearer ${await token(A)}`, 'x-empresa': B } });
    expect(atributos((await spans())[0]!).empresa_id).toBe(A);
  });

  it('la ruta es el PATRÓN: el identificador real no llega a la traza', async () => {
    const id = '99999999-9999-4999-8999-999999999999';
    await arnes.pedir(`/prueba/item/${id}?secreto=dato-sensible`, await token(A));
    const [span] = await spans();
    expect(atributos(span!)['http.route']).toBe('/prueba/item/:id');
    expect(JSON.stringify([span!.name, span!.attributes])).not.toMatch(/9999|dato-sensible/);
  });

  it('sin token (401) y en rutas públicas no hay empresa_id; el 401 sí queda trazado', async () => {
    await arnes.pedir('/prueba/trabajo');
    const [span] = await spans();
    expect(atributos(span!)['http.response.status_code']).toBe(401);
    expect('empresa_id' in atributos(span!)).toBe(false);
  });

  it('una ruta inexistente se llama «desconocida» (nunca la dirección cruda)', async () => {
    await arnes.pedir('/no/existe/22222222-2222-4222-8222-222222222222', await token(A));
    const [span] = await spans();
    expect(span!.name).toBe('GET desconocida');
    expect(JSON.stringify(span!.attributes)).not.toMatch(/existe|22222222/);
  });

  it('un error interno es un span con estado de error y no filtra el detalle', async () => {
    expect((await arnes.pedir('/prueba/falla', await token(A))).status).toBe(500);
    const [span] = await spans();
    expect(span!.status.code).toBe(SpanStatusCode.ERROR);
    expect(atributos(span!)['http.response.status_code']).toBe(500);
    expect(JSON.stringify([span!.name, span!.attributes, span!.events, span!.status])).not.toContain('detalle-interno');
  });

  it('un 4xx no es error del servidor', async () => {
    await arnes.pedir('/prueba/prohibido', await token(A));
    expect((await spans())[0]!.status.code).toBe(SpanStatusCode.UNSET);
  });

  it('solicitudes simultáneas de dos empresas: cada span lleva la suya', async () => {
    const [ta, tb] = [await token(A), await token(B, '55555555-5555-4555-8555-555555555555')];
    await Promise.all(Array.from({ length: 10 }, (_, i) => arnes.pedir('/prueba/trabajo', i % 2 === 0 ? ta : tb)));
    for (let i = 0; i < 50 && exportador.getFinishedSpans().length < 10; i++) await new Promise((r) => setTimeout(r, 10));
    const empresas = exportador.getFinishedSpans().map((s) => atributos(s).empresa_id);
    expect(empresas.filter((e) => e === A)).toHaveLength(5);
    expect(empresas.filter((e) => e === B)).toHaveLength(5);
  });

  it('nada del token, de la persona ni de la dirección de red llega a la traza', async () => {
    const t = await token(A);
    await fetch(`${arnes.base}/prueba/trabajo`, { headers: { authorization: `Bearer ${t}`, 'user-agent': 'agente-raro', 'x-forwarded-for': '10.1.2.3' } });
    const [span] = await spans();
    const texto = JSON.stringify([span!.name, span!.attributes, span!.events, span!.links.map((l) => l.attributes), span!.resource.attributes]);
    expect(texto).not.toContain(t.split('.')[1]);
    expect(texto).not.toMatch(/agente-raro|10\.1\.2\.3/);
    expect(texto).not.toContain(USUARIO);
  });
});
