import { ApiProperty } from '@nestjs/swagger';
import { CAMBIOS_RELEVANTES_API, FRECUENCIAS_API, IMPORTANCIAS_API, RELACIONES_API } from './esquemas-auditoria.js';

// Cuerpos de entrada del contrato (packages/contracts/openapi.yaml) de la auditoría interna (ADR 040). Solo documentan: la lectura es
// tolerante y lo válido lo decide el caso de uso después del permiso (401 → 403 → 400 → 404 → 409).

const UUID = { type: String, format: 'uuid', maxLength: 36 } as const;

export class CuerpoProcesoEntrada {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, maxLength: 300, nullable: true, required: false }) descripcion?: string | null;
  @ApiProperty(UUID) duenaId!: string;
  @ApiProperty({ type: String, enum: IMPORTANCIAS_API, required: false }) importancia?: string;
  @ApiProperty({ type: String, enum: FRECUENCIAS_API, required: false }) frecuencia?: string;
}

export class CuerpoProcesoCambios {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, required: false }) nombre?: string;
  @ApiProperty({ type: String, maxLength: 300, nullable: true, required: false }) descripcion?: string | null;
  @ApiProperty({ ...UUID, required: false }) duenaId?: string;
  @ApiProperty({ type: String, enum: IMPORTANCIAS_API, required: false }) importancia?: string;
  @ApiProperty({ type: String, enum: FRECUENCIAS_API, required: false }) frecuencia?: string;
  @ApiProperty({ type: String, enum: CAMBIOS_RELEVANTES_API, nullable: true, required: false }) cambioRelevante?: string | null;
}

export class CuerpoRelacionEntrada {
  @ApiProperty(UUID) personaId!: string;
  @ApiProperty({ type: String, enum: RELACIONES_API }) relacion!: string;
}
