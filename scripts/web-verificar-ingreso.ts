// pnpm web:verify-login — recorre el ingreso REAL: web (3000) → Keycloak → web, sin navegador. Requiere Keycloak (pnpm keycloak:start)
// y la web (pnpm dev web) en marcha. Requiere también la API (pnpm dev api) y PostgreSQL. No imprime tokens ni claves.
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
// El 404 repite la dirección pedida (lo que la persona escribió) y Next añade un identificador aleatorio por respuesta: para
// comparar dos 404 se sustituyen ambos por una marca.
const normalizar = (texto: string, slug: string): string =>
  texto
    .split(slug)
    .join('X')
    .replace(/__next_r="[^"]*"/g, '__next_r="N"');
const ubicacion = (r: Response): string => {
  const l = r.headers.get('location');
  if (!l) return '';
  const u = new URL(l, web);
  return u.origin === web ? `${u.pathname}${u.search}` : u.toString();
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

  // 1) Ingreso válido: la web valida todo, la API registra el inicio y se emite la sesión.
  const valido = await pedir(regreso, new Map(jarWeb));
  const cuerpo = await valido.text();
  comprobar(
    'callback válido: 303 a la ruta pedida (la API registró el inicio y se emitió la sesión)',
    valido.status === 303 && valido.headers.get('location') === `${web}/e/empresa-a/panel`,
    `respuesta ${valido.status} ${valido.headers.get('location') ?? ''}`,
  );
  const nombreSesion = web.startsWith('https:') ? '__Host-sig-sesion' : 'sig-sesion';
  const setSesion = valido.headers.getSetCookie().find((c) => c.startsWith(`${nombreSesion}=`)) ?? '';
  comprobar(
    'la cookie de sesión es httpOnly, SameSite=Lax, Path=/ y SIN Max-Age ni Expires (cookie de sesión del navegador)',
    /HttpOnly/i.test(setSesion) &&
      /SameSite=Lax/i.test(setSesion) &&
      /Path=\//.test(setSesion) &&
      !/Max-Age|Expires/i.test(setSesion),
  );
  console.log(
    `  (tamaño de la cookie de sesión: ${setSesion.length} bytes; límite de prueba 3072, del navegador 4096)`,
  );
  comprobar('la cookie de sesión cabe con margen (< 3 KB)', setSesion.length > 0 && setSesion.length < 3072);
  comprobar(
    'callback válido: borra la cookie de la transacción',
    valido.headers.getSetCookie().some((c) => /^sig-oidc=;.*Max-Age=0|^__Host-sig-oidc=;.*Max-Age=0/.test(c)),
  );
  comprobar(
    'callback válido: ningún token en la respuesta',
    !/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./.test(cuerpo + JSON.stringify([...valido.headers])),
  );
  const cookieSesion = new Map([[nombreSesion, setSesion.split(';')[0]!.slice(nombreSesion.length + 1)]]);
  comprobar(
    'la cookie de sesión es un JWE de 5 partes sin clave en el sello (dir): nada legible dentro',
    (cookieSesion.get(nombreSesion) ?? '').split('.').length === 5 &&
      (cookieSesion.get(nombreSesion) ?? '').split('.')[1] === '',
  );

  const estadoSesion = async (jar: Map<string, string>) => {
    const r = await pedir(`${web}/auth/sesion`, new Map(jar));
    return { estado: r.status, cuerpo: await r.text() };
  };
  const dentro = await estadoSesion(cookieSesion);
  comprobar(
    'GET /auth/sesion con la cookie: 200 autenticado',
    dentro.estado === 200 && dentro.cuerpo === '{"autenticado":true}',
    `respuesta ${dentro.estado}`,
  );
  comprobar('GET /auth/sesion sin cookie: 401', (await estadoSesion(new Map())).estado === 401);

  // Pantallas internas (proxy de la web): sesión, empresa y caché.
  const pagina = (ruta: string, jar: Map<string, string>, extra: Record<string, string> = {}) =>
    pedir(`${web}${ruta}`, new Map(jar), { headers: extra });
  // Con sesión de A, la empresa verificada es la suya (ruta /contexto: lo que el proxy comprobó).
  const propia = await pagina('/e/empresa-a/contexto', cookieSesion);
  comprobar(
    'con sesión de A: el proxy deja pasar /e/empresa-a/… y confirma la empresa verificada, sin caché',
    propia.status === 200 &&
      (await propia.text()) === '{"empresa":"empresa-a"}' &&
      /no-store/.test(propia.headers.get('cache-control') ?? ''),
    `respuesta ${propia.status}, cache-control: ${propia.headers.get('cache-control')}`,
  );
  const deB = await pagina('/e/empresa-b/contexto', cookieSesion);
  const textoDeB = await deB.text();
  const inexistente = await pagina('/e/empresa-c/contexto', cookieSesion);
  const textoInexistente = await inexistente.text();
  const panelDeB = await pagina('/e/empresa-b/panel', cookieSesion);
  const textoPanelDeB = await panelDeB.text();
  comprobar(
    'H2.3: con sesión de A, lo de B da 404, igual que una empresa inexistente, sin nombre ni marca de B',
    deB.status === 404 &&
      inexistente.status === 404 &&
      panelDeB.status === 404 &&
      !/Empresa B|b45309/i.test(textoDeB + textoInexistente + textoPanelDeB) &&
      normalizar(textoDeB, 'empresa-b') === normalizar(textoInexistente, 'empresa-c'),
    `respuestas ${deB.status}/${inexistente.status}/${panelDeB.status}; marca de B: ${/Empresa B|b45309/i.test(textoDeB + textoInexistente + textoPanelDeB)}; cuerpos iguales: ${normalizar(textoDeB, 'empresa-b') === normalizar(textoInexistente, 'empresa-c')} (${textoDeB.length}/${textoInexistente.length} bytes)`,
  );
  const falsificado = await pagina('/e/empresa-b/contexto', cookieSesion, { 'x-sig-empresa': 'empresa-b' });
  comprobar(
    'un encabezado x-sig-empresa falsificado no cambia nada (sigue 404)',
    falsificado.status === 404,
    `respuesta ${falsificado.status}`,
  );
  const falsificadoPropio = await pagina('/e/empresa-a/contexto', new Map(), { 'x-sig-empresa': 'empresa-a' });
  comprobar(
    'sin sesión, el encabezado x-sig-empresa tampoco abre nada (307 a ingresar)',
    falsificadoPropio.status === 307 && ubicacion(falsificadoPropio).startsWith('/auth/login'),
    `respuesta ${falsificadoPropio.status}`,
  );
  const pedido = '/e/empresa-a/requisitos?q=gobierno';
  const sinSesion = await pagina(pedido, new Map());
  comprobar(
    'H1.3: sin sesión, redirige a /auth/login recordando la pantalla pedida',
    sinSesion.status === 307 && ubicacion(sinSesion) === `/auth/login?retorno=${encodeURIComponent(pedido)}`,
    `respuesta ${sinSesion.status} ${ubicacion(sinSesion)}`,
  );
  const vuelta = await ingresar(pedido);
  const alVolver = await pedir(vuelta.regreso, new Map(vuelta.jarWeb));
  comprobar(
    'H1.3: tras ingresar vuelve exactamente a la pantalla pedida',
    alVolver.status === 303 && ubicacion(alVolver) === pedido,
    ubicacion(alVolver),
  );
  const ingresoPublico = await pagina('/e/a/ingreso', new Map());
  comprobar(
    'la pantalla de ingreso de cada empresa es pública (200, sin sesión)',
    ingresoPublico.status === 200,
    `respuesta ${ingresoPublico.status}`,
  );

  // Cierre: solo POST con Origin propio.
  const logout = (origen: string | null, metodo = 'POST') =>
    pedir(`${web}/auth/logout`, new Map(cookieSesion), {
      method: metodo,
      headers: origen === null ? {} : { origin: origen },
    });
  const sinOrigen = await logout(null);
  const ajeno = await logout('https://evil.example');
  const porGet = await logout(web, 'GET');
  comprobar(
    'cerrar sin Origin o con Origin ajeno: 403; por GET: 405 (y la sesión sigue viva)',
    sinOrigen.status === 403 &&
      ajeno.status === 403 &&
      porGet.status === 405 &&
      (await estadoSesion(cookieSesion)).estado === 200,
  );

  const cierre = await logout(web);
  const aKeycloakLogout = new URL(cierre.headers.get('location') ?? 'http://invalida');
  comprobar(
    'cerrar con Origin propio: 303 al cierre de Keycloak con id_token_hint y retorno al inicio; borra la cookie',
    cierre.status === 303 &&
      `${aKeycloakLogout.origin}${aKeycloakLogout.pathname}` === `${emisor}/protocol/openid-connect/logout` &&
      !!aKeycloakLogout.searchParams.get('id_token_hint') &&
      aKeycloakLogout.searchParams.get('post_logout_redirect_uri') === `${web}/` &&
      cierre.headers.getSetCookie().some((c) => c.startsWith(`${nombreSesion}=;`) && /Max-Age=0/.test(c)),
    `respuesta ${cierre.status}`,
  );
  const finKeycloak = await pedir(aKeycloakLogout.toString(), new Map());
  comprobar(
    'Keycloak cierra su sesión y devuelve al inicio sin pedir confirmación',
    finKeycloak.status === 302 && (finKeycloak.headers.get('location') ?? '').startsWith(web),
    `respuesta ${finKeycloak.status}`,
  );

  comprobar(
    'el cierre pide al navegador olvidar su caché (Clear-Site-Data)',
    cierre.headers.get('clear-site-data') === '"cache"',
  );
  const trasCierre = await pagina('/e/empresa-a/contexto', cookieSesion);
  comprobar(
    'H1.4: tras cerrar sesión, la cookie anterior ya no abre /e/empresa-a/… (307 a ingresar)',
    trasCierre.status === 307 && ubicacion(trasCierre).startsWith('/auth/login'),
    `respuesta ${trasCierre.status}`,
  );
  const robada = await estadoSesion(cookieSesion);
  comprobar(
    'REPRODUCIR la cookie robada después del cierre: 401 (el refresh token está revocado)',
    robada.estado === 401,
    `respuesta ${robada.estado}`,
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
