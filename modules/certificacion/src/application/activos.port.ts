import type { Activo } from '../domain/activo.js';

/** Repositorio de activos de información de la empresa (vigentes y retirados), ligado a la empresa y la transacción de la unidad de trabajo. */
export interface ActivoRepositoryPort {
  /** Todos, ordenados por número. */
  listar(): Promise<readonly Activo[]>;
  obtener(id: string): Promise<Activo | null>;
  /** El número que sigue al mayor de la empresa (1 si no hay ninguno); también cuenta los retirados: el código no se reutiliza. */
  siguienteNumero(): Promise<number>;
  /** Falso si ese número ya existe en la empresa (otra persona creó un activo entre la lectura y la escritura). */
  crear(activo: Activo, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Cambia solo si la versión guardada es `versionEsperada` y la sube a `activo.version`. Falso si no coincide. */
  actualizar(activo: Activo, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean>;
}

export interface LigaRiesgoActivoFila {
  readonly riesgoId: string;
  readonly activoId: string;
}

/** Ligas riesgo–activo de la empresa. Se agregan y se quitan (con rastro), no se actualizan. */
export interface RiesgoActivoRepositoryPort {
  /** Todas las ligas de la empresa, ordenadas por riesgo y activo. */
  listar(): Promise<readonly LigaRiesgoActivoFila[]>;
  /** Cuántos activos tiene ligados el riesgo. */
  contarDeRiesgo(riesgoId: string): Promise<number>;
  /** Falso si ya existía. */
  agregar(riesgoId: string, activoId: string, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Falso si no existía. */
  quitar(riesgoId: string, activoId: string): Promise<boolean>;
}
