// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { consultarApi } from './cliente';

const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado });
const consultar = (fetchFn: unknown, ruta = '/librerias') =>
  consultarApi({ ruta, acceso: 'token-de-acceso', apiUrl: 'http://127.0.0.1:3001', fetchFn: fetchFn as typeof fetch });

describe('consultarApi (GET con el token de la sesión)', () => {
  it('pide la ruta con el token, sin caché y sin seguir redirecciones, y devuelve el JSON', async () => {
    const fetchFn = vi.fn(async () => json([1, 2]));
    expect(await consultar(fetchFn)).toEqual({ ok: true, json: [1, 2] });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3001/librerias');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-de-acceso');
    expect(init.cache).toBe('no-store');
    expect(init.redirect).toBe('error');
    expect(init.method ?? 'GET').toBe('GET');
  });

  it('401 → no autenticado; cualquier otro estado, JSON ilegible o red caída → no disponible', async () => {
    expect(await consultar(vi.fn(async () => json({}, 401)))).toEqual({ ok: false, motivo: 'no_autenticado' });
    for (const resp of [
      () => json({}, 400),
      () => json({}, 403),
      () => json({}, 429),
      () => json({}, 500),
      () => json({}, 201),
      () => new Response('<html>', { status: 200 }),
    ]) {
      expect(await consultar(vi.fn(async () => resp()))).toEqual({ ok: false, motivo: 'no_disponible' });
    }
    expect(await consultar(vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))))).toEqual({
      ok: false,
      motivo: 'no_disponible',
    });
  });

  it('solo acepta rutas propias de la API (no se puede apuntar a otro servidor con el token)', async () => {
    const fetchFn = vi.fn(async () => json([]));
    for (const ruta of [
      'http://evil.example/x',
      '//evil.example',
      'librerias',
      '/../x',
      '/a b',
      '/x\\y',
      '',
      '/librerias#a',
    ]) {
      expect(await consultar(fetchFn, ruta), ruta).toEqual({ ok: false, motivo: 'no_disponible' });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
