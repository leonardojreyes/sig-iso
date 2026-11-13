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

// ---- Evidencias con archivo y cobertura (M4)

const TIPOS_ARCHIVO_API = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

/** Cuerpo `multipart/form-data` de la subida (solo para documentar: lo recibe el motor de subida, no Nest). */
export class EvidenciaSubidaRequest {
  @ApiProperty({ type: String, enum: ['documento', 'registro'] }) tipo!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) titulo!: string;
  @ApiProperty({ type: String, format: 'date', maxLength: 10 }) fechaHecho!: string;
  @ApiProperty({ type: String, format: 'date', maxLength: 10, required: false }) vigenteHasta?: string;
  @ApiProperty({ type: String, format: 'binary' }) archivo!: string;
}

export class EvidenciaReemplazoRequest {
  @ApiProperty({ type: String, enum: ['documento', 'registro'], required: false }) tipo?: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, required: false }) titulo?: string;
  @ApiProperty({ type: String, format: 'date', maxLength: 10 }) fechaHecho!: string;
  @ApiProperty({ type: String, format: 'date', maxLength: 10, required: false }) vigenteHasta?: string;
  @ApiProperty({ type: String, format: 'binary' }) archivo!: string;
}

export class ArchivoEvidenciaResponse {
  @ApiProperty({ type: String, maxLength: 120, description: 'Etiqueta normalizada (sin carpetas ni símbolos); en el almacén el archivo es un UUID del servidor.' }) nombre!: string;
  @ApiProperty({ type: String, enum: TIPOS_ARCHIVO_API }) tipo!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 26214400 }) bytes!: number;
  @ApiProperty({ type: String, pattern: '^[0-9a-f]{64}$', maxLength: 64 }) sha256!: string;
}

export class EvidenciaResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) controlId!: string;
  @ApiProperty({ type: String, enum: ['documento', 'registro'] }) tipo!: string;
  @ApiProperty({ type: String, maxLength: 120 }) titulo!: string;
  @ApiProperty({ type: String, format: 'date', maxLength: 10 }) fechaHecho!: string;
  @ApiProperty({ type: String, format: 'date', maxLength: 10, nullable: true }) vigenteHasta!: string | null;
  @ApiProperty({ type: String, enum: ['activa', 'reemplazada', 'eliminada'] }) estado!: string;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36, nullable: true }) reemplazaId!: string | null;
  @ApiProperty({ type: Boolean, description: 'Activa y con la vigencia al día (fecha de hoy en Ecuador).' }) vigente!: boolean;
  @ApiProperty({ type: Boolean, description: 'Activa pero con la vigencia ya pasada.' }) vencida!: boolean;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40 }) creadaEn!: string;
  @ApiProperty({ type: ArchivoEvidenciaResponse }) archivo!: ArchivoEvidenciaResponse;
}

export class ResumenCoberturaResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) cubiertas!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) evidenciaVencida!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) sinEvidencia!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) sinControl!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 100, nullable: true, description: 'Nulo si no hay ninguna entrada a la que pedir cobertura (no es 0).' }) porcentaje!: number | null;
}

export class CoberturaNormaResponse extends ResumenCoberturaResponse {
  @ApiProperty({ type: String, maxLength: 60 }) norma!: string;
}

export class CoberturaEntradaResponse {
  @ApiProperty({ type: String, maxLength: 64 }) libreriaCodigo!: string;
  @ApiProperty({ type: String, maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: String, enum: ['clausula', 'control'] }) tipo!: string;
  @ApiProperty({ type: 'integer', minimum: 4, maximum: 10, nullable: true }) capitulo!: number | null;
  @ApiProperty({ type: String, maxLength: 60, nullable: true }) grupo!: string | null;
  @ApiProperty({ type: String, maxLength: 80 }) titulo!: string;
  @ApiProperty({ type: 'array', items: { type: 'string', maxLength: 60 }, maxItems: 20 }) normas!: string[];
  @ApiProperty({ type: String, enum: ['cubierta', 'evidencia_vencida', 'sin_evidencia', 'sin_control', 'no_aplica'] }) estado!: string;
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Controles vigentes que la cubren por un mapeo.' }) controles!: number;
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Evidencias activas de esos controles (vigentes o no).' }) evidencias!: number;
}

export class CoberturaResponse {
  @ApiProperty({ type: String, format: 'date', maxLength: 10, description: 'La fecha de hoy en Ecuador con la que se calculó el vencimiento.' }) hoy!: string;
  @ApiProperty({ type: [CoberturaEntradaResponse], maxItems: 500 }) entradas!: CoberturaEntradaResponse[];
  @ApiProperty({ type: [CoberturaNormaResponse], maxItems: 20 }) porNorma!: CoberturaNormaResponse[];
  @ApiProperty({ type: ResumenCoberturaResponse }) total!: ResumenCoberturaResponse;
  @ApiProperty({ type: 'array', items: { type: 'string', maxLength: 60 }, maxItems: 20 }) normas!: string[];
}

