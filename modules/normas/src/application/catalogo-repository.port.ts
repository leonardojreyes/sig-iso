import type { EntradaLibreria } from '../domain/entrada-libreria.js';
import type { Libreria } from '../domain/libreria.js';

export const CATALOGO_REPOSITORY = Symbol('CATALOGO_REPOSITORY');

/** Puerto de salida de solo lectura del catálogo global. Se usa dentro de una unidad de trabajo (empresa fijada). */
export interface CatalogoRepositoryPort {
  /** Metadatos de la librería (públicos para toda empresa), o `null` si no existe. */
  obtenerLibreria(libreriaId: string): Promise<Libreria | null>;
  /** Entradas de la librería VISIBLES para la empresa del contexto: 0 mientras no la haya adoptado. */
  contarEntradas(libreriaId: string): Promise<number>;
  /** Todas las librerías del catálogo global (metadatos públicos). */
  listarLibrerias(): Promise<Libreria[]>;
  /** Entradas VISIBLES para la empresa del contexto (las de librerías que adoptó), sin orden garantizado. */
  listarEntradas(): Promise<EntradaLibreria[]>;
  /** Una entrada visible para la empresa del contexto, o `null` (no existe, es de otra empresa o su librería no está adoptada). */
  obtenerEntrada(id: string): Promise<EntradaLibreria | null>;
}
