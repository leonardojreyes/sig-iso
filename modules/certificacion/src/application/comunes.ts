import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { AutorizacionPort, Permiso } from './autorizacion.port.js';
import { ParametroInvalidoError, SinPermisoError } from './errores.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La empresa y la persona salen siempre del token verificado; aun así se revalidan. */
export const identificar = (empresaId: string, usuarioId: string): { empresaId: EmpresaId; usuarioId: string } => {
  if (typeof usuarioId !== 'string' || !UUID.test(usuarioId)) throw new ParametroInvalidoError('usuarioId');
  return { empresaId: crearEmpresaId(empresaId), usuarioId: usuarioId.toLowerCase() };
};

/** Falla con 403 si no hay permiso; si la autorización no puede decidir, también falla (cerrado por omisión). */
export const exigirPermiso = async (autorizacion: AutorizacionPort, usuarioId: string, permiso: Permiso, empresaId: EmpresaId): Promise<void> => {
  if (!(await autorizacion.puede(usuarioId, permiso, empresaId))) throw new SinPermisoError(permiso);
};

/** Identificador de norma apto para el objeto de la bitácora: «ISO/IEC 27001» → «iso-iec-27001». */
export const identificadorDeNorma = (norma: string): string => norma.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Un identificador (UUID) recibido; se llama DESPUÉS de decidir el permiso (401 → 403 → 400 → 404). */
export const validarUuid = (valor: unknown, campo: string): string => {
  if (typeof valor !== 'string' || !UUID.test(valor)) throw new ParametroInvalidoError(campo);
  return valor.toLowerCase();
};

const PATRON_NORMA = /^[A-Za-z0-9 :./-]+$/;
/** La norma recibida debe ser un texto de forma válida. Se llama DESPUÉS de decidir el permiso (401 → 403 → 400 → 404). */
export const validarNorma = (norma: unknown): string => {
  if (typeof norma !== 'string' || norma.length < 1 || norma.length > 60 || !PATRON_NORMA.test(norma)) throw new ParametroInvalidoError('norma');
  return norma;
};
