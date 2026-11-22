import type { Clasificacion, EstadoVersion, MotivoDevolucion, MotivoRevision, TipoDocumento } from '../domain/documento.js';
import type { TipoArchivo } from '../domain/tipo-archivo.js';

// Puertos de salida del control documental (ADR 039). Todo ocurre dentro de la unidad de trabajo: empresa fijada y bitácora en la misma
// transacción. Las filas son datos ya validados; las reglas viven en `domain/documento.ts`.

export interface FilaDocumento {
  readonly id: string;
  readonly tipo: TipoDocumento;
  readonly numero: number;
  readonly codigo: string;
  readonly titulo: string;
  readonly area: string | null;
  readonly clasificacion: Clasificacion;
  readonly responsableId: string;
  readonly emisor: string | null;
  readonly edicionFuente: string | null;
  readonly estado: 'activo' | 'retirado';
  readonly proximaRevision: string | null;
  readonly ultimaRevisionEn: Date | null;
  readonly ultimaRevisionPor: string | null;
  readonly version: number;
  readonly creadoPor: string;
  readonly creadoEn: Date;
}

export interface NuevoDocumento {
  readonly id: string;
  readonly tipo: TipoDocumento;
  readonly numero: number;
  readonly titulo: string;
  readonly area: string | null;
  readonly clasificacion: Clasificacion;
  readonly responsableId: string;
  readonly emisor: string | null;
  readonly edicionFuente: string | null;
}

/** Lo que cambia de un documento; lo ausente no se toca. */
export interface CambiosDocumento {
  readonly titulo?: string;
  readonly area?: string | null;
  readonly clasificacion?: Clasificacion;
  readonly responsableId?: string;
  readonly emisor?: string | null;
  readonly edicionFuente?: string | null;
  readonly estado?: 'activo' | 'retirado';
  readonly proximaRevision?: string | null;
  readonly ultimaRevisionEn?: Date;
  readonly ultimaRevisionPor?: string;
}

export interface ArchivoVersion {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: TipoArchivo;
  readonly bytes: number;
  readonly sha256: string;
}

export interface FilaVersion {
  readonly id: string;
  readonly documentoId: string;
  readonly numero: number;
  readonly estado: EstadoVersion;
  readonly nota: string;
  readonly archivo: ArchivoVersion;
  readonly autorId: string;
  readonly aprobadorId: string | null;
  readonly enviadaEn: Date | null;
  readonly aprobadaPor: string | null;
  readonly aprobadaEn: Date | null;
  readonly porSuAutor: boolean;
  readonly motivoExcepcion: string | null;
  readonly requiereLectura: boolean;
  readonly devueltaMotivo: MotivoDevolucion | null;
  readonly devueltaNota: string | null;
  readonly obsoletaEn: Date | null;
  readonly version: number;
  readonly creadaEn: Date;
}

export interface NuevaVersion {
  readonly id: string;
  readonly documentoId: string;
  readonly numero: number;
  readonly nota: string;
  readonly archivo: ArchivoVersion;
}

export interface CambiosVersion {
  readonly estado?: EstadoVersion;
  readonly aprobadorId?: string | null;
  readonly enviadaEn?: Date | null;
  readonly aprobadaPor?: string | null;
  readonly aprobadaEn?: Date | null;
  readonly porSuAutor?: boolean;
  readonly motivoExcepcion?: string | null;
  readonly requiereLectura?: boolean;
  readonly devueltaMotivo?: MotivoDevolucion | null;
  readonly devueltaNota?: string | null;
  readonly obsoletaEn?: Date | null;
}

