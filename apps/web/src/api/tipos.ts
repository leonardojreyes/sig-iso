// Formas de las respuestas de la API que usa la web (espejo de packages/contracts/openapi.yaml). Se validan al recibirlas.
export type AlcanceComun = 'comun' | 'parcial' | 'especifico';
export type Rol =
  'administrador_sig' | 'dueno_proceso' | 'auditor_interno' | 'auditor_externo' | 'colaborador' | 'alta_direccion';

export interface LibreriaResumen {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly version: string;
  readonly esEjemplo: boolean;
  readonly fuente: string;
  /** Subida por la empresa (ADR 034); si no, es del catálogo global. */
  readonly propia: boolean;
  readonly adoptada: boolean;
}

export interface CorrespondenciaNorma {
  readonly norma: string;
  readonly edicion: string;
  readonly clausula: string;
}

export interface EntradaLibreria {
  readonly id: string;
  readonly idEstable: string;
  readonly libreriaId: string;
  /** Nulo en un control del Anexo A. */
  readonly capitulo: number | null;
  readonly nivel: 1 | 2;
  readonly tipo: 'clausula' | 'control';
  /** Tema del control; nulo en una cláusula. */
  readonly grupo: string | null;
  readonly titulo: string;
  readonly guia: string;
  readonly alcanceComun: AlcanceComun;
  readonly aplicaA: readonly CorrespondenciaNorma[];
  readonly esEjemplo: boolean;
}

export interface Identidad {
  readonly usuarioId: string;
  readonly nombre: string;
  readonly roles: readonly Rol[];
  readonly empresa: { readonly slug: string; readonly nombre: string };
}

export type EstadoEvaluacion = 'cumple' | 'parcial' | 'no_cumple' | 'no_aplica';

export interface Alcance {
  readonly norma: string;
  /** Nulo mientras el alcance no se haya definido. */
  readonly texto: string | null;
  readonly aprobado: boolean;
  readonly aprobadoEn: string | null;
  readonly actualizadoEn: string | null;
}

export interface EvaluacionVigente {
  readonly estado: EstadoEvaluacion;
  readonly comentario: string | null;
  readonly fechaObjetivo: string | null;
  readonly version: number;
}

export interface FilaDiagnostico {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: 'clausula' | 'control';
  readonly capitulo: number | null;
  readonly grupo: string | null;
  readonly titulo: string;
  readonly guia: string;
  readonly aplicaA: readonly CorrespondenciaNorma[];
  /** Nulo = sin evaluar. */
  readonly evaluacion: EvaluacionVigente | null;
}

export interface Desglose {
  readonly cumple: number;
  readonly parcial: number;
  readonly noCumple: number;
  readonly noAplica: number;
  readonly sinEvaluar: number;
  readonly total: number;
  /** Nulo si no hay nada evaluado que cuente (no es 0). */
  readonly porcentaje: number | null;
}

export interface Madurez {
  readonly porNorma: readonly { readonly norma: string; readonly desglose: Desglose }[];
  readonly porAgrupador: readonly { readonly tipo: 'capitulo' | 'tema'; readonly nombre: string; readonly desglose: Desglose }[];
  readonly clausulas: Desglose;
}

export interface Diagnostico {
  readonly filas: readonly FilaDiagnostico[];
  readonly madurez: Madurez;
  readonly normas: readonly string[];
}

export type EstadoControl = 'vigente' | 'retirado';

export interface EntradaDeMapeo {
  readonly tipo: 'clausula' | 'control';
  readonly titulo: string;
  readonly aplicaA: readonly CorrespondenciaNorma[];
}

export interface MapeoDeControl {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  /** Nula si la entrada ya no está entre las librerías que la empresa adoptó. */
  readonly entrada: EntradaDeMapeo | null;
}

export interface ControlMarco {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly responsableId: string | null;
  readonly estado: EstadoControl;
  readonly version: number;
  readonly mapeos: readonly MapeoDeControl[];
  /** Normas que alcanza por los mapeos cuyas entradas siguen adoptadas. */
  readonly normas: readonly string[];
}

export interface MarcoControles {
  readonly controles: readonly ControlMarco[];
  readonly normas: readonly string[];
}

export type TipoArchivo =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'text/plain'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export type TipoEvidencia = 'documento' | 'registro';
export type EstadoEvidencia = 'activa' | 'reemplazada' | 'eliminada';

export interface Evidencia {
  readonly id: string;
  readonly controlId: string;
  readonly tipo: TipoEvidencia;
  readonly titulo: string;
  readonly fechaHecho: string;
  readonly vigenteHasta: string | null;
  readonly estado: EstadoEvidencia;
  /** La evidencia a la que reemplazó, si es un reemplazo. */
  readonly reemplazaId: string | null;
  /** Activa y con la vigencia al día (fecha de hoy en Ecuador). */
  readonly vigente: boolean;
  /** Activa pero con la vigencia ya pasada. */
  readonly vencida: boolean;
  readonly creadaEn: string;
  readonly archivo: { readonly nombre: string; readonly tipo: TipoArchivo; readonly bytes: number; readonly sha256: string };
}

