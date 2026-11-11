import { ApiProperty } from '@nestjs/swagger';
import { CorrespondenciaNormaResponse } from '../normas/dto.js';

// Formas del contrato (packages/contracts/openapi.yaml) para alcance y diagnóstico. Cerradas.

const ESTADOS = ['cumple', 'parcial', 'no_cumple', 'no_aplica'];

export class AlcanceNormaRequest {
  @ApiProperty({ type: String, minLength: 1, maxLength: 60, pattern: '^[A-Za-z0-9 :./-]+$' }) norma!: string;
}

export class AlcanceEntradaRequest {
  @ApiProperty({ type: String, minLength: 1, maxLength: 60, pattern: '^[A-Za-z0-9 :./-]+$' }) norma!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 4000 }) texto!: string;
}

export class AlcanceResponse {
  @ApiProperty({ type: String, maxLength: 60 }) norma!: string;
  @ApiProperty({ type: String, maxLength: 4000, nullable: true, description: 'Nulo mientras el alcance no se haya definido.' }) texto!: string | null;
  @ApiProperty({ type: Boolean }) aprobado!: boolean;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40, nullable: true }) aprobadoEn!: string | null;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40, nullable: true }) actualizadoEn!: string | null;
}

export class EvaluacionEntradaRequest {
  @ApiProperty({ type: String, pattern: '^[a-z0-9-]+$', maxLength: 64 }) libreriaCodigo!: string;
  @ApiProperty({ type: String, pattern: '^[a-z0-9][a-z0-9.-]{0,40}$', maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: String, enum: ESTADOS }) estado!: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true, required: false }) comentario?: string | null;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true, required: false }) responsableId?: string | null;
  @ApiProperty({ type: String, format: 'date', maxLength: 10, nullable: true, required: false }) fechaObjetivo?: string | null;
  @ApiProperty({ type: 'integer', minimum: 0, required: false }) versionEsperada?: number;
}

export class EvaluacionResponse {
  @ApiProperty({ type: String, maxLength: 64 }) libreriaCodigo!: string;
  @ApiProperty({ type: String, maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: String, enum: ESTADOS }) estado!: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true }) comentario!: string | null;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true }) responsableId!: string | null;
  @ApiProperty({ type: String, format: 'date', maxLength: 10, nullable: true }) fechaObjetivo!: string | null;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
}

export class EvaluacionVigenteResponse {
  @ApiProperty({ type: String, enum: ESTADOS }) estado!: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true }) comentario!: string | null;
  @ApiProperty({ type: String, format: 'date', maxLength: 10, nullable: true }) fechaObjetivo!: string | null;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
}

export class FilaDiagnosticoResponse {
  @ApiProperty({ type: String, maxLength: 64 }) libreriaCodigo!: string;
  @ApiProperty({ type: String, maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: String, enum: ['clausula', 'control'] }) tipo!: string;
  @ApiProperty({ type: 'integer', minimum: 4, maximum: 10, nullable: true }) capitulo!: number | null;
  @ApiProperty({ type: String, maxLength: 60, nullable: true }) grupo!: string | null;
  @ApiProperty({ type: String, maxLength: 80 }) titulo!: string;
  @ApiProperty({ type: String, maxLength: 280 }) guia!: string;
  @ApiProperty({ type: [CorrespondenciaNormaResponse], minItems: 1, maxItems: 20 }) aplicaA!: CorrespondenciaNormaResponse[];
  @ApiProperty({ type: EvaluacionVigenteResponse, nullable: true, description: 'Nulo = sin evaluar.' }) evaluacion!: EvaluacionVigenteResponse | null;
}

export class DesgloseResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) cumple!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) parcial!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) noCumple!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) noAplica!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) sinEvaluar!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @ApiProperty({ type: 'number', minimum: 0, maximum: 100, nullable: true }) porcentaje!: number | null;
}

export class MadurezNormaResponse {
  @ApiProperty({ type: String, maxLength: 60 }) norma!: string;
  @ApiProperty({ type: DesgloseResponse }) desglose!: DesgloseResponse;
}

