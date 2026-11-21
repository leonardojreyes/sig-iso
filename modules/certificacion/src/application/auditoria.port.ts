import type { CambioRelevante, EstadoProceso, FrecuenciaProceso, ImportanciaProceso } from '../domain/proceso.js';
import type { EstadoAuditoria, EstadoPrograma, MotivoCambioAuditoria } from '../domain/auditoria.js';
import type { ResultadoItem } from '../domain/auditoria-lista.js';
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

// --- Lista de verificación, hallazgos e informe -------------------------------------------------------------------------------------

export interface FilaItem {
  readonly id: string;
  readonly auditoriaId: string;
  readonly libreriaCodigo: string;
  /** Identificador de la versión de la librería con que se generó la lista (queda fijada). */
  readonly libreriaVersion: string;
  readonly idEstable: string;
  readonly resultado: ResultadoItem;
  readonly nota: string | null;
  readonly evaluadoPor: string | null;
  readonly evaluadoEn: Date | null;
  readonly version: number;
}
export interface NuevoItem {
  readonly id: string;
  readonly auditoriaId: string;
  readonly libreriaCodigo: string;
  readonly libreriaVersion: string;
  readonly idEstable: string;
}
export interface FilaPregunta {
  readonly id: string;
  readonly itemId: string;
  readonly texto: string;
}

export interface ItemRepositoryPort {
  listar(auditoriaId: string): Promise<readonly FilaItem[]>;
  obtener(id: string): Promise<FilaItem | null>;
  /** Las filas de todas las auditorías cerradas (para la cobertura y el prerrequisito). */
  listarDeCerradas(): Promise<readonly FilaItem[]>;
  crearVarios(items: readonly NuevoItem[], usuarioId: string, ahora: Date): Promise<void>;
  /** Quita filas «por evaluar» (nunca una ya evaluada). Devuelve cuántas quitó. */
  quitarPorEvaluar(auditoriaId: string, claves: readonly { libreriaCodigo: string; idEstable: string }[]): Promise<number>;
  /** Concurrencia optimista por versión: `false` si otra persona cambió la fila antes. */
  evaluar(id: string, r: { resultado: ResultadoItem; nota: string | null }, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean>;
  preguntas(auditoriaId: string): Promise<readonly FilaPregunta[]>;
  agregarPregunta(p: FilaPregunta, usuarioId: string, ahora: Date): Promise<void>;
  quitarPregunta(auditoriaId: string, preguntaId: string): Promise<boolean>;
}

export type TipoHallazgo = 'nc_mayor' | 'nc_menor' | 'observacion' | 'oportunidad';
export interface FilaHallazgo {
  readonly id: string;
  readonly auditoriaId: string;
  readonly itemId: string | null;
  readonly numero: number;
  readonly codigo: string;
  readonly tipo: TipoHallazgo;
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly idEstable: string | null;
  readonly enunciado: string;
  readonly evidencia: string;
  readonly justificacionGravedad: string | null;
  readonly estado: 'abierto' | 'anulado';
  readonly anulacionMotivo: 'duplicado' | 'error_de_registro' | 'otro' | null;
  readonly registradoPor: string;
  readonly version: number;
}
export interface NuevoHallazgo {
  readonly id: string;
  readonly auditoriaId: string;
  readonly itemId: string | null;
  readonly numero: number;
  readonly tipo: TipoHallazgo;
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly idEstable: string | null;
  readonly enunciado: string;
  readonly evidencia: string;
  readonly justificacionGravedad: string | null;
}
export interface CambiosHallazgo {
  readonly tipo?: TipoHallazgo;
  readonly procesoId?: string | null;
  readonly libreriaCodigo?: string | null;
  readonly idEstable?: string | null;
  readonly enunciado?: string;
  readonly evidencia?: string;
  readonly justificacionGravedad?: string | null;
  readonly estado?: 'anulado';
  readonly anulacionMotivo?: 'duplicado' | 'error_de_registro' | 'otro';
  readonly anuladoPor?: string;
  readonly anuladoEn?: Date;
}
export interface HallazgoRepositoryPort {
  listar(auditoriaId: string): Promise<readonly FilaHallazgo[]>;
  obtener(id: string): Promise<FilaHallazgo | null>;
  siguienteNumero(auditoriaId: string): Promise<number>;
  /** `false` si el correlativo chocó (lo garantiza la base). */
  crear(h: NuevoHallazgo, usuarioId: string, ahora: Date): Promise<boolean>;
  actualizar(id: string, cambios: CambiosHallazgo, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean>;
}

export interface FilaInforme {
  readonly id: string;
  readonly auditoriaId: string;
  /** La copia congelada (JSON). Inmutable. */
  readonly contenido: unknown;
  readonly huella: string;
  readonly emitidoPor: string;
  readonly emitidoEn: Date;
}
export interface InformeRepositoryPort {
  obtener(auditoriaId: string): Promise<FilaInforme | null>;
  /** `false` si la auditoría ya tiene informe. */
  crear(i: { id: string; auditoriaId: string; contenido: unknown; huella: string }, usuarioId: string, ahora: Date): Promise<boolean>;
}
