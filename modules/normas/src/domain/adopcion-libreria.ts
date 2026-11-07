import { esEmpresaId, type EmpresaId } from '@sig/tenancy';
import { ErrorNormas, exigirUuid } from './errores.js';

export interface DatosAdopcion {
  readonly empresaId: EmpresaId;
  readonly libreriaId: string;
  readonly usuarioId: string;
  readonly ahora: Date;
}

/** Una empresa adoptó una librería del catálogo. No hay «desadopción» en este corte. */
export class AdopcionLibreria {
  private constructor(
    readonly empresaId: EmpresaId,
    readonly libreriaId: string,
    readonly adoptadaPor: string,
    private readonly _adoptadaEn: Date,
  ) {
    Object.freeze(this);
  }

  /** Copia: cambiarla fuera no altera la adopción. */
  get adoptadaEn(): Date {
    return new Date(this._adoptadaEn);
  }

  static crear(d: DatosAdopcion): AdopcionLibreria {
    if (!esEmpresaId(d.empresaId)) throw new ErrorNormas('empresaId');
    const libreriaId = exigirUuid('libreriaId', d.libreriaId);
    const usuarioId = exigirUuid('usuarioId', d.usuarioId);
    if (!(d.ahora instanceof Date) || Number.isNaN(d.ahora.getTime())) throw new ErrorNormas('ahora');
    return new AdopcionLibreria(d.empresaId, libreriaId, usuarioId, new Date(d.ahora));
  }
}

export interface ResultadoAdopcion {
  readonly adopcion: AdopcionLibreria;
  readonly yaAdoptada: boolean;
}

/**
 * Regla de adopción (H4.7): si ya estaba adoptada NO es un rechazo; se devuelve la existente sin cambios.
 * `existente` debe ser de la misma empresa y librería: si no, algo falló al aislar y se aborta.
 */
export const adoptar = (existente: AdopcionLibreria | null, datos: DatosAdopcion): ResultadoAdopcion => {
  const nueva = AdopcionLibreria.crear(datos);
  if (existente === null) return { adopcion: nueva, yaAdoptada: false };
  if (existente.empresaId !== nueva.empresaId) throw new ErrorNormas('empresaId');
  if (existente.libreriaId !== nueva.libreriaId) throw new ErrorNormas('libreriaId');
  return { adopcion: existente, yaAdoptada: true };
};
