import type { Permiso } from './autorizacion.port.js';

/** Quien llama no tiene el permiso. Se traduce a 403 (y queda en la bitácora como acceso denegado). */
export class SinPermisoError extends Error {
  constructor(readonly permiso: Permiso) {
    super('Sin permiso para esta acción.');
    this.name = 'SinPermisoError';
  }
}

/** Un parámetro no cumple su forma o su rango. Se traduce a 400. Nunca repite el valor recibido. */
export class ParametroInvalidoError extends Error {
  constructor(readonly parametro: string) {
    super(`Parámetro no válido: ${parametro}`);
    this.name = 'ParametroInvalidoError';
  }
}

/** La entrada o la norma no existe entre las librerías que esta empresa adoptó (también si es de otra empresa). Se traduce a 404. */
export class EntradaNoEncontradaError extends Error {
  constructor() {
    super('No se encontró.');
    this.name = 'EntradaNoEncontradaError';
  }
}

/** El estado actual no permite la acción (p. ej., alcance ya aprobado). Se traduce a 409. */
export class ConflictoError extends Error {
  constructor(readonly motivo: string) {
    super('El estado actual no permite esta acción.');
    this.name = 'ConflictoError';
  }
}

/** Otra persona cambió la evaluación mientras se editaba. Se traduce a 409: hay que revisar y volver a guardar. */
export class ConflictoDeVersionError extends ConflictoError {
  constructor() {
    super('version_distinta');
    this.name = 'ConflictoDeVersionError';
  }
}
