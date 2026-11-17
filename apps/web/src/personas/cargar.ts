// Personas y solicitudes de acceso de la empresa de la sesión (ADR 036). Todo sale de la API con el token de la sesión; la empresa nunca
// es un parámetro. Si algo falla no se muestra nada a medias.
import { consultarApi } from '../api/cliente';
import type { Personas } from '../api/tipos';
import { validarPersonas } from '../api/validadores';
import type { ResultadoCarga } from '../certificacion/cargar';

export const cargarPersonas = async (p: { readonly acceso: string; readonly apiUrl: string; readonly fetchFn: typeof fetch }): Promise<ResultadoCarga<Personas>> => {
  const r = await consultarApi({ ...p, ruta: '/personas' });
  if (!r.ok) return r.motivo === 'no_autenticado' ? { tipo: 'ingresar' } : r.motivo === 'sin_permiso' ? { tipo: 'sin_permiso' } : { tipo: 'no_disponible' };
  const datos = validarPersonas(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};
