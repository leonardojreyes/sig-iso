// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { cargarEmpresaActual } from './empresa-actual';

const AHORA = new Date('2026-11-08T10:00:00Z');
const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'),
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
});
const marca = {
  nombre: 'Empresa A (prueba)',
  colorPrimario: '#0b5fff',
  colorOriginal: '#0b5fff',
  ajustadoPorContraste: false,
  logoUrl: null,
};

const identidad = {
  usuarioId: '5eed0001-0000-4000-8000-0000000000a1',
  nombre: 'Persona de prueba',
  roles: ['administrador_sig'],
  empresa: { slug: 'empresa-a', nombre: 'Empresa A (prueba)' },
};

const montar = (
  opciones: { marca?: () => Response; me?: () => Response; keycloak?: 'ok' | 'invalid_grant' | 'caido' } = {},
) => {
  const llamadas: string[] = [];
  const fetchFn = (async (url: string) => {
    llamadas.push(url.replace(config.apiUrl, 'API').replace(config.emisor, 'KC'));
    if (url === `${config.apiUrl}/empresa/marca`)
      return (opciones.marca ?? (() => new Response(JSON.stringify(marca), { status: 200 })))();
    if (url === `${config.apiUrl}/me`)
      return (opciones.me ?? (() => new Response(JSON.stringify(identidad), { status: 200 })))();
    if (url.startsWith(config.apiUrl)) return new Response(null, { status: 204 });
    if (url.endsWith('/token')) {
      if (opciones.keycloak === 'caido') throw new Error('ECONNREFUSED');
      if (opciones.keycloak === 'invalid_grant')
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

const entorno = async (opciones: Parameters<typeof montar>[0] = {}, reloj = { t: AHORA }) => {
  const { llamadas, fetchFn } = montar(opciones);
  const deps = { config, ahora: () => reloj.t, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!
    .split(';')[0]!;
  llamadas.length = 0;
  return { deps, llamadas, cookie, reloj };
};

describe('cargarEmpresaActual (marca de la sesión para las pantallas internas)', () => {
  it('con el slug verificado por el proxy y la cookie de sesión, devuelve la marca REAL de esa empresa', async () => {
    const { deps, cookie, llamadas } = await entorno();
    const r = await cargarEmpresaActual({ slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie }, deps);
    expect(r).toEqual({
      tipo: 'ok',
      empresa: { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff', logoUrl: undefined },
      persona: { nombre: 'Persona de prueba', roles: ['administrador_sig'] },
      acceso: 'acceso-inicial',
    });
    expect([...llamadas].sort()).toEqual(['API/empresa/marca', 'API/me']);
  });

  it('si la dirección no es la empresa verificada (o el proxy no verificó nada) es 404 y NO llama a la API', async () => {
    const { deps, cookie, llamadas } = await entorno();
    for (const [dir, ver] of [
      ['empresa-b', 'empresa-a'],
      ['empresa-a', 'empresa-b'],
      ['empresa-a', null],
      ['empresa-a', ''],
    ] as const) {
      expect(
        await cargarEmpresaActual({ slugDeLaDireccion: dir, slugVerificado: ver, cookie }, deps),
        `${dir}/${ver}`,
      ).toEqual({ tipo: 'no_encontrado' });
    }
    expect(llamadas).toEqual([]);
  });

  it('la persona (nombre y roles) sale de /me, no de datos de demostración', async () => {
    const { deps, cookie } = await entorno({
      me: () =>
        new Response(JSON.stringify({ ...identidad, nombre: 'Otra Persona', roles: ['colaborador'] }), { status: 200 }),
    });
    const r = await cargarEmpresaActual({ slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie }, deps);
    expect(r).toMatchObject({ tipo: 'ok', persona: { nombre: 'Otra Persona', roles: ['colaborador'] } });
  });

  it('si /me trae OTRA empresa distinta de la verificada: no encontrado (nunca se mezclan datos)', async () => {
    const { deps, cookie } = await entorno({
      me: () =>
        new Response(JSON.stringify({ ...identidad, empresa: { slug: 'empresa-b', nombre: 'Empresa B' } }), {
          status: 200,
        }),
    });
    expect(
      await cargarEmpresaActual({ slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie }, deps),
    ).toEqual({ tipo: 'no_encontrado' });
  });

  it('/me con 401: ingresar; con error o forma inválida: no disponible', async () => {
    const dir = { slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a' };
    const a = await entorno({ me: () => new Response('{}', { status: 401 }) });
    expect(await cargarEmpresaActual({ ...dir, cookie: a.cookie }, a.deps)).toEqual({ tipo: 'ingresar' });
    for (const me of [
      () => new Response('{}', { status: 500 }),
      () => new Response(JSON.stringify({ ...identidad, extra: 1 }), { status: 200 }),
    ]) {
      const b = await entorno({ me });
      expect(await cargarEmpresaActual({ ...dir, cookie: b.cookie }, b.deps)).toEqual({ tipo: 'no_disponible' });
    }
  });

  it('sin cookie de sesión: ingresar', async () => {
    const { deps } = await entorno();
    expect(
      await cargarEmpresaActual({ slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie: null }, deps),
    ).toEqual({ tipo: 'ingresar' });
    expect(
      await cargarEmpresaActual(
        { slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie: `${config.nombreCookieSesion}=basura` },
        deps,
      ),
    ).toEqual({ tipo: 'ingresar' });
  });

  it('la API rechaza el token (401): ingresar', async () => {
    const { deps, cookie } = await entorno({ marca: () => new Response('{}', { status: 401 }) });
    expect(
      await cargarEmpresaActual({ slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie }, deps),
    ).toEqual({ tipo: 'ingresar' });
    expect(deps.almacen.obtener('sesion-kc-1')).toBeUndefined(); // y se olvida el token rechazado
  });

  it('sesión inactiva o revocada (renovación con invalid_grant): ingresar', async () => {
    const reloj = { t: AHORA };
    const { deps, cookie } = await entorno({ keycloak: 'invalid_grant' }, reloj);
    reloj.t = new Date(AHORA.getTime() + 40 * 60_000);
    expect(
      await cargarEmpresaActual({ slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie }, deps),
    ).toEqual({ tipo: 'ingresar' });
  });

  it('Keycloak caído, API caída o marca inválida: no disponible (nunca una marca inventada)', async () => {
    const reloj = { t: AHORA };
    const a = await entorno({ keycloak: 'caido' }, reloj);
    reloj.t = new Date(AHORA.getTime() + 290_000);
    expect(
      await cargarEmpresaActual(
        { slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie: a.cookie },
        a.deps,
      ),
    ).toEqual({ tipo: 'no_disponible' });
    for (const marcaMala of [
      () => new Response('{}', { status: 500 }),
      () => new Response(JSON.stringify({ ...marca, colorPrimario: 'x' }), { status: 200 }),
    ]) {
      const b = await entorno({ marca: marcaMala });
      expect(
        await cargarEmpresaActual(
          { slugDeLaDireccion: 'empresa-a', slugVerificado: 'empresa-a', cookie: b.cookie },
          b.deps,
        ),
      ).toEqual({ tipo: 'no_disponible' });
    }
  });
});
