import { consultarApi } from '../api/cliente';
import { type Carga } from '../documentos/cargar';
import type { Criterios } from './tipos';
import { validarCriterios } from './validadores';

interface Base {
  readonly acceso: string;
  readonly apiUrl: string;
  readonly fetchFn: typeof fetch;
}

/** Los criterios vigentes de la empresa de la sesión (o la escala por omisión) con la matriz. La empresa nunca es un parámetro. */
export const cargarCriterios = async (p: Base): Promise<Carga<Criterios>> => {
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: '/criterios' });
  if (!r.ok) return { tipo: r.motivo === 'no_autenticado' ? 'ingresar' : r.motivo };
  const datos = validarCriterios(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};
