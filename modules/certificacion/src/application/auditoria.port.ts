import type { CambioRelevante, EstadoProceso, FrecuenciaProceso, ImportanciaProceso } from '../domain/proceso.js';
import type { EstadoAuditoria, EstadoPrograma, MotivoCambioAuditoria } from '../domain/auditoria.js';
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

// --- Programa anual -----------------------------------------------------------------------------------------------------------------

export interface FilaPrograma {
  readonly id: string;
  readonly anio: number;
  readonly objetivo: string;
  readonly estado: EstadoPrograma;
  readonly aprobadoPor: string | null;
  readonly aprobadoEn: Date | null;
  readonly version: number;
  readonly creadoPor: string;
  readonly creadoEn: Date;
}
export interface CambiosPrograma {
  readonly objetivo?: string;
  readonly estado?: EstadoPrograma;
  readonly aprobadoPor?: string | null;
  readonly aprobadoEn?: Date | null;
}
export interface FilaExclusion {
  readonly id: string;
  readonly programaId: string;
  readonly tipo: 'proceso' | 'capitulo';
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly capitulo: string | null;
  readonly motivo: string;
}
export interface NuevaExclusion {
  readonly id: string;
  readonly programaId: string;
  readonly tipo: 'proceso' | 'capitulo';
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly capitulo: string | null;
  readonly motivo: string;
}

export interface ProgramaRepositoryPort {
  listar(): Promise<readonly FilaPrograma[]>;
  obtener(id: string): Promise<FilaPrograma | null>;
  /** `false` si ya hay un programa de ese año (lo garantiza la base). */
  crear(p: { id: string; anio: number; objetivo: string }, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Concurrencia optimista por versión: `false` si otra persona cambió el programa antes. */
  actualizar(id: string, cambios: CambiosPrograma, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean>;
  normas(programaId: string): Promise<readonly string[]>;
  /** Reemplaza el conjunto de normas del programa. */
  fijarNormas(programaId: string, normas: readonly string[], usuarioId: string, ahora: Date): Promise<void>;
  exclusiones(programaId: string): Promise<readonly FilaExclusion[]>;
  /** `false` si ya había un motivo para ese proceso o capítulo. */
  agregarExclusion(e: NuevaExclusion, usuarioId: string, ahora: Date): Promise<boolean>;
  quitarExclusion(programaId: string, id: string): Promise<boolean>;
}

// --- Auditorías ---------------------------------------------------------------------------------------------------------------------

export interface MiembroEquipo {
  readonly usuarioId: string;
  readonly rol: 'lider' | 'auditor';
  readonly excepcion: boolean;
  readonly excepcionMotivo: string | null;
  readonly excepcionMedida: string | null;
  readonly excepcionAutorizadaPor: string | null;
  readonly autoautorizada: boolean;
}
export interface CapituloDeAlcance {
  readonly libreriaCodigo: string;
  readonly capitulo: string;
}
export interface FilaAuditoria {
  readonly id: string;
  readonly programaId: string;
  readonly anio: number;
  readonly numero: number;
  readonly codigo: string;
  readonly objetivo: string;
  readonly estado: EstadoAuditoria;
  readonly inicio: string;
  readonly fin: string;
  readonly reunionApertura: string | null;
  readonly reunionCierre: string | null;
  readonly reprogramaciones: number;
  readonly cancelacionMotivo: MotivoCambioAuditoria | null;
  readonly informeEmitidoEn: Date | null;
  readonly cerradaEn: Date | null;
  readonly version: number;
  readonly creadoPor: string;
  readonly normas: readonly string[];
  readonly procesosIds: readonly string[];
  readonly capitulos: readonly CapituloDeAlcance[];
  readonly equipo: readonly MiembroEquipo[];
}
export interface NuevaAuditoria {
  readonly id: string;
  readonly programaId: string;
  readonly anio: number;
  readonly numero: number;
  readonly objetivo: string;
  readonly inicio: string;
  readonly fin: string;
  readonly reunionApertura: string | null;
  readonly reunionCierre: string | null;
}
export interface CambiosAuditoria {
  readonly objetivo?: string;
  readonly estado?: EstadoAuditoria;
  readonly inicio?: string;
  readonly fin?: string;
  readonly reunionApertura?: string | null;
  readonly reunionCierre?: string | null;
  readonly reprogramaciones?: number;
  readonly cancelacionMotivo?: MotivoCambioAuditoria | null;
  readonly cancelacionNota?: string | null;
  readonly informeEmitidoPor?: string;
  readonly informeEmitidoEn?: Date;
  readonly cerradaPor?: string;
  readonly cerradaEn?: Date;
}
export interface AlcanceDeAuditoriaEscribible {
  readonly normas: readonly string[];
  readonly procesosIds: readonly string[];
  readonly capitulos: readonly CapituloDeAlcance[];
}

export interface AuditoriaRepositoryPort {
  /** Todas las de la empresa, o solo las de un programa, con su alcance y su equipo. */
  listar(programaId?: string): Promise<readonly FilaAuditoria[]>;
  obtener(id: string): Promise<FilaAuditoria | null>;
  /** Siguiente correlativo del año (el máximo existente + 1). La unicidad la garantiza la base: `crear` devuelve `false` si chocó. */
  siguienteNumero(anio: number): Promise<number>;
  crear(a: NuevaAuditoria, usuarioId: string, ahora: Date): Promise<boolean>;
  actualizar(id: string, cambios: CambiosAuditoria, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Reemplaza normas, procesos y capítulos del alcance. */
  fijarAlcance(id: string, alcance: AlcanceDeAuditoriaEscribible, usuarioId: string, ahora: Date): Promise<void>;
  /** `false` si esa persona ya estaba en el equipo. */
  agregarMiembro(auditoriaId: string, m: MiembroEquipo, usuarioId: string, ahora: Date): Promise<boolean>;
  quitarMiembro(auditoriaId: string, personaId: string): Promise<boolean>;
}

/** Ayudas para armar el programa (H2.4): lo último que se auditó de cada proceso y sus hallazgos abiertos. Solo informativo. */
export interface AyudaDeProceso {
  readonly procesoId: string;
  /** `AAAA-MM-DD` de la última auditoría cerrada que lo incluyó. */
  readonly ultimaAuditoria: string | null;
  readonly hallazgosAbiertos: number;
}
export interface AyudasRepositoryPort {
  porProceso(): Promise<readonly AyudaDeProceso[]>;
}
