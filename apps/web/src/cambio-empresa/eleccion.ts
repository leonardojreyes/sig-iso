// Datos de la pantalla «¿Con qué empresa va a trabajar?» (ADR 035). Las empresas de la persona salen de la API con el token de la
// sesión (`/sesion/empresas`), nunca de la dirección. Quien tiene una sola entra directo; quien tiene varias elige; ante cualquier duda
// no se muestra nada a medias.
import { consultarApi } from '../api/cliente';
import type { EmpresaDePersona } from '../api/tipos';
import { validarEmpresasDePersona } from '../api/validadores';
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion } from '../auth/sesion';

export type Eleccion =
  | { readonly tipo: 'ingresar' }
  | { readonly tipo: 'no_disponible' }
  /** Una sola empresa: no hay nada que elegir. */
  | { readonly tipo: 'una'; readonly slug: string }
  | { readonly tipo: 'varias'; readonly empresas: readonly EmpresaDePersona[] };

export const cargarEleccion = async (cookie: string | null, deps: DependenciasSesion): Promise<Eleccion> => {
  if (!cookie) return { tipo: 'ingresar' };
  const servicio = crearServicioSesion(deps);
  const sesion = await servicio.leer(new Request('http://interno.invalid/', { headers: { cookie } }));
  if (!sesion) return { tipo: 'ingresar' };
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) return acceso.motivo === 'expirada' ? { tipo: 'ingresar' } : { tipo: 'no_disponible' };
  const r = await consultarApi({ ruta: '/sesion/empresas', acceso: acceso.acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn });
  if (!r.ok) return r.motivo === 'no_autenticado' ? { tipo: 'ingresar' } : { tipo: 'no_disponible' };
  const empresas = validarEmpresasDePersona(r.json);
  if (!empresas || empresas.length === 0) return { tipo: 'no_disponible' };
  if (empresas.length === 1) return { tipo: 'una', slug: empresas[0]!.slug };
  return { tipo: 'varias', empresas };
};
