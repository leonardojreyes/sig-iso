/** Estados de una evaluación. «Sin evaluar» no es un estado guardado: es la ausencia de evaluación. */
export const ESTADOS_EVALUACION = ['cumple', 'parcial', 'no_cumple', 'no_aplica'] as const;
export type EstadoEvaluacion = (typeof ESTADOS_EVALUACION)[number];

export const esEstadoEvaluacion = (valor: unknown): valor is EstadoEvaluacion =>
  typeof valor === 'string' && (ESTADOS_EVALUACION as readonly string[]).includes(valor);
