import { ApiProperty } from '@nestjs/swagger';

// Formas de respuesta del contrato (packages/contracts/openapi.yaml): LibreriaResumen, Adopcion y EntradaLibreria. Cerradas.

export class LibreriaResumenResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, pattern: '^[a-z0-9-]+$', maxLength: 64 }) codigo!: string;
  @ApiProperty({ type: String, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$', maxLength: 20 }) version!: string;
  @ApiProperty({ type: Boolean }) esEjemplo!: boolean;
  @ApiProperty({ type: String, maxLength: 200 }) fuente!: string;
  @ApiProperty({ type: Boolean, description: 'Verdadero si la subió la empresa de quien consulta (ADR 034); falso si es del catálogo global.' }) propia!: boolean;
  @ApiProperty({ type: Boolean, description: 'Si la empresa de quien consulta ya la adoptó.' }) adoptada!: boolean;
}

export class AdopcionResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) libreriaId!: string;
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Entradas que quedaron disponibles para la empresa.' }) entradas!: number;
  @ApiProperty({ type: Boolean, description: 'Verdadero si ya estaba adoptada (respuesta 200, sin cambios).' }) yaAdoptada!: boolean;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40 }) adoptadaEn!: string;
}

export class CorrespondenciaNormaResponse {
  @ApiProperty({ type: String, maxLength: 60 }) norma!: string;
  @ApiProperty({ type: String, pattern: '^[0-9]{4}$', maxLength: 4 }) edicion!: string;
  @ApiProperty({ type: String, pattern: '^[A-Za-z0-9]+(\\.[A-Za-z0-9]+)*$', maxLength: 20 }) clausula!: string;
}

export class EntradaLibreriaResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, pattern: '^[a-z0-9][a-z0-9.-]{0,40}$', maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) libreriaId!: string;
  @ApiProperty({ type: 'integer', minimum: 4, maximum: 10, nullable: true }) capitulo!: number | null;
  @ApiProperty({ type: 'integer', enum: [1, 2] }) nivel!: number;
  @ApiProperty({ type: String, enum: ['clausula', 'control'] }) tipo!: string;
  @ApiProperty({ type: String, maxLength: 60, nullable: true }) grupo!: string | null;
  @ApiProperty({ type: String, maxLength: 80 }) titulo!: string;
  @ApiProperty({ type: String, maxLength: 280 }) guia!: string;
  @ApiProperty({ type: String, enum: ['comun', 'parcial', 'especifico'] }) alcanceComun!: string;
  @ApiProperty({ type: [CorrespondenciaNormaResponse], minItems: 1, maxItems: 20 }) aplicaA!: CorrespondenciaNormaResponse[];
  @ApiProperty({ type: Boolean }) esEjemplo!: boolean;
}

export class LibreriaSubidaRequest {
  @ApiProperty({ type: String, format: 'binary', description: 'El YAML de la librería (hasta 1 MB).' }) archivo!: string;
}

export class ErrorCargaLibreriaResponse {
  @ApiProperty({ type: String, maxLength: 41, nullable: true, description: 'Identificador de la entrada afectada, si aplica.' }) entrada!: string | null;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 999, nullable: true }) indice!: number | null;
  @ApiProperty({ type: String, maxLength: 200 }) ruta!: string;
  @ApiProperty({ type: String, maxLength: 60 }) codigo!: string;
}

export class CargaLibreriaResponse {
  @ApiProperty({ type: String, enum: ['cargada', 'ya_cargada', 'rechazada'] }) estado!: string;
  @ApiProperty({ type: String, enum: ['tipo_no_permitido', 'tamano_excedido', 'formato_invalido', 'contenido_no_permitido', 'codigo_no_permitido', 'hash_distinto'], nullable: true, description: 'Solo si el estado es `rechazada`.' }) motivo!: string | null;
  @ApiProperty({ type: String, pattern: '^[a-z0-9-]+$', maxLength: 64, nullable: true }) codigo!: string | null;
  @ApiProperty({ type: String, pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$', maxLength: 20, nullable: true }) version!: string | null;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 1000, nullable: true }) entradas!: number | null;
  @ApiProperty({ type: String, pattern: '^[0-9a-f]{64}$', maxLength: 64, description: 'SHA-256 del contenido canónico (si es válida) o de los bytes del archivo (si no).' }) huella!: string;
  @ApiProperty({ type: [ErrorCargaLibreriaResponse], maxItems: 200 }) errores!: ErrorCargaLibreriaResponse[];
}
