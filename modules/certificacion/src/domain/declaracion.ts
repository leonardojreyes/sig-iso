// Declaración de Aplicabilidad (M5): una fila por control de la norma, DERIVADA del diagnóstico, de los controles de la empresa y
// de la cobertura de M4. Es una función pura; nada se guarda hasta que la empresa la aprueba (versión congelada). NO incluye texto
// de la norma: el título breve y el grupo vienen de la librería (propios) y la justificación la escribió la empresa.
import type { EstadoCobertura } from './cobertura.js';
import type { EstadoEvaluacion } from './estado-evaluacion.js';
import type { DecisionTratamiento, NivelRiesgo } from './riesgo.js';

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

/** Motivos que se REGISTRAN (el motivo «riesgo» se deriva, nunca se escribe; ADR 037). */
export const TIPOS_MOTIVO = Object.freeze(['legal', 'contractual', 'negocio', 'otro'] as const);
export type TipoMotivo = (typeof TIPOS_MOTIVO)[number];

export interface MotivoParaDeclaracion {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: TipoMotivo;
  readonly nota: string;
}
export interface RiesgoParaDeclaracion {
  readonly id: string;
  readonly codigo: string;
  readonly titulo: string;
  readonly nivel: NivelRiesgo;
  readonly decision: DecisionTratamiento;
  readonly vigente: boolean;
}
export interface VinculoRiesgoControl {
  readonly riesgoId: string;
  readonly controlId: string;
}
/** Tratamiento previsto: el riesgo se vincula directo a un control del Anexo A, sin control propio de la empresa. */
export interface VinculoRiesgoEntrada {
  readonly riesgoId: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
}
/** Lo que justifica la Declaración. Si no se entrega, la derivación es la anterior (sin motivos ni riesgos, sin bloqueo por motivo). */
export interface JustificacionParaDeclaracion {
  readonly riesgos: readonly RiesgoParaDeclaracion[];
  readonly vinculosControl: readonly VinculoRiesgoControl[];
  readonly vinculosEntrada: readonly VinculoRiesgoEntrada[];
  readonly motivos: readonly MotivoParaDeclaracion[];
}

/** Cómo llega un riesgo a una fila: por un control vigente de la empresa o solo como tratamiento previsto (sin control propio). */
export type ViaRiesgo = 'control' | 'previsto';
export interface RiesgoDeFila {
  readonly codigo: string;
  readonly titulo: string;
  readonly nivel: NivelRiesgo;
  readonly via: ViaRiesgo;
}
export interface MotivoDeFila {
  readonly tipo: TipoMotivo;
  readonly nota: string;
}

export type Bloqueo = 'sin_filas' | 'por_decidir' | 'sin_motivo';

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

/** Fila derivada con su justificación; `FilaDeclaracion` es lo que ya se guardó en versiones anteriores (sin motivos ni riesgos). */
export interface FilaJustificada extends FilaDeclaracion {
  /** Solo si aplica: los motivos registrados, en el orden de `TIPOS_MOTIVO`. */
  readonly motivos: readonly MotivoDeFila[];
  /** Solo si aplica: riesgos vigentes que se tratan con este control (derivado), ordenados por código. */
  readonly riesgos: readonly RiesgoDeFila[];
  /** Aplica y no tiene ningún riesgo ni motivo registrado. Siempre falso si no se entregó la justificación. */
  readonly sinMotivo: boolean;
}

export interface ResumenDeclaracion {
  readonly total: number;
  readonly aplican: number;
  readonly noAplican: number;
  readonly porDecidir: number;
  /** Controles que aplican y ningún control de la empresa cubre: no impide aprobar, queda señalado. */
  readonly sinControl: number;
  /** Controles que aplican y tienen al menos un riesgo derivado o un motivo registrado. */
  readonly conMotivo: number;
  /** Controles que aplican y no tienen motivo: **bloquean** la aprobación (ADR 037). */
  readonly sinMotivo: number;
  /** Riesgos vigentes (los que se congelan al aprobar). */
  readonly riesgosVigentes: number;
  /** Advertencia, no bloqueo: riesgos vigentes con decisión «mitigar» y ningún control vigente ni tratamiento previsto. */
  readonly riesgosSinTratamiento: number;
  /** Qué impide aprobar (vacío = se puede aprobar). */
  readonly bloqueos: readonly Bloqueo[];
  /** Se puede aprobar: no hay bloqueos. */
  readonly aprobable: boolean;
}

export interface Declaracion {
  readonly filas: readonly FilaJustificada[];
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
  readonly justificacion?: JustificacionParaDeclaracion;
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

