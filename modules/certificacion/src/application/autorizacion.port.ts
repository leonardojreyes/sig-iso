import type { EmpresaId } from '@sig/tenancy';

export const AUTORIZACION = Symbol('AUTORIZACION');

export type Permiso = 'diagnostico.ver' | 'diagnostico.evaluar' | 'alcance.ver' | 'alcance.gestionar' | 'alcance.aprobar' | 'controles.ver' | 'controles.gestionar';

/** Puerto de salida: ¿puede este usuario hacer esto en esta empresa? Si no se puede decidir, debe fallar (nunca responder «sí»). */
export interface AutorizacionPort {
  puede(usuarioId: string, permiso: Permiso, empresaId: EmpresaId): Promise<boolean>;
}
