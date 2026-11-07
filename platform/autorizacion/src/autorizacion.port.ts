import type { EmpresaId } from '@sig/tenancy';
import type { Permiso } from './roles.js';

export const AUTORIZACION = Symbol('AUTORIZACION');

/**
 * Puerto de salida: ¿puede este usuario hacer esto en ESTA empresa? Un permiso desconocido se niega. Si la consulta es inválida
 * o no se puede decidir (servicio caído), debe FALLAR: nunca responder «sí» por omisión.
 */
export interface AutorizacionPort {
  puede(usuarioId: string, permiso: Permiso, empresaId: EmpresaId): Promise<boolean>;
}
