import { cssMarca, derivarTema, type MarcaEmpresa } from '@sig/tokens';

export interface Empresa extends MarcaEmpresa {
  readonly id: string;
}

/** Empresas de prueba. En el paso 0.6 vienen de la configuración por empresa en la base de datos. */
export const empresas: Record<string, Empresa> = {
  a: { id: 'a', nombre: 'SynapTech Ecuador', primario: '#0E5C42' },
  b: { id: 'b', nombre: 'Andes Logística S.A.', primario: '#1D4ED8' },
};

/** Un id de empresa válido: minúsculas, dígitos y guion. Nunca se usa para indexar sin pasar por aquí. */
export const esIdEmpresa = (id: string): boolean => /^[a-z0-9-]{1,32}$/.test(id);

export const obtenerEmpresa = (id: string): Empresa | undefined =>
  esIdEmpresa(id) && Object.hasOwn(empresas, id) ? empresas[id] : undefined;

/** CSS de marca de UNA empresa, acotado por `[data-empresa]`. Solo se inyecta en el layout de esa empresa. */
export const cssDeEmpresa = (empresa: Empresa): string => cssMarca(empresa.id, derivarTema(empresa));
