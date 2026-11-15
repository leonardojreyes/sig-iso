import { cssMarca, derivarTema, type MarcaEmpresa } from '@sig/tokens';

export interface Empresa extends MarcaEmpresa {
  readonly id: string;
  /**
   * Las OTRAS empresas a las que pertenece la persona de la sesión (un consultor), para el selector de la cabecera (ADR 035).
   * Solo nombre y slug. Vacío o ausente si pertenece a una sola.
   */
  readonly otrasEmpresas?: readonly { readonly slug: string; readonly nombre: string }[];
}

/** Un id de empresa válido: minúsculas, dígitos y guion. Nunca se usa para indexar ni para CSS sin pasar por aquí. */
export const esIdEmpresa = (id: string): boolean => /^[a-z0-9-]{1,32}$/.test(id);

/** CSS de marca de UNA empresa, acotado por `[data-empresa]`. Solo se inyecta en el contenedor de esa empresa. */
export const cssDeEmpresa = (empresa: Empresa): string => cssMarca(empresa.id, derivarTema(empresa));