export interface DocumentoRepositoryPort {
  listar(): Promise<readonly FilaDocumento[]>;
  obtener(id: string): Promise<FilaDocumento | null>;
  /** Siguiente correlativo del tipo (el máximo existente + 1). La unicidad la garantiza la base: `crear` devuelve `false` si chocó. */
  siguienteNumero(tipo: TipoDocumento): Promise<number>;
  crear(d: NuevoDocumento, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Concurrencia optimista por versión: `false` si otra persona cambió el documento antes. */
  actualizar(id: string, cambios: CambiosDocumento, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean>;
}

export interface VersionDocumentoRepositoryPort {
  obtener(id: string): Promise<FilaVersion | null>;
  listarDeDocumento(documentoId: string): Promise<readonly FilaVersion[]>;
  /** Todas las versiones aprobadas (una por documento a lo sumo), para listas y cobertura. */
  listarVigentes(): Promise<readonly FilaVersion[]>;
  /** Versiones obsoletas de la empresa (para marcar las elegibles para disposición). */
  listarObsoletas(): Promise<readonly FilaVersion[]>;
  /** Bloquea el documento hasta el fin de la transacción y devuelve el siguiente número de versión. */
  siguienteNumero(documentoId: string): Promise<number>;
  crear(v: NuevaVersion, usuarioId: string, ahora: Date): Promise<boolean>;
  actualizar(id: string, cambios: CambiosVersion, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Pasa a «obsoleta» la versión aprobada de un documento, si la hay. Devuelve su identificador. */
  obsoletizarVigente(documentoId: string, ahora: Date, usuarioId: string): Promise<string | null>;
}

export interface DestinatarioRepositoryPort {
  listar(documentoId: string): Promise<readonly string[]>;
  reemplazar(documentoId: string, usuarioIds: readonly string[], usuarioId: string): Promise<void>;
}

export interface LecturaPendiente {
  readonly versionId: string;
  readonly documentoId: string;
  readonly codigo: string;
  readonly titulo: string;
  readonly numeroVersion: number;
}

export interface LecturaDeVersion {
  readonly versionId: string;
  readonly usuarioId: string;
  readonly confirmadaEn: Date | null;
}

export interface LecturaRepositoryPort {
  crearPendientes(versionId: string, usuarioIds: readonly string[]): Promise<void>;
  listarDeVersion(versionId: string): Promise<readonly LecturaDeVersion[]>;
  /** Lecturas de todas las versiones de un documento (para el historial). */
  listarDeVersiones(versionIds: readonly string[]): Promise<readonly LecturaDeVersion[]>;
  /** `false` si no había lectura pendiente (o ya estaba confirmada): la fecha no se reescribe. */
  confirmar(versionId: string, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Lecturas sin confirmar de una persona sobre versiones que aún rigen. */
  pendientesDe(usuarioId: string): Promise<readonly LecturaPendiente[]>;
}

export interface VinculoDocumentoRepositoryPort {
  listarControles(documentoId: string): Promise<readonly string[]>;
  listarEntradas(documentoId: string): Promise<readonly { libreriaCodigo: string; idEstable: string }[]>;
  /** Todas las entradas ligadas a algún documento (para la cobertura y el filtro por norma). */
  listarTodasEntradas(): Promise<readonly { documentoId: string; libreriaCodigo: string; idEstable: string }[]>;
  agregarControl(documentoId: string, controlId: string, usuarioId: string): Promise<boolean>;
  quitarControl(documentoId: string, controlId: string): Promise<boolean>;
  agregarEntrada(documentoId: string, libreriaCodigo: string, idEstable: string, usuarioId: string): Promise<boolean>;
  quitarEntrada(documentoId: string, libreriaCodigo: string, idEstable: string): Promise<boolean>;
}

export interface FilaRetencion {
  readonly tipo: TipoDocumento;
  readonly anios: number;
  readonly motivo: string;
  readonly version: number;
}

export interface RetencionRepositoryPort {
  listar(): Promise<readonly FilaRetencion[]>;
  crear(r: Omit<FilaRetencion, 'version'>, usuarioId: string, ahora: Date): Promise<boolean>;
  actualizar(tipo: TipoDocumento, anios: number, motivo: string, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean>;
}

export interface PersonaDirectorio {
  readonly id: string;
  readonly nombre: string;
  readonly rol: string | null;
  /** Con rol y sin baja. */
  readonly activa: boolean;
}

/**
 * Directorio de las personas de la empresa de la sesión (decisión 7 del plan de riesgos y ADR 039): solo identificador, nombre,
 * rol y si está activa. El módulo no importa código de otros módulos: el adaptador lee `usuario` con la empresa fijada.
 */
export interface DirectorioPersonasPort {
  listar(): Promise<readonly PersonaDirectorio[]>;
  /** ¿Existe en la empresa de la sesión y sigue activa (con rol y sin baja)? Una persona de otra empresa, de baja o inexistente da `false`. */
  existeActiva(personaId: string): Promise<boolean>;
}

export type { MotivoRevision };
