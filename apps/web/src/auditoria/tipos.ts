// Tipos de la auditoría interna (ADR 040) tal como los entrega la API. Los valores de las listas cerradas viven aquí y los validadores
// los usan: una respuesta con un valor desconocido se rechaza entera.

export const IMPORTANCIAS = ['alta', 'media', 'baja'] as const;
export const FRECUENCIAS = ['semestral', 'anual', 'cada_dos_anios', 'cada_tres_anios'] as const;
export const CAMBIOS_RELEVANTES = ['cambio', 'incidente'] as const;
export const RELACIONES = ['duena', 'participa', 'diseno', 'supervisa'] as const;
export const AVISOS_PROCESO = ['sin_relaciones', 'duena_inactiva'] as const;
export const ESTADOS_PROGRAMA = ['sin_aprobar', 'aprobado'] as const;
export const ESTADOS_AUDITORIA = ['planificada', 'en_preparacion', 'en_ejecucion', 'informe_emitido', 'cerrada', 'cancelada'] as const;
export const MOTIVOS_CAMBIO = ['sin_recursos', 'cambio_de_alcance', 'reprogramada', 'otro'] as const;
export const ROLES_EQUIPO = ['lider', 'auditor'] as const;
export const RESULTADOS = ['por_evaluar', 'conforme', 'no_conforme', 'observacion', 'oportunidad', 'no_aplica', 'no_verificado'] as const;
export const TIPOS_HALLAZGO = ['nc_mayor', 'nc_menor', 'observacion', 'oportunidad'] as const;
export const MOTIVOS_ANULACION = ['duplicado', 'error_de_registro', 'otro'] as const;
export const ESTADOS_DIAGNOSTICO = ['cumple', 'parcial', 'no_cumple', 'no_aplica'] as const;

export type Importancia = (typeof IMPORTANCIAS)[number];
export type Frecuencia = (typeof FRECUENCIAS)[number];
export type CambioRelevante = (typeof CAMBIOS_RELEVANTES)[number];
export type Relacion = (typeof RELACIONES)[number];
export type EstadoPrograma = (typeof ESTADOS_PROGRAMA)[number];
export type EstadoAuditoria = (typeof ESTADOS_AUDITORIA)[number];
export type MotivoCambio = (typeof MOTIVOS_CAMBIO)[number];
export type Resultado = (typeof RESULTADOS)[number];
export type TipoHallazgo = (typeof TIPOS_HALLAZGO)[number];

