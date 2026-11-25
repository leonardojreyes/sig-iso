import { ApiProperty } from '@nestjs/swagger';
import { CLASIFICACIONES_ACTIVO_API, TIPOS_ACTIVO_API } from './esquemas-activos.js';

// Cuerpos de entrada del contrato de los activos (ADR 038). Solo documentan: la lectura es tolerante y lo válido lo decide el caso de
// uso después del permiso (401 → 403 → 400 → 404 → 409).
const UUID = { type: String, format: 'uuid', maxLength: 36 } as const;

export class CuerpoActivoEntrada {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, maxLength: 500, required: false }) descripcion?: string;
  @ApiProperty({ type: String, enum: TIPOS_ACTIVO_API }) tipo!: string;
  @ApiProperty({ type: String, enum: CLASIFICACIONES_ACTIVO_API }) clasificacion!: string;
  @ApiProperty(UUID) responsableId!: string;
}

export class CuerpoActivoCambios {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, required: false }) nombre?: string;
  @ApiProperty({ type: String, maxLength: 500, nullable: true, required: false }) descripcion?: string | null;
  @ApiProperty({ type: String, enum: TIPOS_ACTIVO_API, required: false }) tipo?: string;
  @ApiProperty({ type: String, enum: CLASIFICACIONES_ACTIVO_API, required: false }) clasificacion?: string;
  @ApiProperty({ ...UUID, required: false }) responsableId?: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}

export class CuerpoActivoVersion {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}

export class CuerpoLigaActivo {
  @ApiProperty(UUID) activoId!: string;
}
