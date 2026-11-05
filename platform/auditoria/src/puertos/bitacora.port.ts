import type { RegistroBitacora } from '../dominio/tipos';

export const BITACORA_PORT = Symbol('BITACORA_PORT');

/**
 * Escribe un registro YA validado. La implementación decide el rol de base de datos (empresa o plataforma) y debe escribir
 * en la misma transacción que la acción registrada: si no se puede escribir, la acción no se completa (H6.8).
 */
export interface BitacoraPort {
  registrar(registro: RegistroBitacora): Promise<void>;
}
