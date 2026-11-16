// Editar la marca de la empresa desde la web (M6b-2). La web NO decide nada: reenvía color y logo a la API (que autoriza, valida y
// registra en la bitácora) con el token de la sesión; la empresa y la persona salen del token, nunca del formulario. Aquí solo se
// protege el formulario: método POST, `Origin` propio exacto, empresa de la dirección = empresa verificada y forma de los dos campos.
// El resultado vuelve a la pantalla como un aviso de una lista cerrada.
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion } from '../auth/sesion';
import { rechazoDeEscritura, redirigir, type EntradaDeEmpresa } from '../auth/guardia-formulario';
import { COLOR, LOGO } from '../validacion/patrones';

export type AvisoMarca = 'guardada' | 'sin_permiso' | 'no_valido' | 'no_disponible';
const AVISOS: readonly string[] = ['guardada', 'sin_permiso', 'no_valido', 'no_disponible'];
export const leerAvisoMarca = (sp: Readonly<Record<string, string | readonly string[] | undefined>>): AvisoMarca | null =>
  typeof sp.aviso === 'string' && AVISOS.includes(sp.aviso) ? (sp.aviso as AvisoMarca) : null;

export const guardarMarca = async (peticion: Request, entrada: EntradaDeEmpresa, deps: DependenciasSesion): Promise<Response> => {
  const { config } = deps;
  const rechazo = rechazoDeEscritura(peticion, config.origen, entrada);
  if (rechazo) return rechazo;
  const slug = entrada.slugVerificado as string;

  const volver = (aviso: AvisoMarca, cookies: readonly string[] = []): Response =>
    redirigir(`${config.origen}/e/${slug}/marca?aviso=${aviso}`, cookies);
  const aIngresar = (cookies: readonly string[]): Response =>
    redirigir(`${config.origen}/auth/login?retorno=${encodeURIComponent(`/e/${slug}/marca`)}`, cookies);

  let formulario: FormData;
  try {
    formulario = await peticion.formData();
  } catch {
    return volver('no_valido');
  }
  const color = formulario.get('color');
  const logoCrudo = formulario.get('logo');
  // Un logo vacío quita el logo (vuelve el monograma). Lo demás debe tener la forma permitida; la API vuelve a decidir.
  const logo = typeof logoCrudo === 'string' ? logoCrudo.trim() : null;
  if (typeof color !== 'string' || !COLOR.test(color) || logo === null || (logo !== '' && (logo.length > 2048 || !LOGO.test(logo))))
    return volver('no_valido');

  const servicio = crearServicioSesion(deps);
  const sesion = await servicio.leer(peticion);
  if (!sesion) return aIngresar([]);
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok)
    return acceso.motivo === 'expirada' ? aIngresar([acceso.limpiarCookie ?? servicio.borrarCookie()]) : volver('no_disponible');
  const cookies = acceso.nuevaCookie ? [acceso.nuevaCookie] : [];

  let estado: number | null;
  try {
    const r = await deps.fetchFn(`${config.apiUrl}/empresa/marca`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${acceso.acceso}`, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ colorPrimario: color, logoUrl: logo === '' ? null : logo }),
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
  if (estado === 200) return volver('guardada', cookies);
  if (estado === 400) return volver('no_valido', cookies);
  if (estado === 403) return volver('sin_permiso', cookies);
  return volver('no_disponible', cookies);
};
