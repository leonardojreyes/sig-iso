import { Controller, Get } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Publico } from './publico.decorator.js';
import { crearArnes, hechosEnMemoria, type Arnes } from './prueba/arnes.js';
import { erroresDeEsquema } from './prueba/contrato.js';

// Límite de frecuencia por persona y por empresa sobre una aplicación Nest REAL: 429 con `Retry-After`, sin tocar la lógica de
// negocio ni la bitácora, y con el reloj controlado.
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const P1 = '44444444-4444-4444-8444-444444444444';
const P2 = '55555555-5555-4555-8555-555555555555';
const P3 = '66666666-6666-4666-8666-666666666666';
const P4 = '77777777-7777-4777-8777-777777777777';

const contador = { negocio: 0 };

@Controller('prueba')
class LimiteController {
  @Get('trabajo') trabajo() { contador.negocio++; return { ok: true }; }
  @Publico() @Get('publica') publica() { return { ok: true }; }
}

describe('límite de frecuencia (tarea 6.8)', () => {
  let arnes: Arnes;
  const reloj = { t: 10_000_000 };
  const bitacora = hechosEnMemoria();
  let n = 0;
  // Persona: 4 por minuto; empresa: 6 por minuto. Cada token lleva su propia sesión.
  const token = (e: string, u: string) => arnes.firmar(e, u, { sid: `l-${++n}` });
  const trabajo = (t?: string) => arnes.pedir('/prueba/trabajo', t);

  beforeAll(async () => {
    arnes = await crearArnes({ controladores: [LimiteController], hechos: bitacora.hechos, limites: { persona: 4, empresa: 6 }, ahora: () => reloj.t });
  });
  afterAll(async () => { await arnes.cerrar(); });
  beforeEach(() => {
    reloj.t += 3_600_000; // cada prueba empieza con los cubos llenos
    contador.negocio = 0;
    bitacora.estado.eventos = [];
  });

  const estados = async (peticiones: Promise<Response>[]) => (await Promise.all(peticiones)).map((r) => r.status);

  describe('por persona', () => {
    it('admite lo que permite el límite y rechaza el resto con 429 problem+json y Retry-After', async () => {
      const t = await token(A, P1);
      for (let i = 0; i < 4; i++) expect((await trabajo(t)).status).toBe(200);
      const r = await trabajo(t);
      expect(r.status).toBe(429);
      expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const espera = Number(r.headers.get('retry-after'));
      expect(Number.isInteger(espera)).toBe(true);
      expect(espera).toBeGreaterThanOrEqual(1);
      const c = (await r.json()) as Record<string, unknown>;
      expect(c).toEqual({ type: 'about:blank', title: 'Límite de solicitudes excedido', status: 429, codigo: 'limite_excedido' });
      expect(erroresDeEsquema('Problema', c)).toEqual([]);
    });

    it('lo rechazado NO llega a la lógica de negocio ni a la bitácora', async () => {
      const t = await token(A, P1);
      for (let i = 0; i < 10; i++) await trabajo(t);
      expect(contador.negocio).toBe(4);
      expect(bitacora.estado.eventos).toEqual([]);
    });

    it('Retry-After dice cuánto falta de verdad: pasado ese tiempo se vuelve a admitir', async () => {
      const t = await token(A, P1);
      for (let i = 0; i < 4; i++) await trabajo(t);
      const r = await trabajo(t);
      const espera = Number(r.headers.get('retry-after'));
      reloj.t += (espera - 1) * 1000;
      expect((await trabajo(t)).status).toBe(429);
      reloj.t += 1000;
      expect((await trabajo(t)).status).toBe(200);
    });

    it('otra persona de la misma empresa sigue pudiendo trabajar (mientras la empresa no se agote)', async () => {
      const t1 = await token(A, P1);
      for (let i = 0; i < 6; i++) await trabajo(t1);
      expect((await trabajo(await token(A, P2))).status).toBe(200);
    });

    it('la persona se identifica por el token: cambiar de sesión o de encabezados no reinicia el límite', async () => {
      for (let i = 0; i < 4; i++) await trabajo(await token(A, P1));
      expect((await trabajo(await token(A, P1))).status).toBe(429);
      const r = await fetch(`${arnes.base}/prueba/trabajo?usuario=${P4}&empresa=${B}`, { headers: { authorization: `Bearer ${await token(A, P1)}`, 'x-forwarded-for': '10.9.9.9', 'x-empresa': B } });
      expect(r.status).toBe(429);
    });
  });

  describe('por empresa', () => {
    it('varias personas que juntas pasan el límite de su empresa reciben 429 aunque cada una esté por debajo del suyo', async () => {
      const resultados: number[] = [];
      for (const u of [P1, P2, P3]) for (let i = 0; i < 3; i++) resultados.push((await trabajo(await token(A, u))).status);
      expect(resultados.filter((s) => s === 200)).toHaveLength(6);
      expect(resultados.filter((s) => s === 429)).toHaveLength(3);
    });

    it('otra empresa no se ve afectada', async () => {
      for (let i = 0; i < 12; i++) await trabajo(await token(A, i % 2 === 0 ? P1 : P2));
      expect((await trabajo(await token(B, P3))).status).toBe(200);
    });
  });

  describe('lo que NO se limita', () => {
    it('las rutas públicas (las marcadas @Publico, como /health) no se limitan', async () => {
      expect(await estados(Array.from({ length: 30 }, () => arnes.pedir('/prueba/publica')))).toEqual(Array(30).fill(200));
    });

    it('los rechazos 401 no consumen fichas de nadie', async () => {
      for (let i = 0; i < 30; i++) await trabajo(); // sin token
      for (let i = 0; i < 30; i++) await arnes.pedir('/prueba/trabajo', 'basura');
      const t = await token(A, P1);
      expect(await estados([trabajo(t), trabajo(t), trabajo(t), trabajo(t)])).toEqual([200, 200, 200, 200]);
    });
  });

  it('con peticiones simultáneas el límite es exacto: ni una de más ni una de menos', async () => {
    const t = await token(A, P1);
    const e = await estados(Array.from({ length: 20 }, () => trabajo(t)));
    expect(e.filter((s) => s === 200)).toHaveLength(4);
    expect(e.filter((s) => s === 429)).toHaveLength(16);
    expect(contador.negocio).toBe(4);
  });

  it('el 429 no revela si se agotó la persona o la empresa', async () => {
    const porPersona = await trabajo(await (async () => { const t = await token(A, P1); for (let i = 0; i < 4; i++) await trabajo(t); return t; })());
    reloj.t += 3_600_000;
    for (let i = 0; i < 6; i++) await trabajo(await token(A, [P1, P2, P3][i % 3]!));
    const porEmpresa = await trabajo(await token(A, P4));
    expect(porPersona.status).toBe(429);
    expect(porEmpresa.status).toBe(429);
    expect(await porPersona.text()).toBe(await porEmpresa.text());
  });
});
