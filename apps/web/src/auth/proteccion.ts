// Decisión de acceso a las pantallas internas /e/<empresa>/… (ADR 027, H1.3 a H1.5 y H2.3). Es una función pura sobre Request: el
// proxy de Next solo traduce la decisión a una respuesta. Cerrada por omisión: ante cualquier duda, no se muestra nada.
import type { ConfiguracionIngreso } from './configuracion';
import { leerCookie } from './flujo';
import { crearServicioSesion, type DependenciasSesion } from './sesion';

export type DecisionProxy =
  | { readonly tipo: 'pasar'; readonly empresa: string | null; readonly cookies: readonly string[] }
  | { readonly tipo: 'login'; readonly retorno: string; readonly cookies: readonly string[] }
  | { readonly tipo: 'no_encontrado'; readonly cookies: readonly string[] }
  | { readonly tipo: 'no_disponible' };

const RUTA_DE_EMPRESA = /^\/e\/([^/]+)(?:\/(.*))?$/;
const SLUG = /^[a-z0-9-]{1,32}$/;
const VIDA_IDENTIDAD_MS = 5 * 60_000;
const TIEMPO_API_MS = 5_000;

type Identidad =
  { readonly ok: true; readonly slug: string } | { readonly ok: false; readonly motivo: 'rechazada' | 'no_disponible' };

// La empresa de la sesión, tal como la confirma la API con el token (nunca la que diga la dirección).
const empresaDeLaSesion = async (sid: string, acceso: string, deps: DependenciasSesion): Promise<Identidad> => {
  const { config, almacen } = deps;
  const guardada = almacen.empresaDe(sid, deps.ahora().getTime());
  if (guardada) return { ok: true, slug: guardada };
  try {
    const r = await deps.fetchFn(`${config.apiUrl}/me`, {
      headers: { authorization: `Bearer ${acceso}`, accept: 'application/json' },
      signal: AbortSignal.timeout(TIEMPO_API_MS),
      redirect: 'error',
      cache: 'no-store',
    });
    if (r.status === 401) return { ok: false, motivo: 'rechazada' };
    if (r.status !== 200) return { ok: false, motivo: 'no_disponible' };
    const cuerpo = (await r.json()) as { empresa?: { slug?: unknown } };
    const slug = cuerpo?.empresa?.slug;
    if (typeof slug !== 'string' || !SLUG.test(slug)) return { ok: false, motivo: 'no_disponible' };
    almacen.guardarEmpresa(sid, slug, deps.ahora().getTime() + VIDA_IDENTIDAD_MS);
    return { ok: true, slug };
  } catch {
    return { ok: false, motivo: 'no_disponible' };
  }
};

export const decidirAcceso = async (peticion: Request, deps: DependenciasSesion): Promise<DecisionProxy> => {
  const url = new URL(peticion.url);
  const coincide = RUTA_DE_EMPRESA.exec(url.pathname);
  if (!coincide) return { tipo: 'pasar', empresa: null, cookies: [] };

  // La pantalla de ingreso de cada empresa es pública; todo lo demás de /e/… exige sesión.
  const resto = coincide[2] ?? '';
  if (resto === 'ingreso' || resto === 'ingreso/') return { tipo: 'pasar', empresa: null, cookies: [] };

  const servicio = crearServicioSesion(deps);
  const retorno = `${url.pathname}${url.search}`;
  const aIngresar = (cookies: readonly string[] = []): DecisionProxy => ({ tipo: 'login', retorno, cookies });

  const sesion = await servicio.leer(peticion);
  if (!sesion) {
    // Una cookie que no se puede abrir (alterada, vencida, de otra clave) se borra para no reintentarla.
    return aIngresar(leerCookie(peticion, deps.config.nombreCookieSesion) === null ? [] : [servicio.borrarCookie()]);
  }

  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) {
    return acceso.motivo === 'expirada'
      ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()])
      : { tipo: 'no_disponible' };
  }
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  const identidad = await empresaDeLaSesion(sesion.sid, acceso.acceso, deps);
  if (!identidad.ok) {
    if (identidad.motivo === 'no_disponible') return { tipo: 'no_disponible' };
    deps.almacen.borrar(sesion.sid);
    return aIngresar([servicio.borrarCookie()]);
  }

  // H2.3: la empresa de la dirección debe ser la de la sesión; cualquier otra (exista o no) es «no encontrado», sin datos ni marca.
  if (coincide[1] !== identidad.slug) return { tipo: 'no_encontrado', cookies };
  return { tipo: 'pasar', empresa: identidad.slug, cookies };
};

export type { ConfiguracionIngreso };
