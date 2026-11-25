// Validación de la forma EXACTA de lo que responde la API (dato externo): sin campos de más ni de menos, tipos, patrones y topes del
// contrato. Lo que no cumple se rechaza entero (nunca se corrige ni se muestra a medias). Combinadores mínimos para no repetir.
import { UUID } from '../validacion/patrones';

export type Validador = (v: unknown) => boolean;

export const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const texto =
  (max: number, patron?: RegExp, min = 0): Validador =>
  (v) =>
    typeof v === 'string' && v.length >= min && v.length <= max && (patron === undefined || patron.test(v));
export const entero =
  (min = 0, max = Number.MAX_SAFE_INTEGER): Validador =>
  (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
export const booleano: Validador = (v) => typeof v === 'boolean';
export const uuid: Validador = (v) => typeof v === 'string' && UUID.test(v);
export const fecha: Validador = texto(10, /^\d{4}-\d{2}-\d{2}$/);
export const fechaHora: Validador = texto(40, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
export const enLista =
  (lista: readonly string[]): Validador =>
  (v) =>
    typeof v === 'string' && lista.includes(v);
export const oNulo =
  (f: Validador): Validador =>
  (v) =>
    v === null || f(v);
export const lista =
  (f: Validador, max: number): Validador =>
  (v) =>
    Array.isArray(v) && v.length <= max && v.every(f);
/** Objeto con EXACTAMENTE estas claves y cada valor válido. */
export const forma =
  (esquema: Readonly<Record<string, Validador>>): Validador =>
  (v) => {
    if (!esObjeto(v)) return false;
    const claves = Object.keys(esquema);
    return Object.keys(v).length === claves.length && claves.every((k) => k in v && esquema[k]!(v[k]));
  };
