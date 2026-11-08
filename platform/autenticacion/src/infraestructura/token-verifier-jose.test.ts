import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, UnsecuredJWT, type JWK, type JWTPayload } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { TokenInvalidoError, VerificadorNoDisponibleError } from '../dominio/errores.js';
import type { TokenVerifierPort } from '../puertos/token-verifier.port.js';
import { TokenVerifierJose, type OpcionesVerificador } from './token-verifier-jose.adapter.js';

const EMISOR = 'http://127.0.0.1:8081/realms/sigiso';
const AUDIENCIA = 'sigiso-api';
const CLIENTE = 'sigiso-web';
const EMPRESA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USUARIO = '44444444-4444-4444-8444-444444444444';
const AHORA = new Date('2026-11-07T12:00:00.000Z');
const seg = (d: Date) => Math.floor(d.getTime() / 1000);

type Par = Awaited<ReturnType<typeof generateKeyPair>>;
let rsa: Par;
let otra: Par;
let ec: Par;
let ps: Par;
let jwks: ReturnType<typeof createLocalJWKSet>;

const jwkPublica = async (par: Par, kid: string, alg: string): Promise<JWK> => ({ ...(await exportJWK(par.publicKey)), kid, alg, use: 'sig' });

beforeAll(async () => {
  [rsa, otra, ec, ps] = await Promise.all([
    generateKeyPair('RS256'), generateKeyPair('RS256'), generateKeyPair('ES256'), generateKeyPair('PS256'),
  ]);
  jwks = createLocalJWKSet({ keys: [await jwkPublica(rsa, 'rsa-1', 'RS256'), await jwkPublica(ec, 'ec-1', 'ES256'), await jwkPublica(ps, 'ps-1', 'PS256')] });
});

const base = (): JWTPayload => ({
  iss: EMISOR, aud: AUDIENCIA, azp: CLIENTE, typ: 'Bearer', sub: USUARIO, empresa_id: EMPRESA_A, sid: 'sesion-1',
  iat: seg(AHORA) - 10, exp: seg(AHORA) + 290,
});

const firmar = (payload: JWTPayload, opciones: { par?: Par; alg?: string; kid?: string } = {}) => {
  const par = opciones.par ?? rsa;
  const alg = opciones.alg ?? 'RS256';
  const jwt = new SignJWT(payload).setProtectedHeader({ alg, kid: opciones.kid ?? 'rsa-1', typ: 'JWT' });
  return jwt.sign(par.privateKey);
};

const verificador = (cambios: Partial<OpcionesVerificador> = {}) =>
  new TokenVerifierJose({ emisor: EMISOR, audiencia: AUDIENCIA, clienteAutorizado: CLIENTE, claves: jwks, ahora: () => AHORA, ...cambios });

const motivo = async (token: unknown, v: TokenVerifierJose = verificador()): Promise<string> => {
  try {
    await v.verificar(token as string);
  } catch (e) {
    if (e instanceof TokenInvalidoError) return e.motivo;
    throw e;
  }
  return 'ACEPTADO';
};
const con = (cambio: Record<string, unknown>) => ({ ...base(), ...cambio }) as JWTPayload;
const sin = (...claves: string[]) => {
  const p: Record<string, unknown> = { ...base() };
  for (const c of claves) delete p[c];
  return p as JWTPayload;
};

describe('token válido', () => {
  it('devuelve la identidad: persona, empresa, sesión y vencimiento', async () => {
    const id = await verificador().verificar(await firmar(base()));
    expect(id).toEqual({ usuarioId: USUARIO, empresaId: EMPRESA_A, sesionId: 'sesion-1', expiraEn: new Date((seg(AHORA) + 290) * 1000) });
  });

  it('la empresa sale SOLO del claim empresa_id, normalizada a minúsculas', async () => {
    const id = await verificador().verificar(await firmar(con({ empresa_id: EMPRESA_B.toUpperCase() })));
    expect(id.empresaId).toBe(EMPRESA_B);
  });

  it('sin sid la sesión es null', async () => {
    expect((await verificador().verificar(await firmar(sin('sid')))).sesionId).toBeNull();
  });

  it('acepta ES256 y rotación de claves (varias claves publicadas)', async () => {
    expect(await motivo(await firmar(base(), { par: ec, alg: 'ES256', kid: 'ec-1' }))).toBe('ACEPTADO');
    expect(await motivo(await firmar(base(), { par: rsa, kid: 'rsa-1' }))).toBe('ACEPTADO');
  });

  it('encaja con el puerto', () => {
    const puerto: TokenVerifierPort = verificador();
    expect(typeof puerto.verificar).toBe('function');
  });

  it('dos personas de empresas distintas obtienen empresas distintas', async () => {
    const v = verificador();
    const a = await v.verificar(await firmar(base()));
    const b = await v.verificar(await firmar(con({ empresa_id: EMPRESA_B, sub: '55555555-5555-4555-8555-555555555555' })));
    expect([a.empresaId, b.empresaId]).toEqual([EMPRESA_A, EMPRESA_B]);
  });
});