export class MadurezAgrupadorResponse {
  @ApiProperty({ type: String, enum: ['capitulo', 'tema'] }) tipo!: string;
  @ApiProperty({ type: String, maxLength: 60, description: 'Capítulo (por ejemplo «4») o tema del Anexo A.' }) nombre!: string;
  @ApiProperty({ type: DesgloseResponse }) desglose!: DesgloseResponse;
}

export class MadurezResponse {
  @ApiProperty({ type: [MadurezNormaResponse], maxItems: 20 }) porNorma!: MadurezNormaResponse[];
  @ApiProperty({ type: [MadurezAgrupadorResponse], maxItems: 100 }) porAgrupador!: MadurezAgrupadorResponse[];
  @ApiProperty({ type: DesgloseResponse }) clausulas!: DesgloseResponse;
}

export class DiagnosticoResponse {
  @ApiProperty({ type: [FilaDiagnosticoResponse], maxItems: 500 }) filas!: FilaDiagnosticoResponse[];
  @ApiProperty({ type: MadurezResponse }) madurez!: MadurezResponse;
  @ApiProperty({ type: 'array', items: { type: 'string', maxLength: 60 }, maxItems: 20 }) normas!: string[];
}

// ---- Controles de la empresa y mapeos (M3)

export class ControlEntradaRequest {
  @ApiProperty({ type: String, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$', maxLength: 20 }) codigo!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true, required: false }) descripcion?: string | null;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true, required: false }) responsableId?: string | null;
}

export class ControlCambiosRequest {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, required: false }) nombre?: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true, required: false }) descripcion?: string | null;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true, required: false }) responsableId?: string | null;
}

export class ControlVersionRequest {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}

export class MapeoEntradaRequest {
  @ApiProperty({ type: String, pattern: '^[a-z0-9][a-z0-9-]{0,63}$', maxLength: 64 }) libreriaCodigo!: string;
  @ApiProperty({ type: String, pattern: '^[a-z0-9][a-z0-9.-]{0,40}$', maxLength: 41 }) idEstable!: string;
}

export class MapeoResultadoResponse {
  @ApiProperty({ type: String, maxLength: 64 }) libreriaCodigo!: string;
  @ApiProperty({ type: String, maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: Boolean, description: 'Verdadero si se creó (201); falso si ya existía (200).' }) creado!: boolean;
}

export class ControlResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$', maxLength: 20 }) codigo!: string;
  @ApiProperty({ type: String, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true }) descripcion!: string | null;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true }) responsableId!: string | null;
  @ApiProperty({ type: String, enum: ['vigente', 'retirado'] }) estado!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
}

export class EntradaDeMapeoResponse {
  @ApiProperty({ type: String, enum: ['clausula', 'control'] }) tipo!: string;
  @ApiProperty({ type: String, maxLength: 80 }) titulo!: string;
  @ApiProperty({ type: [CorrespondenciaNormaResponse], minItems: 1, maxItems: 20 }) aplicaA!: CorrespondenciaNormaResponse[];
}

export class MapeoDeControlResponse {
  @ApiProperty({ type: String, maxLength: 64 }) libreriaCodigo!: string;
  @ApiProperty({ type: String, maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: EntradaDeMapeoResponse, nullable: true, description: 'Nula si la entrada ya no está entre las librerías que la empresa adoptó.' }) entrada!: EntradaDeMapeoResponse | null;
}

export class ControlMarcoResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, maxLength: 20 }) codigo!: string;
  @ApiProperty({ type: String, maxLength: 120 }) nombre!: string;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true }) descripcion!: string | null;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true }) responsableId!: string | null;
  @ApiProperty({ type: String, enum: ['vigente', 'retirado'] }) estado!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
  @ApiProperty({ type: [MapeoDeControlResponse], maxItems: 50 }) mapeos!: MapeoDeControlResponse[];
  @ApiProperty({ type: 'array', items: { type: 'string', maxLength: 60 }, maxItems: 20, description: 'Normas que alcanza por los mapeos cuyas entradas siguen adoptadas.' }) normas!: string[];
}

export class MarcoControlesResponse {
  @ApiProperty({ type: [ControlMarcoResponse], maxItems: 500 }) controles!: ControlMarcoResponse[];
  @ApiProperty({ type: 'array', items: { type: 'string', maxLength: 60 }, maxItems: 20 }) normas!: string[];
}
