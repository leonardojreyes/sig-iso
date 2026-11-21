import type { CambioRelevante, EstadoProceso, FrecuenciaProceso, ImportanciaProceso } from '../domain/proceso.js';
import type { RelacionProceso } from '../domain/independencia.js';

// Puertos de salida de la auditoría interna (ADR 040). Todo ocurre dentro de la unidad de trabajo: empresa fijada y bitácora en la misma
// transacción. Las filas son datos ya validados; las reglas viven en `domain/`.

export interface FilaProceso {
  readonly id: string;
  readonly numero: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly duenaId: string;
  readonly importancia: ImportanciaProceso;
  readonly frecuencia: FrecuenciaProceso;
  readonly transversal: boolean;
  readonly cambioRelevante: CambioRelevante | null;
  readonly estado: EstadoProceso;
  readonly version: number;
  readonly creadoPor: string;
  readonly creadoEn: Date;
}

export interface NuevoProceso {
  readonly id: string;
  readonly numero: number;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly duenaId: string;
  readonly importancia: ImportanciaProceso;
  readonly frecuencia: FrecuenciaProceso;
  readonly transversal: boolean;
}

/** Lo que cambia de un proceso; lo ausente no se toca. La marca transversal y el código nunca cambian. */
export interface CambiosProceso {
  readonly nombre?: string;
  readonly descripcion?: string | null;
  readonly duenaId?: string;
  readonly importancia?: ImportanciaProceso;
  readonly frecuencia?: FrecuenciaProceso;
  readonly cambioRelevante?: CambioRelevante | null;
  readonly estado?: EstadoProceso;
}

export interface ProcesoRepositoryPort {
  listar(): Promise<readonly FilaProceso[]>;
  obtener(id: string): Promise<FilaProceso | null>;
  /** El proceso transversal («Gestión del SIG») vigente, si lo hay. */
  transversalVigente(): Promise<FilaProceso | null>;
  /** Siguiente correlativo (el máximo existente + 1). La unicidad la garantiza la base: `crear` devuelve `false` si chocó. */
  siguienteNumero(): Promise<number>;
  crear(p: NuevoProceso, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Concurrencia optimista por versión: `false` si otra persona cambió el proceso antes. */
  actualizar(id: string, cambios: CambiosProceso, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean>;
}

export interface FilaRelacion {
  readonly procesoId: string;
  readonly usuarioId: string;
  readonly relacion: RelacionProceso;
}

export interface RelacionRepositoryPort {
  /** Todas las relaciones de la empresa (la lista de procesos cuenta con ellas y la independencia las consulta). */
  listar(): Promise<readonly FilaRelacion[]>;
  /** `false` si ya existía (idempotente). */
  agregar(r: FilaRelacion, creadoPor: string, ahora: Date): Promise<boolean>;
  /** `false` si no existía. */
  quitar(r: FilaRelacion): Promise<boolean>;
}