describe('firma y algoritmo (ADR 027 §1)', () => {
  it('rechaza una firma hecha con otra clave', async () => {
    expect(await motivo(await firmar(base(), { par: otra }))).toBe('token_alterado');
  });

  it('rechaza un token con el payload alterado', async () => {
    const t = await firmar(base());
    const [h, , f] = t.split('.');
    const falso = Buffer.from(JSON.stringify({ ...base(), empresa_id: EMPRESA_B })).toString('base64url');
    expect(await motivo(`${h}.${falso}.${f}`)).toBe('token_alterado');
  });

  it('rechaza «alg: none» (token sin firma)', async () => {
    const sinFirma = new UnsecuredJWT(base()).encode();
    expect(await motivo(sinFirma)).toBe('token_alterado');
  });

  it('rechaza HS256 firmado con la clave PÚBLICA como secreto (confusión de algoritmo)', async () => {
    const spki = JSON.stringify(await exportJWK(rsa.publicKey));
    const hs = await new SignJWT(base()).setProtectedHeader({ alg: 'HS256', kid: 'rsa-1' }).sign(new TextEncoder().encode(spki));
    expect(await motivo(hs)).toBe('token_alterado');
  });

  it('rechaza un algoritmo fuera de la lista blanca (PS256), aunque la firma sea válida', async () => {
    expect(await motivo(await firmar(base(), { par: ps, alg: 'PS256', kid: 'ps-1' }))).toBe('token_alterado');
  });

  it('rechaza un kid desconocido', async () => {
    expect(await motivo(await firmar(base(), { kid: 'no-existe' }))).toBe('token_alterado');
  });

  it('rechaza un token sin kid cuando hay varias claves del mismo tipo… o con kid de otra clave', async () => {
    expect(await motivo(await firmar(base(), { par: otra, kid: 'rsa-1' }))).toBe('token_alterado');
  });
});

describe('reclamos obligatorios (emisor, audiencia, tipo, cliente)', () => {
  it.each([
    ['emisor distinto', { iss: 'http://otro.example/realms/x' }],
    ['audiencia de Keycloak por defecto (account)', { aud: 'account' }],
    ['audiencia de otra API', { aud: 'otra-api' }],
    ['audiencia en lista sin la propia', { aud: ['account', 'otra'] }],
    ['cliente autorizado distinto (azp)', { azp: 'otro-cliente' }],
    ['id_token usado como access token (typ=ID)', { typ: 'ID' }],
    ['refresh token (typ=Refresh)', { typ: 'Refresh' }],
  ])('rechaza %s', async (_n, cambio) => {
    expect(await motivo(await firmar(con(cambio)))).toBe('token_alterado');
  });

  it('acepta la audiencia propia dentro de una lista', async () => {
    expect(await motivo(await firmar(con({ aud: ['account', AUDIENCIA] })))).toBe('ACEPTADO');
  });

  it.each([['iss'], ['aud'], ['azp'], ['typ'], ['sub'], ['exp'], ['iat']])('rechaza un token sin %s', async (c) => {
    expect(await motivo(await firmar(sin(c)))).toBe('token_alterado');
  });
});

