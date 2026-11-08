// pnpm keycloak:verify — ingreso REAL contra el Keycloak local (flujo de código + PKCE) y verificación del token con el mismo
// verificador que usa la API (ADR 027). Requiere Keycloak en marcha (pnpm keycloak:start). No imprime tokens ni contraseñas.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearJwksRemoto, TokenInvalidoError, TokenVerifierJose } from '@sig/autenticacion';
import { DATOS_SIEMBRA } from './lib/datos-siembra.ts';
import { decodificarPayload, ingresarConCodigo, intentarIngresoFallido } from './lib/flujo-codigo.mjs';

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
  // H1.2: usuario inexistente y contraseña equivocada deben dar el MISMO mensaje, en español. Se hace primero porque el
  // ingreso correcto posterior de admin-a reinicia su contador de fallos (bloqueo temporal tras 5).
  const fallido = (usuario: string, clave: string) =>
    intentarIngresoFallido({ emisor, clienteId, redirectUri, usuario, clave });
  const claveMala = await fallido('admin-a', 'una-clave-equivocada-123');
  const sinUsuario = await fallido('persona-que-no-existe', 'una-clave-equivocada-123');
  comprobar(
    'credenciales inválidas: ambos casos vuelven al formulario (200) con un mensaje',
    claveMala.estado === 200 && sinUsuario.estado === 200 && !!claveMala.mensaje && !!sinUsuario.mensaje,
    `estados ${claveMala.estado}/${sinUsuario.estado}`,
  );
  comprobar(
    'credenciales inválidas: el mensaje es EXACTAMENTE el mismo exista o no el usuario (H1.2)',
    claveMala.mensaje === sinUsuario.mensaje && claveMala.mensaje !== null,
  );
  comprobar(
    'credenciales inválidas: la página está en español',
    claveMala.idioma === 'es' && sinUsuario.idioma === 'es',
    `idioma ${claveMala.idioma}/${sinUsuario.idioma}`,
  );
  comprobar(
    'credenciales inválidas: el mensaje no nombra al usuario ni dice que no existe',
    !/admin-a|persona-que-no-existe|no existe|not found/i.test(`${claveMala.mensaje} ${sinUsuario.mensaje}`),
  );
  console.log(`  (mensaje mostrado: «${claveMala.mensaje}»)`);
  if (claveMala.mensaje === null) console.log(`  (pista del HTML: ${claveMala.pista})`);

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

  // Clientes integrados de Keycloak (autoservicio y administración del realm): deshabilitados, sin formulario ni contraseña directa.
  for (const id of ['account', 'account-console', 'admin-cli', 'security-admin-console']) {
    const pagina = await fetch(
      `${emisor}/protocol/openid-connect/auth?${new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: `${redirectUri}`, scope: 'openid' })}`,
      { redirect: 'manual' },
    );
    const html = pagina.status === 200 ? await pagina.text() : '';
    comprobar(
      `cliente integrado ${id}: no ofrece formulario de ingreso`,
      !html.includes('kc-form-login'),
      `respuesta ${pagina.status}`,
    );
  }
  const adminCli = await fetch(`${emisor}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin-a',
      password: claves['admin-a'] ?? '',
    }),
  });
  comprobar(
    'admin-cli no acepta contraseña directa en el realm sigiso',
    adminCli.status === 400 || adminCli.status === 401,
    `respuesta ${adminCli.status}`,
  );

  // Eventos: la cuenta de servicio de solo lectura de eventos (la del worker, 11.1) los ve y quedaron registrados.
  const secretoEventos = process.env.KEYCLOAK_EVENTS_CLIENT_SECRET;
  const idEventos = process.env.KEYCLOAK_EVENTS_CLIENT_ID ?? 'sigiso-events';
  if (!secretoEventos) throw new Error('Falta KEYCLOAK_EVENTS_CLIENT_SECRET: ejecuta pnpm keycloak:realm');
  const respuestaToken = await fetch(`${emisor}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: idEventos,
      client_secret: secretoEventos,
    }),
  });
  comprobar(
    'la cuenta de eventos obtiene su token (client credentials)',
    respuestaToken.ok,
    `respuesta ${respuestaToken.status}`,
  );
  const tokenEventos: string = respuestaToken.ok
    ? ((await respuestaToken.json()) as { access_token: string }).access_token
    : '';
  const base = emisor.replace(/\/realms\/[^/]+$/, '');
  const administracion = (ruta: string) =>
    fetch(`${base}/admin/realms/${ruta}`, { headers: { authorization: `Bearer ${tokenEventos}` } });
  if (tokenEventos) {
    const pe = decodificarPayload(tokenEventos);
    comprobar(
      'token de eventos: rol view-events de realm-management y audiencia de la API de administración (Keycloak 26.8)',
      JSON.stringify(pe.resource_access?.['realm-management']?.roles) === '["view-events"]' &&
        [pe.aud].flat().some((a: string) => a.endsWith('/admin/realms/sigiso')) &&
        String(pe.scope).split(' ').includes('kc-admin-api'),
    );
  }
  const lectura = await administracion('sigiso/events?type=LOGIN_ERROR&max=50');
  comprobar(
    'la cuenta de eventos lee LOGIN_ERROR (tiene view-events)',
    lectura.status === 200,
    `respuesta ${lectura.status}`,
  );
  const eventos = lectura.ok ? ((await lectura.json()) as Array<Record<string, unknown>>) : [];
  const codigos = new Set(eventos.map((e) => String(e.error)));
  comprobar(
    'los dos intentos fallidos quedaron registrados como LOGIN_ERROR',
    codigos.has('invalid_user_credentials') && codigos.has('user_not_found'),
    [...codigos].join(', '),
  );
  const sinUsuarioEvento = eventos.find((e) => e.error === 'user_not_found');
  comprobar(
    'el evento de usuario inexistente no trae userId',
    sinUsuarioEvento !== undefined && sinUsuarioEvento.userId === undefined,
  );
  const campos = new Set(eventos.flatMap((e) => Object.keys(e)));
  console.log(
    `  (campos de un evento: ${[...campos].sort().join(', ')}; el worker solo copiará tipo, fecha, código de error y userId)`,
  );
  const propios = await administracion('sigiso/users');
  const ajeno = await administracion('master/users');
  comprobar(
    'la cuenta de eventos NO puede listar usuarios, ni de su realm ni de otro',
    (propios.status === 401 || propios.status === 403) && (ajeno.status === 401 || ajeno.status === 403),
    `respuestas ${propios.status}/${ajeno.status}`,
  );
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else console.log('\nTodo correcto: el ingreso real produce un token que la API acepta, con la empresa de la cuenta.');
