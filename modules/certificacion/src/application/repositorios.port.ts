import type { Alcance } from '../domain/alcance.js';
import type { Control } from '../domain/control.js';
import type { Evaluacion } from '../domain/evaluacion.js';
import type { Evidencia } from '../domain/evidencia.js';
import type { FilaDeclaracion, ViaRiesgo } from '../domain/declaracion.js';
import type { DecisionTratamiento, NivelRiesgo } from '../domain/riesgo.js';
import type { MotivoInclusion } from '../domain/motivo-inclusion.js';
import type { ReferenciaTratamiento, TipoReferencia } from '../domain/referencia-tratamiento.js';
import type { TipoMotivo } from '../domain/declaracion.js';
import type { Riesgo } from '../domain/riesgo.js';
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

/** Repositorio de riesgos de la empresa (vigentes y retirados), ligado a la empresa y la transacción de la unidad de trabajo. */
export interface RiesgoRepositoryPort {
  /** Todos, ordenados por número. */
  listar(): Promise<readonly Riesgo[]>;
  obtener(id: string): Promise<Riesgo | null>;
  /** El número que sigue al mayor de la empresa (1 si no hay ninguno); también cuenta los retirados: el código no se reutiliza. */
  siguienteNumero(): Promise<number>;
  /** Falso si ese número ya existe en la empresa (otra persona creó un riesgo entre la lectura y la escritura). */
  crear(riesgo: Riesgo, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Cambia solo si la versión guardada es `versionEsperada` y la sube a `riesgo.version`. Falso si no coincide. */
  actualizar(riesgo: Riesgo, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean>;
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
  /** Lo que justifica la versión. Ausente o nulo en las aprobadas antes de la Declaración justificada (ADR 037). */
  readonly justificacion?: JustificacionVersion | null;
}

/** La escala y los cortes del nivel de riesgo usados al aprobar. Se congelan: cambiarlos después no altera la versión. */
export interface EscalaCongelada {
  readonly escalaMax: number;
  /** Primer puntaje de los niveles medio, alto y crítico. */
  readonly corteMedio: number;
  readonly corteAlto: number;
  readonly corteCritico: number;
}
export interface JustificacionVersion {
  readonly escala: EscalaCongelada;
  /** Controles que aplican y tenían motivo al aprobar. */
  readonly conMotivo: number;
  readonly riesgosVigentes: number;
}

/** Copia inmutable de lo que justifica una versión aprobada: motivos, riesgos tal como estaban, vínculos fila–riesgo y referencias. */
export interface CopiaJustificacion {
  readonly motivos: readonly { readonly libreriaCodigo: string; readonly idEstable: string; readonly tipo: TipoMotivo; readonly nota: string }[];
  readonly riesgos: readonly {
    readonly codigo: string;
    readonly titulo: string;
    readonly probabilidad: number;
    readonly impacto: number;
    readonly nivel: NivelRiesgo;
    readonly decision: DecisionTratamiento;
    readonly responsableId: string | null;
    /** Códigos de los controles vigentes de la empresa que lo trataban. */
    readonly controles: readonly string[];
  }[];
  /** Qué riesgos justificaban cada fila y de qué manera. */
  readonly riesgosPorFila: readonly { readonly libreriaCodigo: string; readonly idEstable: string; readonly riesgoCodigo: string; readonly via: ViaRiesgo }[];
  readonly referencias: readonly { readonly tipo: TipoReferencia; readonly titulo: string; readonly versionDoc: string; readonly fecha: string; readonly ubicacion: string }[];
}

/** Repositorio de versiones aprobadas de la declaración, ligado a la empresa y la transacción. Inmutable: solo se agrega. */
export interface DeclaracionRepositoryPort {
  /** El mayor número de versión de la empresa (0 si no hay ninguna). */
  ultimoNumero(): Promise<number>;
  /** Guarda la versión con todas sus filas. Falso si ese número ya existe (otra persona aprobó entre la lectura y la escritura). */
  crear(version: VersionDeclaracion, filas: readonly FilaDeclaracion[], copia?: CopiaJustificacion): Promise<boolean>;
  /** De la más nueva a la más antigua. */
  listarVersiones(): Promise<readonly VersionDeclaracion[]>;
  /** La copia es nula en las versiones aprobadas antes de la Declaración justificada. */
  obtener(id: string): Promise<{ readonly version: VersionDeclaracion; readonly filas: readonly FilaDeclaracion[]; readonly copia: CopiaJustificacion | null } | null>;
}

/** Un riesgo tratado con un control de la empresa. */
export interface VinculoRiesgoControlFila {
  readonly riesgoId: string;
  readonly controlId: string;
}
/** Tratamiento previsto: un riesgo vinculado directo a un control del Anexo A, sin control propio de la empresa. */
export interface VinculoRiesgoEntradaFila {
  readonly riesgoId: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
}

/** Repositorio de los vínculos de los riesgos, ligado a la empresa y la transacción. Se agregan y se quitan (con rastro), no se actualizan. */
export interface VinculoRiesgoRepositoryPort {
  /** Todos los vínculos con controles de la empresa, ordenados por riesgo y control. */
  listarControles(): Promise<readonly VinculoRiesgoControlFila[]>;
  /** Todos los tratamientos previstos, ordenados por riesgo y entrada. */
  listarEntradas(): Promise<readonly VinculoRiesgoEntradaFila[]>;
  /** Cuántos vínculos (de ambas clases) tiene el riesgo. */
  contar(riesgoId: string): Promise<number>;
  /** Falso si ya existía. */
  agregarControl(riesgoId: string, controlId: string, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Falso si no existía. */
  quitarControl(riesgoId: string, controlId: string): Promise<boolean>;
  /** Falso si ya existía. */
  agregarEntrada(riesgoId: string, libreriaCodigo: string, idEstable: string, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Falso si no existía. */
  quitarEntrada(riesgoId: string, libreriaCodigo: string, idEstable: string): Promise<boolean>;
}

/** Repositorio de los motivos de inclusión registrados, ligado a la empresa y la transacción. */
export interface MotivoRepositoryPort {
  /** Todos, ordenados por librería, control y tipo. */
  listar(): Promise<readonly MotivoInclusion[]>;
  obtener(libreriaCodigo: string, idEstable: string, tipo: TipoMotivo): Promise<MotivoInclusion | null>;
  /** Falso si ya existía (otra persona lo registró entre la lectura y la escritura). */
  crear(motivo: MotivoInclusion, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Cambia solo si la versión guardada es `versionEsperada` y la sube a `motivo.version`. Falso si no coincide. */
  actualizar(motivo: MotivoInclusion, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean>;
  /** Quita solo si la versión guardada es `versionEsperada`. Falso si no coincide o ya no existía. */
  eliminar(libreriaCodigo: string, idEstable: string, tipo: TipoMotivo, versionEsperada: number): Promise<boolean>;
}

/** Repositorio de las referencias al análisis y al plan de tratamiento (una de cada tipo por norma), ligado a la empresa y la transacción. */
export interface ReferenciaRepositoryPort {
  /** Las de la norma (a lo sumo una por tipo). */
  listar(norma: string): Promise<readonly ReferenciaTratamiento[]>;
  obtener(norma: string, tipo: TipoReferencia): Promise<ReferenciaTratamiento | null>;
  /** Falso si ya existía. */
  crear(referencia: ReferenciaTratamiento, usuarioId: string, ahora: Date): Promise<boolean>;
  /** Cambia solo si la versión guardada es `versionEsperada`. Falso si no coincide. */
  actualizar(referencia: ReferenciaTratamiento, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean>;
  /** Quita solo si la versión guardada es `versionEsperada`. Falso si no coincide o ya no existía. */
  eliminar(norma: string, tipo: TipoReferencia, versionEsperada: number): Promise<boolean>;
}
