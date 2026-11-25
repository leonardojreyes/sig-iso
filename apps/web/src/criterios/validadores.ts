// La respuesta de la API se trata como un dato externo: forma EXACTA, tipos y topes del contrato. Lo que no cumple se rechaza entero.
import { NIVELES_CRITERIO, type Criterios } from './tipos';

const objeto = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const claves = (o: Record<string, unknown>, esperadas: readonly string[]): boolean => Object.keys(o).sort().join(',') === [...esperadas].sort().join(',');
const entero = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const nivel = (v: unknown): boolean => typeof v === 'string' && (NIVELES_CRITERIO as readonly string[]).includes(v);
const escala = (v: unknown): boolean => Array.isArray(v) && v.length === 5 && v.every((x) => typeof x === 'string' && x.length >= 1 && x.length <= 200);
// Los cortes del nivel son fijos: la web comprueba que el contrato no los cambió.
const nivelDe = (puntaje: number): string => (puntaje <= 4 ? 'bajo' : puntaje <= 9 ? 'medio' : puntaje <= 15 ? 'alto' : 'critico');

export const validarCriterios = (cuerpo: unknown): Criterios | null => {
  const c = objeto(cuerpo);
  if (!c || !claves(c, ['origen', 'version', 'probabilidad', 'impacto', 'nivelAceptacion', 'creadoEn', 'riesgosVigentes', 'matriz'])) return null;
  if (c.origen !== 'omision' && c.origen !== 'empresa') return null;
  if (!entero(c.version, 0, 1_000_000) || !escala(c.probabilidad) || !escala(c.impacto) || !(c.nivelAceptacion === null || nivel(c.nivelAceptacion))) return null;
  if (!(c.creadoEn === null || (typeof c.creadoEn === 'string' && c.creadoEn.length <= 40 && !Number.isNaN(Date.parse(c.creadoEn))))) return null;
  // Coherencia: por omisión es la versión 0 y sin nivel de aceptación ni fecha; los de la empresa traen versión, nivel y fecha.
  if (c.origen === 'omision' && (c.version !== 0 || c.nivelAceptacion !== null || c.creadoEn !== null)) return null;
  if (c.origen === 'empresa' && (c.version < 1 || c.nivelAceptacion === null || c.creadoEn === null)) return null;
  if (!entero(c.riesgosVigentes, 0, 500) || !Array.isArray(c.matriz) || c.matriz.length !== 25) return null;
  let total = 0;
  const vistas = new Set<string>();
  for (const item of c.matriz) {
    const x = objeto(item);
    if (!x || !claves(x, ['probabilidad', 'impacto', 'puntaje', 'nivel', 'cantidad']) || !entero(x.probabilidad, 1, 5) || !entero(x.impacto, 1, 5) || !entero(x.puntaje, 1, 25) || !nivel(x.nivel) || !entero(x.cantidad, 0, 500)) return null;
    if (x.puntaje !== x.probabilidad * x.impacto || x.nivel !== nivelDe(x.puntaje)) return null;
    const k = `${x.probabilidad}|${x.impacto}`;
    if (vistas.has(k)) return null;
    vistas.add(k);
    total += x.cantidad;
  }
  // La suma de la matriz es la cantidad de riesgos vigentes.
  return total === c.riesgosVigentes ? (c as unknown as Criterios) : null;
};
