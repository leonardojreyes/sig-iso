/** Motivos de rechazo: los mismos códigos del catálogo de la bitácora para el hecho `token.invalido`. */
export type MotivoTokenInvalido = 'token_vencido' | 'token_alterado' | 'sin_empresa';

/** El token no es válido. Lleva solo el motivo: nunca repite el token ni sus datos. */
export class TokenInvalidoError extends Error {
  constructor(readonly motivo: MotivoTokenInvalido) {
    super(`Token no válido: ${motivo}`);
    this.name = 'TokenInvalidoError';
  }
}

/**
 * No se pudo decidir (por ejemplo, el servicio de claves no responde). NO es un token inválido: no debe registrarse como
 * `token.invalido`, pero tampoco se acepta nada. No repite el detalle técnico (puede incluir direcciones internas).
 */
export class VerificadorNoDisponibleError extends Error {
  constructor() {
    super('No se pudo verificar el token: el servicio de claves no está disponible');
    this.name = 'VerificadorNoDisponibleError';
  }
}
