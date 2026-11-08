// pnpm keycloak:verify — ingreso REAL contra el Keycloak local (flujo de código + PKCE) y verificación del token con el mismo
// verificador que usa la API (ADR 027). Requiere Keycloak en marcha (pnpm keycloak:start). No imprime tokens ni contraseñas.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearJwksRemoto, TokenInvalidoError, TokenVerifierJose } from '@sig/autenticacion';
import { DATOS_SIEMBRA } from './lib/datos-siembra.ts';
import { decodificarPayload, ingresarConCodigo } from './lib/flujo-codigo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const emisor = (process.env.OIDC_ISSUER_URL ?? 'http://127.0.0.1:8080/realms/sigiso').replace(/\/+$/, '');
const clienteId = process.env.OIDC_CLIENT_ID ?? 'sigiso-web';
const audiencia = process.env.OIDC_AUDIENCE ?? 'sigiso-api';
const redirectUri = process.env.OIDC_REDIRECT_URI ?? 'http://localhost:3000/auth/callback';
const clienteSecreto = process.env.OIDC_CLIENT_SECRET;
if (!clienteSecreto) throw new Error('Falta OIDC_CLIENT_SECRET: ejecuta pnpm keycloak:realm');
const claves = JSON.parse(readFileSync(join(raiz, '.local', 'secretos-keycloak.json'), 'utf8')).usuarios as Record<
  string,
  string
>;

const verificador = new TokenVerifierJose({
  emisor,
  audiencia,
  clienteAutorizado: clienteId,
  claves: crearJwksRemoto(`${emisor}/protocol/openid-connect/certs`),
});

let fallos = 0;
const comprobar = (descripcion: string, ok: boolean, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? '✔' : '✖'} ${descripcion}${ok || !detalle ? '' : ` — ${detalle}`}`);
};

// Si la API rechazara un token real, indica QUÉ regla no cuadra. Nunca imprime sub, sid, empresa_id ni el token.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const diagnosticar = (alias: string, token: string) => {
  const p = decodificarPayload(token);
  const reglas: Record<string, boolean> = {
    'iss = emisor configurado': p.iss === emisor,
    'aud incluye la audiencia': [p.aud].flat().includes(audiencia),
    'typ = Bearer': p.typ === 'Bearer',
    'azp = cliente autorizado': p.azp === clienteId,
    'sub es UUID': typeof p.sub === 'string' && UUID.test(p.sub),
    'empresa_id es UUID': typeof p.empresa_id === 'string' && UUID.test(p.empresa_id),
    'sid con formato válido':
      p.sid === undefined || (typeof p.sid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(p.sid)),
    'vida (exp menos iat) hasta 600 s': typeof p.exp === 'number' && typeof p.iat === 'number' && p.exp - p.iat <= 600,
  };
  console.error(`Diagnóstico de ${alias}:`);
  for (const [regla, ok] of Object.entries(reglas)) console.error(`  ${ok ? '✔' : '✖'} ${regla}`);
  console.error(`  claims presentes: ${Object.keys(p).join(', ')}`);
  if (!reglas['iss = emisor configurado']) console.error(`  iss recibido: ${String(p.iss)} (esperado ${emisor})`);
  if (!reglas['aud incluye la audiencia']) console.error(`  aud recibido: ${JSON.stringify(p.aud)}`);
};

const ingresar = (alias: string) =>
  ingresarConCodigo({
    emisor,
    clienteId,
    clienteSecreto,
    redirectUri,
    usuario: alias,
    clave: claves[alias] ?? '',
  });

try {
  const identidades = new Map<string, string>();
  for (const alias of ['admin-a', 'admin-b']) {
    const dato = DATOS_SIEMBRA.usuarios.find((u) => u.alias === alias)!;
    const { tokens, nonce } = await ingresar(alias);
    const identidad = await verificador.verificar(tokens.access_token).catch((e: unknown) => {
      diagnosticar(alias, tokens.access_token);
      throw e;
    });
    identidades.set(alias, identidad.empresaId);
    comprobar(`${alias}: el verificador de la API acepta el token`, true);
    comprobar(`${alias}: empresa_id del token = empresa de la cuenta`, identidad.empresaId === dato.empresaId);
    comprobar(`${alias}: sub del token = identificador de la siembra`, identidad.usuarioId === dato.id);
    const acceso = decodificarPayload(tokens.access_token);
    comprobar(
      `${alias}: typ Bearer, azp ${clienteId}, aud incluye ${audiencia}`,
      acceso.typ === 'Bearer' && acceso.azp === clienteId && [acceso.aud].flat().includes(audiencia),
    );
    comprobar(`${alias}: el token vive 5 minutos`, acceso.exp - acceso.iat === 300, `${acceso.exp - acceso.iat} s`);
    comprobar(`${alias}: el emisor es el configurado`, acceso.iss === emisor);
    const id = decodificarPayload(tokens.id_token);
    comprobar(`${alias}: el id_token lleva el nonce enviado`, id.nonce === nonce);
    comprobar(
      `${alias}: el access token no trae nombre ni correo`,
      acceso.email === undefined && acceso.name === undefined && acceso.preferred_username === undefined,
    );
    const comoAcceso = await verificador.verificar(tokens.id_token).then(
      () => 'aceptado',
      (e) => (e instanceof TokenInvalidoError ? 'rechazado' : 'error'),
    );
    comprobar(`${alias}: un id_token NO vale como token de acceso`, comoAcceso === 'rechazado', comoAcceso);
  }
  comprobar(
    'las dos empresas de prueba reciben empresa_id distinto',
    identidades.get('admin-a') !== identidades.get('admin-b'),
  );

  const directo = await fetch(`${emisor}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: clienteId,
      client_secret: clienteSecreto,
      username: 'admin-a',
      password: claves['admin-a'] ?? '',
    }),
  });
  comprobar(
    'el flujo de contraseña directo está rechazado',
    directo.status === 400 || directo.status === 401,
    `respuesta ${directo.status}`,
  );
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else console.log('\nTodo correcto: el ingreso real produce un token que la API acepta, con la empresa de la cuenta.');