export type EstadoCobertura = 'cubierta' | 'evidencia_vencida' | 'sin_evidencia' | 'sin_control' | 'no_aplica';

export interface ResumenCobertura {
  readonly total: number;
  readonly cubiertas: number;
  readonly evidenciaVencida: number;
  readonly sinEvidencia: number;
  readonly sinControl: number;
  /** Nulo si no hay ninguna entrada a la que pedir cobertura (no es 0). */
  readonly porcentaje: number | null;
}

export interface CoberturaEntrada {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: 'clausula' | 'control';
  readonly capitulo: number | null;
  readonly grupo: string | null;
  readonly titulo: string;
  readonly normas: readonly string[];
  readonly estado: EstadoCobertura;
  readonly controles: number;
  readonly evidencias: number;
}

export interface Cobertura {
  readonly hoy: string;
  readonly entradas: readonly CoberturaEntrada[];
  readonly porNorma: readonly (ResumenCobertura & { readonly norma: string })[];
  readonly total: ResumenCobertura;
  readonly normas: readonly string[];
}

// ---- Declaración de Aplicabilidad (M5)
export type Aplicabilidad = 'aplica' | 'no_aplica' | 'por_decidir';
export type Implementacion = 'implementado' | 'parcial' | 'no_implementado';

export interface FilaDeclaracion {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly orden: number;
  readonly titulo: string;
  readonly grupo: string | null;
  readonly aplicabilidad: Aplicabilidad;
  readonly implementacion: Implementacion | null;
  readonly justificacion: string | null;
  readonly controles: readonly string[];
  readonly cobertura: EstadoCobertura;
}

export interface ResumenDeclaracion {
  readonly total: number;
  readonly aplican: number;
  readonly noAplican: number;
  readonly porDecidir: number;
  readonly sinControl: number;
  readonly aprobable: boolean;
}

export interface VersionDeclaracion {
  readonly id: string;
  readonly numero: number;
  readonly total: number;
  readonly aplican: number;
  readonly noAplican: number;
  readonly sinControl: number;
  readonly aprobadaPor: string;
  readonly aprobadaEn: string;
}

// ---- Riesgos y justificación de la Declaración (ADR 037)
export type NivelRiesgo = 'bajo' | 'medio' | 'alto' | 'critico';
export type DecisionTratamiento = 'mitigar' | 'aceptar' | 'transferir' | 'evitar';
export type TipoMotivo = 'legal' | 'contractual' | 'negocio' | 'otro';
export type TipoReferencia = 'analisis' | 'plan';
export type ViaRiesgo = 'control' | 'previsto';
export type BloqueoDeclaracion = 'sin_filas' | 'por_decidir' | 'sin_motivo';

export interface EscalaRiesgo {
  readonly escalaMax: number;
  readonly corteMedio: number;
  readonly corteAlto: number;
  readonly corteCritico: number;
}
export interface ReferenciaDeclaracion {
  readonly tipo: TipoReferencia;
  readonly titulo: string;
  readonly versionDoc: string;
  readonly fecha: string;
  readonly ubicacion: string;
  readonly version: number;
}
export interface MotivoDeFila {
  readonly tipo: TipoMotivo;
  readonly nota: string;
}
export interface RiesgoDeFila {
  readonly codigo: string;
  readonly titulo: string;
  readonly nivel: NivelRiesgo;
  readonly via: ViaRiesgo;
}
export interface FilaJustificacion {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly sinMotivo: boolean;
  readonly motivos: readonly MotivoDeFila[];
  readonly riesgos: readonly RiesgoDeFila[];
}
/** Lo que justifica el borrador, derivado en vivo. */
export interface JustificacionBorrador {
  readonly conMotivo: number;
  readonly sinMotivo: number;
  readonly riesgosVigentes: number;
  readonly riesgosSinTratamiento: number;
  readonly bloqueos: readonly BloqueoDeclaracion[];
  readonly filas: readonly FilaJustificacion[];
  readonly referencias: readonly ReferenciaDeclaracion[];
  readonly escala: EscalaRiesgo;
  readonly faltaPlanTratamiento: boolean;
}
export interface RiesgoCongelado {
  readonly codigo: string;
  readonly titulo: string;
  readonly probabilidad: number;
  readonly impacto: number;
  readonly nivel: NivelRiesgo;
  readonly decision: DecisionTratamiento;
  readonly responsableId: string | null;
  readonly controles: readonly string[];
}
/** Lo que justificaba una versión al aprobarla, tal como se congeló. */
export interface JustificacionVersion {
  readonly escala: EscalaRiesgo;
  readonly conMotivo: number;
  readonly riesgosVigentes: number;
  readonly motivos: readonly { readonly libreriaCodigo: string; readonly idEstable: string; readonly tipo: TipoMotivo; readonly nota: string }[];
  readonly riesgos: readonly RiesgoCongelado[];
  readonly riesgosPorFila: readonly { readonly libreriaCodigo: string; readonly idEstable: string; readonly riesgoCodigo: string; readonly via: ViaRiesgo }[];
  readonly referencias: readonly Omit<ReferenciaDeclaracion, 'version'>[];
}

