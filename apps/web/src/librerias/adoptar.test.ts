// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from '../auth/almacen-acceso';
import { leerConfiguracion } from '../auth/configuracion';
import type { ResultadoCallback } from '../auth/flujo';
import { crearServicioSesion } from '../auth/sesion';
import { adoptarLibreria } from './adoptar';

const AHORA = new Date('2026-11-08T10:00:00Z');
const LIBRERIA = '5eed0001-0000-4000-8000-0000000000a1';
const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'),
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
});

const montar = (
  api: { estado: number; lanza?: boolean } = { estado: 201 },
  keycloak: 'ok' | 'invalid_grant' | 'caido' = 'ok',
) => {
  const llamadas: Array<{ metodo: string; ruta: string; autorizacion: string | null; cuerpo: string | null }> = [];
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    const ruta = url.replace(config.apiUrl, 'API').replace(config.emisor, 'KC');
    llamadas.push({
      metodo: init.method ?? 'GET',
      ruta,
      autorizacion: new Headers(init.headers).get('authorization'),
      cuerpo: typeof init.body === 'string' ? init.body : null,
    });
    if (url.startsWith(`${config.apiUrl}/librerias/`)) {
      if (api.lanza) throw new Error('ECONNREFUSED');
      return new Response(
        api.estado === 201 || api.estado === 200
          ? JSON.stringify({
              libreriaId: LIBRERIA,
              entradas: 21,
              yaAdoptada: api.estado === 200,
              adoptadaEn: '2026-11-08T10:00:00Z',
            })
          : '{}',
        { status: api.estado },
      );
    }
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
  api?: Parameters<typeof montar>[0],
  keycloak?: Parameters<typeof montar>[1],
  reloj = { t: AHORA },
) => {
  const { llamadas, fetchFn } = montar(api, keycloak);
  const deps = { config, ahora: () => reloj.t, fetchFn, almacen: new AlmacenAcceso() };
  const r = await crearServicioSesion(deps).iniciar(callbackOk());
  const cookie = r.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!
    .split(';')[0]!;
  llamadas.length = 0;
  const enviar = (
    opciones: {
      metodo?: string;
      origen?: string | null;
      cookie?: string | null;
      slug?: string;
      verificado?: string | null;
      id?: string;
    } = {},
  ) => {
    const {
      metodo = 'POST',
      origen = config.origen,
      cookie: c = cookie,
      slug = 'empresa-a',
      verificado = 'empresa-a',
      id = LIBRERIA,
    } = opciones;
    const peticion = new Request(`${config.origen}/e/${slug}/librerias/${id}/adopcion`, {
      method: metodo,
      headers: { ...(origen === null ? {} : { origin: origen }), ...(c ? { cookie: c } : {}) },
    });
    return adoptarLibreria(peticion, { slugDeLaDireccion: slug, slugVerificado: verificado, libreriaId: id }, deps);
  };
  return { llamadas, enviar, deps, reloj };
};

const destino = (r: Response) => new URL(r.headers.get('location') ?? 'http://invalida', config.origen);

describe('adoptarLibreria — Origin, método y entradas', () => {
  it.each([
    ['ausente', null],
    ['«null»', 'null'],
    ['de otro sitio', 'https://evil.example'],
    ['de la API', 'http://localhost:3001'],
    ['con el mismo texto al inicio', `${config.origen}.evil.example`],
    ['con barra final', `${config.origen}/`],
  ])('con Origin %s: 403 y NO llama a la API ni a Keycloak', async (_n, origen) => {
    const { enviar, llamadas } = await entorno();
    const r = await enviar({ origen });
    expect(r.status).toBe(403);
    expect(llamadas).toEqual([]);
    expect(r.headers.get('location')).toBeNull();
  });

  it('solo POST: un GET responde 405 y no llama a nadie', async () => {
    const { enviar, llamadas } = await entorno();
    const r = await enviar({ metodo: 'GET' });
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toBe('POST');
    expect(llamadas).toEqual([]);
  });

  it('un identificador de librería que no es UUID es 404 sin llamar a la API', async () => {
    const { enviar, llamadas } = await entorno();
    for (const id of ['x', '../../etc', 'a b', '5eed0001-0000-4000-8000-0000000000a1/../x', '']) {
      expect((await enviar({ id })).status, id).toBe(404);
    }
    expect(llamadas).toEqual([]);
  });

  it('si la empresa de la dirección no es la verificada por el proxy: 404 sin llamar a la API', async () => {
    const { enviar, llamadas } = await entorno();
    expect((await enviar({ slug: 'empresa-b', verificado: 'empresa-a' })).status).toBe(404);
    expect((await enviar({ verificado: null })).status).toBe(404);
    expect(llamadas).toEqual([]);
  });
});

