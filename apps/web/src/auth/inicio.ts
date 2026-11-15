// La portada lleva a quien YA tiene sesión directo al listado de su empresa, o a elegir la empresa si pertenece a varias (ADR 035).
// La empresa sale de la API con el token (`/me` y `/sesion/empresas`), nunca de una dirección ni de datos de demostración. Ante
// cualquier duda devuelve null y se muestra la portada de ingreso.
import { consultarApi } from '../api/cliente';
import { validarEmpresasDePersona, validarIdentidad } from '../api/validadores';
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
  if (!identidad) return null;
  // Quien pertenece a varias empresas elige con cuál va a trabajar. Si esta consulta falla o no cumple el contrato, se sigue como
  // siempre (a la empresa de la sesión): no se bloquea la entrada por algo que solo ayuda a elegir.
  const empresas = await consultarApi({ ruta: '/sesion/empresas', acceso: acceso.acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn });
  const lista = empresas.ok ? validarEmpresasDePersona(empresas.json) : null;
  if (lista && lista.length > 1) return '/empresas';
  return `/e/${identidad.empresa.slug}/requisitos`;
};