export interface VersionDeclaracionConFilas extends VersionDeclaracion {
  readonly alcance: string | null;
  readonly filas: readonly FilaDeclaracion[];
  /** Nula en las versiones aprobadas antes de la Declaración justificada. */
  readonly justificacion: JustificacionVersion | null;
}

export interface Declaracion {
  readonly norma: string;
  readonly hoy: string;
  readonly resumen: ResumenDeclaracion;
  readonly filas: readonly FilaDeclaracion[];
  readonly alcance: { readonly texto: string; readonly aprobado: boolean } | null;
  readonly ultimaVersion: VersionDeclaracion | null;
  readonly justificacion: JustificacionBorrador;
}

export type EstadoCargaLibreria = 'cargada' | 'ya_cargada' | 'rechazada';
export type MotivoCargaLibreria = 'tipo_no_permitido' | 'tamano_excedido' | 'formato_invalido' | 'contenido_no_permitido' | 'codigo_no_permitido' | 'hash_distinto';

/** Qué falló y dónde; nunca el contenido del archivo. */
export interface ErrorCargaLibreria {
  readonly entrada: string | null;
  readonly indice: number | null;
  readonly ruta: string;
  readonly codigo: string;
}

export interface CargaLibreria {
  readonly estado: EstadoCargaLibreria;
  readonly motivo: MotivoCargaLibreria | null;
  readonly codigo: string | null;
  readonly version: string | null;
  readonly entradas: number | null;
  readonly huella: string;
  readonly errores: readonly ErrorCargaLibreria[];
}

/** Una empresa a la que pertenece la persona de la sesión (ADR 035). */
export interface EmpresaDePersona {
  readonly slug: string;
  readonly nombre: string;
  /** Es la empresa de esta sesión ahora. */
  readonly activa: boolean;
}

/** Una persona de la empresa (ADR 036). Rol nulo = sin acceso (dada de baja). Nombre y correo los ve solo el administrador SIG. */
export interface PersonaDeLaEmpresa {
  readonly id: string;
  readonly nombre: string;
  readonly correo: string;
  readonly rol: Rol | null;
  readonly bajaEn: string | null;
  readonly version: number;
}

/** Una solicitud de acceso vigente: el código es lo que la persona le entrega al administrador. */
export interface SolicitudDeAcceso {
  readonly id: string;
  readonly usuarioId: string;
  readonly codigo: string;
  readonly creadaEn: string;
  readonly venceEn: string;
}

export interface Personas {
  readonly personas: readonly PersonaDeLaEmpresa[];
  readonly solicitudes: readonly SolicitudDeAcceso[];
}

// ---- Riesgos mínimos (ADR 037)
export interface Riesgo {
  readonly id: string;
  readonly codigo: string;
  readonly titulo: string;
  readonly descripcion: string | null;
  readonly probabilidad: number;
  readonly impacto: number;
  readonly puntaje: number;
  readonly nivel: NivelRiesgo;
  readonly decision: DecisionTratamiento;
  readonly responsableId: string | null;
  readonly estado: 'vigente' | 'retirado';
  readonly version: number;
}
/** Un riesgo de la lista, con cuánto tratamiento tiene. */
export interface RiesgoListado extends Riesgo {
  readonly controles: number;
  readonly tratamientosPrevistos: number;
  readonly sinTratamiento: boolean;
}
export interface ControlDeRiesgo {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly estado: 'vigente' | 'retirado';
}
export interface TratamientoPrevisto {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  /** Nulo si la entrada ya no está entre las librerías adoptadas. */
  readonly titulo: string | null;
}
export interface RiesgoDetalle extends Riesgo {
  readonly controles: readonly ControlDeRiesgo[];
  readonly tratamientosPrevistos: readonly TratamientoPrevisto[];
}
export interface AvisoRetiroRiesgo {
  readonly riesgoId: string;
  readonly codigo: string;
  readonly controlesSinMotivo: readonly { readonly libreriaCodigo: string; readonly idEstable: string; readonly titulo: string }[];
}
