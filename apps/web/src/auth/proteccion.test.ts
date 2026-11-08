// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from './almacen-acceso';
import { leerConfiguracion } from './configuracion';
import type { ResultadoCallback } from './flujo';
import { decidirAcceso } from './proteccion';
import { crearServicioSesion } from './sesion';

const SECRETO = randomBytes(18).toString('base64url');
const AHORA = new Date('2026-11-08T10:00:00Z');
const SID = 'sesion-kc-1';
const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: SECRETO,
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
});

interface Estado {
  me: { estado: number; slug: string; lanza?: boolean };
  keycloak: 'ok' | 'invalid_grant' | 'caido';
  llamadas: string[];
  revocados: Set<string>;
}

const montar = (slugDeLaSesion = 'empresa-a') => {
  const e: Estado = { me: { estado: 200, slug: slugDeLaSesion }, keycloak: 'ok', llamadas: [], revocados: new Set() };
  let n = 1;
  const vigentes = new Set(['refresco-0']);
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    e.llamadas.push(`${init.method ?? 'GET'} ${url.replace(config.apiUrl, 'API').replace(config.emisor, 'KC')}`);
    if (url === `${config.apiUrl}/me`) {
      if (e.me.lanza) throw new Error('ECONNREFUSED');
      return new Response(
        JSON.stringify({
          usuarioId: 'x',
          nombre: 'Persona',
          roles: ['colaborador'],
          empresa: { slug: e.me.slug, nombre: 'Empresa' },
        }),
        { status: e.me.estado },
      );
    }
    if (url.startsWith(config.apiUrl)) return new Response(null, { status: 204 });
    if (url.endsWith('/revoke')) {
      const t = new URLSearchParams(init.body as string).get('token')!;
      vigentes.delete(t);
      e.revocados.add(t);
      return new Response(null, { status: 200 });
    }
    if (url.endsWith('/token')) {
      if (e.keycloak === 'caido') throw new Error('ECONNREFUSED');
      const usado = new URLSearchParams(init.body as string).get('refresh_token')!;
      if (e.keycloak === 'invalid_grant' || !vigentes.has(usado))
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
      vigentes.delete(usado);
      const k = n++;
      vigentes.add(`refresco-${k}`);
      return new Response(
        JSON.stringify({
          token_type: 'Bearer',
          access_token: `acceso-${k}`,
          refresh_token: `refresco-${k}`,
          expires_in: 300,
        }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  return { e, fetchFn };
};

const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: '5eed0001-0000-4000-8000-0000000000a1', sid: SID },
  retorno: '/',
  limpiarCookie: 'sig-oidc=; Max-Age=0',
});

// Inicia una sesión y devuelve una función para pedir páginas con (o sin) su cookie.
const entorno = async (slug = 'empresa-a', reloj: { t: Date } = { t: AHORA }) => {
  const { e, fetchFn } = montar(slug);
  const almacen = new AlmacenAcceso();
  const deps = { config, ahora: () => reloj.t, fetchFn, almacen };
  const svc = crearServicioSesion(deps);
  const r = await svc.iniciar(callbackOk());
  const cookie = r.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!
    .split(';')[0]!;
  e.llamadas.length = 0;
  const pedir = (ruta: string, conCookie: string | null = cookie) =>
    decidirAcceso(
      new Request(`http://localhost:3000${ruta}`, { headers: conCookie ? { cookie: conCookie } : {} }),
      deps,
    );
  return { e, deps, svc, almacen, cookie, pedir, reloj };
};

