import { ApiProperty } from '@nestjs/swagger';

// Formas de respuesta del contrato (packages/contracts/openapi.yaml): LibreriaResumen, Adopcion y EntradaLibreria. Cerradas.

export class LibreriaResumenResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, pattern: '^[a-z0-9-]+$', maxLength: 64 }) codigo!: string;
  @ApiProperty({ type: String, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' }) version!: string;
  @ApiProperty({ type: Boolean }) esEjemplo!: boolean;
  @ApiProperty({ type: String, maxLength: 200 }) fuente!: string;
  @ApiProperty({ type: Boolean, description: 'Si la empresa de quien consulta ya la adoptó.' }) adoptada!: boolean;
}

export class AdopcionResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) libreriaId!: string;
  @ApiProperty({ type: Number, minimum: 0, description: 'Entradas que quedaron disponibles para la empresa.' }) entradas!: number;
  @ApiProperty({ type: Boolean, description: 'Verdadero si ya estaba adoptada (respuesta 200, sin cambios).' }) yaAdoptada!: boolean;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40 }) adoptadaEn!: string;
}

export class CorrespondenciaNormaResponse {
  @ApiProperty({ type: String, maxLength: 60 }) norma!: string;
  @ApiProperty({ type: String, pattern: '^[0-9]{4}$' }) edicion!: string;
  @ApiProperty({ type: String, maxLength: 20 }) clausula!: string;
}

export class EntradaLibreriaResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) libreriaId!: string;
  @ApiProperty({ type: Number, minimum: 4, maximum: 10 }) capitulo!: number;
  @ApiProperty({ type: Number, enum: [1, 2] }) nivel!: number;
  @ApiProperty({ type: String, maxLength: 80 }) titulo!: string;
  @ApiProperty({ type: String, maxLength: 280 }) guia!: string;
  @ApiProperty({ type: String, enum: ['comun', 'parcial', 'especifico'] }) alcanceComun!: string;
  @ApiProperty({ type: [CorrespondenciaNormaResponse], minItems: 1, maxItems: 20 }) aplicaA!: CorrespondenciaNormaResponse[];
  @ApiProperty({ type: Boolean }) esEjemplo!: boolean;
}
