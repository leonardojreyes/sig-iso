// Filtros de la lista de documentos leídos de la dirección. Lo que no cumple se descarta y se avisa, así la API nunca recibe un valor
// que rechazaría con 400.
import { UUID } from '../validacion/patrones';
import { TIPOS_DOCUMENTO, type TipoDocumento } from './tipos';

export interface FiltrosDocumentos {
  readonly tipo?: TipoDocumento;
  readonly estado?: 'activo' | 'retirado';
  readonly responsableId?: string;
  readonly area?: string;
  readonly norma?: string;
  readonly sinVigente?: true;
  readonly revisionVencida?: true;
}

type Parametros = Readonly<Record<string, string | readonly string[] | undefined>>;
const NORMA = /^[A-Za-z0-9 :./-]{1,60}$/;

export const leerFiltrosDocumentos = (sp: Parametros): { filtros: FiltrosDocumentos; invalidos: boolean } => {
  let invalidos = false;
  const f: { -readonly [K in keyof FiltrosDocumentos]: FiltrosDocumentos[K] } = {};
  const uno = (k: string): string | undefined => {
    const v = sp[k];
    if (v === undefined || v === '') return undefined;
    if (typeof v !== 'string') {
      invalidos = true;
      return undefined;
    }
    return v;
  };
  const tipo = uno('tipo');
  if (tipo !== undefined) {
    if ((TIPOS_DOCUMENTO as readonly string[]).includes(tipo)) f.tipo = tipo as TipoDocumento;
    else invalidos = true;
  }
  const estado = uno('estado');
  if (estado !== undefined) {
    if (estado === 'activo' || estado === 'retirado') f.estado = estado;
    else invalidos = true;
  }
  const responsable = uno('responsable');
  if (responsable !== undefined) {
    if (UUID.test(responsable)) f.responsableId = responsable.toLowerCase();
    else invalidos = true;
  }
  const area = uno('area');
  if (area !== undefined) {
    if (area.trim().length >= 1 && area.length <= 60) f.area = area.trim();
    else invalidos = true;
  }
  const norma = uno('norma');
  if (norma !== undefined) {
    if (NORMA.test(norma)) f.norma = norma;
    else invalidos = true;
  }
  for (const k of ['sinVigente', 'revisionVencida'] as const) {
    const v = uno(k);
    if (v === undefined || v === 'false') continue;
    if (v === 'true') f[k] = true;
    else invalidos = true;
  }
  return { filtros: f, invalidos };
};

export const construirConsultaDocumentos = (f: FiltrosDocumentos): string => {
  const p = new URLSearchParams();
  if (f.tipo) p.set('tipo', f.tipo);
  if (f.estado) p.set('estado', f.estado);
  if (f.responsableId) p.set('responsableId', f.responsableId);
  if (f.area) p.set('area', f.area);
  if (f.norma) p.set('norma', f.norma);
  if (f.sinVigente) p.set('sinVigente', 'true');
  if (f.revisionVencida) p.set('revisionVencida', 'true');
  const s = p.toString();
  return s ? `?${s}` : '';
};
