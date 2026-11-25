// La respuesta de la API se trata como un dato externo: forma EXACTA, tipos, patrones y topes del contrato. Lo que no cumple se rechaza
// entero (nunca se corrige ni se muestra a medias).
import { UUID } from '../validacion/patrones';
import { CLASIFICACIONES_ACTIVO, TIPOS_ACTIVO, type Activo, type ActivoDetalle, type ActivoListado, type AvisoRetiroActivo } from './tipos';

const objeto = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const claves = (o: Record<string, unknown>, esperadas: readonly string[]): boolean => Object.keys(o).sort().join(',') === [...esperadas].sort().join(',');
const texto = (v: unknown, max: number, patron?: RegExp, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max && (patron === undefined || patron.test(v));
const entero = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const en = (v: unknown, lista: readonly string[]): boolean => typeof v === 'string' && lista.includes(v);
const uuid = (v: unknown): v is string => texto(v, 36, UUID);
const CODIGO_ACTIVO = /^A-\d{3,6}$/;
const CODIGO_RIESGO = /^R-\d{3,6}$/;
const NIVELES = ['bajo', 'medio', 'alto', 'critico'];
const CAMPOS = ['id', 'codigo', 'nombre', 'descripcion', 'tipo', 'clasificacion', 'responsableId', 'estado', 'version'];

const activoValido = (a: Record<string, unknown>): boolean =>
  uuid(a.id) && texto(a.codigo, 8, CODIGO_ACTIVO) && texto(a.nombre, 120, undefined, 1) && (a.descripcion === null || texto(a.descripcion, 500, undefined, 1)) && en(a.tipo, TIPOS_ACTIVO) && en(a.clasificacion, CLASIFICACIONES_ACTIVO) && uuid(a.responsableId) && (a.estado === 'vigente' || a.estado === 'retirado') && entero(a.version, 1);

export const validarActivo = (cuerpo: unknown): Activo | null => {
  const a = objeto(cuerpo);
  return a && claves(a, CAMPOS) && activoValido(a) ? (a as unknown as Activo) : null;
};

export const validarActivos = (cuerpo: unknown, max = 50): Activo[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > max) return null;
  const vistos = new Set<string>();
  for (const item of cuerpo) {
    const a = objeto(item);
    if (!a || !claves(a, CAMPOS) || !activoValido(a) || vistos.has(a.codigo as string)) return null;
    vistos.add(a.codigo as string);
  }
  return cuerpo as Activo[];
};

export const validarListadoActivos = (cuerpo: unknown): ActivoListado[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 500) return null;
  const vistos = new Set<string>();
  for (const item of cuerpo) {
    const a = objeto(item);
    if (!a || !claves(a, [...CAMPOS, 'riesgos', 'sinRiesgos']) || !activoValido(a) || !entero(a.riesgos, 0, 500) || typeof a.sinRiesgos !== 'boolean' || vistos.has(a.codigo as string)) return null;
    // «Sin riesgos» solo es cierto para un activo vigente sin ningún riesgo vigente ligado.
    if (a.sinRiesgos !== (a.estado === 'vigente' && a.riesgos === 0)) return null;
    vistos.add(a.codigo as string);
  }
  return cuerpo as ActivoListado[];
};

export const validarActivoDetalle = (cuerpo: unknown): ActivoDetalle | null => {
  const a = objeto(cuerpo);
  if (!a || !claves(a, [...CAMPOS, 'riesgos', 'nivelMasAlto']) || !activoValido(a) || !Array.isArray(a.riesgos) || a.riesgos.length > 500) return null;
  if (!(a.nivelMasAlto === null || en(a.nivelMasAlto, NIVELES))) return null;
  const ids = new Set<string>();
  for (const item of a.riesgos) {
    const r = objeto(item);
    if (!r || !claves(r, ['id', 'codigo', 'titulo', 'nivel', 'puntaje', 'estado']) || !uuid(r.id) || ids.has(r.id) || !texto(r.codigo, 8, CODIGO_RIESGO) || !texto(r.titulo, 120, undefined, 1) || !en(r.nivel, NIVELES) || !entero(r.puntaje, 1, 25) || (r.estado !== 'vigente' && r.estado !== 'retirado')) return null;
    ids.add(r.id);
  }
  return a as unknown as ActivoDetalle;
};

export const validarAvisoRetiroActivo = (cuerpo: unknown): AvisoRetiroActivo | null => {
  const a = objeto(cuerpo);
  if (!a || !claves(a, ['activoId', 'codigo', 'riesgosSinActivo']) || !uuid(a.activoId) || !texto(a.codigo, 8, CODIGO_ACTIVO) || !Array.isArray(a.riesgosSinActivo) || a.riesgosSinActivo.length > 500) return null;
  for (const item of a.riesgosSinActivo) {
    const r = objeto(item);
    if (!r || !claves(r, ['id', 'codigo', 'titulo']) || !uuid(r.id) || !texto(r.codigo, 8, CODIGO_RIESGO) || !texto(r.titulo, 120, undefined, 1)) return null;
  }
  return a as unknown as AvisoRetiroActivo;
};
