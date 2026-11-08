// pnpm web:verify-login — recorre el ingreso REAL: web (3000) → Keycloak → web, sin navegador. Requiere Keycloak (pnpm keycloak:start)
// y la web (pnpm dev web) en marcha. Hasta la tarea 10.3 el callback termina en 501 («validado, sin sesión»). No imprime tokens ni claves.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATOS_SIEMBRA } from './lib/datos-siembra.ts';
import { extraerFormulario, guardarCookies } from './lib/flujo-codigo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = new URL(process.env.OIDC_REDIRECT_URI ?? 'http://localhost:3000/auth/callback').origin;
const emisor = (process.env.OIDC_ISSUER_URL ?? 'http://127.0.0.1:8080/realms/sigiso').replace(/\/+$/, '');
const claves = JSON.parse(readFileSync(join(raiz, '.local', 'secretos-keycloak.json'), 'utf8')).usuarios as Record<
  string,
  string
>;
const admin = DATOS_SIEMBRA.usuarios.find((u) => u.alias === 'admin-a')!;

let fallos = 0;
const comprobar = (descripcion: string, ok: boolean, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? '✔' : '✖'} ${descripcion}${ok || !detalle ? '' : ` — ${detalle}`}`);
};
const cabeceraCookies = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const pedir = async (url: string, jar: Map<string, string>, init: RequestInit = {}) => {
  const r = await fetch(url, {
    redirect: 'manual',
    ...init,
    headers: { ...(init.headers ?? {}), ...(jar.size ? { cookie: cabeceraCookies(jar) } : {}) },
  });
  guardarCookies(jar, r.headers.getSetCookie());
  return r;
};

// Recorre el ingreso hasta la URL de retorno de la web (con code, state e iss) y devuelve también las cookies de la web.
const ingresar = async (retorno: string) => {
  const jarWeb = new Map<string, string>();
  const jarKc = new Map<string, string>();
  const inicio = await pedir(`${web}/auth/login?retorno=${encodeURIComponent(retorno)}`, jarWeb);
  const aKeycloak = inicio.headers.get('location') ?? '';
  const pagina = await pedir(aKeycloak, jarKc);
  const formulario = extraerFormulario(await pagina.text());
  const envio = await pedir(formulario.action, jarKc, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...formulario.campos,
      username: admin.alias,
      password: claves[admin.alias] ?? '',
    }).toString(),
  });
  return { inicio, aKeycloak, jarWeb, regreso: envio.headers.get('location') ?? '' };
};

try {
  const { inicio, aKeycloak, jarWeb, regreso } = await ingresar('/e/empresa-a/panel');
  comprobar(
    '/auth/login redirige a Keycloak (302) con código + PKCE S256',
    inicio.status === 302 &&
      aKeycloak.startsWith(`${emisor}/protocol/openid-connect/auth?`) &&
      aKeycloak.includes('code_challenge_method=S256'),
  );
  const cookieWeb = [...jarWeb.keys()][0] ?? '';
  const setCookie = inicio.headers.getSetCookie()[0] ?? '';
  comprobar(
    'la cookie de la transacción es httpOnly, SameSite=Lax y de 5 minutos',
    /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && /Max-Age=300/.test(setCookie),
    cookieWeb,
  );
  const url = new URL(regreso || 'http://invalida');
  comprobar(
    'Keycloak vuelve a /auth/callback con code, state e iss',
    url.origin + url.pathname === `${web}/auth/callback` &&
      !!url.searchParams.get('code') &&
      !!url.searchParams.get('state') &&
      url.searchParams.get('iss') === emisor,
  );

  // 1) Ingreso válido: la web valida todo y (hasta la 10.3) responde 501 sin sesión y borrando la cookie.
  const valido = await pedir(regreso, new Map(jarWeb));
  const cuerpo = await valido.text();
  comprobar(
    'callback válido: la web valida iss, state, código e id_token (hoy responde 501: sesión pendiente, 10.3)',
    valido.status === 501,
    `respuesta ${valido.status}`,
  );
  comprobar(
    'callback válido: borra la cookie de la transacción',
    /Max-Age=0/.test(valido.headers.getSetCookie()[0] ?? ''),
  );
  comprobar(
    'callback válido: ningún token en la respuesta',
    !/eyJ[A-Za-z0-9_-]{10,}\./.test(cuerpo + JSON.stringify([...valido.headers])),
  );

  // 2) Repetir el mismo regreso sin la cookie (ya borrada): rechazado.
  const repetido = await pedir(regreso, new Map());
  comprobar(
    'repetir el regreso sin la cookie se rechaza (303 a /?error=ingreso_invalido)',
    repetido.status === 303 && repetido.headers.get('location') === `${web}/?error=ingreso_invalido`,
    `respuesta ${repetido.status}`,
  );

  // 3) Otro ingreso con state alterado.
  const otro = await ingresar('/e/empresa-a/panel');
  const alterado = new URL(otro.regreso);
  alterado.searchParams.set('state', 'estado-falso-aaaaaaaaaaaaaaaa');
  const conStateFalso = await pedir(alterado.toString(), new Map(otro.jarWeb));
  comprobar(
    'state alterado: rechazado (303 a /?error=ingreso_invalido)',
    conStateFalso.status === 303 && conStateFalso.headers.get('location') === `${web}/?error=ingreso_invalido`,
    `respuesta ${conStateFalso.status}`,
  );

  // 4) Otro ingreso con iss de otro emisor.
  const tercero = await ingresar('/');
  const conIssFalso = new URL(tercero.regreso);
  conIssFalso.searchParams.set('iss', 'https://evil.example/realms/sigiso');
  const r3 = await pedir(conIssFalso.toString(), new Map(tercero.jarWeb));
  comprobar(
    'iss de otro emisor: rechazado',
    r3.status === 303 && r3.headers.get('location') === `${web}/?error=ingreso_invalido`,
    `respuesta ${r3.status}`,
  );

  // 5) El destino de retorno peligroso no rompe el ingreso (se descarta en silencio).
  const peligroso = await pedir(`${web}/auth/login?retorno=${encodeURIComponent('//evil.example')}`, new Map());
  comprobar(
    'un retorno externo no impide ni altera el ingreso (sigue yendo a Keycloak)',
    peligroso.status === 302 && (peligroso.headers.get('location') ?? '').startsWith(`${emisor}/`),
  );
} catch (error) {
  fallos += 1;
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
}
if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  process.exitCode = 1;
} else
  console.log(
    '\nTodo correcto: el ingreso real de la web contra Keycloak valida el código, el state, el emisor y el id_token.',
  );
