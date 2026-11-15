import type { EmpresaId } from '@sig/tenancy';

export const EMPRESA_ACTIVA = Symbol('EMPRESA_ACTIVA');

/** Una empresa a la que pertenece la persona (con un rol en ella). */
export interface EmpresaDePersona {
  readonly empresaId: EmpresaId;
  readonly slug: string;
  readonly nombre: string;
}

/**
 * Puerto de salida: la empresa activa de una sesión y las empresas de una persona (ADR 035). NO es por empresa: se consulta
 * antes de conocer la empresa de la petición, por eso lo atiende el rol de plataforma con permisos mínimos.
 */
export interface EmpresaActivaPort {
  /** La empresa activa de la sesión, solo si no venció y la persona SIGUE teniendo un rol en ella; si no, `null`. */
  activaDe(sesionId: string, usuarioId: string, ahora: Date): Promise<EmpresaId | null>;
  /** Las empresas a las que pertenece la persona (las que le dan un rol), por nombre. */
  empresasDe(usuarioId: string): Promise<readonly EmpresaDePersona[]>;
  /** Guarda la empresa activa de la sesión (y borra de paso lo vencido). Falla si la sesión es de otra persona. */
  fijar(sesionId: string, usuarioId: string, empresaId: EmpresaId, ahora: Date, expiraEn: Date): Promise<void>;
  /** Olvida la empresa activa de la sesión (cierre de sesión). */
  limpiar(sesionId: string): Promise<void>;
}
