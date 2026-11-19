// Formas del control documental (contrato openapi.yaml, ADR 039) tal como las usa la web. Todo viene validado por `validadores.ts`.
export const TIPOS_DOCUMENTO = ['politica', 'procedimiento', 'instructivo', 'formato', 'manual', 'externo', 'otro'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
export const CLASIFICACIONES = ['publica', 'interna', 'confidencial', 'restringida'] as const;
export type Clasificacion = (typeof CLASIFICACIONES)[number];
export const ESTADOS_VERSION = ['borrador', 'en_revision', 'aprobada', 'obsoleta', 'descartada'] as const;
export type EstadoVersion = (typeof ESTADOS_VERSION)[number];
export const MOTIVOS_DEVOLUCION = ['incompleta', 'incorrecta', 'otro'] as const;
export type MotivoDevolucion = (typeof MOTIVOS_DEVOLUCION)[number];
export const MOTIVOS_REVISION = ['periodica', 'auditoria', 'cambio_de_contexto'] as const;
export type MotivoRevision = (typeof MOTIVOS_REVISION)[number];
export type EstadoRevision = 'vencida' | 'por_vencer' | 'al_dia';

export interface LecturasDocumento {
  readonly confirmadas: number;
  readonly total: number;
}

export interface Documento {
  readonly id: string;
  readonly codigo: string;
  readonly tipo: TipoDocumento;
  readonly titulo: string;
  readonly area: string | null;
  readonly clasificacion: Clasificacion;
  readonly responsableId: string;
  readonly emisor: string | null;
  readonly edicionFuente: string | null;
  readonly estado: 'activo' | 'retirado';
  readonly proximaRevision: string | null;
  readonly revision: EstadoRevision | null;
  readonly ultimaRevisionEn: string | null;
  readonly vigente: { readonly versionId: string; readonly numero: number; readonly aprobadaEn: string } | null;
  readonly sinVigente: boolean;
  readonly lecturas: LecturasDocumento | null;
  readonly lecturaPendiente: boolean;
  readonly version: number;
}

export interface ListaDocumentos {
  readonly hoy: string;
  readonly documentos: readonly Documento[];
}

export interface VersionDocumento {
  readonly id: string;
  readonly documentoId: string;
  readonly numero: number;
  readonly estado: EstadoVersion;
  readonly vigente: boolean;
  readonly nota: string;
  readonly archivo: { readonly nombre: string; readonly tipo: string; readonly bytes: number; readonly sha256: string };
  readonly autorId: string;
  readonly aprobadorId: string | null;
  readonly aprobadaPor: string | null;
  readonly aprobadaEn: string | null;
  readonly porSuAutor: boolean;
  readonly motivoExcepcion: string | null;
  readonly requiereLectura: boolean;
  readonly devueltaMotivo: MotivoDevolucion | null;
  readonly devueltaNota: string | null;
  readonly obsoletaEn: string | null;
  readonly elegibleParaDisposicion: boolean;
  readonly lecturas: LecturasDocumento | null;
  readonly creadaEn: string;
}

export interface DocumentoDetalle extends Documento {
  readonly versiones: readonly VersionDocumento[];
  readonly destinatarios: readonly string[];
  readonly controles: readonly string[];
  readonly entradas: readonly { readonly libreriaCodigo: string; readonly idEstable: string }[];
  readonly retencion: { readonly anios: number; readonly motivo: string } | null;
  readonly unicoAdministrador: boolean;
}

export interface LecturaPendiente {
  readonly versionId: string;
  readonly documentoId: string;
  readonly codigo: string;
  readonly titulo: string;
  readonly numeroVersion: number;
}

export interface CoberturaDocumental {
  readonly normas: readonly string[];
  readonly total: number;
  readonly cubiertas: number;
  readonly entradas: readonly {
    readonly libreriaCodigo: string;
    readonly idEstable: string;
    readonly tipo: 'clausula' | 'control';
    readonly titulo: string;
    readonly normas: readonly string[];
    readonly documentos: readonly { readonly id: string; readonly codigo: string }[];
    readonly cubierta: boolean;
  }[];
}

export interface Retencion {
  readonly tipo: TipoDocumento;
  readonly anios: number;
  readonly motivo: string;
  readonly version: number;
}

export interface PersonaDirectorio {
  readonly id: string;
  readonly nombre: string;
  readonly activa: boolean;
}
