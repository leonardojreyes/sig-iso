import { ApiProperty } from '@nestjs/swagger';

// Esquemas de las operaciones de personas (ADR 036). Iguales a los de packages/contracts/openapi.yaml: la prueba de conformidad los compara.
const ROLES = ['administrador_sig', 'dueno_proceso', 'auditor_interno', 'auditor_externo', 'colaborador', 'alta_direccion'] as const;
const CODIGO = '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$';

export class SolicitudAccesoResponse {
  @ApiProperty({ type: String, pattern: CODIGO, maxLength: 9 }) codigo!: string;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40 }) venceEn!: string;
}

export class SolicitudPendienteResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) usuarioId!: string;
  @ApiProperty({ type: String, pattern: CODIGO, maxLength: 9 }) codigo!: string;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40 }) creadaEn!: string;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40 }) venceEn!: string;
}

export class PersonaResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, minLength: 3, maxLength: 254 }) correo!: string;
  @ApiProperty({ type: String, enum: [...ROLES, null], nullable: true }) rol!: string | null;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40, nullable: true }) bajaEn!: string | null;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
}

export class PersonasResponse {
  @ApiProperty({ type: [PersonaResponse], maxItems: 1000 }) personas!: PersonaResponse[];
  @ApiProperty({ type: [SolicitudPendienteResponse], maxItems: 50 }) solicitudes!: SolicitudPendienteResponse[];
}

export class AprobacionSolicitudRequest {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, minLength: 3, maxLength: 254 }) correo!: string;
  @ApiProperty({ type: String, enum: [...ROLES] }) rol!: string;
}

export class CambioDeRolRequest {
  @ApiProperty({ type: String, enum: [...ROLES] }) rol!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}

export class PersonaVersionRequest {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}
