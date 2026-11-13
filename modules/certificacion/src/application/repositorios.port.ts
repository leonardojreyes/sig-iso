import type { Alcance } from '../domain/alcance.js';
import type { Control } from '../domain/control.js';
import type { Evaluacion } from '../domain/evaluacion.js';
import type { Evidencia } from '../domain/evidencia.js';
import type { FilaDeclaracion } from '../domain/declaracion.js';
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

/** Una evidencia con el momento en que se registró (el dominio no lo guarda: la evidencia es inmutable). */
export interface FilaEvidencia {
  readonly evidencia: Evidencia;
  readonly creadaEn: Date;
}

/** Repositorio de evidencias, ligado a la empresa y la transacción. */
export interface EvidenciaRepositoryPort {
  obtener(id: string): Promise<FilaEvidencia | null>;
  /** Las evidencias de un control, de la más nueva a la más antigua; sin las reemplazadas ni eliminadas salvo que se pidan. */
  listarDeControl(controlId: string, incluirHistoricas: boolean): Promise<readonly FilaEvidencia[]>;
  /** Todas las evidencias ACTIVAS de la empresa (para la cobertura). */
  listarActivas(): Promise<readonly Evidencia[]>;
  /** Cuántas evidencias activas tiene el control. Bloquea la fila del control hasta el fin de la transacción, así dos subidas a la vez no pasan el tope. */
  contarActivas(controlId: string): Promise<number>;
  /** Falso si el archivo del almacén ya estaba registrado. */
  crear(evidencia: Evidencia, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Guarda el estado nuevo, solo si la evidencia seguía activa. Falso si otra persona la cambió antes. */
  cambiarEstado(evidencia: Evidencia, usuarioId: string, ahora: Date): Promise<boolean>;
}

/** Una versión aprobada (congelada) de la Declaración de Aplicabilidad. Los conteos son los de ese momento. */
export interface VersionDeclaracion {
  readonly id: string;
  /** Correlativo por empresa: 1, 2, 3… */
  readonly numero: number;
  /** El alcance de la norma tal como estaba al aprobar (nulo si no había). */
  readonly alcanceTexto: string | null;
  readonly total: number;
  readonly aplican: number;
  readonly noAplican: number;
  readonly sinControl: number;
  readonly aprobadaPor: string;
  readonly aprobadaEn: Date;
}

/** Repositorio de versiones aprobadas de la declaración, ligado a la empresa y la transacción. Inmutable: solo se agrega. */
export interface DeclaracionRepositoryPort {
  /** El mayor número de versión de la empresa (0 si no hay ninguna). */
  ultimoNumero(): Promise<number>;
  /** Guarda la versión con todas sus filas. Falso si ese número ya existe (otra persona aprobó entre la lectura y la escritura). */
  crear(version: VersionDeclaracion, filas: readonly FilaDeclaracion[]): Promise<boolean>;
  /** De la más nueva a la más antigua. */
  listarVersiones(): Promise<readonly VersionDeclaracion[]>;
  obtener(id: string): Promise<{ readonly version: VersionDeclaracion; readonly filas: readonly FilaDeclaracion[] } | null>;
}
