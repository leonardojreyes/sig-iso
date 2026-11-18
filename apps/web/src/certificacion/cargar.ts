// Datos de alcance y diagnóstico de la empresa de la sesión. Todo sale de la API con el token de la sesión; la empresa nunca es
// un parámetro. Si algo falla no se muestra nada a medias.
import { consultarApi } from '../api/cliente';
import type {
  MotivoDeclaracion,
  AvisoRetiroRiesgo,
  RiesgoDetalle,
  RiesgoListado,
  Alcance,
  Cobertura,
  Declaracion,
  Diagnostico,
  Evidencia,
  MarcoControles,
  VersionDeclaracion,
  VersionDeclaracionConFilas,
} from '../api/tipos';
import {
  validarMotivosDeclaracion,
  validarAvisoRetiroRiesgo,
  validarRiesgoDetalle,
  validarRiesgos,
  validarAlcances,
  validarCobertura,
  validarDeclaracion,
  validarDiagnostico,
  validarEvidencias,
  validarMarcoControles,
  validarVersionDeclaracionConFilas,
  validarVersionesDeclaracion,
} from '../api/validadores';
import { construirConsulta, type FiltrosDiagnostico } from './filtros';
import { construirConsultaRiesgos, type FiltrosRiesgos } from './filtros-riesgos';
import { construirConsultaControles, type FiltrosControles } from './filtros-controles';
import { UUID } from '../validacion/patrones';

export type ResultadoCarga<T> =
  | { readonly tipo: 'ok'; readonly datos: T }
  | { readonly tipo: 'ingresar' }
  | { readonly tipo: 'sin_permiso' }
  | { readonly tipo: 'no_disponible' };

interface Base {
  readonly acceso: string;
  readonly apiUrl: string;
  readonly fetchFn: typeof fetch;
}

