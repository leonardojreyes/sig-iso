import { ApiProperty } from '@nestjs/swagger';
import { CAMBIOS_RELEVANTES_API, FRECUENCIAS_API, IMPORTANCIAS_API, RELACIONES_API, TIPOS_EXCLUSION_API } from './esquemas-auditoria.js';

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

const NORMA = { type: String, maxLength: 80, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$' } as const;
const NORMAS = { type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: { type: 'string', maxLength: 80, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$' } } as const;

export class CuerpoProgramaEntrada {
  @ApiProperty({ type: 'integer', minimum: 2000, maximum: 2100 }) anio!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 }) objetivo!: string;
  @ApiProperty(NORMAS) normas!: string[];
}

export class CuerpoProgramaCambios {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500, required: false }) objetivo?: string;
  @ApiProperty({ ...NORMAS, required: false }) normas?: string[];
}

export class CuerpoProgramaVersion {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}

export class CuerpoExclusionEntrada {
  @ApiProperty({ type: String, enum: TIPOS_EXCLUSION_API }) tipo!: string;
  @ApiProperty({ ...UUID, required: false }) procesoId?: string;
  @ApiProperty({ ...NORMA, required: false }) libreriaCodigo?: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 60, required: false }) capitulo?: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 300 }) motivo!: string;
}

export class CuerpoExclusionQuitar {
  @ApiProperty(UUID) exclusionId!: string;
}
