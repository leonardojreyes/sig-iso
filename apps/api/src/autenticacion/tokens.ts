export const VERIFICADOR = Symbol('VERIFICADOR');
export const REGISTRADOR_TOKEN_INVALIDO = Symbol('REGISTRADOR_TOKEN_INVALIDO');
/** Registro de hechos de la bitácora (cada llamada es su PROPIA transacción). */
export const HECHOS = Symbol('HECHOS');
/** Límite de frecuencia por persona y por empresa. */
export const LIMITE = Symbol('LIMITE');
/** Resuelve la empresa de la petición (la activa de la sesión o la del token, ADR 035). Puede ser `null` en pruebas sin esa función. */
export const RESOLVER_EMPRESA = Symbol('RESOLVER_EMPRESA');
