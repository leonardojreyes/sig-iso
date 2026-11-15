// Cambiar de empresa desde la web (ADR 035). La web NO decide pertenencia: manda el slug elegido a la API (que lo compara con las
// empresas de la persona del token y registra el cambio) y, si la API acepta, actualiza la empresa de la sesión que usa el proxy.
// Aquí solo se protege el formulario: método POST, `Origin` propio exacto, empresa de la dirección = empresa verificada, y un slug
// con forma válida. El resultado vuelve como un aviso de una lista cerrada.
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion, origenValido } from '../auth/sesion';

const SIN_CACHE = { 'Cache-Control': 'no-store' };
const SLUG = /^[a-z0-9-]{1,32}$/;
/** Lo que el proxy recuerda de la empresa de una sesión (igual que al confirmarla con la API). */
const VIDA_IDENTIDAD_MS = 5 * 60_000;

export type AvisoCambio = 'no_encontrada' | 'no_valido' | 'no_disponible';
const AVISOS: readonly string[] = ['no_encontrada', 'no_valido', 'no_disponible'];
export const leerAvisoCambio = (sp: Readonly<Record<string, string | readonly string[] | undefined>>): AvisoCambio | null =>
  typeof sp.cambio === 'string' && AVISOS.includes(sp.cambio) ? (sp.cambio as AvisoCambio) : null;

export const cambiarEmpresa = async (
  peticion: Request,
  entrada: { slugDeLaDireccion: string; slugVerificado: string | null },
  deps: DependenciasSesion,
): Promise<Response> => {
  const { config } = deps;
  if (peticion.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: { Allow: 'POST', ...SIN_CACHE } });
  if (!origenValido(peticion, config.origen)) return new Response('Origen no permitido', { status: 403, headers: SIN_CACHE });
  if (!entrada.slugVerificado || entrada.slugVerificado !== entrada.slugDeLaDireccion) return new Response(null, { status: 404, headers: SIN_CACHE });
  const actual = entrada.slugVerificado;

  const redirigir = (ubicacion: string, cookies: readonly string[] = []): Response => {
    const cabeceras = new Headers({ Location: ubicacion, ...SIN_CACHE });
    for (const c of cookies) cabeceras.append('Set-Cookie', c);
    return new Response(null, { status: 303, headers: cabeceras });
  };
  const volver = (aviso: AvisoCambio, cookies: readonly string[] = []): Response => redirigir(`${config.origen}/e/${actual}/panel?cambio=${aviso}`, cookies);
  const aIngresar = (cookies: readonly string[]): Response => redirigir(`${config.origen}/auth/login?retorno=${encodeURIComponent(`/e/${actual}/panel`)}`, cookies);

  let formulario: FormData;
  try {
    formulario = await peticion.formData();
  } catch {
    return volver('no_valido');
  }
  const elegida = formulario.get('empresa');
  if (typeof elegida !== 'string' || !SLUG.test(elegida)) return volver('no_valido');

  const servicio = crearServicioSesion(deps);
  const sesion = await servicio.leer(peticion);
  if (!sesion) return aIngresar([]);
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) return acceso.motivo === 'expirada' ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()]) : volver('no_disponible');
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  let estado: number | null;
  let json: unknown = null;
  try {
    const r = await deps.fetchFn(`${config.apiUrl}/sesion/empresa`, {
      method: 'POST',
      headers: { authorization: `Bearer ${acceso.acceso}`, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ slug: elegida }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      cache: 'no-store',
    });
    estado = r.status;
    if (estado === 200) json = await r.json().catch(() => null);
  } catch {
    estado = null;
  }
  if (estado === 401) {
    deps.almacen.borrar(sesion.sid);
    return aIngresar([servicio.borrarCookie()]);
  }
  if (estado === 200) {
    // La API confirma la empresa activa: se actualiza la que recuerda el proxy y se entra a ella. Una respuesta que no coincide con lo
    // pedido no se da por buena.
    const slug = (json as { slug?: unknown } | null)?.slug;
    if (slug !== elegida) return volver('no_disponible', cookies);
    deps.almacen.guardarEmpresa(sesion.sid, elegida, deps.ahora().getTime() + VIDA_IDENTIDAD_MS);
    return redirigir(`${config.origen}/e/${elegida}/panel`, cookies);
  }
  if (estado === 400) return volver('no_valido', cookies);
  if (estado === 404) return volver('no_encontrada', cookies);
  return volver('no_disponible', cookies);
};
