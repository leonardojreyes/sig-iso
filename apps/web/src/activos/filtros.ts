// Filtros de la lista de activos leídos de la dirección. Lo que no cumple se descarta y se avisa: la API nunca recibe un valor que rechazaría.
import { UUID } from '../validacion/patrones';
import { CLASIFICACIONES_ACTIVO, TIPOS_ACTIVO, type ClasificacionActivo, type TipoActivo } from './tipos';

export interface FiltrosActivos {
  readonly tipo?: TipoActivo;
  readonly clasificacion?: ClasificacionActivo;
  readonly responsableId?: string;
  readonly retirados?: true;
}
type Parametros = Readonly<Record<string, string | readonly string[] | undefined>>;

export const leerFiltrosActivos = (sp: Parametros): { filtros: FiltrosActivos; invalidos: boolean } => {
  let invalidos = false;
  const f: { -readonly [K in keyof FiltrosActivos]: FiltrosActivos[K] } = {};
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
    if ((TIPOS_ACTIVO as readonly string[]).includes(tipo)) f.tipo = tipo as TipoActivo;
    else invalidos = true;
  }
  const clasificacion = uno('clasificacion');
  if (clasificacion !== undefined) {
    if ((CLASIFICACIONES_ACTIVO as readonly string[]).includes(clasificacion)) f.clasificacion = clasificacion as ClasificacionActivo;
    else invalidos = true;
  }
  const responsable = uno('responsable');
  if (responsable !== undefined) {
    if (UUID.test(responsable)) f.responsableId = responsable.toLowerCase();
    else invalidos = true;
  }
  const retirados = uno('retirados');
  if (retirados !== undefined && retirados !== 'false') {
    if (retirados === 'true') f.retirados = true;
    else invalidos = true;
  }
  return { filtros: f, invalidos };
};

export const construirConsultaActivos = (f: FiltrosActivos): string => {
  const p = new URLSearchParams();
  if (f.tipo) p.set('tipo', f.tipo);
  if (f.clasificacion) p.set('clasificacion', f.clasificacion);
  if (f.responsableId) p.set('responsableId', f.responsableId);
  if (f.retirados) p.set('incluirRetirados', 'true');
  const s = p.toString();
  return s ? `?${s}` : '';
};
