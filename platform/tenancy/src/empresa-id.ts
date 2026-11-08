// Tipo puro: sin dependencias de Node ni de frameworks, para poder usarlo desde el dominio.
import { EmpresaIdInvalidoError } from './errores';

export { EmpresaIdInvalidoError };

declare const marca: unique symbol;
/** Identificador de empresa (UUID canónico en minúsculas). Solo se obtiene con `crearEmpresaId`. */
export type EmpresaId = string & { readonly [marca]: 'EmpresaId' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_NULO = '00000000-0000-0000-0000-000000000000';

/** Verdadero si el valor ya está en forma canónica (UUID en minúsculas, no nulo). */
export const esEmpresaId = (valor: unknown): valor is EmpresaId => typeof valor === 'string' && UUID.test(valor) && valor !== UUID_NULO;

/** Valida y normaliza a minúsculas. Lanza `EmpresaIdInvalidoError` si no es un UUID usable. */
export const crearEmpresaId = (valor: unknown): EmpresaId => {
  if (typeof valor !== 'string') throw new EmpresaIdInvalidoError();
  const normalizado = valor.toLowerCase();
  if (!esEmpresaId(normalizado)) throw new EmpresaIdInvalidoError();
  return normalizado;
};
