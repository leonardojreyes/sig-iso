import type { Libreria } from '../domain/libreria.js';

export const CATALOGO_REPOSITORY = Symbol('CATALOGO_REPOSITORY');

/** Puerto de salida de solo lectura del catálogo global. Se usa dentro de una unidad de trabajo (empresa fijada). */
export interface CatalogoRepositoryPort {
  /** Metadatos de la librería (públicos para toda empresa), o `null` si no existe. */
  obtenerLibreria(libreriaId: string): Promise<Libreria | null>;
  /** Entradas de la librería VISIBLES para la empresa del contexto: 0 mientras no la haya adoptado. */
  contarEntradas(libreriaId: string): Promise<number>;
}
