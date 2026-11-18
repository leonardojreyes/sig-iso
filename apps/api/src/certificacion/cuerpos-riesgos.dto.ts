import { ApiProperty } from '@nestjs/swagger';

// Cuerpos de entrada del contrato (packages/contracts/openapi.yaml) de los riesgos y la justificación de la Declaración (ADR 037). Solo
// documentan: la lectura es tolerante (`cuerpos.ts`) y lo válido lo decide el caso de uso después del permiso (401 → 403 → 400 → 404).

const DECISIONES = ['mitigar', 'aceptar', 'transferir', 'evitar'];
const TIPOS_MOTIVO = ['legal', 'contractual', 'negocio', 'otro'];
const TIPOS_REFERENCIA = ['analisis', 'plan'];
const LIBRERIA = { type: String, pattern: '^[a-z0-9][a-z0-9-]{0,63}$', maxLength: 64 } as const;
const ID_ESTABLE = { type: String, pattern: '^[a-z0-9][a-z0-9.-]{0,40}$', maxLength: 41 } as const;

export class CuerpoRiesgoEntrada {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) titulo!: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true, required: false }) descripcion?: string | null;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 5 }) probabilidad!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 5 }) impacto!: number;
  @ApiProperty({ type: String, enum: DECISIONES }) decision!: string;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true, required: false }) responsableId?: string | null;
}

export class CuerpoRiesgoCambios {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, required: false }) titulo?: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true, required: false }) descripcion?: string | null;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 5, required: false }) probabilidad?: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 5, required: false }) impacto?: number;
  @ApiProperty({ type: String, enum: DECISIONES, required: false }) decision?: string;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true, required: false }) responsableId?: string | null;
}

export class CuerpoRiesgoVersion {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}

export class CuerpoVinculoControl {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) controlId!: string;
}

export class CuerpoMotivoEntrada {
  @ApiProperty(LIBRERIA) libreriaCodigo!: string;
  @ApiProperty(ID_ESTABLE) idEstable!: string;
  @ApiProperty({ type: String, enum: TIPOS_MOTIVO }) tipo!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 }) nota!: string;
  @ApiProperty({ type: 'integer', minimum: 1, required: false, description: 'Ausente = crear; presente = la versión que la persona vio.' }) versionEsperada?: number;
}

export class CuerpoMotivoQuitar {
  @ApiProperty(LIBRERIA) libreriaCodigo!: string;
  @ApiProperty(ID_ESTABLE) idEstable!: string;
  @ApiProperty({ type: String, enum: TIPOS_MOTIVO }) tipo!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}

export class CuerpoReferenciaEntrada {
  @ApiProperty({ type: String, enum: TIPOS_REFERENCIA }) tipo!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) titulo!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 40 }) versionDoc!: string;
  @ApiProperty({ type: String, format: 'date', maxLength: 10 }) fecha!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 200 }) ubicacion!: string;
  @ApiProperty({ type: 'integer', minimum: 1, required: false, description: 'Ausente = crear; presente = la versión que la persona vio.' }) versionEsperada?: number;
}

export class CuerpoReferenciaQuitar {
  @ApiProperty({ type: String, enum: TIPOS_REFERENCIA }) tipo!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}
