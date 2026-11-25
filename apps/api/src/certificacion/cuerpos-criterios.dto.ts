import { ApiProperty } from '@nestjs/swagger';
import { NIVELES_CRITERIOS } from './esquemas-criterios.js';

// Cuerpo de entrada del contrato de los criterios (ADR 038). Solo documenta: la lectura es tolerante y lo válido lo decide el caso de uso
// después del permiso (401 → 403 → 400 → 409).
const ESCALA = { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 200 } } as const;

export class CuerpoCriterios {
  @ApiProperty(ESCALA) probabilidad!: string[];
  @ApiProperty(ESCALA) impacto!: string[];
  @ApiProperty({ type: String, enum: NIVELES_CRITERIOS }) nivelAceptacion!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) versionEsperada!: number;
}