describe('adoptarLibreria — sesión', () => {
  it('sin cookie de sesión: manda a ingresar y no llama a la API', async () => {
    const { enviar, llamadas } = await entorno();
    const r = await enviar({ cookie: null });
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/auth/login');
    expect(destino(r).searchParams.get('retorno')).toBe('/e/empresa-a/requisitos');
    expect(llamadas).toEqual([]);
  });

  it('sesión vencida o revocada (invalid_grant al renovar): ingresar y borrar la cookie', async () => {
    const reloj = { t: AHORA };
    const { enviar } = await entorno({ estado: 201 }, 'invalid_grant', reloj);
    reloj.t = new Date(AHORA.getTime() + 40 * 60_000);
    const r = await enviar();
    expect(r.status).toBe(303);
    expect(destino(r).pathname).toBe('/auth/login');
    expect(r.headers.getSetCookie()[0]).toMatch(/Max-Age=0/);
  });

  it('Keycloak caído al renovar: aviso «no disponible», sin cerrar la sesión', async () => {
    const reloj = { t: AHORA };
    const { enviar } = await entorno({ estado: 201 }, 'caido', reloj);
    reloj.t = new Date(AHORA.getTime() + 290_000);
    const r = await enviar();
    expect(destino(r).searchParams.get('adopcion')).toBe('no_disponible');
    expect(r.headers.getSetCookie()).toEqual([]);
  });

  it('si la renovación rotó el refresh, la respuesta lleva la cookie nueva', async () => {
    const reloj = { t: AHORA };
    const { enviar } = await entorno({ estado: 201 }, 'ok', reloj);
    reloj.t = new Date(AHORA.getTime() + 290_000);
    const r = await enviar();
    expect(destino(r).searchParams.get('adopcion')).toBe('adoptada');
    expect(r.headers.getSetCookie()).toHaveLength(1);
    expect(r.headers.getSetCookie()[0]).toMatch(new RegExp(`^${config.nombreCookieSesion}=`));
  });
});

describe('adoptarLibreria — llamada a la API y resultado', () => {
  it('hace POST /librerias/<id>/adopcion con el token de la sesión y SIN cuerpo (la empresa y la persona salen del token)', async () => {
    const { enviar, llamadas } = await entorno();
    await enviar();
    expect(llamadas).toEqual([
      {
        metodo: 'POST',
        ruta: `API/librerias/${LIBRERIA}/adopcion`,
        autorizacion: 'Bearer acceso-inicial',
        cuerpo: null,
      },
    ]);
  });

  it.each([
    [201, 'adoptada', true],
    [200, 'ya_adoptada', true],
    [403, 'sin_permiso', false],
    [404, 'no_encontrada', false],
    [429, 'no_disponible', false],
    [500, 'no_disponible', false],
    [400, 'no_disponible', false],
  ])('la API responde %s → aviso «%s»', async (estado, aviso, conLibreria) => {
    const { enviar } = await entorno({ estado });
    const r = await enviar();
    expect(r.status).toBe(303);
    const d = destino(r);
    expect(`${d.origin}${d.pathname}`).toBe(`${config.origen}/e/empresa-a/requisitos`);
    expect(d.searchParams.get('adopcion')).toBe(aviso);
    expect(d.searchParams.get('libreria')).toBe(conLibreria ? LIBRERIA : null);
    expect([...d.searchParams.keys()].sort()).toEqual(conLibreria ? ['adopcion', 'libreria'] : ['adopcion']);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('la API no responde: aviso «no disponible»', async () => {
    const { enviar } = await entorno({ estado: 201, lanza: true });
    expect(destino(await enviar()).searchParams.get('adopcion')).toBe('no_disponible');
  });

  it('la API rechaza el token (401): ingresar y olvidar la sesión', async () => {
    const { enviar, deps } = await entorno({ estado: 401 });
    const r = await enviar();
    expect(destino(r).pathname).toBe('/auth/login');
    expect(r.headers.getSetCookie()[0]).toMatch(/Max-Age=0/);
    expect(deps.almacen.obtener('sesion-kc-1')).toBeUndefined();
  });

  it('el 403 se muestra igual aunque la librería no exista (no revela nada)', async () => {
    const { enviar } = await entorno({ estado: 403 });
    const a = destino(await enviar({ id: LIBRERIA })).search;
    const b = destino(await enviar({ id: '5eed0009-0000-4000-8000-0000000000ff' })).search;
    expect(a).toBe(b);
  });
});
