import { ApiProperty } from '@nestjs/swagger';
import { CAMBIOS_RELEVANTES_API, ESTADOS_AVANCE_API, FRECUENCIAS_API, IMPORTANCIAS_API, MOTIVOS_ANULACION_API, MOTIVOS_CAMBIO_API, RELACIONES_API, TIPOS_HALLAZGO_API, ROLES_EQUIPO_API, TIPOS_EXCLUSION_API } from './esquemas-auditoria.js';

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

const FECHA = { type: String, format: 'date', maxLength: 10 } as const;
const FECHA_O_NULA = { type: String, format: 'date', maxLength: 10, nullable: true } as const;
const PROCESOS = { type: 'array', maxItems: 200, uniqueItems: true, items: { type: 'string', format: 'uuid', maxLength: 36 } } as const;
const CAPITULOS = {
  type: 'array',
  maxItems: 100,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['libreriaCodigo', 'capitulo'],
    properties: { libreriaCodigo: { type: 'string', maxLength: 80, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$' }, capitulo: { type: 'string', minLength: 1, maxLength: 60 } },
  },
} as unknown as Record<string, unknown>;
const NOTA = { type: String, minLength: 1, maxLength: 300, required: false } as const;

export class CuerpoAuditoriaEntrada {
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 }) objetivo!: string;
  @ApiProperty(FECHA) inicio!: string;
  @ApiProperty(FECHA) fin!: string;
  @ApiProperty({ ...FECHA, required: false }) reunionApertura?: string;
  @ApiProperty({ ...FECHA, required: false }) reunionCierre?: string;
  @ApiProperty(NORMAS) normas!: string[];
  @ApiProperty({ ...PROCESOS, required: false }) procesosIds?: string[];
  @ApiProperty({ ...CAPITULOS, required: false } as never) capitulos?: unknown[];
  @ApiProperty({ type: String, enum: MOTIVOS_CAMBIO_API, required: false }) motivo?: string;
  @ApiProperty(NOTA) nota?: string;
}

export class CuerpoAuditoriaCambios {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500, required: false }) objetivo?: string;
  @ApiProperty({ ...FECHA, required: false }) inicio?: string;
  @ApiProperty({ ...FECHA, required: false }) fin?: string;
  @ApiProperty({ ...FECHA_O_NULA, required: false }) reunionApertura?: string | null;
  @ApiProperty({ ...FECHA_O_NULA, required: false }) reunionCierre?: string | null;
  @ApiProperty({ ...NORMAS, required: false }) normas?: string[];
  @ApiProperty({ ...PROCESOS, required: false }) procesosIds?: string[];
  @ApiProperty({ ...CAPITULOS, required: false } as never) capitulos?: unknown[];
}

export class CuerpoAuditoriaReprogramacion {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty(FECHA) inicio!: string;
  @ApiProperty(FECHA) fin!: string;
  @ApiProperty({ ...FECHA_O_NULA, required: false }) reunionApertura?: string | null;
  @ApiProperty({ ...FECHA_O_NULA, required: false }) reunionCierre?: string | null;
  @ApiProperty({ type: String, enum: MOTIVOS_CAMBIO_API }) motivo!: string;
  @ApiProperty(NOTA) nota?: string;
}

export class CuerpoAuditoriaCancelacion {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, enum: MOTIVOS_CAMBIO_API }) motivo!: string;
  @ApiProperty(NOTA) nota?: string;
}

export class CuerpoAuditoriaAvance {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, enum: ESTADOS_AVANCE_API }) estado!: string;
}

export class CuerpoMiembroEntrada {
  @ApiProperty(UUID) personaId!: string;
  @ApiProperty({ type: String, enum: ROLES_EQUIPO_API }) rol!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: false,
    required: ['motivo', 'medida'],
    properties: { motivo: { type: 'string', minLength: 1, maxLength: 300 }, medida: { type: 'string', minLength: 1, maxLength: 300 } },
    required_: false,
  } as never)
  excepcion?: { motivo: string; medida: string };
}

export class CuerpoMiembroQuitar {
  @ApiProperty(UUID) personaId!: string;
}

const ID_ESTABLE = { type: String, minLength: 1, maxLength: 80, pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$' } as const;
const RESULTADOS_ENTRADA = ['conforme', 'no_conforme', 'observacion', 'oportunidad', 'no_aplica', 'no_verificado'];

export class CuerpoResultadoFila {
  @ApiProperty(UUID) filaId!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, enum: RESULTADOS_ENTRADA }) resultado!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500, required: false }) nota?: string;
}
export class CuerpoPreguntaEntrada {
  @ApiProperty(UUID) filaId!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 300 }) texto!: string;
}
export class CuerpoPreguntaQuitar {
  @ApiProperty(UUID) preguntaId!: string;
}
export class CuerpoHallazgoEntrada {
  @ApiProperty({ type: String, enum: TIPOS_HALLAZGO_API }) tipo!: string;
  @ApiProperty({ ...UUID, required: false }) itemId?: string;
  @ApiProperty({ ...UUID, required: false }) procesoId?: string;
  @ApiProperty({ ...NORMA, required: false }) libreriaCodigo?: string;
  @ApiProperty({ ...ID_ESTABLE, required: false }) idEstable?: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 }) enunciado!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 1000 }) evidencia!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500, required: false }) justificacionGravedad?: string;
}
export class CuerpoHallazgoCambios {
  @ApiProperty(UUID) hallazgoId!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, enum: TIPOS_HALLAZGO_API, required: false }) tipo?: string;
  @ApiProperty({ ...UUID, nullable: true, required: false }) procesoId?: string | null;
  @ApiProperty({ ...NORMA, nullable: true, required: false }) libreriaCodigo?: string | null;
  @ApiProperty({ ...ID_ESTABLE, nullable: true, required: false }) idEstable?: string | null;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500, required: false }) enunciado?: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 1000, required: false }) evidencia?: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500, nullable: true, required: false }) justificacionGravedad?: string | null;
}
export class CuerpoHallazgoAnulacion {
  @ApiProperty(UUID) hallazgoId!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, enum: MOTIVOS_ANULACION_API }) motivo!: string;
}
export class CuerpoInformeEntrada {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 1000 }) conclusion!: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 1000, required: false }) limitaciones?: string;
}
export class CuerpoCierreEntrada {
  @ApiProperty({ type: 'integer', minimum: 1 }) versionEsperada!: number;
}
