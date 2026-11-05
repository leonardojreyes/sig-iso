// Textos por defecto (español de Ecuador) de los componentes de dominio. Las apps pueden sobrescribirlos por props.
export const textosUi = {
  semaforo: { cumple: 'Cumple', parcial: 'Parcial', noCumple: 'No cumple', noAplica: 'No aplica' },
  madurez: { de: 'de' },
  riesgos: { probabilidad: 'Probabilidad', impacto: 'Impacto', riesgos: 'riesgos', nivel: { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' } },
  navegacion: { migas: 'Ruta de navegación' },
  etapas: { titulo: 'Ciclo de certificación', completada: 'Completada', enCurso: 'En curso', pendiente: 'Pendiente' },
} as const;
