// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { leerConfiguracion } from './configuracion';
import { crearManejadorCallback, crearManejadorLogin } from './manejadores';
import type { DependenciasFlujo } from './flujo';

// Generado en cada ejecución: ningún secreto (ni de mentira) queda escrito en el código.
const SECRETO = randomBytes(18).toString('base64url');

const EMISOR = 'http://127.0.0.1:8080/realms/sigiso';
const SUB = '5eed0001-0000-4000-8000-0000000000a1';
const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: SECRETO,
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
});

const armar = async (
  fetchFn: typeof fetch,
): Promise<DependenciasFlujo & { firmar: (nonce: string) => Promise<string> }> => {
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
  return { config, ahora: () => new Date(), fetchFn, claves: jwks, firmar };
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

  it('callback con ingreso válido: hasta la tarea 10.3 NO hay sesión (501), la cookie se borra y ningún token sale en la respuesta', async () => {
    const base = await armar(vi.fn() as never);
    // Inicia de verdad para obtener una transacción coherente.
    const inicio = await crearManejadorLogin(() => base, vi.fn())(new Request('http://localhost:3000/auth/login'));
    const destino = new URL(inicio.headers.get('location')!);
    const cookie = inicio.headers.getSetCookie()[0]!.split(';')[0]!;
    const idToken = await base.firmar(destino.searchParams.get('nonce')!);
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            token_type: 'Bearer',
            access_token: 'ACCESO-SECRETO',
            refresh_token: 'REFRESCO-SECRETO',
            id_token: idToken,
          }),
          { status: 200 },
        ),
    );
    const deps = { ...base, fetchFn: fetchFn as never };
    const r = await crearManejadorCallback(
      () => deps,
      vi.fn(),
    )(
      new Request(
        `${config.redirectUri}?code=c&state=${destino.searchParams.get('state')}&iss=${encodeURIComponent(EMISOR)}`,
        { headers: { cookie } },
      ),
    );
    expect(r.status).toBe(501);
    expect(r.headers.getSetCookie()).toHaveLength(1);
    expect(r.headers.getSetCookie()[0]).toMatch(/Max-Age=0/);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    const cuerpo = await r.text();
    for (const secreto of ['ACCESO-SECRETO', 'REFRESCO-SECRETO', idToken]) expect(cuerpo).not.toContain(secreto);
    expect(JSON.stringify([...r.headers])).not.toContain('ACCESO-SECRETO');
  });
});
