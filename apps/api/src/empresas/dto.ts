import { ApiProperty } from '@nestjs/swagger';

// Formas de respuesta del contrato (packages/contracts/openapi.yaml): Identidad y Marca. Cerradas, sin campos de más.

export class EmpresaResumenResponse {
  @ApiProperty({ type: String, example: 'empresa-a', pattern: '^[a-z0-9-]+$', maxLength: 32 }) slug!: string;
  @ApiProperty({ type: String, example: 'Empresa A (prueba)', maxLength: 120 }) nombre!: string;
}

export class IdentidadResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) usuarioId!: string;
  @ApiProperty({ type: String, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: [String], enum: ['administrador_sig', 'dueno_proceso', 'auditor_interno', 'auditor_externo', 'colaborador', 'alta_direccion'], minItems: 1, maxItems: 6, uniqueItems: true }) roles!: string[];
  @ApiProperty({ type: EmpresaResumenResponse }) empresa!: EmpresaResumenResponse;
}

export class MarcaResponse {
  @ApiProperty({ type: String, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, pattern: '^#[0-9A-Fa-f]{6}$', maxLength: 7 }) colorPrimario!: string;
  @ApiProperty({ type: String, pattern: '^#[0-9A-Fa-f]{6}$', maxLength: 7 }) colorOriginal!: string;
  @ApiProperty({ type: Boolean }) ajustadoPorContraste!: boolean;
  @ApiProperty({ type: String, nullable: true, maxLength: 2048, pattern: '^(https://[A-Za-z0-9.-]+(:[0-9]+)?/[^\\s@]*|/[^/\\\\\\s][^\\s@]*)$' }) logoUrl!: string | null;
}
