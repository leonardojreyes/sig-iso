// Datos de alcance y diagnóstico de la empresa de la sesión. Todo sale de la API con el token de la sesión; la empresa nunca es
// un parámetro. Si algo falla no se muestra nada a medias.
import { consultarApi } from '../api/cliente';
import type { Alcance, Diagnostico, MarcoControles } from '../api/tipos';
import { validarAlcances, validarDiagnostico, validarMarcoControles } from '../api/validadores';
import { construirConsulta, type FiltrosDiagnostico } from './filtros';
import { construirConsultaControles, type FiltrosControles } from './filtros-controles';

export type ResultadoCarga<T> = { readonly tipo: 'ok'; readonly datos: T } | { readonly tipo: 'ingresar' } | { readonly tipo: 'sin_permiso' } | { readonly tipo: 'no_disponible' };

interface Base {
  readonly acceso: string;
  readonly apiUrl: string;
  readonly fetchFn: typeof fetch;
}

export const cargarAlcances = async (p: Base): Promise<ResultadoCarga<Alcance[]>> => {
  const r = await consultarApi({ ...p, ruta: '/alcances' });
  if (!r.ok) return r.motivo === 'no_autenticado' ? { tipo: 'ingresar' } : r.motivo === 'sin_permiso' ? { tipo: 'sin_permiso' } : { tipo: 'no_disponible' };
  const datos = validarAlcances(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

export const cargarDiagnostico = async (p: Base & { filtros: FiltrosDiagnostico }): Promise<ResultadoCarga<Diagnostico>> => {
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: `/diagnostico${construirConsulta(p.filtros)}` });
  if (!r.ok) return r.motivo === 'no_autenticado' ? { tipo: 'ingresar' } : r.motivo === 'sin_permiso' ? { tipo: 'sin_permiso' } : { tipo: 'no_disponible' };
  const datos = validarDiagnostico(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

export const cargarControles = async (p: Base & { filtros: FiltrosControles }): Promise<ResultadoCarga<MarcoControles>> => {
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: `/controles${construirConsultaControles(p.filtros)}` });
  if (!r.ok) return r.motivo === 'no_autenticado' ? { tipo: 'ingresar' } : r.motivo === 'sin_permiso' ? { tipo: 'sin_permiso' } : { tipo: 'no_disponible' };
  const datos = validarMarcoControles(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};