export const cargarAlcances = async (p: Base): Promise<ResultadoCarga<Alcance[]>> => {
  const r = await consultarApi({ ...p, ruta: '/alcances' });
  if (!r.ok)
    return r.motivo === 'no_autenticado'
      ? { tipo: 'ingresar' }
      : r.motivo === 'sin_permiso'
        ? { tipo: 'sin_permiso' }
        : { tipo: 'no_disponible' };
  const datos = validarAlcances(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

export const cargarDiagnostico = async (p: Base & { filtros: FiltrosDiagnostico }): Promise<ResultadoCarga<Diagnostico>> => {
  const r = await consultarApi({
    acceso: p.acceso,
    apiUrl: p.apiUrl,
    fetchFn: p.fetchFn,
    ruta: `/diagnostico${construirConsulta(p.filtros)}`,
  });
  if (!r.ok)
    return r.motivo === 'no_autenticado'
      ? { tipo: 'ingresar' }
      : r.motivo === 'sin_permiso'
        ? { tipo: 'sin_permiso' }
        : { tipo: 'no_disponible' };
  const datos = validarDiagnostico(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

export const cargarControles = async (p: Base & { filtros: FiltrosControles }): Promise<ResultadoCarga<MarcoControles>> => {
  const r = await consultarApi({
    acceso: p.acceso,
    apiUrl: p.apiUrl,
    fetchFn: p.fetchFn,
    ruta: `/controles${construirConsultaControles(p.filtros)}`,
  });
  if (!r.ok)
    return r.motivo === 'no_autenticado'
      ? { tipo: 'ingresar' }
      : r.motivo === 'sin_permiso'
        ? { tipo: 'sin_permiso' }
        : { tipo: 'no_disponible' };
  const datos = validarMarcoControles(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

type Fallo =
  | { readonly tipo: 'ingresar' }
  | { readonly tipo: 'sin_permiso' }
  | { readonly tipo: 'no_encontrado' }
  | { readonly tipo: 'no_disponible' };

/** Las evidencias de un control (404 si el control no existe o es de otra empresa). El identificador se valida antes de armar la ruta. */
export const cargarEvidencias = async (
  p: Base & { controlId: string; incluirHistoricas: boolean },
): Promise<{ readonly tipo: 'ok'; readonly datos: Evidencia[] } | Fallo> => {
  if (!UUID.test(p.controlId)) return { tipo: 'no_encontrado' };
  const consulta = p.incluirHistoricas ? '?incluirHistoricas=true' : '';
  const r = await consultarApi({
    acceso: p.acceso,
    apiUrl: p.apiUrl,
    fetchFn: p.fetchFn,
    ruta: `/controles/${p.controlId.toLowerCase()}/evidencias${consulta}`,
  });
  if (!r.ok)
    return r.motivo === 'no_autenticado'
      ? { tipo: 'ingresar' }
      : r.motivo === 'sin_permiso'
        ? { tipo: 'sin_permiso' }
        : r.motivo === 'no_encontrado'
          ? { tipo: 'no_encontrado' }
          : { tipo: 'no_disponible' };
  const datos = validarEvidencias(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

export const cargarCobertura = async (p: Base & { norma?: string }): Promise<ResultadoCarga<Cobertura>> => {
  const consulta = p.norma ? `?norma=${encodeURIComponent(p.norma)}` : '';
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: `/cobertura${consulta}` });
  if (!r.ok)
    return r.motivo === 'no_autenticado'
      ? { tipo: 'ingresar' }
      : r.motivo === 'sin_permiso'
        ? { tipo: 'sin_permiso' }
        : { tipo: 'no_disponible' };
  const datos = validarCobertura(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

/** El borrador de la declaración (derivado hoy) y su última versión aprobada. */
export const cargarDeclaracion = async (p: Base): Promise<ResultadoCarga<Declaracion>> => {
  const r = await consultarApi({ ...p, ruta: '/declaracion' });
  if (!r.ok)
    return r.motivo === 'no_autenticado'
      ? { tipo: 'ingresar' }
      : r.motivo === 'sin_permiso'
        ? { tipo: 'sin_permiso' }
        : { tipo: 'no_disponible' };
  const datos = validarDeclaracion(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

/** Las versiones aprobadas, de la más nueva a la más antigua. */
export const cargarVersionesDeclaracion = async (p: Base): Promise<ResultadoCarga<VersionDeclaracion[]>> => {
  const r = await consultarApi({ ...p, ruta: '/declaracion/versiones' });
  if (!r.ok)
    return r.motivo === 'no_autenticado'
      ? { tipo: 'ingresar' }
      : r.motivo === 'sin_permiso'
        ? { tipo: 'sin_permiso' }
        : { tipo: 'no_disponible' };
  const datos = validarVersionesDeclaracion(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

/** Una versión aprobada con sus filas congeladas (404 si no existe o es de otra empresa). El identificador se valida antes de armar la ruta. */
export const cargarVersionDeclaracion = async (
  p: Base & { id: string },
): Promise<{ readonly tipo: 'ok'; readonly datos: VersionDeclaracionConFilas } | Fallo> => {
  if (!UUID.test(p.id)) return { tipo: 'no_encontrado' };
  const r = await consultarApi({
    acceso: p.acceso,
    apiUrl: p.apiUrl,
    fetchFn: p.fetchFn,
    ruta: `/declaracion/versiones/${p.id.toLowerCase()}`,
  });
  if (!r.ok)
    return r.motivo === 'no_autenticado'
      ? { tipo: 'ingresar' }
      : r.motivo === 'sin_permiso'
        ? { tipo: 'sin_permiso' }
        : r.motivo === 'no_encontrado'
          ? { tipo: 'no_encontrado' }
          : { tipo: 'no_disponible' };
  const datos = validarVersionDeclaracionConFilas(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

const fallo = (motivo: string): { readonly tipo: 'ingresar' } | { readonly tipo: 'sin_permiso' } | { readonly tipo: 'no_encontrado' } | { readonly tipo: 'no_disponible' } =>
  motivo === 'no_autenticado' ? { tipo: 'ingresar' } : motivo === 'sin_permiso' ? { tipo: 'sin_permiso' } : motivo === 'no_encontrado' ? { tipo: 'no_encontrado' } : { tipo: 'no_disponible' };

/** Los riesgos de la empresa (por omisión solo los vigentes), cada uno con cuánto tratamiento tiene. */
export const cargarRiesgos = async (p: Base & { filtros: FiltrosRiesgos }): Promise<ResultadoCarga<RiesgoListado[]>> => {
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: `/riesgos${construirConsultaRiesgos(p.filtros)}` });
  if (!r.ok) {
    const f = fallo(r.motivo);
    return f.tipo === 'no_encontrado' ? { tipo: 'no_disponible' } : f;
  }
  const datos = validarRiesgos(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

/** Un riesgo con los controles que lo tratan (404 si no existe o es de otra empresa). El identificador se valida antes de armar la ruta. */
export const cargarRiesgo = async (p: Base & { id: string }): Promise<{ readonly tipo: 'ok'; readonly datos: RiesgoDetalle } | Fallo> => {
  if (!UUID.test(p.id)) return { tipo: 'no_encontrado' };
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: `/riesgos/${p.id.toLowerCase()}` });
  if (!r.ok) return fallo(r.motivo);
  const datos = validarRiesgoDetalle(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

/** Qué controles quedarían sin motivo si se retira el riesgo (solo para quien puede retirar). */
export const cargarAvisoRetiroRiesgo = async (p: Base & { id: string }): Promise<{ readonly tipo: 'ok'; readonly datos: AvisoRetiroRiesgo } | Fallo> => {
  if (!UUID.test(p.id)) return { tipo: 'no_encontrado' };
  const r = await consultarApi({ acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn, ruta: `/riesgos/${p.id.toLowerCase()}/aviso-retiro` });
  if (!r.ok) return fallo(r.motivo);
  const datos = validarAvisoRetiroRiesgo(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};

/** Los motivos registrados, con la versión de cada uno (para cambiarlos o quitarlos). */
export const cargarMotivosDeclaracion = async (p: Base): Promise<ResultadoCarga<MotivoDeclaracion[]>> => {
  const r = await consultarApi({ ...p, ruta: '/declaracion/motivos' });
  if (!r.ok) {
    const f = fallo(r.motivo);
    return f.tipo === 'no_encontrado' ? { tipo: 'no_disponible' } : f;
  }
  const datos = validarMotivosDeclaracion(r.json);
  return datos ? { tipo: 'ok', datos } : { tipo: 'no_disponible' };
};
