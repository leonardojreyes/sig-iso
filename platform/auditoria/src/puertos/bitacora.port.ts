import type { RegistroBitacora } from '../dominio/tipos';

export const BITACORA_PORT = Symbol('BITACORA_PORT');

export type ResultadoRegistro = 'registrado' | 'ya_existia';

/**
 * Escribe un registro YA validado. La implementación decide el rol de base de datos (empresa o plataforma) y, cuando se
 * crea para una transacción en curso, escribe en LA MISMA transacción que la acción registrada: si no se puede escribir,
 * la acción no se completa (H6.8).
 */
export interface BitacoraPort {
  registrar(registro: RegistroBitacora): Promise<void>;
  /**
   * Igual que `registrar`, pero no repite un hecho con el mismo `origenId` (idempotencia de eventos externos).
   * Exige que el registro tenga `origenId`.
   */
  registrarUnaVez(registro: RegistroBitacora): Promise<ResultadoRegistro>;
}
