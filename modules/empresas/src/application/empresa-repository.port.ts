import type { EmpresaId } from '@sig/tenancy';

export const EMPRESA_REPOSITORY = Symbol('EMPRESA_REPOSITORY');

/** Fila de `empresa` tal como la guarda la base; las reglas de la marca las aplica el dominio. */
export interface DatosEmpresa {
  readonly id: EmpresaId;
  readonly nombre: string;
  readonly colorPrimario: string;
  readonly logoUrl: string | null;
}

/** Puerto de salida. Cada operación va ligada a UNA empresa: el adaptador la fija como contexto (RLS) y nunca lista las de otras. */
export interface EmpresaRepositoryPort {
  /** La fila de la propia empresa, o `null` si no existe o no es visible. */
  obtenerPropia(empresaId: EmpresaId): Promise<DatosEmpresa | null>;
}
