import type { EmpresaId } from '@sig/tenancy';

export const EMPRESA_ACTIVA = Symbol('EMPRESA_ACTIVA');

/** Una empresa a la que pertenece la persona (con un rol en ella). */
export interface EmpresaDePersona {
  readonly empresaId: EmpresaId;
  readonly slug: string;
  readonly nombre: string;
}

/**
 * Qué hay guardado para una sesión (ADR 035). `invalida` = hay una elección pero ya no vale (venció o la persona dejó de pertenecer a
 * esa empresa): NO se confunde con «no hay elección», porque la persona cree estar en esa empresa.
 */
export type EleccionDeSesion =
  | { readonly tipo: 'sin_eleccion' }
  | { readonly tipo: 'activa'; readonly empresaId: EmpresaId }
  | { readonly tipo: 'invalida' };

/**
 * Puerto de salida: la empresa activa de una sesión y las empresas de una persona (ADR 035). NO es por empresa: se consulta
 * antes de conocer la empresa de la petición, por eso lo atiende el rol de plataforma con permisos mínimos.
 */
export interface EmpresaActivaPort {
  /** Lo guardado para la sesión: su empresa activa si no venció y la persona SIGUE teniendo un rol en ella; si no, `invalida`. */
  activaDe(sesionId: string, usuarioId: string, ahora: Date): Promise<EleccionDeSesion>;
  /** Las empresas a las que pertenece la persona (las que le dan un rol), por nombre. */
  empresasDe(usuarioId: string): Promise<readonly EmpresaDePersona[]>;
  /** Guarda la empresa activa de la sesión (y borra de paso lo vencido). Falla si la sesión es de otra persona. */
  fijar(sesionId: string, usuarioId: string, empresaId: EmpresaId, ahora: Date, expiraEn: Date): Promise<void>;
  /** Olvida la empresa activa de la sesión (cierre de sesión). */
  limpiar(sesionId: string): Promise<void>;
}
