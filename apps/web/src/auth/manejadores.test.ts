// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { leerConfiguracion } from './configuracion';
import { AlmacenAcceso } from './almacen-acceso';
import { crearManejadorCallback, crearManejadorLogin, crearManejadorLogout, crearManejadorSesion } from './manejadores';
import type { DependenciasFlujo } from './flujo';
import type { DependenciasSesion } from './sesion';

type Deps = DependenciasFlujo & Pick<DependenciasSesion, 'almacen'>;

// Generado en cada ejecución: ningún secreto (ni de mentira) queda escrito en el código.
const SECRETO = randomBytes(18).toString('base64url');

const EMISOR = 'http://127.0.0.1:8080/realms/sigiso';
const SUB = '5eed0001-0000-4000-8000-0000000000a1';
const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: SECRETO,
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
});

const armar = async (fetchFn: typeof fetch): Promise<Deps & { firmar: (nonce: string) => Promise<string> }> => {
  const par = await generateKeyPair('RS256');
  const jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(par.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }],
  });
  const firmar = (nonce: string) =>
    new SignJWT({ nonce, sid: 'sesion-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(EMISOR)
      .setAudience('sigiso-web')
      .setSubject(SUB)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(par.privateKey);
  return { config, ahora: () => new Date(), fetchFn, claves: jwks, almacen: new AlmacenAcceso(), firmar };
};

describe('manejadores de ruta', () => {
  it('login: si falta configuración responde 500 genérico, sin detalles ni secretos, y no inicia nada', async () => {
    const registrar = vi.fn();
    const login = crearManejadorLogin(() => {
      throw new Error('Falta OIDC_CLIENT_SECRET (pnpm keycloak:realm lo genera)');
    }, registrar);
    const r = await login(new Request('http://localhost:3000/auth/login'));
    expect(r.status).toBe(500);
    expect(r.headers.getSetCookie()).toEqual([]);
    const texto = await r.text();
    expect(texto).not.toMatch(/OIDC_CLIENT_SECRET|Falta/);
    expect(registrar).toHaveBeenCalledWith(expect.stringContaining('OIDC_CLIENT_SECRET'));
  });

  it('login: redirige a Keycloak', async () => {
    const deps = await armar(vi.fn() as never);
    const r = await crearManejadorLogin(
      () => deps,
      vi.fn(),
    )(new Request('http://localhost:3000/auth/login?retorno=/e/a/panel'));
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toContain(`${EMISOR}/protocol/openid-connect/auth?`);
  });

  it('callback con fallo: 303 al inicio con código genérico y la cookie borrada', async () => {
    const deps = await armar(vi.fn() as never);
    const r = await crearManejadorCallback(
      () => deps,
      vi.fn(),
    )(new Request(`${config.redirectUri}?code=c&state=x&iss=${encodeURIComponent(EMISOR)}`));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://localhost:3000/?error=ingreso_invalido');
    expect(r.headers.getSetCookie()[0]).toMatch(/Max-Age=0/);
  });

  it('callback sin configuración: 500 genérico', async () => {
    const r = await crearManejadorCallback(() => {
      throw new Error('SESSION_SEALING_KEY falta');
    }, vi.fn())(new Request('http://localhost:3000/auth/callback'));
    expect(r.status).toBe(500);
    expect(await r.text()).not.toMatch(/SESSION_SEALING_KEY/);
  });

  // Ingreso completo contra un Keycloak y una API de mentira (la API responde `apiEstado` a /sesion/*).
  const ingresoCompleto = async (apiEstado = 204) => {
    const llamadas: string[] = [];
    const base = await armar(vi.fn() as never);
    const inicio = await crearManejadorLogin(
      () => base,
      vi.fn(),
    )(new Request('http://localhost:3000/auth/login?retorno=/e/empresa-a/panel'));
    const destino = new URL(inicio.headers.get('location')!);
    const cookie = inicio.headers.getSetCookie()[0]!.split(';')[0]!;
    const idToken = await base.firmar(destino.searchParams.get('nonce')!);
    const fetchFn = vi.fn(async (url: string) => {
      llamadas.push(url);
      if (url.includes('/sesion/')) return new Response(null, { status: apiEstado });
      if (url.endsWith('/token'))
        return new Response(
          JSON.stringify({
            token_type: 'Bearer',
            access_token: 'ACCESO-SECRETO',
            refresh_token: 'REFRESCO-SECRETO',
            id_token: idToken,
            expires_in: 300,
          }),
          { status: 200 },
        );
      return new Response(null, { status: 204 });
    });
    const deps = { ...base, fetchFn: fetchFn as never };
    const regreso = new Request(
      `${config.redirectUri}?code=c&state=${destino.searchParams.get('state')}&iss=${encodeURIComponent(EMISOR)}`,
      { headers: { cookie } },
    );
    return { deps, regreso, llamadas, idToken };
  };

  it('callback con ingreso válido: registra el inicio, emite la sesión y vuelve a la ruta pedida; ningún token sale en la respuesta', async () => {
    const { deps, regreso, llamadas, idToken } = await ingresoCompleto();
    const r = await crearManejadorCallback(() => deps, vi.fn())(regreso);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://localhost:3000/e/empresa-a/panel');
    expect(llamadas.some((u) => u.endsWith('/sesion/inicio'))).toBe(true);
    const cookies = r.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('sig-sesion='))).toBe(true);
    expect(cookies.some((c) => /^sig-oidc=;.*Max-Age=0/.test(c))).toBe(true);
    const visible = JSON.stringify([...r.headers]) + (await r.text());
    for (const secreto of ['ACCESO-SECRETO', 'REFRESCO-SECRETO', idToken]) expect(visible).not.toContain(secreto);
  });

  it('callback: si la API no registra el inicio, NO hay sesión y la persona vuelve al inicio con un error genérico', async () => {
    const { deps, regreso } = await ingresoCompleto(500);
    const r = await crearManejadorCallback(() => deps, vi.fn())(regreso);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://localhost:3000/?error=ingreso_no_disponible');
    expect(r.headers.getSetCookie().some((c) => c.startsWith('sig-sesion='))).toBe(false);
  });

  it('GET /auth/sesion: sin sesión 401; con sesión 200 sin datos sensibles; tras el cierre vuelve a 401', async () => {
    const { deps, regreso } = await ingresoCompleto();
    const entrada = await crearManejadorCallback(() => deps, vi.fn())(regreso);
    const cookie = entrada.headers
      .getSetCookie()
      .find((c) => c.startsWith('sig-sesion='))!
      .split(';')[0]!;
    const sesion = crearManejadorSesion(() => deps, vi.fn());
    expect((await sesion(new Request('http://localhost:3000/auth/sesion'))).status).toBe(401);
    const ok = await sesion(new Request('http://localhost:3000/auth/sesion', { headers: { cookie } }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toMatch(/no-store/);
    const cuerpo = await ok.text();
    expect(JSON.parse(cuerpo)).toEqual({ autenticado: true });
    for (const secreto of ['ACCESO-SECRETO', 'REFRESCO-SECRETO']) expect(cuerpo).not.toContain(secreto);
  });

  // Sesión iniciada con el access token ya vencido en la memoria, para forzar la renovación en /auth/sesion.
  const sesionConTokenVencido = async (token: (url: string) => Response | Promise<Response>) => {
    const { deps, regreso } = await ingresoCompleto();
    const entrada = await crearManejadorCallback(() => deps, vi.fn())(regreso);
    const cookie = entrada.headers
      .getSetCookie()
      .find((c) => c.startsWith('sig-sesion='))!
      .split(';')[0]!;
    const previo = deps.almacen.obtener('sesion-1')!;
    deps.almacen.guardar('sesion-1', { ...previo, expiraEn: 0 });
    const base = deps.fetchFn;
    const conRenovacion = {
      ...deps,
      fetchFn: (async (url: string, init?: RequestInit) =>
        url.endsWith('/token') && !(init?.body as string).includes('authorization_code')
          ? token(url)
          : (base as never as typeof fetch)(url, init)) as never,
    };
    return { deps: conRenovacion, cookie };
  };

  it('GET /auth/sesion: si Keycloak dice invalid_grant responde 401 y borra la cookie', async () => {
    const { deps, cookie } = await sesionConTokenVencido(
      () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
    );
    const r = await crearManejadorSesion(
      () => deps,
      vi.fn(),
    )(new Request('http://localhost:3000/auth/sesion', { headers: { cookie } }));
    expect(r.status).toBe(401);
    expect(r.headers.getSetCookie()[0]).toMatch(/^sig-sesion=;.*Max-Age=0/);
  });

  it('GET /auth/sesion: si Keycloak no responde responde 503 y NO borra la cookie', async () => {
    const { deps, cookie } = await sesionConTokenVencido(() => {
      throw new Error('ECONNREFUSED');
    });
    const r = await crearManejadorSesion(
      () => deps,
      vi.fn(),
    )(new Request('http://localhost:3000/auth/sesion', { headers: { cookie } }));
    expect(r.status).toBe(503);
    expect(r.headers.getSetCookie()).toEqual([]);
  });

  it('GET /auth/sesion: tras renovar, reemite la cookie con el refresh nuevo', async () => {
    const { deps, cookie } = await sesionConTokenVencido(
      () =>
        new Response(
          JSON.stringify({
            token_type: 'Bearer',
            access_token: 'ACCESO-NUEVO',
            refresh_token: 'REFRESCO-NUEVO',
            expires_in: 300,
          }),
          { status: 200 },
        ),
    );
    const r = await crearManejadorSesion(
      () => deps,
      vi.fn(),
    )(new Request('http://localhost:3000/auth/sesion', { headers: { cookie } }));
    expect(r.status).toBe(200);
    const nueva = r.headers.getSetCookie().find((c) => c.startsWith('sig-sesion='))!;
    expect(nueva.split(';')[0]).not.toBe(cookie);
    expect(nueva).not.toMatch(/Max-Age|Expires/i);
  });

  it('POST /auth/logout: cierra y redirige a Keycloak; un GET o un POST de otro origen no cierran', async () => {
    const { deps, regreso } = await ingresoCompleto();
    const entrada = await crearManejadorCallback(() => deps, vi.fn())(regreso);
    const cookie = entrada.headers
      .getSetCookie()
      .find((c) => c.startsWith('sig-sesion='))!
      .split(';')[0]!;
    const logout = crearManejadorLogout(() => deps, vi.fn());
    const ajeno = await logout(
      new Request('http://localhost:3000/auth/logout', {
        method: 'POST',
        headers: { cookie, origin: 'https://evil.example' },
      }),
    );
    expect(ajeno.status).toBe(403);
    const get = await logout(new Request('http://localhost:3000/auth/logout', { headers: { cookie } }));
    expect(get.status).toBe(405);
    const ok = await logout(
      new Request('http://localhost:3000/auth/logout', {
        method: 'POST',
        headers: { cookie, origin: 'http://localhost:3000' },
      }),
    );
    expect(ok.status).toBe(303);
    expect(ok.headers.get('location')).toContain('/protocol/openid-connect/logout');
    expect(ok.headers.getSetCookie()[0]).toMatch(/^sig-sesion=;.*Max-Age=0/);
  });

  it('logout y sesión sin configuración: 500 genérico', async () => {
    const roto = () => {
      throw new Error('SESSION_SEALING_KEY falta');
    };
    for (const m of [crearManejadorLogout(roto, vi.fn()), crearManejadorSesion(roto, vi.fn())]) {
      const r = await m(
        new Request('http://localhost:3000/auth/x', { method: 'POST', headers: { origin: 'http://localhost:3000' } }),
      );
      expect(r.status).toBe(500);
      expect(await r.text()).not.toMatch(/SESSION_SEALING_KEY/);
    }
  });
});