// ---- Declaración de Aplicabilidad (M5)
const APLICABILIDAD = ['aplica', 'no_aplica', 'por_decidir'];
const COBERTURAS = ['cubierta', 'evidencia_vencida', 'sin_evidencia', 'sin_control', 'no_aplica'];

export class FilaDeclaracionResponse {
  @ApiProperty({ type: String, maxLength: 64 }) libreriaCodigo!: string;
  @ApiProperty({ type: String, maxLength: 41 }) idEstable!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) orden!: number;
  @ApiProperty({ type: String, maxLength: 200 }) titulo!: string;
  @ApiProperty({ type: String, maxLength: 80, nullable: true }) grupo!: string | null;
  @ApiProperty({ type: String, enum: APLICABILIDAD }) aplicabilidad!: string;
  @ApiProperty({ type: String, maxLength: 20, nullable: true, description: 'implementado, parcial o no_implementado; nula si no aplica o está por decidir.' }) implementacion!: string | null;
  @ApiProperty({ type: String, maxLength: 1000, nullable: true, description: 'Solo si no aplica; es la que la empresa escribió al evaluar.' }) justificacion!: string | null;
  @ApiProperty({ type: 'array', items: { type: 'string', maxLength: 20 }, maxItems: 50, description: 'Códigos de los controles vigentes de la empresa que la cubren.' }) controles!: string[];
  @ApiProperty({ type: String, enum: COBERTURAS }) cobertura!: string;
}

export class ResumenDeclaracionResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) aplican!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) noAplican!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) porDecidir!: number;
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Aplican y ningún control de la empresa los cubre; no impide aprobar.' }) sinControl!: number;
  @ApiProperty({ type: 'boolean', description: 'Hay filas y ninguna está por decidir.' }) aprobable!: boolean;
}

export class VersionDeclaracionResponse {
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) id!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) numero!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) total!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) aplican!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) noAplican!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) sinControl!: number;
  @ApiProperty({ type: String, format: 'uuid', maxLength: 36 }) aprobadaPor!: string;
  @ApiProperty({ type: String, format: 'date-time', maxLength: 40 }) aprobadaEn!: string;
}

export class VersionDeclaracionConFilasResponse extends VersionDeclaracionResponse {
  @ApiProperty({ type: String, maxLength: 4000, nullable: true, description: 'El alcance de la norma tal como estaba al aprobar.' }) alcance!: string | null;
  @ApiProperty({ type: [FilaDeclaracionResponse], maxItems: 500 }) filas!: FilaDeclaracionResponse[];
}

const VERSION_EN_LINEA = {
  id: { type: 'string', format: 'uuid', maxLength: 36 },
  numero: { type: 'integer', minimum: 1 },
  total: { type: 'integer', minimum: 0 },
  aplican: { type: 'integer', minimum: 0 },
  noAplican: { type: 'integer', minimum: 0 },
  sinControl: { type: 'integer', minimum: 0 },
  aprobadaPor: { type: 'string', format: 'uuid', maxLength: 36 },
  aprobadaEn: { type: 'string', format: 'date-time', maxLength: 40 },
} as const;

export class DeclaracionResponse {
  @ApiProperty({ type: String, maxLength: 60 }) norma!: string;
  @ApiProperty({ type: String, format: 'date', maxLength: 10, description: 'La fecha de hoy en Ecuador con la que se calculó la cobertura.' }) hoy!: string;
  @ApiProperty({ type: ResumenDeclaracionResponse }) resumen!: ResumenDeclaracionResponse;
  @ApiProperty({ type: [FilaDeclaracionResponse], maxItems: 500 }) filas!: FilaDeclaracionResponse[];
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: false,
    properties: { texto: { type: 'string', maxLength: 4000 }, aprobado: { type: 'boolean' } },
    required: ['texto', 'aprobado'],
    selfRequired: true,
    description: 'El alcance de la norma tal como está hoy (aprobado o no); nulo si no se definió.',
  })
  alcance!: { texto: string; aprobado: boolean } | null;
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: false,
    properties: VERSION_EN_LINEA,
    required: Object.keys(VERSION_EN_LINEA),
    selfRequired: true,
    description: 'La última versión aprobada; nula si todavía no hay ninguna.',
  })
  ultimaVersion!: VersionDeclaracionResponse | null;
}
