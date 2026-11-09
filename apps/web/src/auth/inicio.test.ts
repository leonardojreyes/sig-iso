// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from './almacen-acceso';
import { leerConfiguracion } from './configuracion';
import type { ResultadoCallback } from './flujo';
import { rutaDeInicio } from './inicio';
import { crearServicioSesion } from './sesion';

const AHORA = new Date('2026-11-08T10:00:00Z');
const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'),
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
});
const identidad = (slug = 'empresa-a') => ({
  usuarioId: '5eed0001-0000-4000-8000-0000000000a1',
  nombre: 'Persona',
  roles: ['colaborador'],
  empresa: { slug, nombre: 'Empresa' },
});

const montar = (
  me: () => Response | Promise<Response> = () => new Response(JSON.stringify(identidad()), { status: 200 }),
  keycloak: 'ok' | 'invalid_grant' | 'caido' = 'ok',
) => {
  const llamadas: string[] = [];
  const fetchFn = (async (url: string) => {
    llamadas.push(url.replace(config.apiUrl, 'API').replace(config.emisor, 'KC'));
    if (url === `${config.apiUrl}/me`) return me();
    if (url.startsWith(config.apiUrl)) return new Response(null, { status: 204 });
    if (url.endsWith('/token')) {
      if (keycloak === 'caido') throw new Error('ECONNREFUSED');
      if (keycloak === 'invalid_grant')
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
      return new Response(
        JSON.stringify({
          token_type: 'Bearer',
          access_token: 'acceso-nuevo',
          refresh_token: 'refresco-nuevo',
          expires_in: 300,
        }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  return { llamadas, fetchFn };
};

const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0001-0000-4000-8000-0000000000a1', sid: 'sesion-kc-1' },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});

const entorno = async (
  me?: Parameters<typeof montar>[0],
  keycloak?: Parameters<typeof montar>[1],
  reloj = { t: AHORA },
) => {
  const { llamadas, fetchFn } = montar(me, keycloak);
  const deps = { config, ahora: () => reloj.t, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!
    .split(';')[0]!;
  llamadas.length = 0;
  return { deps, cookie, llamadas, reloj };
};

describe('rutaDeInicio (la portada lleva a su empresa a quien ya tiene sesión)', () => {
  it('con sesión válida devuelve el listado de SU empresa, tomada de /me (no de datos de demostración)', async () => {
    const { deps, cookie, llamadas } = await entorno();
    expect(await rutaDeInicio(cookie, deps)).toBe('/e/empresa-a/requisitos');
    expect(llamadas).toEqual(['API/me']);
  });

  it('otra persona de otra empresa va a la suya', async () => {
    const { deps, cookie } = await entorno(() => new Response(JSON.stringify(identidad('empresa-b')), { status: 200 }));
    expect(await rutaDeInicio(cookie, deps)).toBe('/e/empresa-b/requisitos');
  });

  it('sin cookie, con basura o alterada: null (se muestra la portada de ingreso) y no llama a nadie', async () => {
    const { deps, cookie, llamadas } = await entorno();
    for (const c of [null, '', `${config.nombreCookieSesion}=basura`, `${cookie.slice(0, -4)}AAAA`])
      expect(await rutaDeInicio(c, deps), String(c)).toBeNull();
    expect(llamadas).toEqual([]);
  });

  it('sesión inactiva o revocada (invalid_grant): null', async () => {
    const reloj = { t: AHORA };
    const { deps, cookie } = await entorno(undefined, 'invalid_grant', reloj);
    reloj.t = new Date(AHORA.getTime() + 40 * 60_000);
    expect(await rutaDeInicio(cookie, deps)).toBeNull();
  });

  it.each([
    ['/me con 401', () => new Response('{}', { status: 401 })],
    ['/me con 500', () => new Response('{}', { status: 500 })],
    ['/me con forma inválida', () => new Response(JSON.stringify({ ...identidad(), extra: 1 }), { status: 200 })],
    [
      '/me con una empresa de forma peligrosa',
      () => new Response(JSON.stringify(identidad('../../otra')), { status: 200 }),
    ],
    ['/me que no responde', () => Promise.reject(new Error('ECONNREFUSED'))],
  ])('%s: null (nunca se redirige a una ruta dudosa; se muestra la portada)', async (_n, me) => {
    const { deps, cookie } = await entorno(me);
    expect(await rutaDeInicio(cookie, deps)).toBeNull();
  });

  it('Keycloak caído al renovar: null', async () => {
    const reloj = { t: AHORA };
    const { deps, cookie } = await entorno(undefined, 'caido', reloj);
    reloj.t = new Date(AHORA.getTime() + 290_000);
    expect(await rutaDeInicio(cookie, deps)).toBeNull();
  });
});
