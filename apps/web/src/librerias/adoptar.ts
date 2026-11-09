// Adoptar una librería desde la web (H4.6 a H4.10). La web no decide nada: reenvía a la API, que es la que autoriza (solo el
// administrador SIG), con el token de la sesión y SIN cuerpo (la empresa y la persona salen del token). Aquí solo se protege el
// formulario: método POST, `Origin` propio exacto (ausente o «null» se rechaza), empresa de la dirección = empresa verificada y
// librería con forma de UUID. El resultado vuelve al listado como un aviso de una lista cerrada.
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion, origenValido } from '../auth/sesion';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_CACHE = { 'Cache-Control': 'no-store' };

export const adoptarLibreria = async (
  peticion: Request,
  entrada: { slugDeLaDireccion: string; slugVerificado: string | null; libreriaId: string },
  deps: DependenciasSesion,
): Promise<Response> => {
  const { config } = deps;
  if (peticion.method !== 'POST')
    return new Response('Método no permitido', { status: 405, headers: { Allow: 'POST', ...SIN_CACHE } });
  if (!origenValido(peticion, config.origen))
    return new Response('Origen no permitido', { status: 403, headers: SIN_CACHE });
  if (
    !UUID.test(entrada.libreriaId) ||
    !entrada.slugVerificado ||
    entrada.slugVerificado !== entrada.slugDeLaDireccion
  ) {
    return new Response(null, { status: 404, headers: SIN_CACHE });
  }
  const slug = entrada.slugVerificado;

  const redirigir = (ubicacion: string, cookies: readonly string[]): Response => {
    const cabeceras = new Headers({ Location: ubicacion, ...SIN_CACHE });
    for (const c of cookies) cabeceras.append('Set-Cookie', c);
    return new Response(null, { status: 303, headers: cabeceras });
  };
  const aIngresar = (cookies: readonly string[]): Response =>
    redirigir(`${config.origen}/auth/login?retorno=${encodeURIComponent(`/e/${slug}/requisitos`)}`, cookies);
  const volver = (aviso: string, cookies: readonly string[], libreria?: string): Response => {
    const q = new URLSearchParams({ adopcion: aviso, ...(libreria ? { libreria } : {}) });
    return redirigir(`${config.origen}/e/${slug}/requisitos?${q}`, cookies);
  };

  const servicio = crearServicioSesion(deps);
  const sesion = await servicio.leer(peticion);
  if (!sesion) return aIngresar([]);
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) {
    return acceso.motivo === 'expirada'
      ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()])
      : volver('no_disponible', []);
  }
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  let estado: number | null;
  try {
    const r = await deps.fetchFn(`${config.apiUrl}/librerias/${entrada.libreriaId}/adopcion`, {
      method: 'POST',
      headers: { authorization: `Bearer ${acceso.acceso}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
      cache: 'no-store',
    });
    estado = r.status;
  } catch {
    estado = null;
  }
  if (estado === 401) {
    deps.almacen.borrar(sesion.sid);
    return aIngresar([servicio.borrarCookie()]);
  }
  if (estado === 201) return volver('adoptada', cookies, entrada.libreriaId);
  if (estado === 200) return volver('ya_adoptada', cookies, entrada.libreriaId);
  if (estado === 403) return volver('sin_permiso', cookies);
  if (estado === 404) return volver('no_encontrada', cookies);
  return volver('no_disponible', cookies);
};
