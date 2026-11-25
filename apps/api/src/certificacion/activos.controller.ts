import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { Identidad } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import { ACTIVOS, type CasosActivos } from './activos.casos.js';
import { CuerpoActivoCambios, CuerpoActivoEntrada, CuerpoActivoVersion, CuerpoLigaActivo } from './cuerpos-activos.dto.js';
import { ACTIVO, ACTIVO_DETALLE, ACTIVOS as ESQUEMA_ACTIVOS, ACTIVOS_LISTADO, AVISO_RETIRO_ACTIVO, CLASIFICACIONES_ACTIVO_API, LIGA_ACTIVO_RESULTADO, TIPOS_ACTIVO_API } from './esquemas-activos.js';

type Cuerpo = Record<string, unknown>;
type Respuesta = { status(codigo: number): unknown };

const campos = (cuerpo: unknown): Cuerpo => (typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Cuerpo) : {});
/** Copia solo las claves conocidas que vengan presentes: los demás campos se ignoran y el caso de uso valida lo que pasa. */
const elegir = (cuerpo: unknown, claves: readonly string[]): Cuerpo => {
  const o = campos(cuerpo);
  const r: Cuerpo = {};
  for (const k of claves) if (o[k] !== undefined) r[k] = o[k];
  return r;
};
const booleano = (v: unknown): unknown => (v === 'true' ? true : v === 'false' ? false : v);

/**
 * Activos de información (ADR 038). La empresa y la persona salen SOLO del token verificado; los 403, 404 y 409 los traduce el filtro
 * global y el permiso se decide en el caso de uso antes de mirar nada más (401 → 403 → 400 → 404 → 409).
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('activos')
@Controller()
export class ActivosController {
  constructor(@Inject(ACTIVOS) private readonly c: CasosActivos) {}

  private ids(i: IdentidadVerificada): { empresaId: string; usuarioId: string } {
    return { empresaId: i.empresaId, usuarioId: i.usuarioId };
  }

  @Get('activos')
  @ApiOperation({ operationId: 'listarActivos' })
  @ApiQuery({ name: 'tipo', required: false, schema: { type: 'string', enum: TIPOS_ACTIVO_API } })
  @ApiQuery({ name: 'clasificacion', required: false, schema: { type: 'string', enum: CLASIFICACIONES_ACTIVO_API } })
  @ApiQuery({ name: 'responsableId', required: false, schema: { type: 'string', format: 'uuid', maxLength: 36 } })
  @ApiQuery({ name: 'incluirRetirados', required: false, schema: { type: 'boolean' } })
  @ApiOkResponse({ schema: ACTIVOS_LISTADO })
  @RespuestasProblema(400, 401, 403, 429, 500)
  async listar(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Cuerpo) {
    const f = elegir(consulta, ['tipo', 'clasificacion', 'responsableId']);
    if (consulta['incluirRetirados'] !== undefined) f['incluirRetirados'] = booleano(consulta['incluirRetirados']);
    return [...(await this.c.listar.ejecutar({ ...this.ids(identidad), ...f }))];
  }

  @Post('activos')
  @HttpCode(201)
  @ApiOperation({ operationId: 'crearActivo' })
  @ApiBody({ type: CuerpoActivoEntrada })
  @ApiCreatedResponse({ schema: ACTIVO })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async crear(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.crear.ejecutar({ ...this.ids(identidad), ...elegir(cuerpo, ['nombre', 'descripcion', 'tipo', 'clasificacion', 'responsableId']) } as never);
  }

  @Get('activos/:id')
  @ApiOperation({ operationId: 'obtenerActivo' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: ACTIVO_DETALLE })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async obtener(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.obtener.ejecutar({ ...this.ids(identidad), id });
  }

  @Put('activos/:id')
  @ApiOperation({ operationId: 'cambiarActivo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoActivoCambios })
  @ApiOkResponse({ schema: ACTIVO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cambiar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.cambiar.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['nombre', 'descripcion', 'tipo', 'clasificacion', 'responsableId', 'versionEsperada']) } as never);
  }

  @Get('activos/:id/aviso-retiro')
  @ApiOperation({ operationId: 'avisarRetiroActivo' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: AVISO_RETIRO_ACTIVO })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async avisarRetiro(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.avisarRetiro.ejecutar({ ...this.ids(identidad), id });
  }

  @Post('activos/:id/retiro')
  @HttpCode(200)
  @ApiOperation({ operationId: 'retirarActivo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoActivoVersion })
  @ApiOkResponse({ schema: ACTIVO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async retirar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.retirar.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['versionEsperada']) } as never);
  }

  @Get('riesgos/:id/activos')
  @ApiOperation({ operationId: 'listarActivosDeRiesgo' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: ESQUEMA_ACTIVOS })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async deRiesgo(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return [...(await this.c.deRiesgo.ejecutar({ ...this.ids(identidad), riesgoId: id }))];
  }

  /** 201 la primera vez; 200 si ya existía (no es un error). */
  @Post('riesgos/:id/activos')
  @ApiOperation({ operationId: 'ligarActivoARiesgo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoLigaActivo })
  @ApiCreatedResponse({ schema: LIGA_ACTIVO_RESULTADO })
  @ApiOkResponse({ schema: LIGA_ACTIVO_RESULTADO, description: 'La liga ya existía; no hubo cambios.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async ligar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown, @Res({ passthrough: true }) respuesta: Respuesta) {
    const r = await this.c.ligar.ejecutar({ ...this.ids(identidad), riesgoId: id, activoId: campos(cuerpo)['activoId'] as string });
    respuesta.status(r.creado ? 201 : 200);
    return { creado: r.creado };
  }

  @Post('riesgos/:id/activos/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'desligarActivoDeRiesgo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoLigaActivo })
  @ApiNoContentResponse({ description: 'La liga se quitó.' })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async desligar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.c.desligar.ejecutar({ ...this.ids(identidad), riesgoId: id, activoId: campos(cuerpo)['activoId'] as string });
  }
}
