import type { AdopcionLibreria } from '../domain/adopcion-libreria.js';

export const ADOPCION_REPOSITORY = Symbol('ADOPCION_REPOSITORY');

/** Puerto de salida de las adopciones de LA empresa del contexto (la unidad de trabajo la fija; nunca se pasa otra). */
export interface AdopcionRepositoryPort {
  obtener(libreriaId: string): Promise<AdopcionLibreria | null>;
  /** Guarda la adopción; si ya existía (otra adopción simultánea) no la toca y responde `ya_existia`. */
  crear(adopcion: AdopcionLibreria): Promise<'creada' | 'ya_existia'>;
}
