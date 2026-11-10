import type { Alcance } from '../domain/alcance.js';
import type { Evaluacion } from '../domain/evaluacion.js';

/** Repositorio de evaluaciones, ligado a la empresa y la transacción de la unidad de trabajo. */
export interface EvaluacionRepositoryPort {
  listar(): Promise<readonly Evaluacion[]>;
  obtener(libreriaCodigo: string, idEstable: string): Promise<Evaluacion | null>;
  /** Falso si ya existía (otra persona la creó entre la lectura y la escritura). */
  crear(evaluacion: Evaluacion, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Cambia solo si la versión guardada es `versionEsperada` y la sube a `evaluacion.version`. Falso si no coincide. */
  actualizar(evaluacion: Evaluacion, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean>;
}

/** Repositorio de alcances (uno por norma), ligado a la empresa y la transacción. */
export interface AlcanceRepositoryPort {
  listar(): Promise<readonly Alcance[]>;
  obtener(norma: string): Promise<Alcance | null>;
  /** Crea o reemplaza el alcance de esa norma. */
  guardar(alcance: Alcance): Promise<void>;
}
