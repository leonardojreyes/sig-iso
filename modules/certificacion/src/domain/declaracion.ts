// Declaración de Aplicabilidad (M5): una fila por control de la norma, DERIVADA del diagnóstico, de los controles de la empresa y
// de la cobertura de M4. Es una función pura; nada se guarda hasta que la empresa la aprueba (versión congelada). NO incluye texto
// de la norma: el título breve y el grupo vienen de la librería (propios) y la justificación la escribió la empresa.
import type { EstadoCobertura } from './cobertura.js';
import type { EstadoEvaluacion } from './estado-evaluacion.js';

export type Aplicabilidad = 'aplica' | 'no_aplica' | 'por_decidir';
export type Implementacion = 'implementado' | 'parcial' | 'no_implementado';

/** Tope de códigos de control por fila (lo mismo que admite la tabla). */
export const CONTROLES_POR_FILA_MAX = 50;

export interface EntradaParaDeclaracion {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly orden: number;
  readonly titulo: string;
  readonly grupo: string | null;
}
export interface EvaluacionParaDeclaracion {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly estado: EstadoEvaluacion;
  readonly comentario: string | null;
}
export interface ControlParaDeclaracion {
  readonly id: string;
  readonly codigo: string;
  readonly vigente: boolean;
}
export interface MapeoParaDeclaracion {
  readonly controlId: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
}
export interface CoberturaParaDeclaracion {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly estado: EstadoCobertura;
}

export interface FilaDeclaracion {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly orden: number;
  readonly titulo: string;
  readonly grupo: string | null;
  readonly aplicabilidad: Aplicabilidad;
  /** Nula si no aplica o está por decidir. */
  readonly implementacion: Implementacion | null;
  /** Solo si no aplica: la que escribió la empresa al evaluar. */
  readonly justificacion: string | null;
  /** Códigos de los controles vigentes de la empresa que la cubren (ordenados). */
  readonly controles: readonly string[];
  readonly cobertura: EstadoCobertura;
}

export interface ResumenDeclaracion {
  readonly total: number;
  readonly aplican: number;
  readonly noAplican: number;
  readonly porDecidir: number;
  /** Controles que aplican y ningún control de la empresa cubre: no impide aprobar, queda señalado. */
  readonly sinControl: number;
  /** Se puede aprobar: hay filas y ninguna está por decidir. */
  readonly aprobable: boolean;
}

export interface Declaracion {
  readonly filas: readonly FilaDeclaracion[];
  readonly resumen: ResumenDeclaracion;
}

const IMPLEMENTACION: Readonly<Record<Exclude<EstadoEvaluacion, 'no_aplica'>, Implementacion>> = {
  cumple: 'implementado',
  parcial: 'parcial',
  no_cumple: 'no_implementado',
};

export const derivarDeclaracion = (p: {
  readonly entradas: readonly EntradaParaDeclaracion[];
  readonly evaluaciones: readonly EvaluacionParaDeclaracion[];
  readonly controles: readonly ControlParaDeclaracion[];
  readonly mapeos: readonly MapeoParaDeclaracion[];
  readonly cobertura: readonly CoberturaParaDeclaracion[];
}): Declaracion => {
  const clave = (c: string, i: string) => `${c}|${i}`;
  const evaluacionDe = new Map(p.evaluaciones.map((e) => [clave(e.libreriaCodigo, e.idEstable), e]));
  const coberturaDe = new Map(p.cobertura.map((c) => [clave(c.libreriaCodigo, c.idEstable), c.estado]));
  const codigoDe = new Map(p.controles.filter((c) => c.vigente).map((c) => [c.id, c.codigo]));
  const controlesDe = new Map<string, Set<string>>();
  for (const m of p.mapeos) {
    const codigo = codigoDe.get(m.controlId);
    if (codigo === undefined) continue;
    const k = clave(m.libreriaCodigo, m.idEstable);
    controlesDe.set(k, (controlesDe.get(k) ?? new Set()).add(codigo));
  }

  const ordenadas = [...p.entradas].sort((a, b) => a.libreriaCodigo.localeCompare(b.libreriaCodigo) || a.orden - b.orden || a.idEstable.localeCompare(b.idEstable));
  const filas: FilaDeclaracion[] = ordenadas.map((e) => {
    const k = clave(e.libreriaCodigo, e.idEstable);
    const evaluacion = evaluacionDe.get(k);
    const codigos = [...(controlesDe.get(k) ?? [])].sort((a, b) => a.localeCompare(b, 'es'));
    let aplicabilidad: Aplicabilidad = 'por_decidir';
    let implementacion: Implementacion | null = null;
    let justificacion: string | null = null;
    if (evaluacion !== undefined) {
      if (evaluacion.estado === 'no_aplica') {
        // Sin justificación no se puede declarar que no aplica: la entrada queda por decidir.
        if (evaluacion.comentario !== null && evaluacion.comentario.trim() !== '') {
          aplicabilidad = 'no_aplica';
          justificacion = evaluacion.comentario.trim();
        }
      } else {
        aplicabilidad = 'aplica';
        implementacion = IMPLEMENTACION[evaluacion.estado];
      }
    }
    return {
      libreriaCodigo: e.libreriaCodigo,
      idEstable: e.idEstable,
      orden: e.orden,
      titulo: e.titulo,
      grupo: e.grupo,
      aplicabilidad,
      implementacion,
      justificacion,
      controles: codigos.slice(0, CONTROLES_POR_FILA_MAX),
      cobertura: aplicabilidad === 'no_aplica' ? 'no_aplica' : (coberturaDe.get(k) ?? (codigos.length === 0 ? 'sin_control' : 'sin_evidencia')),
    };
  });

  const aplican = filas.filter((f) => f.aplicabilidad === 'aplica').length;
  const noAplican = filas.filter((f) => f.aplicabilidad === 'no_aplica').length;
  const porDecidir = filas.length - aplican - noAplican;
  return {
    filas,
    resumen: {
      total: filas.length,
      aplican,
      noAplican,
      porDecidir,
      // Se cuenta con los controles REALES, no con los 50 que se muestran.
      sinControl: filas.filter((f) => f.aplicabilidad === 'aplica' && (controlesDe.get(clave(f.libreriaCodigo, f.idEstable))?.size ?? 0) === 0).length,
      aprobable: filas.length > 0 && porDecidir === 0,
    },
  };
};
