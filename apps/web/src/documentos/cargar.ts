// Datos del control documental de la empresa de la sesión. Todo sale de la API con el token de la sesión; la empresa nunca es un
// parámetro. Si algo falla no se muestra nada a medias.
import { consultarApi } from '../api/cliente';
import { UUID } from '../validacion/patrones';
import { construirConsultaDocumentos, type FiltrosDocumentos } from './filtros';
import type { CoberturaDocumental, DocumentoDetalle, LecturaPendiente, ListaDocumentos, PersonaDirectorio, Retencion } from './tipos';
import { validarCoberturaDocumental, validarDirectorio, validarDocumentoDetalle, validarLecturasPendientes, validarListaDocumentos, validarRetenciones } from './validadores';

export type Fallo = { readonly tipo: 'ingresar' } | { readonly tipo: 'sin_permiso' } | { readonly tipo: 'no_encontrado' } | { readonly tipo: 'no_disponible' };
export type Carga<T> = { readonly tipo: 'ok'; readonly datos: T } | Fallo;

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

export const cargarDocumentos = (p: Base & { filtros: FiltrosDocumentos }): Promise<Carga<ListaDocumentos>> => pedir(p, `/documentos${construirConsultaDocumentos(p.filtros)}`, validarListaDocumentos);

/** Un documento con su historial (404 si no existe o es de otra empresa). El identificador se valida antes de armar la ruta. */
export const cargarDocumento = async (p: Base & { id: string }): Promise<Carga<DocumentoDetalle>> => {
  if (!UUID.test(p.id)) return { tipo: 'no_encontrado' };
  return pedir(p, `/documentos/${p.id.toLowerCase()}`, validarDocumentoDetalle);
};

export const cargarLecturasPendientes = (p: Base): Promise<Carga<LecturaPendiente[]>> => pedir(p, '/lecturas/pendientes', validarLecturasPendientes);

export const cargarCoberturaDocumental = (p: Base & { norma?: string; soloSinDocumento: boolean }): Promise<Carga<CoberturaDocumental>> => {
  const q = new URLSearchParams();
  if (p.norma) q.set('norma', p.norma);
  if (p.soloSinDocumento) q.set('soloSinDocumento', 'true');
  return pedir(p, `/cobertura-documental${q.size > 0 ? `?${q}` : ''}`, validarCoberturaDocumental);
};

export const cargarRetencion = (p: Base): Promise<Carga<Retencion[]>> => pedir(p, '/retencion', validarRetenciones);

export const cargarDirectorio = (p: Base): Promise<Carga<PersonaDirectorio[]>> => pedir(p, '/certificacion/personas', validarDirectorio);
