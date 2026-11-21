import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { Identidad } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import { AUDITORIA, type CasosAuditoria } from './auditoria.casos.js';
import { CuerpoProcesoCambios, CuerpoProcesoEntrada, CuerpoRelacionEntrada } from './cuerpos-auditoria.dto.js';
import { LISTA_PROCESOS, LISTA_RELACIONES, PROCESO, RELACION_PROCESO } from './esquemas-auditoria.js';

type Cuerpo = Record<string, unknown>;
type Respuesta = { status(codigo: number): unknown };

/** Copia solo las claves conocidas que vengan presentes: los demás campos se ignoran y el caso de uso valida lo que pasa. */
const elegir = (cuerpo: unknown, claves: readonly string[]): Cuerpo => {
  const o: Cuerpo = typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Cuerpo) : {};
  const r: Cuerpo = {};
  for (const k of claves) if (o[k] !== undefined) r[k] = o[k];
  return r;
};

/**
 * Auditoría interna (ADR 040): procesos y personas relacionadas. La empresa y la persona salen SOLO del token verificado. Los 403, 404 y
 * 409 los traduce el filtro global; el permiso se decide en el caso de uso antes de mirar nada más (401 → 403 → 400 → 404 → 409).
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('auditoria')
@Controller()
export class AuditoriaController {
  constructor(@Inject(AUDITORIA) private readonly c: CasosAuditoria) {}

  private ids(i: IdentidadVerificada): { empresaId: string; usuarioId: string } {
    return { empresaId: i.empresaId, usuarioId: i.usuarioId };
  }

  @Get('procesos')
  @ApiOperation({ operationId: 'listarProcesos' })
  @ApiOkResponse({ schema: LISTA_PROCESOS })
  @RespuestasProblema(401, 403, 429, 500)
  async listarProcesos(@Identidad() identidad: IdentidadVerificada) {
    return this.c.listarProcesos.ejecutar(this.ids(identidad));
  }

  @Post('procesos')
  @HttpCode(201)
  @ApiOperation({ operationId: 'crearProceso' })
  @ApiBody({ type: CuerpoProcesoEntrada })
  @ApiCreatedResponse({ schema: PROCESO })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async crearProceso(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.crearProceso.ejecutar({ ...this.ids(identidad), ...elegir(cuerpo, ['nombre', 'descripcion', 'duenaId', 'importancia', 'frecuencia']) });
  }

  @Post('procesos/gestion-sig')
  @HttpCode(201)
  @ApiOperation({ operationId: 'crearProcesoGestionSig' })
  @ApiCreatedResponse({ schema: PROCESO })
  @RespuestasProblema(401, 403, 409, 429, 500)
  async crearGestionSig(@Identidad() identidad: IdentidadVerificada) {
    return this.c.crearGestionSig.ejecutar(this.ids(identidad));
  }

  @Put('procesos/:id')
  @ApiOperation({ operationId: 'cambiarProceso' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoProcesoCambios })
  @ApiOkResponse({ schema: PROCESO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cambiarProceso(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.cambiarProceso.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['versionEsperada', 'nombre', 'descripcion', 'duenaId', 'importancia', 'frecuencia', 'cambioRelevante']),
    });
  }

  @Post('procesos/:id/retiro')
  @HttpCode(204)
  @ApiOperation({ operationId: 'retirarProceso' })
  @ParametroIdRuta()
  @ApiNoContentResponse()
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async retirarProceso(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.c.retirarProceso.ejecutar({ ...this.ids(identidad), id });
  }

  @Get('procesos/:id/relaciones')
  @ApiOperation({ operationId: 'listarRelacionesProceso' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: LISTA_RELACIONES })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async listarRelaciones(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return { relaciones: await this.c.listarRelaciones.ejecutar({ ...this.ids(identidad), id }) };
  }

  /** 201 la primera vez; 200 si ya existía (no es un error). */
  @Post('procesos/:id/relaciones')
  @ApiOperation({ operationId: 'agregarRelacionProceso' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoRelacionEntrada })
  @ApiCreatedResponse({ schema: RELACION_PROCESO })
  @ApiOkResponse({ schema: RELACION_PROCESO, description: 'La relación ya existía; no hubo cambios.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async agregarRelacion(
    @Param('id') id: string,
    @Identidad() identidad: IdentidadVerificada,
    @Body() cuerpo: unknown,
    @Res({ passthrough: true }) respuesta: Respuesta,
  ) {
    const r = await this.c.agregarRelacion.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['personaId', 'relacion']) });
    respuesta.status(r.creada ? 201 : 200);
    return r.relacion;
  }

  @Post('procesos/:id/relaciones/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'quitarRelacionProceso' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoRelacionEntrada })
  @ApiNoContentResponse()
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async quitarRelacion(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.c.quitarRelacion.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['personaId', 'relacion']) });
  }
}
