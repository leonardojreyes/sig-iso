import { ErrorCertificacion } from './errores.js';
import { calcularNivel, type NivelRiesgo } from './riesgo.js';

// Criterios de evaluación de riesgos de la empresa (ADR 038): descripciones propias de cada valor de la escala (1 a 5) y el nivel de
// aceptación. Reglas puras: sin base de datos, sin reloj. Cada cambio es una versión nueva; sin ninguna rige la escala por omisión de la
// herramienta, que SIEMPRE se rotula así (no es el criterio de la empresa) y no trae nivel de aceptación.

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/;
export const DESCRIPCION_CRITERIO_MAX = 200;
export const NIVELES_ACEPTACION = Object.freeze(['bajo', 'medio', 'alto', 'critico'] as const);
export type NivelAceptacion = (typeof NIVELES_ACEPTACION)[number];
const VALORES = [1, 2, 3, 4, 5] as const;

export type DescripcionesEscala = readonly [string, string, string, string, string];

export interface CriteriosVigentes {
  /** `omision` = la escala de la herramienta (no son los criterios de la empresa). */
  readonly origen: 'omision' | 'empresa';
  /** 0 para la escala por omisión. */
  readonly version: number;
  readonly probabilidad: DescripcionesEscala;
  readonly impacto: DescripcionesEscala;
  /** Nulo mientras la empresa no lo defina: sin él no se puede registrar una aceptación del riesgo residual. */
  readonly nivelAceptacion: NivelAceptacion | null;
}

/** Descripciones propias de la herramienta para cada valor; son un punto de partida, no el criterio de nadie. */
export const CRITERIOS_POR_OMISION: CriteriosVigentes = Object.freeze({
  origen: 'omision',
  version: 0,
  probabilidad: Object.freeze(['Muy improbable', 'Improbable', 'Posible', 'Probable', 'Casi seguro']) as unknown as DescripcionesEscala,
  impacto: Object.freeze(['Insignificante', 'Menor', 'Moderado', 'Grave', 'Crítico']) as unknown as DescripcionesEscala,
  nivelAceptacion: null,
});

export interface EntradaCriterios {
  readonly probabilidad?: unknown;
  readonly impacto?: unknown;
  readonly nivelAceptacion?: unknown;
}

const descripciones = (v: unknown, campo: string): DescripcionesEscala => {
  if (!Array.isArray(v) || v.length !== VALORES.length) throw new ErrorCertificacion(campo);
  const salida = v.map((x, i) => {
    if (typeof x !== 'string') throw new ErrorCertificacion(campo, [`valor_${i + 1}`]);
    const t = x.trim();
    if (t.length < 1 || t.length > DESCRIPCION_CRITERIO_MAX || CONTROL.test(t)) throw new ErrorCertificacion(campo, [`valor_${i + 1}`]);
    return t;
  });
  return salida as unknown as DescripcionesEscala;
};

/** Valida los criterios que escribe la empresa: diez descripciones (cinco por eje, con texto) y un nivel de aceptación de la lista cerrada. */
export const validarCriterios = (e: EntradaCriterios): { readonly probabilidad: DescripcionesEscala; readonly impacto: DescripcionesEscala; readonly nivelAceptacion: NivelAceptacion } => {
  const probabilidad = descripciones(e.probabilidad, 'probabilidad');
  const impacto = descripciones(e.impacto, 'impacto');
  if (!(NIVELES_ACEPTACION as readonly unknown[]).includes(e.nivelAceptacion)) throw new ErrorCertificacion('nivelAceptacion');
  return { probabilidad, impacto, nivelAceptacion: e.nivelAceptacion as NivelAceptacion };
};

/** ¿Son iguales dos criterios (mismas descripciones y mismo nivel)? Guardar lo mismo no crea una versión nueva. */
export const mismosCriterios = (a: Pick<CriteriosVigentes, 'probabilidad' | 'impacto' | 'nivelAceptacion'>, b: Pick<CriteriosVigentes, 'probabilidad' | 'impacto' | 'nivelAceptacion'>): boolean =>
  a.nivelAceptacion === b.nivelAceptacion && a.probabilidad.every((x, i) => x === b.probabilidad[i]) && a.impacto.every((x, i) => x === b.impacto[i]);

export interface CeldaMatriz {
  readonly probabilidad: number;
  readonly impacto: number;
  readonly puntaje: number;
  readonly nivel: NivelRiesgo;
  /** Riesgos vigentes en esa celda. */
  readonly cantidad: number;
}

/** La matriz 5 × 5 (probabilidad contra impacto) con cuántos riesgos vigentes hay en cada celda. Siempre 25 celdas, de la fila de mayor probabilidad a la de menor. */
export const calcularMatriz = (riesgos: readonly { readonly probabilidad: number; readonly impacto: number }[]): readonly CeldaMatriz[] => {
  const celdas: CeldaMatriz[] = [];
  for (const p of [...VALORES].reverse()) {
    for (const i of VALORES) {
      const { puntaje, nivel } = calcularNivel(p, i);
      celdas.push({ probabilidad: p, impacto: i, puntaje, nivel, cantidad: riesgos.filter((r) => r.probabilidad === p && r.impacto === i).length });
    }
  }
  return celdas;
};
