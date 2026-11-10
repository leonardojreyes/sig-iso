import type { EstadoEvaluacion } from './estado-evaluacion.js';

/** Lo que la madurez necesita saber de cada entrada del diagnóstico. */
export interface EntradaParaMadurez {
  readonly tipo: 'clausula' | 'control';
  readonly capitulo: number | null;
  readonly grupo: string | null;
  /** Normas a las que aplica (una entrada común cuenta en cada una). */
  readonly normas: readonly string[];
  /** Nulo = sin evaluar. */
  readonly estado: EstadoEvaluacion | null;
}

export interface Desglose {
  readonly cumple: number;
  readonly parcial: number;
  readonly noCumple: number;
  readonly noAplica: number;
  readonly sinEvaluar: number;
  readonly total: number;
  /** 0–100, o nulo si no hay nada evaluado que cuente. Es la madurez de la AUTOEVALUACIÓN, no una probabilidad de certificarse. */
  readonly porcentaje: number | null;
}

export interface MadurezAgrupador {
  readonly tipo: 'capitulo' | 'tema';
  readonly clave: string;
  readonly desglose: Desglose;
}

export interface Madurez {
  readonly porNorma: Readonly<Record<string, Desglose>>;
  readonly porAgrupador: readonly MadurezAgrupador[];
  /** Indicador propio de las cláusulas (4 a 10): un «no cumple» ahí es crítico aunque el promedio general sea alto. */
  readonly clausulas: Desglose;
}

/**
 * Cumple = 100, parcial = 50, no cumple = 0; «no aplica» queda fuera del cálculo y «sin evaluar» se cuenta aparte (no suma como
 * cumplido). Sin entradas evaluables el porcentaje es nulo, no 0.
 */
export const desglosar = (entradas: readonly Pick<EntradaParaMadurez, 'estado'>[]): Desglose => {
  let cumple = 0;
  let parcial = 0;
  let noCumple = 0;
  let noAplica = 0;
  let sinEvaluar = 0;
  for (const e of entradas) {
    if (e.estado === 'cumple') cumple++;
    else if (e.estado === 'parcial') parcial++;
    else if (e.estado === 'no_cumple') noCumple++;
    else if (e.estado === 'no_aplica') noAplica++;
    else sinEvaluar++;
  }
  const evaluables = cumple + parcial + noCumple;
  return {
    cumple,
    parcial,
    noCumple,
    noAplica,
    sinEvaluar,
    total: entradas.length,
    porcentaje: evaluables === 0 ? null : Math.round((cumple * 100 + parcial * 50) / evaluables),
  };
};

export const calcularMadurez = (entradas: readonly EntradaParaMadurez[]): Madurez => {
  const porNorma: Record<string, EntradaParaMadurez[]> = {};
  const porAgrupador = new Map<string, { tipo: 'capitulo' | 'tema'; clave: string; entradas: EntradaParaMadurez[] }>();
  for (const e of entradas) {
    for (const n of e.normas) (porNorma[n] ??= []).push(e);
    const agrupador =
      e.tipo === 'clausula' ? { tipo: 'capitulo' as const, clave: String(e.capitulo ?? '') } : { tipo: 'tema' as const, clave: e.grupo ?? '' };
    const llave = `${agrupador.tipo}:${agrupador.clave}`;
    const existente = porAgrupador.get(llave);
    if (existente) existente.entradas.push(e);
    else porAgrupador.set(llave, { ...agrupador, entradas: [e] });
  }
  const orden = (a: MadurezAgrupador, b: MadurezAgrupador): number =>
    a.tipo === b.tipo ? (a.tipo === 'capitulo' ? Number(a.clave) - Number(b.clave) : a.clave.localeCompare(b.clave, 'es')) : a.tipo === 'capitulo' ? -1 : 1;
  return {
    porNorma: Object.fromEntries(Object.entries(porNorma).sort(([a], [b]) => a.localeCompare(b, 'es')).map(([n, es]) => [n, desglosar(es)])),
    porAgrupador: [...porAgrupador.values()].map((g) => ({ tipo: g.tipo, clave: g.clave, desglose: desglosar(g.entradas) })).sort(orden),
    clausulas: desglosar(entradas.filter((e) => e.tipo === 'clausula')),
  };
};
