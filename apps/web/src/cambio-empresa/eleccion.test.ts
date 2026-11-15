// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { cargarEleccion } from './eleccion';

const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const AHORA = new Date('2026-11-15T10:00:00Z');
const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0005-0000-4000-8000-0000000000c1', sid: 'sesion-kc-1' },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});
const lista = (...slugs: string[]) => slugs.map((s, i) => ({ slug: s, nombre: `Empresa ${s}`, activa: i === 0 }));

const montar = async (empresas: () => Response | 'lanza') => {
  const llamadas: string[] = [];
  const fetchFn = (async (url: string) => {
    if (url === `${config.apiUrl}/sesion/empresas`) {
      llamadas.push('empresas');
      const r = empresas();
      if (r === 'lanza') throw new Error('ECONNREFUSED');
      return r;
    }
    if (url.startsWith(config.apiUrl)) return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  const deps = { config, ahora: () => AHORA, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!.split(';')[0]!;
  llamadas.length = 0;
  return { deps, cookie, llamadas };
};

describe('cargarEleccion (pantalla de elección de empresa al entrar)', () => {
  it('varias empresas: devuelve la lista para elegir', async () => {
    const { deps, cookie } = await montar(() => new Response(JSON.stringify(lista('empresa-a', 'empresa-b')), { status: 200 }));
    expect(await cargarEleccion(cookie, deps)).toEqual({ tipo: 'varias', empresas: lista('empresa-a', 'empresa-b') });
  });
  it('una sola empresa: no hay nada que elegir, entra directo', async () => {
    const { deps, cookie } = await montar(() => new Response(JSON.stringify(lista('empresa-a')), { status: 200 }));
    expect(await cargarEleccion(cookie, deps)).toEqual({ tipo: 'una', slug: 'empresa-a' });
  });
  it('sin cookie o con una cookie inválida: a ingresar, sin llamar a la API', async () => {
    const { deps, llamadas } = await montar(() => new Response('[]', { status: 200 }));
    expect(await cargarEleccion(null, deps)).toEqual({ tipo: 'ingresar' });
    expect(await cargarEleccion(`${config.nombreCookieSesion}=inventada`, deps)).toEqual({ tipo: 'ingresar' });
    expect(llamadas).toEqual([]);
  });
  it('401 de la API: a ingresar', async () => {
    const { deps, cookie } = await montar(() => new Response(null, { status: 401 }));
    expect(await cargarEleccion(cookie, deps)).toEqual({ tipo: 'ingresar' });
  });
  it.each([
    ['la API falla (500)', () => new Response(null, { status: 500 })],
    ['la API no responde', () => 'lanza' as const],
    ['una lista vacía', () => new Response('[]', { status: 200 })],
    ['una forma que no cumple el contrato', () => new Response(JSON.stringify([{ slug: 'empresa-a', nombre: 'A', activa: true, extra: 1 }]), { status: 200 })],
    ['no es JSON', () => new Response('no es json', { status: 200 })],
  ])('si %s: «no disponible» (no se muestra nada a medias)', async (_n, empresas) => {
    const { deps, cookie } = await montar(empresas);
    expect(await cargarEleccion(cookie, deps)).toEqual({ tipo: 'no_disponible' });
  });
});