describe('decidirAcceso: rutas internas /e/<empresa>/…', () => {
  it('H1.3 sin sesión: va a ingresar y recuerda la pantalla pedida (ruta y consulta)', async () => {
    const { pedir } = await entorno();
    expect(await pedir('/e/empresa-a/requisitos?q=gobierno&capitulo=4', null)).toEqual({
      tipo: 'login',
      retorno: '/e/empresa-a/requisitos?q=gobierno&capitulo=4',
      cookies: [],
    });
  });

  it('la pantalla de ingreso de cada empresa es pública (sin sesión pasa) y no llama a nadie', async () => {
    const { pedir, e } = await entorno();
    expect(await pedir('/e/empresa-a/ingreso', null)).toEqual({ tipo: 'pasar', empresa: null, cookies: [] });
    expect(await pedir('/e/empresa-a/ingreso/', null)).toEqual({ tipo: 'pasar', empresa: null, cookies: [] });
    expect(e.llamadas).toEqual([]);
  });

  it('no hay atajos: puntos, codificaciones y mayúsculas no vuelven pública una ruta interna', async () => {
    const { pedir } = await entorno();
    for (const ruta of [
      '/e/empresa-a/ingreso/../panel',
      '/e/empresa-a/ingreso/%2e%2e/panel',
      '/e/empresa-a/ingreso%2fpanel',
      '/e/empresa-a/Ingreso',
      '/e/empresa-a/ingresos',
      '/e/empresa-a/panel/ingreso',
      '/e/empresa-a',
    ]) {
      expect((await pedir(ruta, null)).tipo, ruta).toBe('login');
    }
  });

  it('con sesión de la empresa pedida pasa, y entrega la empresa VERIFICADA de la sesión', async () => {
    const { pedir, e } = await entorno('empresa-a');
    expect(await pedir('/e/empresa-a/panel')).toEqual({ tipo: 'pasar', empresa: 'empresa-a', cookies: [] });
    expect(e.llamadas).toEqual(['GET API/me']);
  });

  it('la identidad de la sesión se consulta una vez (no en cada página)', async () => {
    const { pedir, e } = await entorno('empresa-a');
    await pedir('/e/empresa-a/panel');
    await pedir('/e/empresa-a/requisitos');
    await pedir('/e/empresa-a/panel');
    expect(e.llamadas.filter((l) => l === 'GET API/me')).toHaveLength(1);
  });

  it('H2.3 sesión de A pidiendo la pantalla de B: no encontrado, IDÉNTICO a una empresa que no existe, sin datos ni marca', async () => {
    const { pedir } = await entorno('empresa-a');
    const deB = await pedir('/e/empresa-b/panel');
    const inexistente = await pedir('/e/empresa-zzz/panel');
    expect(deB).toEqual({ tipo: 'no_encontrado', cookies: [] });
    expect(inexistente).toEqual(deB);
    expect(await pedir('/e/empresa-b/requisitos/algun-id')).toEqual(deB);
  });

  it('la comparación es exacta: un prefijo (o una empresa más larga) de la de la sesión NO es la misma empresa', async () => {
    const { pedir } = await entorno('empresa-a');
    for (const slug of ['e', 'empresa', 'empresa-', 'empresa-a1', 'empresa-a-x']) {
      expect(await pedir(`/e/${slug}/panel`), slug).toEqual({ tipo: 'no_encontrado', cookies: [] });
    }
  });

  it('un 404 por otra empresa conserva la cookie rotada (no se pierde la renovación)', async () => {
    const reloj = { t: AHORA };
    const { pedir } = await entorno('empresa-a', reloj);
    reloj.t = new Date(AHORA.getTime() + 290_000);
    const d = await pedir('/e/empresa-b/panel');
    expect(d.tipo).toBe('no_encontrado');
    expect(d.tipo === 'no_encontrado' && d.cookies).toHaveLength(1);
    expect(d.tipo === 'no_encontrado' && d.cookies[0]).toMatch(new RegExp(`^${config.nombreCookieSesion}=`));
  });

  it('la identidad en caché dura 5 minutos: pasado ese tiempo se vuelve a confirmar con la API', async () => {
    const reloj = { t: AHORA };
    const { pedir, e } = await entorno('empresa-a', reloj);
    await pedir('/e/empresa-a/panel');
    reloj.t = new Date(AHORA.getTime() + 4 * 60_000);
    await pedir('/e/empresa-a/panel');
    expect(e.llamadas.filter((l) => l === 'GET API/me')).toHaveLength(1);
    reloj.t = new Date(AHORA.getTime() + 6 * 60_000);
    await pedir('/e/empresa-a/panel');
    expect(e.llamadas.filter((l) => l === 'GET API/me')).toHaveLength(2);
  });

  it('un identificador de empresa mal formado en la dirección es no encontrado (con sesión) o ingresar (sin sesión)', async () => {
    const { pedir } = await entorno('empresa-a');
    for (const slug of ['EMPRESA-A', 'a..b', 'a'.repeat(33), 'empresa_a', 'empresa%2Da', 'x y']) {
      expect(await pedir(`/e/${slug}/panel`), slug).toEqual({ tipo: 'no_encontrado', cookies: [] });
      expect((await pedir(`/e/${slug}/panel`, null)).tipo, slug).toBe('login');
    }
  });

  it('rutas que no son /e/…: pasan sin pedir sesión', async () => {
    const { pedir, e } = await entorno();
    for (const ruta of ['/', '/auth/login', '/auth/sesion', '/favicon.ico', '/empresa/x']) {
      expect(await pedir(ruta, null), ruta).toEqual({ tipo: 'pasar', empresa: null, cookies: [] });
    }
    expect(e.llamadas).toEqual([]);
  });

  it('cookie alterada o basura: va a ingresar y borra la cookie', async () => {
    const { pedir, cookie } = await entorno();
    const alterada = `${cookie.slice(0, -4)}AAAA`;
    for (const c of [alterada, `${config.nombreCookieSesion}=basura`]) {
      const d = await pedir('/e/empresa-a/panel', c);
      expect(d.tipo).toBe('login');
      expect(d.tipo === 'login' && d.cookies[0]).toMatch(/Max-Age=0/);
    }
  });

  it('H1.5 sesión inactiva (Keycloak responde invalid_grant al renovar): va a ingresar, borra la cookie y la memoria', async () => {
    const reloj = { t: AHORA };
    const { pedir, e, almacen } = await entorno('empresa-a', reloj);
    e.keycloak = 'invalid_grant';
    reloj.t = new Date(AHORA.getTime() + 31 * 60_000); // 31 minutos sin actividad: el access token ya venció
    const d = await pedir('/e/empresa-a/panel');
    expect(d).toMatchObject({ tipo: 'login', retorno: '/e/empresa-a/panel' });
    expect(d.tipo === 'login' && d.cookies[0]).toMatch(/Max-Age=0/);
    expect(almacen.obtener(SID)).toBeUndefined();
  });

  it('si Keycloak no responde: no disponible, SIN cerrar la sesión ni borrar la cookie', async () => {
    const reloj = { t: AHORA };
    const { pedir, e, almacen } = await entorno('empresa-a', reloj);
    e.keycloak = 'caido';
    reloj.t = new Date(AHORA.getTime() + 290_000);
    expect(await pedir('/e/empresa-a/panel')).toEqual({ tipo: 'no_disponible' });
    expect(almacen.obtener(SID)).toBeDefined();
  });

  it('si la renovación rotó el refresh, la respuesta lleva la cookie nueva', async () => {
    const reloj = { t: AHORA };
    const { pedir } = await entorno('empresa-a', reloj);
    reloj.t = new Date(AHORA.getTime() + 290_000);
    const d = await pedir('/e/empresa-a/panel');
    expect(d.tipo).toBe('pasar');
    expect(d.tipo === 'pasar' && d.cookies).toHaveLength(1);
    expect(d.tipo === 'pasar' && d.cookies[0]).toMatch(new RegExp(`^${config.nombreCookieSesion}=`));
  });

  it('la API rechaza el token en /me (401: cuenta desactivada o movida): va a ingresar y borra todo', async () => {
    const { pedir, e, almacen } = await entorno('empresa-a');
    e.me.estado = 401;
    const d = await pedir('/e/empresa-a/panel');
    expect(d.tipo).toBe('login');
    expect(d.tipo === 'login' && d.cookies[0]).toMatch(/Max-Age=0/);
    expect(almacen.obtener(SID)).toBeUndefined();
  });

  it('la API falla en /me (500, 429 o sin respuesta): no disponible, sin cerrar la sesión', async () => {
    for (const falla of [{ estado: 500 }, { estado: 429 }, { estado: 200, lanza: true }]) {
      const { pedir, e, almacen } = await entorno('empresa-a');
      e.me = { ...e.me, ...falla };
      expect(await pedir('/e/empresa-a/panel'), JSON.stringify(falla)).toEqual({ tipo: 'no_disponible' });
      expect(almacen.obtener(SID)).toBeDefined();
    }
  });

  it('la API devuelve un slug raro en /me: no se acepta (no disponible)', async () => {
    const { pedir, e } = await entorno('empresa-a');
    e.me.slug = '../../otra';
    expect(await pedir('/e/empresa-a/panel')).toEqual({ tipo: 'no_disponible' });
  });

  it('H1.4 después de cerrar sesión, la cookie anterior ya no abre nada (el refresh está revocado)', async () => {
    const { pedir, svc, cookie } = await entorno('empresa-a');
    expect((await pedir('/e/empresa-a/panel')).tipo).toBe('pasar');
    await svc.cerrar(
      new Request('http://localhost:3000/auth/logout', {
        method: 'POST',
        headers: { cookie, origin: 'http://localhost:3000' },
      }),
    );
    const d = await pedir('/e/empresa-a/panel', cookie);
    expect(d.tipo).toBe('login');
  });

  it('dos personas de empresas distintas en la misma instancia no se mezclan (identidad por sesión)', async () => {
    const A = await entorno('empresa-a');
    const { e, fetchFn } = montar('empresa-b');
    const almacen = A.almacen; // misma memoria compartida
    const depsB = { config, ahora: () => AHORA, fetchFn, almacen };
    const svcB = crearServicioSesion(depsB);
    const rB = await svcB.iniciar({
      ...callbackOk(),
      identidad: { sub: '5eed0003-0000-4000-8000-0000000000b1', sid: 'sesion-kc-B' },
    });
    const cookieB = rB.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!
      .split(';')[0]!;
    e.llamadas.length = 0;
    const comoB = (ruta: string) =>
      decidirAcceso(new Request(`http://localhost:3000${ruta}`, { headers: { cookie: cookieB } }), depsB);
    expect((await comoB('/e/empresa-b/panel')).tipo).toBe('pasar');
    expect((await comoB('/e/empresa-a/panel')).tipo).toBe('no_encontrado');
    expect((await A.pedir('/e/empresa-a/panel')).tipo).toBe('pasar');
    expect((await A.pedir('/e/empresa-b/panel')).tipo).toBe('no_encontrado');
  });
});
