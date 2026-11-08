import { EventEmitter } from 'node:events';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { InMemorySpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { describe, expect, it, vi } from 'vitest';
import { crearMiddlewareTrazas } from './middleware-trazas.js';
import { crearProveedorDeTrazas, leerConfiguracionTrazas } from './proveedor.js';

const EMPRESA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USUARIO = '44444444-4444-4444-8444-444444444444';

/** Solicitud y respuesta mínimas (EventEmitter) para probar el middleware sin red. */
const simular = (opciones: { metodo?: string; ruta?: string | undefined; estado?: number; empresaId?: string; url?: string } = {}) => {
  const exportador = new InMemorySpanExporter();
  const proveedor = crearProveedorDeTrazas({ exportador });
  const middleware = crearMiddlewareTrazas(proveedor.getTracer('prueba'));
  const req: Record<string, unknown> = { method: opciones.metodo ?? 'GET', originalUrl: opciones.url ?? '/me', headers: {}, route: opciones.ruta === undefined ? undefined : { path: opciones.ruta } };
  const res = Object.assign(new EventEmitter(), { statusCode: opciones.estado ?? 200 });
  const siguiente = vi.fn();
  middleware(req as never, res as never, siguiente);
  return {
    exportador,
    proveedor,
    req,
    res,
    siguiente,
    terminar: (evento: 'finish' | 'close' = 'finish') => {
      if (opciones.empresaId) req.identidad = { empresaId: opciones.empresaId, usuarioId: USUARIO, sesionId: null, expiraEn: new Date() };
      res.emit(evento);
      return exportador.getFinishedSpans();
    },
  };
};
const atributos = (s: ReadableSpan) => s.attributes as Record<string, unknown>;
/** Todo lo que un span puede llevar (nombre, atributos, eventos, enlaces, estado, recurso), como texto para buscar fugas. */
const texto = (s: ReadableSpan) =>
  JSON.stringify({ nombre: s.name, atributos: s.attributes, eventos: s.events, enlaces: s.links.map((l) => l.attributes), estado: s.status, recurso: s.resource.attributes, alcance: s.instrumentationScope.name });

describe('middleware de trazas', () => {
  it('abre un span de servidor por solicitud y deja continuar la cadena', () => {
    const { siguiente, exportador } = simular();
    expect(siguiente).toHaveBeenCalledOnce();
    expect(exportador.getFinishedSpans()).toHaveLength(0); // aún no termina
  });

  it('al responder, cierra el span con método, ruta (patrón) y código de estado', () => {
    const [span] = simular({ ruta: '/librerias/:id/adopcion', metodo: 'POST', estado: 201, url: '/librerias/11111111-1111-4111-8111-111111111111/adopcion' }).terminar();
    expect(span!.name).toBe('POST /librerias/:id/adopcion');
    expect(span!.kind).toBe(SpanKind.SERVER);
    expect(atributos(span!)).toEqual({ 'http.request.method': 'POST', 'http.route': '/librerias/:id/adopcion', 'http.response.status_code': 201 });
  });

  it('H: agrega el atributo empresa_id con la empresa del token verificado', () => {
    const [span] = simular({ ruta: '/me', empresaId: EMPRESA }).terminar();
    expect(atributos(span!).empresa_id).toBe(EMPRESA);
  });

  it('sin identidad verificada (401, rutas públicas) NO hay empresa_id', () => {
    const [span] = simular({ ruta: '/health', estado: 200 }).terminar();
    expect('empresa_id' in atributos(span!)).toBe(false);
  });

  it('una ruta sin patrón (404) se llama «desconocida»: nunca se usa la dirección cruda', () => {
    const [span] = simular({ ruta: undefined, estado: 404, url: '/secreto/11111111-1111-4111-8111-111111111111?token=abc' }).terminar();
    expect(span!.name).toBe('GET desconocida');
    expect(atributos(span!)['http.route']).toBe('desconocida');
    expect(texto(span!)).not.toMatch(/secreto|token=abc|11111111/);
  });

  it('la consulta y los identificadores de la dirección no llegan al span', () => {
    const [span] = simular({ ruta: '/requisitos/:id', url: '/requisitos/22222222-2222-4222-8222-222222222222?q=dato-sensible&empresa=otra', empresaId: EMPRESA }).terminar();
    expect(texto(span!)).not.toMatch(/dato-sensible|22222222|empresa=otra/);
  });

  it('no lleva cabeceras, token, persona ni dirección de red', () => {
    const s = simular({ ruta: '/me', empresaId: EMPRESA });
    s.req.headers = { authorization: 'Bearer TOKEN-SECRETO', 'x-forwarded-for': '10.1.2.3', 'user-agent': 'agente-raro' };
    const [span] = s.terminar();
    expect(texto(span!)).not.toMatch(/TOKEN-SECRETO|10\.1\.2\.3|agente-raro/);
    expect(texto(span!)).not.toContain(USUARIO);
    expect(Object.keys(atributos(span!)).sort()).toEqual(['empresa_id', 'http.request.method', 'http.response.status_code', 'http.route']);
  });

  it('un método HTTP raro se registra como _OTHER, no tal cual (evita valores arbitrarios en las trazas)', () => {
    const [span] = simular({ metodo: 'EXTRAÑO-<script>', ruta: '/x' }).terminar();
    expect(atributos(span!)['http.request.method']).toBe('_OTHER');
    expect(texto(span!)).not.toMatch(/script|EXTRAÑO/);
  });

  it.each([
    [200, SpanStatusCode.UNSET], [204, SpanStatusCode.UNSET], [401, SpanStatusCode.UNSET], [403, SpanStatusCode.UNSET], [404, SpanStatusCode.UNSET], [429, SpanStatusCode.UNSET],
    [500, SpanStatusCode.ERROR], [503, SpanStatusCode.ERROR],
  ])('con estado %i el span queda con estado %i (solo los 5xx son error del servidor)', (estado, esperado) => {
    const [span] = simular({ ruta: '/x', estado }).terminar();
    expect(span!.status.code).toBe(esperado);
  });

  it('si la conexión se corta sin respuesta (solo close) el span igualmente se cierra, sin código de estado inventado', () => {
    const s = simular({ ruta: '/me', empresaId: EMPRESA });
    expect(s.exportador.getFinishedSpans()).toHaveLength(0);
    const [span] = s.terminar('close');
    expect(span!.name).toBe('GET /me');
    expect('http.response.status_code' in atributos(span!)).toBe(false);
    expect(span!.status.code).toBe(SpanStatusCode.UNSET);
    expect(atributos(span!).empresa_id).toBe(EMPRESA);
  });

  it('si luego de responder (finish) llega close, no se cierra otro span ni se cambian los atributos', () => {
    const s = simular({ ruta: '/me', estado: 200 });
    s.res.emit('finish');
    s.res.emit('close');
    const spans = s.exportador.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(atributos(spans[0]!)['http.response.status_code']).toBe(200);
  });

  it('cada solicitud tiene su propio span: dos empresas a la vez no mezclan atributos', () => {
    const a = simular({ ruta: '/me', empresaId: EMPRESA });
    const b = simular({ ruta: '/me', empresaId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    expect(atributos(b.terminar()[0]!).empresa_id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(atributos(a.terminar()[0]!).empresa_id).toBe(EMPRESA);
  });

  it('un empresa_id con forma inválida no se agrega (el atributo solo lleva UUID de empresa)', () => {
    const [span] = simular({ ruta: '/me', empresaId: 'no-es-un-uuid; DROP' }).terminar();
    expect('empresa_id' in atributos(span!)).toBe(false);
  });
});

describe('proveedor y configuración', () => {
  it('describe el servicio como sig-iso-api', () => {
    const exportador = new InMemorySpanExporter();
    const proveedor = crearProveedorDeTrazas({ exportador });
    proveedor.getTracer('t').startSpan('x').end();
    expect(exportador.getFinishedSpans()[0]!.resource.attributes['service.name']).toBe('sig-iso-api');
  });

  it('por defecto exporta a la consola; `none` no exporta; otro valor se rechaza nombrando la variable', () => {
    expect(leerConfiguracionTrazas({})).toEqual({ exportador: 'consola' });
    expect(leerConfiguracionTrazas({ OTEL_TRACES_EXPORTER: 'console' })).toEqual({ exportador: 'consola' });
    expect(leerConfiguracionTrazas({ OTEL_TRACES_EXPORTER: 'none' })).toEqual({ exportador: 'ninguno' });
    expect(() => leerConfiguracionTrazas({ OTEL_TRACES_EXPORTER: 'otlp' })).toThrow(/OTEL_TRACES_EXPORTER/);
    expect(() => leerConfiguracionTrazas({ OTEL_TRACES_EXPORTER: '' })).toThrow(/OTEL_TRACES_EXPORTER/);
  });

  it('con exportador `ninguno` no se escribe nada en la consola', async () => {
    const dir = vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const proveedor = crearProveedorDeTrazas({ exportador: 'ninguno' });
    proveedor.getTracer('t').startSpan('x').end();
    await proveedor.forceFlush();
    expect(dir).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    dir.mockRestore();
    log.mockRestore();
  });

  it('con exportador `consola` el span llega a la consola con su empresa_id (traza visible)', async () => {
    const dir = vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    const proveedor = crearProveedorDeTrazas({ exportador: 'consola' });
    const s = crearMiddlewareTrazas(proveedor.getTracer('t'));
    const req: Record<string, unknown> = { method: 'GET', originalUrl: '/me', headers: {}, route: { path: '/me' }, identidad: { empresaId: EMPRESA } };
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    s(req as never, res as never, () => undefined);
    res.emit('finish');
    await proveedor.forceFlush();
    expect(dir).toHaveBeenCalled();
    expect(JSON.stringify(dir.mock.calls)).toContain(EMPRESA);
    dir.mockRestore();
  });

  it('cerrar el proveedor vacía lo pendiente y no falla si se cierra dos veces', async () => {
    const exportador = new InMemorySpanExporter();
    const proveedor = crearProveedorDeTrazas({ exportador });
    proveedor.getTracer('t').startSpan('x').end();
    await proveedor.shutdown();
    await expect(proveedor.shutdown()).resolves.toBeUndefined();
  });
});
