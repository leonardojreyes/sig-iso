// Datos de alcance y diagnóstico de la empresa de la sesión. Todo sale de la API con el token de la sesión; la empresa nunca es
// un parámetro. Si algo falla no se muestra nada a medias.
import { consultarApi } from '../api/cliente';
import type { Alcance, Cobertura, Diagnostico, Evidencia, MarcoControles } from '../api/tipos';
import { validarAlcances, validarCobertura, validarDiagnostico, validarEvidencias, validarMarcoControles } from '../api/validadores';
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Fallo = { readonly tipo: 'ingresar' } | { readonly tipo: 'sin_permiso' } | { readonly tipo: 'no_encontrado' } | { readonly tipo: 'no_disponible' };

/** Las evidencias de un control (404 si el control no existe o es de otra empresa). El identificador se valida antes de armar la ruta. */
export const cargarEvidencias = async (p: Base & { controlId: string; incluirHistoricas: boolean }): Promise<{ readonly tipo: 'ok'; readonly datos: Evidencia[] } | Fallo> => {
  if (!UUID.test(p.controlId)) return { tipo: 'no_encontrado' };
  const consulta = p.incluirHistoricas ? '?incluirHistoricas=true' : '';
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: `/controles/${p.controlId.toLowerCase()}/evidencias${consulta}` });
  if (!r.ok) return r.motivo === 'no_autenticado' ? { tipo: 'ingresar' } : r.motivo === 'sin_permiso' ? { tipo: 'sin_permiso' } : r.motivo === 'no_encontrado' ? { tipo: 'no_encontrado' } : { tipo: 'no_disponible' };
  const datos = validarEvidencias(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

export const cargarCobertura = async (p: Base & { norma?: string }): Promise<ResultadoCarga<Cobertura>> => {
  const consulta = p.norma ? `?norma=${encodeURIComponent(p.norma)}` : '';
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: `/cobertura${consulta}` });
  if (!r.ok) return r.motivo === 'no_autenticado' ? { tipo: 'ingresar' } : r.motivo === 'sin_permiso' ? { tipo: 'sin_permiso' } : { tipo: 'no_disponible' };
  const datos = validarCobertura(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};
