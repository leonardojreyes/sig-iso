import type { Norma } from '../domain/norma.js';

export const NORMAS_REPOSITORY = Symbol('NORMAS_REPOSITORY');

/** Puerto de salida: lo implementa la capa de infraestructura. */
export interface NormasRepositoryPort {
  listar(): Promise<Norma[]>;
}
