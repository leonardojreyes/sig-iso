// Ingreso REAL de una cuenta de prueba a la web (web → Keycloak → web), sin navegador. Devuelve las cookies de la sesión de la web.
// Solo para verificaciones locales: usa las contraseñas generadas en .local/secretos-keycloak.json. No imprime nada.
import { extraerFormulario, guardarCookies } from './flujo-codigo.mjs';

export interface EntornoWeb {
  readonly web: string;
  readonly emisor: string;
  readonly claves: Readonly<Record<string, string>>;
}

const cabecera = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const pedir = async (url: string, jar: Map<string, string>, init: RequestInit = {}) => {
  const r = await fetch(url, {
    redirect: 'manual',
    ...init,
    headers: { ...(init.headers ?? {}), ...(jar.size ? { cookie: cabecera(jar) } : {}) },
  });
  guardarCookies(jar, r.headers.getSetCookie());
  return r;
};

export const iniciarSesionWeb = async (
  entorno: EntornoWeb,
  alias: string,
  retorno = '/',
): Promise<Map<string, string>> => {
  const jarWeb = new Map<string, string>();
  const jarKc = new Map<string, string>();
  const inicio = await pedir(`${entorno.web}/auth/login?retorno=${encodeURIComponent(retorno)}`, jarWeb);
  const pagina = await pedir(inicio.headers.get('location') ?? '', jarKc);
  const formulario = extraerFormulario(await pagina.text());
  const envio = await pedir(formulario.action, jarKc, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...formulario.campos,
      username: alias,
      password: entorno.claves[alias] ?? '',
    }).toString(),
  });
  const regreso = envio.headers.get('location');
  if (envio.status !== 302 || !regreso)
    throw new Error(`El ingreso de ${alias} no fue aceptado (respuesta ${envio.status})`);
  const callback = await pedir(regreso, new Map(jarWeb));
  const sesion = new Map<string, string>();
  guardarCookies(
    sesion,
    callback.headers.getSetCookie().filter((c) => !/Max-Age=0/.test(c)),
  );
  if (callback.status !== 303 || sesion.size === 0)
    throw new Error(`La web no emitió la sesión de ${alias} (respuesta ${callback.status})`);
  return sesion;
};

export const paginaWeb = async (entorno: EntornoWeb, ruta: string, sesion: Map<string, string>) => {
  const r = await pedir(`${entorno.web}${ruta}`, new Map(sesion));
  // React separa textos adyacentes con <!-- -->: se quitan para poder buscar frases.
  return { estado: r.status, texto: (await r.text()).replaceAll('<!-- -->', ''), cabeceras: r.headers };
};
