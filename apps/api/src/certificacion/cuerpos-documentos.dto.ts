import { ApiProperty } from '@nestjs/swagger';
import { CLASIFICACIONES_API, MOTIVOS_DEVOLUCION_API, MOTIVOS_REVISION_API, TIPOS_DOCUMENTO_API } from './esquemas-documentos.js';

// Cuerpos de entrada del contrato (packages/contracts/openapi.yaml) del control documental (ADR 039). Solo documentan: la lectura es
// tolerante y lo válido lo decide el caso de uso después del permiso (401 → 403 → 400 → 404 → 409).

const UUID = { type: String, format: 'uuid', maxLength: 36 } as const;
const FECHA = { type: String, format: 'date', maxLength: 10 } as const;

export class CuerpoDocumentoEntrada {
  @ApiProperty({ type: String, enum: TIPOS_DOCUMENTO_API }) tipo!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) titulo!: string;
  @ApiProperty({ type: String, maxLength: 60, required: false }) area?: string;
  @ApiProperty({ type: String, enum: CLASIFICACIONES_API }) clasificacion!: string;
  @ApiProperty(UUID) responsableId!: string;
  @ApiProperty({ type: String, maxLength: 120, required: false }) emisor?: string;
  @ApiProperty({ type: String, maxLength: 60, required: false }) edicionFuente?: string;
}

export class CuerpoDocumentoCambios {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, required: false }) titulo?: string;
  @ApiProperty({ type: String, maxLength: 60, nullable: true, required: false }) area?: string | null;
  @ApiProperty({ type: String, enum: CLASIFICACIONES_API, required: false }) clasificacion?: string;
  @ApiProperty({ ...UUID, required: false }) responsableId?: string;
  @ApiProperty({ type: String, maxLength: 120, nullable: true, required: false }) emisor?: string | null;
  @ApiProperty({ type: String, maxLength: 60, nullable: true, required: false }) edicionFuente?: string | null;
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}

export class CuerpoRevisionDocumento {
  @ApiProperty({ type: String, enum: MOTIVOS_REVISION_API, required: false }) motivo?: string;
  @ApiProperty({ ...FECHA, required: false }) proximaRevision?: string;
}

export class CuerpoDistribucion {
  @ApiProperty({ type: 'array', maxItems: 500, items: { type: 'string', format: 'uuid', maxLength: 36 }, required: false })
  usuarioIds?: string[];
  @ApiProperty({ type: 'array', maxItems: 10, items: { type: 'string', pattern: '^[a-z_]{3,30}$', maxLength: 30 }, required: false })
  roles?: string[];
}

export class CuerpoVinculoDocumento {
  @ApiProperty({ ...UUID, required: false }) controlId?: string;
  @ApiProperty({ type: String, pattern: '^[a-z0-9][a-z0-9-]{0,63}$', maxLength: 64, required: false }) libreriaCodigo?: string;
  @ApiProperty({ type: String, pattern: '^[a-z0-9][a-z0-9.-]{0,40}$', maxLength: 41, required: false }) idEstable?: string;
}

/** `multipart/form-data`: la nota va ANTES del archivo. */
export class CuerpoVersionSubida {
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 }) nota!: string;
  @ApiProperty({ type: String, format: 'binary' }) archivo!: string;
}

export class CuerpoEnvioRevision {
  @ApiProperty(UUID) aprobadorId!: string;
}

export class CuerpoDevolucionVersion {
  @ApiProperty({ type: String, enum: MOTIVOS_DEVOLUCION_API }) motivo!: string;
  @ApiProperty({ type: String, maxLength: 300, required: false }) nota?: string;
}

export class CuerpoAprobacionVersion {
  @ApiProperty({ ...FECHA, required: false }) proximaRevision?: string;
  @ApiProperty({ type: Boolean, required: false }) requiereLectura?: boolean;
  @ApiProperty({ type: String, maxLength: 300, required: false }) motivoExcepcion?: string;
}

export class CuerpoRetencionEntrada {
  @ApiProperty({ type: String, enum: TIPOS_DOCUMENTO_API }) tipo!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) anios!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 200 }) motivo!: string;
  @ApiProperty({ type: 'integer', minimum: 1, required: false }) versionEsperada?: number;
}