describe('vigencia', () => {
  it('un token vencido da token_vencido', async () => {
    expect(await motivo(await firmar(con({ iat: seg(AHORA) - 400, exp: seg(AHORA) - 100 })))).toBe('token_vencido');
  });

  it('tolera 30 s de desfase de reloj, no más', async () => {
    expect(await motivo(await firmar(con({ iat: seg(AHORA) - 300, exp: seg(AHORA) - 29 })))).toBe('ACEPTADO');
    expect(await motivo(await firmar(con({ iat: seg(AHORA) - 300, exp: seg(AHORA) - 31 })))).toBe('token_vencido');
  });

  it('un token que aún no es válido (nbf futuro) se rechaza', async () => {
    expect(await motivo(await firmar(con({ nbf: seg(AHORA) + 3600 })))).toBe('token_alterado');
  });

  it('rechaza un token con vida demasiado larga (más de 10 minutos): el access token es de 5', async () => {
    expect(await motivo(await firmar(con({ iat: seg(AHORA) - 10, exp: seg(AHORA) + 3600 })))).toBe('token_alterado');
    expect(await motivo(await firmar(con({ iat: seg(AHORA) - 10, exp: seg(AHORA) - 10 + 600 })))).toBe('ACEPTADO');
  });

  it('un token emitido en el futuro se rechaza', async () => {
    expect(await motivo(await firmar(con({ iat: seg(AHORA) + 3600, exp: seg(AHORA) + 3900 })))).toBe('token_alterado');
  });
});

describe('persona y empresa del token', () => {
  it.each([
    ['sin empresa_id', sin('empresa_id')],
    ['empresa_id vacío', con({ empresa_id: '' })],
    ['empresa_id que no es UUID', con({ empresa_id: 'empresa-a' })],
    ['empresa_id con llaves', con({ empresa_id: `{${EMPRESA_A}}` })],
    ['empresa_id nulo', con({ empresa_id: '00000000-0000-0000-0000-000000000000' })],
    ['empresa_id numérico', con({ empresa_id: 7 })],
    ['empresa_id como lista', con({ empresa_id: [EMPRESA_A] })],
    ['empresa_id como objeto', con({ empresa_id: { id: EMPRESA_A } })],
    ['solo otros nombres de claim (tenant_id, empresa, empresaId)', { ...sin('empresa_id'), tenant_id: EMPRESA_A, empresa: EMPRESA_A, empresaId: EMPRESA_A } as JWTPayload],
  ])('%s → sin_empresa', async (_n, payload) => {
    expect(await motivo(await firmar(payload))).toBe('sin_empresa');
  });

  it.each([['no-uuid'], [''], ['00000000-0000-0000-0000-000000000000'], [42 as never]])('un sub inválido (%j) → token_alterado', async (sub) => {
    expect(await motivo(await firmar(con({ sub })))).toBe('token_alterado');
  });
});

describe('entradas que no son un token', () => {
  it.each([undefined, null, '', 'abc', 'a.b', 'a.b.c', '....', 'eyJ.eyJ.x', 42, {}, [], 'x'.repeat(9000), `${'a'.repeat(9000)}.b.c`])('rechaza %j', async (t) => {
    expect(await motivo(typeof t === 'string' && t.length > 100 ? t : t)).toBe('token_alterado');
  });
});

describe('errores seguros', () => {
  it('los errores no repiten el token ni sus datos', async () => {
    const t = await firmar(con({ empresa_id: 'dato-secreto-de-empresa' }));
    const e = await verificador().verificar(t).catch((x: unknown) => x as Error);
    expect(e).toBeInstanceOf(TokenInvalidoError);
    const texto = `${(e as Error).message} ${JSON.stringify(e)} ${(e as Error).stack?.split('\n')[0]}`;
    expect(texto).not.toContain('dato-secreto-de-empresa');
    expect(texto).not.toContain(t.split('.')[1]);
  });

  it('si el JWKS no se puede obtener (red caída) NO es «token inválido»: es VerificadorNoDisponibleError', async () => {
    const caido = verificador({ claves: async () => { throw new TypeError('fetch failed: ECONNREFUSED http://127.0.0.1:8081/secreto'); } });
    const e = await caido.verificar(await firmar(base())).catch((x: unknown) => x as Error);
    expect(e).toBeInstanceOf(VerificadorNoDisponibleError);
    expect(e).not.toBeInstanceOf(TokenInvalidoError);
    expect((e as Error).message).not.toContain('secreto');
  });

  it('el motivo de cada error es uno del catálogo de la bitácora', async () => {
    const motivos = new Set([
      await motivo(await firmar(base(), { par: otra })),
      await motivo(await firmar(con({ iat: seg(AHORA) - 400, exp: seg(AHORA) - 100 }))),
      await motivo(await firmar(sin('empresa_id'))),
    ]);
    expect([...motivos].sort()).toEqual(['sin_empresa', 'token_alterado', 'token_vencido']);
  });
});
