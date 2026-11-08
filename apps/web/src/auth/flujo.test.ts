// @vitest-environment node
import { createHash, randomBytes } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { leerConfiguracion } from './configuracion';
import { completarCallback, iniciarLogin, respuestaDeFallo } from './flujo';
import { abrirSello } from './sellado';

// Generado en cada ejecución: ningún secreto (ni de mentira) queda escrito en el código.
const SECRETO = randomBytes(18).toString('base64url');

const AHORA = new Date('2026-11-08T10:00:00Z');
const EMISOR = 'http://127.0.0.1:8080/realms/sigiso';
const SUB = '5eed0001-0000-4000-8000-0000000000a1';
const entorno = {
  OIDC_CLIENT_SECRET: SECRETO,
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
};
const config = leerConfiguracion(entorno);

let privada: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;
let otraPrivada: CryptoKey;

beforeAll(async () => {
  const par = await generateKeyPair('RS256');
  privada = par.privateKey;
  const publica = { ...(await exportJWK(par.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' } as JWK;
  jwks = createLocalJWKSet({ keys: [publica] });
  otraPrivada = (await generateKeyPair('RS256')).privateKey;
});

const firmar = (
  cambios: Record<string, unknown> = {},
  opciones: { clave?: CryptoKey; alg?: string; expira?: number } = {},
) =>
  new SignJWT({ nonce: 'N', sid: 'sesion-1', ...cambios })
    .setProtectedHeader({ alg: opciones.alg ?? 'RS256', kid: 'k1' })
    .setIssuer(EMISOR)
    .setAudience('sigiso-web')
    .setSubject(SUB)
    .setIssuedAt(Math.floor(AHORA.getTime() / 1000))
    .setExpirationTime(opciones.expira ?? Math.floor(AHORA.getTime() / 1000) + 300)
    .sign(opciones.clave ?? privada);

const dependencias = (fetchFn: typeof fetch = vi.fn() as never) => ({
  config,
  ahora: () => AHORA,
  fetchFn,
  claves: jwks,
});

const cookieDe = (respuesta: Response): string => {
  const sc = respuesta.headers.getSetCookie()[0]!;
  return sc.split(';')[0]!.slice(config.nombreCookie.length + 1);
};

const callback = (cookie: string | null, consulta: Record<string, string>) =>
  new Request(`${config.redirectUri}?${new URLSearchParams(consulta)}`, {
    headers: cookie === null ? {} : { cookie: `${config.nombreCookie}=${cookie}` },
  });

const tokenOk = async (nonce = 'N') =>
  new Response(
    JSON.stringify({
      token_type: 'Bearer',
      access_token: 'acceso.jwt',
      refresh_token: 'refresco.jwt',
      id_token: await firmar({ nonce }),
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );

// Inicia el ingreso y devuelve lo necesario para simular el regreso desde Keycloak.
const iniciar = async (retorno?: string) => {
  const r = await iniciarLogin(
    new Request(
      `http://localhost:3000/auth/login${retorno === undefined ? '' : `?retorno=${encodeURIComponent(retorno)}`}`,
    ),
    dependencias(),
  );
  const destino = new URL(r.headers.get('location')!);
  const cookie = cookieDe(r);
  const transaccion = await abrirSello<{ s: string; n: string; v: string; r: string }>(cookie, {
    claves: config.clavesSellado,
    ahora: AHORA,
  });
  return { r, destino, cookie, transaccion };
};

describe('iniciarLogin', () => {
  it('redirige a Keycloak con código + PKCE S256, state, nonce y el cliente; nunca envía el secreto', async () => {
    const { r, destino, transaccion } = await iniciar('/e/empresa-a/panel');
    expect(r.status).toBe(302);
    expect(`${destino.origin}${destino.pathname}`).toBe(`${EMISOR}/protocol/openid-connect/auth`);
    const p = destino.searchParams;
    expect(p.get('response_type')).toBe('code');
    expect(p.get('client_id')).toBe('sigiso-web');
    expect(p.get('redirect_uri')).toBe('http://localhost:3000/auth/callback');
    expect(p.get('scope')).toBe('openid');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('state')).toBe(transaccion.s);
    expect(p.get('nonce')).toBe(transaccion.n);
    expect(p.get('code_challenge')).toBe(createHash('sha256').update(transaccion.v).digest('base64url'));
    expect(destino.toString()).not.toContain(SECRETO);
    expect(destino.toString()).not.toContain(transaccion.v);
    expect(transaccion.r).toBe('/e/empresa-a/panel');
  });

  it('state, nonce y verificador son largos y distintos en cada ingreso', async () => {
    const a = await iniciar();
    const b = await iniciar();
    for (const campo of ['s', 'n', 'v'] as const) {
      expect(a.transaccion[campo].length).toBeGreaterThanOrEqual(22);
      expect(a.transaccion[campo]).not.toBe(b.transaccion[campo]);
    }
    expect(a.transaccion.v.length).toBeGreaterThanOrEqual(43);
  });

  it('la cookie de la transacción: sellada, httpOnly, SameSite=Lax, Path=/, 300 s, sin Domain', async () => {
    const { r } = await iniciar();
    const sc = r.headers.getSetCookie();
    expect(sc).toHaveLength(1);
    const texto = sc[0]!;
    expect(texto.startsWith(`${config.nombreCookie}=`)).toBe(true);
    expect(texto).toMatch(/;\s*HttpOnly/i);
    expect(texto).toMatch(/;\s*SameSite=Lax/i);
    expect(texto).toMatch(/;\s*Path=\//i);
    expect(texto).toMatch(/;\s*Max-Age=300/i);
    expect(texto).not.toMatch(/Domain=/i);
    expect(texto).not.toMatch(/;\s*Secure/i); // desarrollo local por http
  });

  it('con HTTPS la cookie es Secure y se llama __Host-…', async () => {
    const seguro = leerConfiguracion({ ...entorno, OIDC_REDIRECT_URI: 'https://sig.ejemplo.ec/auth/callback' });
    const r = await iniciarLogin(new Request('https://sig.ejemplo.ec/auth/login'), {
      ...dependencias(),
      config: seguro,
    });
    const texto = r.headers.getSetCookie()[0]!;
    expect(texto.startsWith('__Host-sig-oidc=')).toBe(true);
    expect(texto).toMatch(/;\s*Secure/i);
  });

  it('no se guarda en caché y un retorno peligroso se cambia por la ruta por omisión', async () => {
    const { r, transaccion } = await iniciar('//evil.example');
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    expect(transaccion.r).toBe('/');
    expect((await iniciar('https://evil.example/x')).transaccion.r).toBe('/');
    expect((await iniciar()).transaccion.r).toBe('/');
  });
});

describe('completarCallback — camino feliz', () => {
  it('valida iss y state, intercambia el código con el verificador PKCE y el secreto, y comprueba el id_token', async () => {
    const { transaccion, cookie } = await iniciar('/e/empresa-a/panel');
    const fetchFn = vi.fn(async () => tokenOk(transaccion.n));
    const resultado = await completarCallback(
      callback(cookie, { code: 'codigo-1', state: transaccion.s, iss: EMISOR }),
      dependencias(fetchFn as never),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.retorno).toBe('/e/empresa-a/panel');
    expect(resultado.identidad).toEqual({ sub: SUB, sid: 'sesion-1' });
    expect(resultado.tokens).toEqual({ acceso: 'acceso.jwt', refresco: 'refresco.jwt', id: expect.any(String) });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${EMISOR}/protocol/openid-connect/token`);
    expect(init.method).toBe('POST');
    const cuerpo = new URLSearchParams(init.body as string);
    expect(Object.fromEntries(cuerpo)).toEqual({
      grant_type: 'authorization_code',
      code: 'codigo-1',
      redirect_uri: 'http://localhost:3000/auth/callback',
      client_id: 'sigiso-web',
      client_secret: SECRETO,
      code_verifier: transaccion.v,
    });
  });

  it('borra la cookie de la transacción (un solo uso)', async () => {
    const { transaccion, cookie } = await iniciar();
    const resultado = await completarCallback(
      callback(cookie, { code: 'c', state: transaccion.s, iss: EMISOR }),
      dependencias((async () => tokenOk(transaccion.n)) as never),
    );
    expect(resultado.limpiarCookie).toMatch(new RegExp(`^${config.nombreCookie}=;`));
    expect(resultado.limpiarCookie).toMatch(/Max-Age=0/i);
    expect(resultado.limpiarCookie).toMatch(/HttpOnly/i);
    expect(resultado.limpiarCookie).toMatch(/Path=\//i);
  });
});

describe('completarCallback — rechazos (ninguno llega a pedir tokens salvo los de después del intercambio)', () => {
  const rechazo = async (
    preparar: (t: Awaited<ReturnType<typeof iniciar>>) => { cookie: string | null; consulta: Record<string, string> },
    motivo: string,
    intercambio = false,
  ) => {
    const t = await iniciar();
    const { cookie, consulta } = preparar(t);
    const fetchFn = vi.fn(async () => tokenOk(t.transaccion.n));
    const r = await completarCallback(callback(cookie, consulta), dependencias(fetchFn as never));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe(motivo);
    expect(r.limpiarCookie).toMatch(/Max-Age=0/i);
    if (!intercambio) expect(fetchFn).not.toHaveBeenCalled();
  };

  it('state que no coincide', () =>
    rechazo(
      (t) => ({ cookie: t.cookie, consulta: { code: 'c', state: 'otro-estado-distinto-aaaaaa', iss: EMISOR } }),
      'state_invalido',
    ));
  it('state ausente', () =>
    rechazo((t) => ({ cookie: t.cookie, consulta: { code: 'c', iss: EMISOR } }), 'state_invalido'));
  it('state de otro ingreso (el de una transacción anterior)', async () => {
    const vieja = await iniciar();
    await rechazo(
      (t) => ({ cookie: t.cookie, consulta: { code: 'c', state: vieja.transaccion.s, iss: EMISOR } }),
      'state_invalido',
    );
  });
  it('sin cookie de transacción', () =>
    rechazo(
      (t) => ({ cookie: null, consulta: { code: 'c', state: t.transaccion.s, iss: EMISOR } }),
      'sin_transaccion',
    ));
  it('cookie alterada', () =>
    rechazo(
      (t) => ({ cookie: `${t.cookie.slice(0, -4)}AAAA`, consulta: { code: 'c', state: t.transaccion.s, iss: EMISOR } }),
      'transaccion_invalida',
    ));
  it('cookie de basura', () =>
    rechazo(
      (t) => ({ cookie: 'basura', consulta: { code: 'c', state: t.transaccion.s, iss: EMISOR } }),
      'transaccion_invalida',
    ));
  it('iss ausente (confusión de emisor, RFC 9207)', () =>
    rechazo((t) => ({ cookie: t.cookie, consulta: { code: 'c', state: t.transaccion.s } }), 'emisor_invalido'));
  it('iss de otro emisor', () =>
    rechazo(
      (t) => ({
        cookie: t.cookie,
        consulta: { code: 'c', state: t.transaccion.s, iss: 'https://evil.example/realms/sigiso' },
      }),
      'emisor_invalido',
    ));
  it('el proveedor devolvió un error', () =>
    rechazo(
      (t) => ({ cookie: t.cookie, consulta: { error: 'access_denied', state: t.transaccion.s, iss: EMISOR } }),
      'rechazado_por_proveedor',
    ));
  it('código ausente', () =>
    rechazo((t) => ({ cookie: t.cookie, consulta: { state: t.transaccion.s, iss: EMISOR } }), 'codigo_invalido'));
  it('código desmesurado', () =>
    rechazo(
      (t) => ({ cookie: t.cookie, consulta: { code: 'a'.repeat(3000), state: t.transaccion.s, iss: EMISOR } }),
      'codigo_invalido',
    ));
  it('parámetros repetidos (state dos veces)', async () => {
    const t = await iniciar();
    const url = `${config.redirectUri}?code=c&state=${t.transaccion.s}&state=otro&iss=${encodeURIComponent(EMISOR)}`;
    const fetchFn = vi.fn();
    const r = await completarCallback(
      new Request(url, { headers: { cookie: `${config.nombreCookie}=${t.cookie}` } }),
      dependencias(fetchFn as never),
    );
    expect(r).toMatchObject({ ok: false, motivo: 'state_invalido' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('transacción vencida (más de 5 minutos)', async () => {
    const t = await iniciar();
    const tarde = { ...dependencias(vi.fn() as never), ahora: () => new Date(AHORA.getTime() + 301_000) };
    const r = await completarCallback(callback(t.cookie, { code: 'c', state: t.transaccion.s, iss: EMISOR }), tarde);
    expect(r).toMatchObject({ ok: false, motivo: 'transaccion_vencida' });
  });
});

describe('completarCallback — intercambio de tokens y verificación del id_token', () => {
  const con = async (respuesta: () => Promise<Response> | Response, ajustes: { nonceEsperado?: boolean } = {}) => {
    const t = await iniciar();
    void ajustes;
    return completarCallback(
      callback(t.cookie, { code: 'c', state: t.transaccion.s, iss: EMISOR }),
      dependencias(vi.fn(async () => respuesta()) as never),
    );
  };
  const respuestaJson = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

  it('el endpoint de tokens falla, responde algo que no es JSON o la red se cae: intercambio_fallido', async () => {
    expect(await con(() => respuestaJson({ error: 'invalid_grant' }, 400))).toMatchObject({
      ok: false,
      motivo: 'intercambio_fallido',
    });
    expect(await con(() => respuestaJson({}, 500))).toMatchObject({ ok: false, motivo: 'intercambio_fallido' });
    expect(await con(() => new Response('<html>', { status: 200 }))).toMatchObject({
      ok: false,
      motivo: 'intercambio_fallido',
    });
    expect(await con(() => Promise.reject(new Error('ECONNREFUSED')))).toMatchObject({
      ok: false,
      motivo: 'intercambio_fallido',
    });
  });

  it('faltan tokens o el tipo no es Bearer: intercambio_fallido', async () => {
    const id = await firmar({ nonce: 'x' });
    expect(
      await con(() => respuestaJson({ token_type: 'Bearer', access_token: 'a', refresh_token: 'r' })),
    ).toMatchObject({ ok: false, motivo: 'intercambio_fallido' });
    expect(await con(() => respuestaJson({ token_type: 'Bearer', refresh_token: 'r', id_token: id }))).toMatchObject({
      ok: false,
      motivo: 'intercambio_fallido',
    });
    expect(await con(() => respuestaJson({ token_type: 'Bearer', access_token: 'a', id_token: id }))).toMatchObject({
      ok: false,
      motivo: 'intercambio_fallido',
    });
    expect(
      await con(() => respuestaJson({ token_type: 'mac', access_token: 'a', refresh_token: 'r', id_token: id })),
    ).toMatchObject({ ok: false, motivo: 'intercambio_fallido' });
  });

  const conIdToken = async (idToken: () => Promise<string>) => {
    const t = await iniciar();
    const idt = await idToken();
    return completarCallback(
      callback(t.cookie, { code: 'c', state: t.transaccion.s, iss: EMISOR }),
      dependencias(
        vi.fn(async () =>
          respuestaJson({ token_type: 'Bearer', access_token: 'a', refresh_token: 'r', id_token: idt }),
        ) as never,
      ),
    ).then((r) => ({ r, nonceReal: t.transaccion.n }));
  };

  it('nonce que no es el enviado: id_token_invalido', async () => {
    const { r } = await conIdToken(() => firmar({ nonce: 'otro-nonce' }));
    expect(r).toMatchObject({ ok: false, motivo: 'id_token_invalido' });
  });
  it('id_token sin nonce: id_token_invalido', async () => {
    const { r } = await conIdToken(() => firmar({ nonce: undefined }));
    expect(r).toMatchObject({ ok: false, motivo: 'id_token_invalido' });
  });
  it('firmado con otra clave: id_token_invalido', async () => {
    const t = await iniciar();
    const falso = await firmar({ nonce: t.transaccion.n }, { clave: otraPrivada });
    const r = await completarCallback(
      callback(t.cookie, { code: 'c', state: t.transaccion.s, iss: EMISOR }),
      dependencias(
        vi.fn(async () =>
          respuestaJson({ token_type: 'Bearer', access_token: 'a', refresh_token: 'r', id_token: falso }),
        ) as never,
      ),
    );
    expect(r).toMatchObject({ ok: false, motivo: 'id_token_invalido' });
  });
  it('vencido, de otra audiencia, de otro emisor o con algoritmo none: id_token_invalido', async () => {
    const t = await iniciar();
    const exito = (idt: string) =>
      completarCallback(
        callback(t.cookie, { code: 'c', state: t.transaccion.s, iss: EMISOR }),
        dependencias(
          vi.fn(async () =>
            respuestaJson({ token_type: 'Bearer', access_token: 'a', refresh_token: 'r', id_token: idt }),
          ) as never,
        ),
      );
    const vencido = await firmar({ nonce: t.transaccion.n }, { expira: Math.floor(AHORA.getTime() / 1000) - 3600 });
    expect(await exito(vencido)).toMatchObject({ ok: false, motivo: 'id_token_invalido' });
    const otraAud = await new SignJWT({ nonce: t.transaccion.n })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(EMISOR)
      .setAudience('otro-cliente')
      .setSubject(SUB)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privada);
    expect(await exito(otraAud)).toMatchObject({ ok: false, motivo: 'id_token_invalido' });
    const otroEmisor = await new SignJWT({ nonce: t.transaccion.n })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://evil.example')
      .setAudience('sigiso-web')
      .setSubject(SUB)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privada);
    expect(await exito(otroEmisor)).toMatchObject({ ok: false, motivo: 'id_token_invalido' });
    const cuerpo = Buffer.from(
      JSON.stringify({ iss: EMISOR, aud: 'sigiso-web', sub: SUB, nonce: t.transaccion.n, exp: 9999999999, iat: 1 }),
    ).toString('base64url');
    const sinFirma = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${cuerpo}.`;
    expect(await exito(sinFirma)).toMatchObject({ ok: false, motivo: 'id_token_invalido' });
  });
  it('sub que no es un UUID, o sid con formato raro: id_token_invalido', async () => {
    const t = await iniciar();
    const exito = (idt: string) =>
      completarCallback(
        callback(t.cookie, { code: 'c', state: t.transaccion.s, iss: EMISOR }),
        dependencias(
          vi.fn(async () =>
            respuestaJson({ token_type: 'Bearer', access_token: 'a', refresh_token: 'r', id_token: idt }),
          ) as never,
        ),
      );
    const malSub = await new SignJWT({ nonce: t.transaccion.n })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(EMISOR)
      .setAudience('sigiso-web')
      .setSubject('no-es-uuid')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privada);
    expect(await exito(malSub)).toMatchObject({ ok: false, motivo: 'id_token_invalido' });
    expect(await exito(await firmar({ nonce: t.transaccion.n, sid: 'con espacios y <raros>' }))).toMatchObject({
      ok: false,
      motivo: 'id_token_invalido',
    });
  });
});

describe('respuestaDeFallo', () => {
  it('redirige (303) a la pantalla de ingreso con un código GENÉRICO y borra la cookie; no revela el motivo interno', () => {
    for (const motivo of [
      'state_invalido',
      'emisor_invalido',
      'id_token_invalido',
      'intercambio_fallido',
      'sin_transaccion',
    ] as const) {
      const r = respuestaDeFallo({ ok: false, motivo, limpiarCookie: 'sig-oidc=; Max-Age=0; Path=/' }, config);
      expect(r.status).toBe(303);
      expect(r.headers.get('location')).toBe('http://localhost:3000/?error=ingreso_invalido');
      expect(r.headers.getSetCookie()).toEqual(['sig-oidc=; Max-Age=0; Path=/']);
      expect(r.headers.get('cache-control')).toMatch(/no-store/);
    }
  });
  it('si la persona canceló en el proveedor, el código es ingreso_cancelado', () => {
    const r = respuestaDeFallo(
      { ok: false, motivo: 'rechazado_por_proveedor', limpiarCookie: 'x=; Max-Age=0' },
      config,
    );
    expect(r.headers.get('location')).toBe('http://localhost:3000/?error=ingreso_cancelado');
  });
});
