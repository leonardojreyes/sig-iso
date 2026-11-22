// Datos de la auditoría interna de la empresa de la sesión. Todo sale de la API con el token de la sesión; la empresa nunca es un
// parámetro. Si algo falla no se muestra nada a medias.
import { consultarApi } from '../api/cliente';
import { UUID } from '../validacion/patrones';
import {
  validarAuditoria,
  validarDetallePrograma,
  validarIndependencia,
  validarInforme,
  validarListaHallazgos,
  validarListaProcesos,
  validarListaProgramas,
  validarListaRelaciones,
  validarListaVerificacion,
  validarPanel,
} from './validadores';

export type Fallo = { readonly tipo: 'ingresar' } | { readonly tipo: 'sin_permiso' } | { readonly tipo: 'no_encontrado' } | { readonly tipo: 'no_disponible' };
export type Carga<T> = { readonly tipo: 'ok'; readonly datos: T } | Fallo;

export interface Base {
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
/** El identificador se valida antes de armar la ruta: uno mal formado se trata como «no existe». */
const conId = <T>(p: Base & { id: string }, ruta: (id: string) => string, validar: (j: unknown) => T | null): Promise<Carga<T>> =>
  UUID.test(p.id) ? pedir(p, ruta(p.id.toLowerCase()), validar) : Promise.resolve({ tipo: 'no_encontrado' });

export const cargarProcesos = (p: Base) => pedir(p, '/procesos', validarListaProcesos);
export const cargarRelaciones = (p: Base & { id: string }) => conId(p, (id) => `/procesos/${id}/relaciones`, validarListaRelaciones);
export const cargarProgramas = (p: Base) => pedir(p, '/programas', validarListaProgramas);
export const cargarPrograma = (p: Base & { id: string }) => conId(p, (id) => `/programas/${id}`, validarDetallePrograma);
export const cargarAuditoria = (p: Base & { id: string }) => conId(p, (id) => `/auditorias/${id}`, validarAuditoria);
export const cargarLista = (p: Base & { id: string }) => conId(p, (id) => `/auditorias/${id}/lista`, validarListaVerificacion);
export const cargarHallazgos = (p: Base & { id: string }) => conId(p, (id) => `/auditorias/${id}/hallazgos`, validarListaHallazgos);
export const cargarInforme = (p: Base & { id: string }) => conId(p, (id) => `/auditorias/${id}/informe`, validarInforme);
export const cargarPanel = (p: Base) => pedir(p, '/auditoria/panel', validarPanel);
/** Por qué una persona sí o no puede auditar este alcance (solo consulta). */
export const cargarIndependencia = (p: Base & { id: string; personaId: string }) =>
  UUID.test(p.personaId) ? conId(p, (id) => `/auditorias/${id}/independencia?personaId=${p.personaId.toLowerCase()}`, validarIndependencia) : Promise.resolve<Carga<never>>({ tipo: 'no_encontrado' });
