// La empresa de la sesión para las pantallas internas, con su marca real. Defensa en profundidad: aunque el proxy ya comprobó la
// sesión, aquí se vuelve a exigir que la empresa de la dirección sea la verificada por él y se pide la marca con el token.
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion } from '../auth/sesion';
import { cargarMarca } from './marca';
import type { Empresa } from './tipos';

export type EmpresaActual =
  | { readonly tipo: 'ok'; readonly empresa: Empresa }
  | { readonly tipo: 'no_encontrado' }
  | { readonly tipo: 'ingresar' }
  | { readonly tipo: 'no_disponible' };

export const cargarEmpresaActual = async (
  entrada: { slugDeLaDireccion: string; slugVerificado: string | null; cookie: string | null },
  deps: DependenciasSesion,
): Promise<EmpresaActual> => {
  if (!entrada.slugVerificado || entrada.slugVerificado !== entrada.slugDeLaDireccion) return { tipo: 'no_encontrado' };

  const servicio = crearServicioSesion(deps);
  const sesion = await servicio.leer(
    new Request('http://interno.invalid/', { headers: entrada.cookie ? { cookie: entrada.cookie } : {} }),
  );
  if (!sesion) return { tipo: 'ingresar' };

  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) return acceso.motivo === 'expirada' ? { tipo: 'ingresar' } : { tipo: 'no_disponible' };

  const marca = await cargarMarca({
    slug: entrada.slugVerificado,
    acceso: acceso.acceso,
    apiUrl: deps.config.apiUrl,
    fetchFn: deps.fetchFn,
  });
  if (marca.ok) return { tipo: 'ok', empresa: marca.empresa };
  if (marca.motivo === 'no_autenticado') {
    deps.almacen.borrar(sesion.sid);
    return { tipo: 'ingresar' };
  }
  return { tipo: 'no_disponible' };
};
