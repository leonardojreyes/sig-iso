// La portada lleva a quien YA tiene sesión directo al listado de su empresa. La empresa sale de la API con el token (`/me`),
// nunca de una dirección ni de datos de demostración. Ante cualquier duda devuelve null y se muestra la portada de ingreso.
import { consultarApi } from '../api/cliente';
import { validarIdentidad } from '../api/validadores';
import type { DependenciasSesion } from './sesion';
import { crearServicioSesion } from './sesion';

export const rutaDeInicio = async (cookie: string | null, deps: DependenciasSesion): Promise<string | null> => {
  if (!cookie) return null;
  const servicio = crearServicioSesion(deps);
  const sesion = await servicio.leer(new Request('http://interno.invalid/', { headers: { cookie } }));
  if (!sesion) return null;
  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) return null;
  const me = await consultarApi({
    ruta: '/me',
    acceso: acceso.acceso,
    apiUrl: deps.config.apiUrl,
    fetchFn: deps.fetchFn,
  });
  if (!me.ok) return null;
  const identidad = validarIdentidad(me.json);
  return identidad ? `/e/${identidad.empresa.slug}/requisitos` : null;
};
