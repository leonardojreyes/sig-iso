/** El valor recibido no es un identificador de empresa válido. Nunca incluye el valor (podría ser dato sensible). */
export class EmpresaIdInvalidoError extends Error {
  constructor() {
    super('Identificador de empresa no válido: se espera un UUID');
    this.name = 'EmpresaIdInvalidoError';
  }
}

/** Se pidió la empresa actual fuera de un contexto de empresa: la operación debe fallar, nunca devolver datos de todas. */
export class SinEmpresaError extends Error {
  constructor() {
    super('No hay empresa en el contexto de esta operación');
    this.name = 'SinEmpresaError';
  }
}
