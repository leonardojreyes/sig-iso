// Flujo de código de autorización con PKCE S256 (ADR 027). Trabaja con Request/Response estándar para probarse sin Next.
// - iniciarLogin: fija state, nonce y verificador en una cookie sellada de un solo uso (5 min) y manda a Keycloak.
// - completarCallback: valida la cookie, `iss`, `state` y el código; intercambia el código y verifica el id_token.
// Cada rechazo tiene un motivo interno (para pruebas y registro) pero la persona solo ve un código genérico.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { ConfiguracionIngreso } from './configuracion';
import { rutaDeRetornoSegura } from './retorno';
import { abrirSello, sellar, TransaccionInvalidaError } from './sellado';

export interface DependenciasFlujo {
  readonly config: ConfiguracionIngreso;
  readonly ahora: () => Date;
  readonly fetchFn: typeof fetch;
  readonly claves: JWTVerifyGetKey;
}

export type MotivoFallo =
  | 'sin_transaccion'
  | 'transaccion_invalida'
  | 'transaccion_vencida'
  | 'rechazado_por_proveedor'
  | 'emisor_invalido'
  | 'state_invalido'
  | 'codigo_invalido'
  | 'intercambio_fallido'
  | 'id_token_invalido';

export type ResultadoCallback =
  | {
      readonly ok: true;
      readonly tokens: { readonly acceso: string; readonly refresco: string; readonly id: string };
      readonly identidad: { readonly sub: string; readonly sid: string | null };
      readonly retorno: string;
      readonly limpiarCookie: string;
    }
  | { readonly ok: false; readonly motivo: MotivoFallo; readonly limpiarCookie: string };

const VIGENCIA_TRANSACCION_SEGUNDOS = 300;
const CODIGO_MAXIMO = 2048;
const TOKEN_MAXIMO = 16_384;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SESION = /^[A-Za-z0-9_-]{1,128}$/;
const SIN_CACHE = 'no-store';

const aleatorio = (bytes: number): string => randomBytes(bytes).toString('base64url');
const huella = (texto: string): Buffer => createHash('sha256').update(texto).digest();

const cookie = (c: ConfiguracionIngreso, valor: string, maxAge: number): string =>
  `${c.nombreCookie}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${c.seguro ? '; Secure' : ''}`;

