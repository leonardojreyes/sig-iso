// Ingreso real contra Keycloak por el flujo de código con PKCE S256, sin navegador (verificación de la tarea 8.4).
// Imita lo que hará la web (10.2): nunca usa el flujo de contraseña directo, que el realm tiene desactivado.
import { createHash, randomBytes } from 'node:crypto';

export const crearPkce = () => {
  const verificador = randomBytes(48).toString('base64url');
  return { verificador, desafio: createHash('sha256').update(verificador).digest('base64url') };
};

const decodificarHtml = (texto) => texto.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");

export const extraerFormulario = (html) => {
  const form = /<form\b[^>]*\bid="kc-form-login"[^>]*>([\s\S]*?)<\/form>/.exec(html);
  const accion = /<form\b[^>]*\bid="kc-form-login"[^>]*\baction="([^"]+)"/.exec(html);
  if (!form || !accion) throw new Error('No se encontró el formulario de ingreso en la página de Keycloak');
  const campos = {};
  for (const m of form[1].matchAll(/<input\b[^>]*\btype="hidden"[^>]*>/g)) {
    const nombre = /\bname="([^"]*)"/.exec(m[0]);
    const valor = /\bvalue="([^"]*)"/.exec(m[0]);
    if (nombre) campos[nombre[1]] = decodificarHtml(valor?.[1] ?? '');
  }
  return { action: decodificarHtml(accion[1]), campos };
};

export const guardarCookies = (jar, setCookies) => {
  for (const linea of setCookies) {
    const [par] = linea.split(';');
    const i = par.indexOf('=');
    if (i > 0) jar.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
  }
};

const cabeceraCookies = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

export const decodificarPayload = (jwt) => {
  const partes = jwt.split('.');
  if (partes.length !== 3) throw new Error('No es un JWT (se esperaban 3 partes)');
  return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
};

const enviarCredenciales = async ({ emisor, clienteId, redirectUri, usuario, clave, fetchFn }) => {
  const jar = new Map();
  const pkce = crearPkce();
  const state = randomBytes(16).toString('base64url');
  const nonce = randomBytes(16).toString('base64url');
  const pedir = async (url, opciones = {}) => {
    const r = await fetchFn(url, {
      redirect: 'manual',
      ...opciones,
      headers: { ...(opciones.headers ?? {}), ...(jar.size ? { cookie: cabeceraCookies(jar) } : {}) },
    });
    guardarCookies(jar, r.headers.getSetCookie());
    return r;
  };

  const autorizacion = new URL(`${emisor}/protocol/openid-connect/auth`);
  autorizacion.search = new URLSearchParams({
    response_type: 'code',
    client_id: clienteId,
    redirect_uri: redirectUri,
    scope: 'openid',
    state,
    nonce,
    code_challenge: pkce.desafio,
    code_challenge_method: 'S256',
  }).toString();
  const pagina = await pedir(autorizacion);
  if (pagina.status !== 200) throw new Error(`La página de ingreso respondió ${pagina.status}`);
  const formulario = extraerFormulario(await pagina.text());

  const envio = await pedir(formulario.action, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...formulario.campos, username: usuario, password: clave }).toString(),
  });
  return { envio, state, nonce, pkce };
};

const sinEtiquetas = (html) =>
  decodificarHtml(html.replace(/<[^>]*>/g, ''))
    .replaceAll('&nbsp;', ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Texto del error que Keycloak muestra bajo el formulario de ingreso, o null si no hay. */
export const extraerMensajeError = (html) => {
  // Tema actual de Keycloak: <span class="… kc-feedback-text">mensaje</span>. Se acepta también un <span id="input-error">.
  const m =
    /<span\b[^>]*\bclass="[^"]*\bkc-feedback-text\b[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(html) ??
    /<span\b[^>]*\bid="input-error"[^>]*>([\s\S]*?)<\/span>/.exec(html);
  const texto = m ? sinEtiquetas(m[1]) : '';
  return texto === '' ? null : texto;
};

/** Ingreso que debe fallar (usuario inexistente o clave mala): devuelve { estado, mensaje, idioma } de la página de error. */
export const intentarIngresoFallido = async ({ fetchFn = fetch, ...datos }) => {
  const { envio } = await enviarCredenciales({ ...datos, fetchFn });
  const html = await envio.text();
  return {
    estado: envio.status,
    mensaje: extraerMensajeError(html),
    idioma: /<html[^>]*\blang="([^"]+)"/.exec(html)?.[1] ?? null,
    // Fragmento de la página alrededor del contenedor de errores (para diagnosticar si cambia el marcado; es HTML público).
    pista: html.match(/.{0,80}input-error-container.{0,500}/is)?.[0].replace(/\s+/g, ' ') ?? null,
  };
};

/** Devuelve { tokens, nonce } o lanza si el ingreso no llega al código. No registra contraseñas ni tokens. */
export const ingresarConCodigo = async ({
  emisor,
  clienteId,
  clienteSecreto,
  redirectUri,
  usuario,
  clave,
  fetchFn = fetch,
}) => {
  const { envio, state, nonce, pkce } = await enviarCredenciales({
    emisor,
    clienteId,
    redirectUri,
    usuario,
    clave,
    fetchFn,
  });
  const destino = envio.headers.get('location');
  if (envio.status !== 302 || !destino) throw new Error(`El ingreso no fue aceptado (respuesta ${envio.status})`);
  const retorno = new URL(destino);
  if (retorno.origin + retorno.pathname !== redirectUri)
    throw new Error('Keycloak redirigió a una dirección distinta de la registrada');
  if (retorno.searchParams.get('state') !== state) throw new Error('El state devuelto no coincide');
  const codigo = retorno.searchParams.get('code');
  if (!codigo) throw new Error('Keycloak no devolvió un código de autorización');

  const respuesta = await fetchFn(`${emisor}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: redirectUri,
      client_id: clienteId,
      client_secret: clienteSecreto,
      code_verifier: pkce.verificador,
    }).toString(),
  });
  if (!respuesta.ok) throw new Error(`El intercambio del código respondió ${respuesta.status}`);
  return { tokens: await respuesta.json(), nonce };
};
