import type { Alcance } from '../domain/alcance.js';
import type { Control } from '../domain/control.js';
import type { Evaluacion } from '../domain/evaluacion.js';
import type { MapeoControl } from '../domain/mapeo-control.js';

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

/** Repositorio de controles de la empresa (vigentes y retirados), ligado a la empresa y la transacción. */
export interface ControlRepositoryPort {
  /** Todos, ordenados por código. */
  listar(): Promise<readonly Control[]>;
  obtener(id: string): Promise<Control | null>;
  /** Falso si el código ya existe en la empresa (también el de un control retirado: no se reutiliza). */
  crear(control: Control, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Cambia solo si la versión guardada es \`versionEsperada\` y la sube a \`control.version\`. Falso si no coincide. */
  actualizar(control: Control, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean>;
}

/** Repositorio de mapeos control ↔ entrada de una norma, ligado a la empresa y la transacción. */
export interface MapeoRepositoryPort {
  /** Todos los de la empresa, ordenados por control y entrada. */
  listar(): Promise<readonly MapeoControl[]>;
  contar(controlId: string): Promise<number>;
  /** Falso si ya existía. */
  agregar(mapeo: MapeoControl, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Falso si no existía. */
  quitar(mapeo: MapeoControl): Promise<boolean>;
}
