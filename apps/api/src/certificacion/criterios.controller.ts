import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { Identidad } from '../autenticacion/identidad.js';
import { RespuestasProblema } from '../documentacion.js';
import { CRITERIOS, type CasosCriterios } from './criterios.casos.js';
import { CuerpoCriterios } from './cuerpos-criterios.dto.js';
import { CRITERIOS_RESPUESTA } from './esquemas-criterios.js';

const CAMPOS = ['probabilidad', 'impacto', 'nivelAceptacion', 'versionEsperada'] as const;

/** Copia solo las claves conocidas: los demás campos se ignoran y el caso de uso valida lo que pasa. */
const elegir = (cuerpo: unknown): Record<string, unknown> => {
  const o = typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : {};
  const r: Record<string, unknown> = {};
  for (const k of CAMPOS) if (o[k] !== undefined) r[k] = o[k];
  return r;
};

/**
 * Criterios de evaluación de riesgos y matriz 5 × 5 (ADR 038). La empresa y la persona salen SOLO del token verificado; el permiso se
 * decide en el caso de uso antes de mirar nada más (401 → 403 → 400 → 409).
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('criterios')
@Controller()
export class CriteriosController {
  constructor(@Inject(CRITERIOS) private readonly c: CasosCriterios) {}

  @Get('criterios')
  @ApiOperation({ operationId: 'obtenerCriterios' })
  @ApiOkResponse({ schema: CRITERIOS_RESPUESTA })
  @RespuestasProblema(401, 403, 429, 500)
  async obtener(@Identidad() identidad: IdentidadVerificada) {
    return this.c.obtener.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId });
  }

  @Put('criterios')
  @ApiOperation({ operationId: 'guardarCriterios' })
  @ApiBody({ type: CuerpoCriterios })
  @ApiOkResponse({ schema: CRITERIOS_RESPUESTA })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async guardar(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.guardar.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...elegir(cuerpo) });
  }
}
