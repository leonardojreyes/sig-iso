// Datos de los activos de la empresa de la sesión. Todo sale de la API con el token de la sesión; la empresa nunca es un parámetro.
import { consultarApi } from '../api/cliente';
import { type Carga } from '../documentos/cargar';
import { UUID } from '../validacion/patrones';
import { construirConsultaActivos, type FiltrosActivos } from './filtros';
import type { Activo, ActivoDetalle, ActivoListado, AvisoRetiroActivo } from './tipos';
import { validarActivoDetalle, validarActivos, validarAvisoRetiroActivo, validarListadoActivos } from './validadores';

interface Base {
  readonly acceso: string;
  readonly apiUrl: string;
  readonly fetchFn: typeof fetch;
}

const pedir = async <T>(p: Base, ruta: string, validar: (j: unknown) => T | null): Promise<Carga<T>> => {
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta });
  if (!r.ok) return { tipo: r.motivo === 'no_autenticado' ? 'ingresar' : r.motivo };
  const datos = validar(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};
const conId = async <T>(p: Base & { id: string }, ruta: (id: string) => string, validar: (j: unknown) => T | null): Promise<Carga<T>> =>
  UUID.test(p.id) ? pedir(p, ruta(p.id.toLowerCase()), validar) : { tipo: 'no_encontrado' };

export const cargarActivos = (p: Base & { filtros: FiltrosActivos }): Promise<Carga<ActivoListado[]>> => pedir(p, `/activos${construirConsultaActivos(p.filtros)}`, validarListadoActivos);
export const cargarActivo = (p: Base & { id: string }): Promise<Carga<ActivoDetalle>> => conId(p, (id) => `/activos/${id}`, validarActivoDetalle);
export const cargarAvisoRetiroActivo = (p: Base & { id: string }): Promise<Carga<AvisoRetiroActivo>> => conId(p, (id) => `/activos/${id}/aviso-retiro`, validarAvisoRetiroActivo);
export const cargarActivosDeRiesgo = (p: Base & { id: string }): Promise<Carga<Activo[]>> => conId(p, (id) => `/riesgos/${id}/activos`, (j) => validarActivos(j, 50));