const leerCookie = (peticion: Request, nombre: string): string | null | 'repetida' => {
  const encontradas = (peticion.headers.get('cookie') ?? '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.startsWith(`${nombre}=`));
  if (encontradas.length === 0) return null;
  if (encontradas.length > 1) return 'repetida';
  return encontradas[0]!.slice(nombre.length + 1);
};

export const iniciarLogin = async (peticion: Request, deps: DependenciasFlujo): Promise<Response> => {
  const { config } = deps;
  const state = aleatorio(24);
  const nonce = aleatorio(24);
  const verificador = aleatorio(48);
  const retorno = rutaDeRetornoSegura(new URL(peticion.url).searchParams.get('retorno'), config.origen);

  const sello = await sellar(
    { s: state, n: nonce, v: verificador, r: retorno },
    { claves: config.clavesSellado, vigenciaSegundos: VIGENCIA_TRANSACCION_SEGUNDOS, ahora: deps.ahora() },
  );
  const destino = new URL(`${config.emisor}/protocol/openid-connect/auth`);
  destino.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clienteId,
    redirect_uri: config.redirectUri,
    scope: 'openid',
    state,
    nonce,
    code_challenge: createHash('sha256').update(verificador).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();

  const cabeceras = new Headers({ Location: destino.toString(), 'Cache-Control': SIN_CACHE });
  cabeceras.append('Set-Cookie', cookie(config, sello, VIGENCIA_TRANSACCION_SEGUNDOS));
  return new Response(null, { status: 302, headers: cabeceras });
};

interface Transaccion extends Record<string, unknown> {
  s: string;
  n: string;
  v: string;
  r: string;
}

const unico = (consulta: URLSearchParams, nombre: string): string | null => {
  const valores = consulta.getAll(nombre);
  return valores.length === 1 ? valores[0]! : null;
};

export const completarCallback = async (peticion: Request, deps: DependenciasFlujo): Promise<ResultadoCallback> => {
  const { config } = deps;
  const limpiarCookie = cookie(config, '', 0);
  const falla = (motivo: MotivoFallo): ResultadoCallback => ({ ok: false, motivo, limpiarCookie });

  // 1. La transacción que iniciamos nosotros (cookie sellada, vigente, de un solo uso).
  const sello = leerCookie(peticion, config.nombreCookie);
  if (sello === null) return falla('sin_transaccion');
  if (sello === 'repetida' || sello === '') return falla('transaccion_invalida');
  let transaccion: Transaccion;
  try {
    transaccion = await abrirSello<Transaccion>(sello, { claves: config.clavesSellado, ahora: deps.ahora() });
  } catch (e) {
    return falla(
      e instanceof TransaccionInvalidaError && e.motivo === 'vencida' ? 'transaccion_vencida' : 'transaccion_invalida',
    );
  }
  if (
    ![transaccion.s, transaccion.n, transaccion.v, transaccion.r].every((x) => typeof x === 'string' && x.length > 0)
  ) {
    return falla('transaccion_invalida');
  }

  const consulta = new URL(peticion.url).searchParams;

  // 2. Emisor (RFC 9207 / RFC 9700): el servidor que respondió debe ser el nuestro.
  if (unico(consulta, 'iss') !== config.emisor) return falla('emisor_invalido');

  // 3. La persona canceló o el proveedor rechazó el ingreso.
  if (consulta.has('error')) return falla('rechazado_por_proveedor');

  // 4. `state` de ESTE ingreso (comparación en tiempo constante) y código presente.
  const state = unico(consulta, 'state');
  if (state === null || !timingSafeEqual(huella(state), huella(transaccion.s))) return falla('state_invalido');
  const codigo = unico(consulta, 'code');
  if (codigo === null || codigo.length === 0 || codigo.length > CODIGO_MAXIMO) return falla('codigo_invalido');

  // 5. Intercambio del código (cliente confidencial + verificador PKCE).
  let cuerpo: Record<string, unknown>;
  try {
    const respuesta = await deps.fetchFn(`${config.emisor}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: codigo,
        redirect_uri: config.redirectUri,
        client_id: config.clienteId,
        client_secret: config.clienteSecreto,
        code_verifier: transaccion.v,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!respuesta.ok) return falla('intercambio_fallido');
    cuerpo = (await respuesta.json()) as Record<string, unknown>;
  } catch {
    return falla('intercambio_fallido');
  }
  const texto = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 && v.length <= TOKEN_MAXIMO ? v : null;
  const acceso = texto(cuerpo?.access_token);
  const refresco = texto(cuerpo?.refresh_token);
  const id = texto(cuerpo?.id_token);
  if (
    typeof cuerpo?.token_type !== 'string' ||
    cuerpo.token_type.toLowerCase() !== 'bearer' ||
    !acceso ||
    !refresco ||
    !id
  ) {
    return falla('intercambio_fallido');
  }

  // 6. id_token: firma, emisor, audiencia (este cliente), vigencia y el nonce de ESTE ingreso.
  try {
    const { payload } = await jwtVerify(id, deps.claves, {
      issuer: config.emisor,
      audience: config.clienteId,
      algorithms: ['RS256', 'ES256'],
      currentDate: deps.ahora(),
      clockTolerance: 30,
      requiredClaims: ['iss', 'aud', 'sub', 'exp', 'iat'],
    });
    if (typeof payload.nonce !== 'string' || !timingSafeEqual(huella(payload.nonce), huella(transaccion.n)))
      return falla('id_token_invalido');
    const sub = typeof payload.sub === 'string' ? payload.sub.toLowerCase() : '';
    if (!UUID.test(sub)) return falla('id_token_invalido');
    const sid = payload.sid;
    if (sid !== undefined && !(typeof sid === 'string' && SESION.test(sid))) return falla('id_token_invalido');
    return {
      ok: true,
      tokens: { acceso, refresco, id },
      identidad: { sub, sid: typeof sid === 'string' ? sid : null },
      retorno: rutaDeRetornoSegura(transaccion.r, config.origen),
      limpiarCookie,
    };
  } catch {
    return falla('id_token_invalido');
  }
};

/** Fallo visible para la persona: vuelve al inicio con un código GENÉRICO (sin revelar qué regla falló) y sin dejar la cookie. */
export const respuestaDeFallo = (
  resultado: Extract<ResultadoCallback, { ok: false }>,
  config: ConfiguracionIngreso,
): Response => {
  const codigo = resultado.motivo === 'rechazado_por_proveedor' ? 'ingreso_cancelado' : 'ingreso_invalido';
  const cabeceras = new Headers({ Location: `${config.origen}/?error=${codigo}`, 'Cache-Control': SIN_CACHE });
  cabeceras.append('Set-Cookie', resultado.limpiarCookie);
  return new Response(null, { status: 303, headers: cabeceras });
};