export interface Proceso {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly duenaId: string;
  readonly importancia: Importancia;
  readonly frecuencia: Frecuencia;
  readonly transversal: boolean;
  readonly cambioRelevante: CambioRelevante | null;
  readonly estado: 'vigente' | 'retirado';
  readonly version: number;
  readonly personasRelacionadas: number;
  readonly avisos: readonly (typeof AVISOS_PROCESO)[number][];
}
export interface ListaProcesos {
  readonly procesos: readonly Proceso[];
  readonly gestionSigVigente: boolean;
}
export interface RelacionProceso {
  readonly procesoId: string;
  readonly personaId: string;
  readonly relacion: Relacion;
}
export interface Programa {
  readonly id: string;
  readonly anio: number;
  readonly objetivo: string;
  readonly estado: EstadoPrograma;
  readonly aprobadoPor: string | null;
  readonly aprobadoEn: string | null;
  readonly version: number;
  readonly normas: readonly string[];
}
export interface AuditoriaDePrograma {
  readonly id: string;
  readonly codigo: string;
  readonly objetivo: string;
  readonly estado: EstadoAuditoria;
  readonly inicio: string;
  readonly fin: string;
  readonly trimestre: number;
  readonly normas: readonly string[];
  readonly combinada: boolean;
  readonly procesosIds: readonly string[];
  readonly liderId: string | null;
}
export interface ExclusionPrograma {
  readonly id: string;
  readonly tipo: 'proceso' | 'capitulo';
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly capitulo: string | null;
  readonly motivo: string;
}
export interface ProcesoDePrograma {
  readonly procesoId: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly importancia: Importancia;
  readonly frecuencia: Frecuencia;
  readonly cambioRelevante: CambioRelevante | null;
  readonly ultimaAuditoria: string | null;
  readonly hallazgosAbiertos: number;
  readonly incluido: boolean;
}
export interface DetallePrograma {
  readonly programa: Programa;
  readonly auditorias: readonly AuditoriaDePrograma[];
  readonly exclusiones: readonly ExclusionPrograma[];
  readonly procesos: readonly ProcesoDePrograma[];
  readonly pendientes: {
    readonly procesos: readonly string[];
    readonly capitulos: readonly { readonly libreriaCodigo: string; readonly capitulo: string }[];
    readonly procesosIncluidos: number;
    readonly capitulosIncluidos: number;
  };
}
export interface MiembroEquipo {
  readonly personaId: string;
  readonly rol: (typeof ROLES_EQUIPO)[number];
  readonly excepcion: boolean;
  readonly autoautorizada: boolean;
  readonly excepcionMotivo: string | null;
  readonly excepcionMedida: string | null;
  readonly excepcionAutorizadaPor: string | null;
}
export interface Auditoria {
  readonly id: string;
  readonly programaId: string;
  readonly codigo: string;
  readonly anio: number;
  readonly objetivo: string;
  readonly estado: EstadoAuditoria;
  readonly inicio: string;
  readonly fin: string;
  readonly reunionApertura: string | null;
  readonly reunionCierre: string | null;
  readonly reprogramaciones: number;
  readonly cancelacionMotivo: MotivoCambio | null;
  readonly informeEmitidoEn: string | null;
  readonly cerradaEn: string | null;
  readonly version: number;
  readonly normas: readonly string[];
  readonly combinada: boolean;
  readonly procesosIds: readonly string[];
  readonly procesosDelAlcance: readonly string[];
  readonly capitulos: readonly { readonly libreriaCodigo: string; readonly capitulo: string }[];
  readonly equipo: readonly MiembroEquipo[];
}
export interface Independencia {
  readonly personaId: string;
  readonly independiente: boolean;
  readonly conflictos: readonly { readonly procesoId: string; readonly relaciones: readonly Relacion[] }[];
  readonly avisos: readonly { readonly procesoId: string; readonly ultimaFecha: string }[];
  readonly procesosDelAlcance: readonly string[];
}
export interface FilaLista {
  readonly id: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly titulo: string | null;
  readonly guia: string | null;
  readonly agrupador: string | null;
  readonly resultado: Resultado;
  readonly nota: string | null;
  readonly version: number;
  readonly evaluadoPor: string | null;
  readonly evaluadoEn: string | null;
  readonly diagnostico: (typeof ESTADOS_DIAGNOSTICO)[number] | null;
  readonly preguntas: readonly { readonly id: string; readonly texto: string }[];
}
export interface ListaVerificacion {
  readonly auditoriaId: string;
  readonly filas: readonly FilaLista[];
  readonly avance: { readonly total: number; readonly evaluadas: number; readonly porResultado: Readonly<Record<Resultado, number>> };
}
export interface Hallazgo {
  readonly id: string;
  readonly codigo: string;
  readonly itemId: string | null;
  readonly tipo: TipoHallazgo;
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly idEstable: string | null;
  readonly enunciado: string;
  readonly evidencia: string;
  readonly justificacionGravedad: string | null;
  readonly estado: 'abierto' | 'anulado';
  readonly anulacionMotivo: (typeof MOTIVOS_ANULACION)[number] | null;
  readonly registradoPor: string;
  readonly version: number;
}
export interface ListaHallazgos {
  readonly hallazgos: readonly Hallazgo[];
  readonly abiertos: Readonly<Record<TipoHallazgo, number>>;
}
/** Del informe emitido la pantalla usa lo esencial; el Word sale completo de la copia congelada. */
export interface InformeAuditoria {
  readonly auditoriaId: string;
  readonly codigo: string;
  readonly huella: string;
  readonly emitidoPor: string;
  readonly emitidoEn: string;
  readonly conclusion: string;
  readonly limitaciones: string | null;
  readonly conteos: Readonly<Record<Resultado | 'total' | 'cubiertas', number>>;
}
export interface PanelAuditoria {
  readonly programaAnio: number | null;
  readonly prerrequisito: {
    readonly cumple: boolean;
    readonly auditoriasCerradas: number;
    readonly brechas: { readonly clausulas: readonly string[]; readonly procesos: readonly string[]; readonly controles: readonly string[]; readonly sinDeclaracion: boolean };
  };
  readonly cobertura12Meses: {
    readonly clausulas: { readonly total: number; readonly cubiertas: number };
    readonly controles: { readonly total: number; readonly cubiertos: number; readonly sinDeclaracion: boolean };
    readonly procesos: { readonly total: number; readonly cubiertos: number };
  };
  readonly auditorias: { readonly total: number; readonly cerradas: number; readonly porEstado: Readonly<Record<EstadoAuditoria, number>> };
}
export interface ListaProgramas {
  readonly programas: readonly Programa[];
}
export interface ListaRelaciones {
  readonly relaciones: readonly RelacionProceso[];
}