  // Justificación: riesgos vigentes → controles vigentes de la empresa (por mapeo) o tratamiento previsto directo.
  const just = p.justificacion;
  const riesgoDe = new Map((just?.riesgos ?? []).filter((r) => r.vigente).map((r) => [r.id, r]));
  const controlesDeRiesgo = new Map<string, Set<string>>();
  for (const v of just?.vinculosControl ?? []) {
    if (!riesgoDe.has(v.riesgoId) || !codigoDe.has(v.controlId)) continue;
    controlesDeRiesgo.set(v.riesgoId, (controlesDeRiesgo.get(v.riesgoId) ?? new Set()).add(v.controlId));
  }
  const entradasDeRiesgo = new Set<string>(); // riesgos con algún tratamiento previsto
  const riesgosPorFila = new Map<string, Map<string, ViaRiesgo>>(); // fila → (riesgo → vía; «control» prevalece)
  const anotar = (k: string, riesgoId: string, via: ViaRiesgo) => {
    const m = riesgosPorFila.get(k) ?? new Map<string, ViaRiesgo>();
    if (m.get(riesgoId) !== 'control') m.set(riesgoId, via);
    riesgosPorFila.set(k, m);
  };
  for (const v of just?.vinculosEntrada ?? []) {
    if (!riesgoDe.has(v.riesgoId)) continue;
    entradasDeRiesgo.add(v.riesgoId);
    anotar(clave(v.libreriaCodigo, v.idEstable), v.riesgoId, 'previsto');
  }
  for (const m of p.mapeos) {
    for (const [riesgoId, controles] of controlesDeRiesgo) if (controles.has(m.controlId)) anotar(clave(m.libreriaCodigo, m.idEstable), riesgoId, 'control');
  }
  const motivosDe = new Map<string, Map<TipoMotivo, string>>();
  for (const m of just?.motivos ?? []) {
    const k = clave(m.libreriaCodigo, m.idEstable);
    motivosDe.set(k, (motivosDe.get(k) ?? new Map<TipoMotivo, string>()).set(m.tipo, m.nota));
  }

  const ordenadas = [...p.entradas].sort((a, b) => a.libreriaCodigo.localeCompare(b.libreriaCodigo) || a.orden - b.orden || a.idEstable.localeCompare(b.idEstable));
  const filas: FilaJustificada[] = ordenadas.map((e) => {
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
    const motivos: MotivoDeFila[] =
      aplicabilidad === 'aplica' ? TIPOS_MOTIVO.flatMap((tipo) => (motivosDe.get(k)?.has(tipo) ? [{ tipo, nota: motivosDe.get(k)?.get(tipo) as string }] : [])) : [];
    const riesgos: RiesgoDeFila[] =
      aplicabilidad === 'aplica'
        ? [...(riesgosPorFila.get(k) ?? [])]
            .map(([id, via]) => {
              const r = riesgoDe.get(id) as RiesgoParaDeclaracion;
              return { codigo: r.codigo, titulo: r.titulo, nivel: r.nivel, via };
            })
            .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'))
        : [];
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
      motivos,
      riesgos,
      sinMotivo: just !== undefined && aplicabilidad === 'aplica' && motivos.length === 0 && riesgos.length === 0,
    };
  });

  const aplican = filas.filter((f) => f.aplicabilidad === 'aplica').length;
  const noAplican = filas.filter((f) => f.aplicabilidad === 'no_aplica').length;
  const porDecidir = filas.length - aplican - noAplican;
  const sinMotivo = filas.filter((f) => f.sinMotivo).length;
  const bloqueos: Bloqueo[] = [];
  if (filas.length === 0) bloqueos.push('sin_filas');
  if (porDecidir > 0) bloqueos.push('por_decidir');
  if (sinMotivo > 0) bloqueos.push('sin_motivo');
  return {
    filas,
    resumen: {
      total: filas.length,
      aplican,
      noAplican,
      porDecidir,
      // Se cuenta con los controles REALES, no con los 50 que se muestran.
      sinControl: filas.filter((f) => f.aplicabilidad === 'aplica' && (controlesDe.get(clave(f.libreriaCodigo, f.idEstable))?.size ?? 0) === 0).length,
      conMotivo: just === undefined ? 0 : aplican - sinMotivo,
      sinMotivo,
      riesgosVigentes: riesgoDe.size,
      // «Mitigar» sin ningún control vigente (de la empresa) ni tratamiento previsto.
      riesgosSinTratamiento: [...riesgoDe.values()].filter((r) => r.decision === 'mitigar' && !controlesDeRiesgo.has(r.id) && !entradasDeRiesgo.has(r.id)).length,
      bloqueos,
      aprobable: bloqueos.length === 0,
    },
  };
};

export interface ControlSinMotivo {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly titulo: string;
}

/**
 * Aviso previo al retiro de un riesgo (H1.4): los controles del Anexo A que aplican y que, al retirarlo, quedarían SIN motivo (no
 * tienen otro riesgo vigente ni un motivo registrado). Compara la derivación de hoy con la de después del retiro; no cambia nada.
 */
export const efectoDeRetirarRiesgo = (
  p: Parameters<typeof derivarDeclaracion>[0] & { readonly justificacion: JustificacionParaDeclaracion },
  riesgoId: string,
): readonly ControlSinMotivo[] => {
  const hoy = derivarDeclaracion(p);
  const sin = derivarDeclaracion({ ...p, justificacion: { ...p.justificacion, riesgos: p.justificacion.riesgos.map((r) => (r.id === riesgoId ? { ...r, vigente: false } : r)) } });
  const yaSinMotivo = new Set(hoy.filas.filter((f) => f.sinMotivo).map((f) => `${f.libreriaCodigo}|${f.idEstable}`));
  return sin.filas.filter((f) => f.sinMotivo && !yaSinMotivo.has(`${f.libreriaCodigo}|${f.idEstable}`)).map((f) => ({ libreriaCodigo: f.libreriaCodigo, idEstable: f.idEstable, titulo: f.titulo }));
};
