import type { EmpresaId } from '@sig/tenancy';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/** Lo que se sabe de quien llama, tomado SOLO de un token verificado. La empresa nunca viene de otro lado (ADR 027). */
export interface IdentidadVerificada {
  /** Identificador opaco de la persona (`sub`, UUID). Es el que va a la bitácora. */
  readonly usuarioId: string;
  readonly empresaId: EmpresaId;
  /** Identificador de la sesión de Keycloak (`sid`), si el token lo trae. */
  readonly sesionId: string | null;
  readonly expiraEn: Date;
}

/**
 * Puerto de salida: verifica un token de acceso. Lanza `TokenInvalidoError` si no es válido y `VerificadorNoDisponibleError`
 * si no pudo decidir. Nunca devuelve una identidad sin haber verificado firma, emisor, audiencia, vigencia y empresa.
 */
export interface TokenVerifierPort {
  verificar(token: string): Promise<IdentidadVerificada>;
}
