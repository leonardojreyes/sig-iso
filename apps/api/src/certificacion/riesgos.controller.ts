import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type {
  AvisoRetiroRiesgoUseCase, CambiarRiesgoUseCase, CrearRiesgoUseCase, DesvincularRiesgoControlUseCase, ListarRiesgosUseCase, ObtenerRiesgoUseCase, PreverTratamientoUseCase, QuitarTratamientoPrevistoUseCase,
  RetirarRiesgoUseCase, RiesgosDeUnControlUseCase, VincularRiesgoControlUseCase,
} from '@sig/certificacion';
import { Identidad } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import { leerIncluirRetirados, leerMapeoEntrada, leerRiesgoCambios, leerRiesgoEntrada, leerControlVersion, leerVinculoControl } from './cuerpos.js';
import { MapeoEntradaRequest, MapeoResultadoResponse } from './dto.js';
import { AVISO_RETIRO_RIESGO, RIESGO, RIESGO_DETALLE, RIESGOS, RIESGOS_LISTADO, VINCULO_RESULTADO } from './esquemas-riesgos.js';
import { CuerpoRiesgoCambios, CuerpoRiesgoEntrada, CuerpoRiesgoVersion, CuerpoVinculoControl } from './cuerpos-riesgos.dto.js';
import {
  AVISAR_RETIRO_RIESGO, CAMBIAR_RIESGO, CREAR_RIESGO, DESVINCULAR_RIESGO_CONTROL, LISTAR_RIESGOS, OBTENER_RIESGO, PREVER_TRATAMIENTO, QUITAR_TRATAMIENTO_PREVISTO, RETIRAR_RIESGO, RIESGOS_DE_CONTROL, VINCULAR_RIESGO_CONTROL,
} from './tokens.js';

type Respuesta = { status(codigo: number): unknown };

/**
 * Riesgos mínimos de la empresa y sus vínculos con controles (ADR 037). La empresa y la persona salen SOLO del token verificado. Los
 * 403, 404 y 409 los traduce el filtro global; el permiso se decide en el caso de uso antes de mirar nada más (401 → 403 → 400 → 404 → 409).
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('riesgos')
@Controller()
export class RiesgosController {
  constructor(
    @Inject(LISTAR_RIESGOS) private readonly listarRiesgos: ListarRiesgosUseCase,
    @Inject(CREAR_RIESGO) private readonly crearRiesgo: CrearRiesgoUseCase,
    @Inject(OBTENER_RIESGO) private readonly obtenerRiesgo: ObtenerRiesgoUseCase,
    @Inject(CAMBIAR_RIESGO) private readonly cambiarRiesgo: CambiarRiesgoUseCase,
    @Inject(AVISAR_RETIRO_RIESGO) private readonly avisarRetiro: AvisoRetiroRiesgoUseCase,
    @Inject(RETIRAR_RIESGO) private readonly retirarRiesgo: RetirarRiesgoUseCase,
    @Inject(VINCULAR_RIESGO_CONTROL) private readonly vincularControl: VincularRiesgoControlUseCase,
    @Inject(DESVINCULAR_RIESGO_CONTROL) private readonly desvincularControl: DesvincularRiesgoControlUseCase,
    @Inject(PREVER_TRATAMIENTO) private readonly preverTratamiento: PreverTratamientoUseCase,
    @Inject(QUITAR_TRATAMIENTO_PREVISTO) private readonly quitarTratamiento: QuitarTratamientoPrevistoUseCase,
    @Inject(RIESGOS_DE_CONTROL) private readonly riesgosDeControl: RiesgosDeUnControlUseCase,
  ) {}

  @Get('riesgos')
  @ApiOperation({ operationId: 'listarRiesgos' })
  @ApiQuery({ name: 'incluirRetirados', required: false, schema: { type: 'boolean' } })
  @ApiOkResponse({ schema: RIESGOS_LISTADO })
  @RespuestasProblema(400, 401, 403, 429, 500)
  async listar(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Record<string, unknown>) {
    return [...(await this.listarRiesgos.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerIncluirRetirados(consulta) }))];
  }

  @Post('riesgos')
  @HttpCode(201)
  @ApiOperation({ operationId: 'crearRiesgo' })
  @ApiBody({ type: CuerpoRiesgoEntrada })
  @ApiCreatedResponse({ schema: RIESGO })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async crear(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.crearRiesgo.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerRiesgoEntrada(cuerpo) });
  }

  @Get('riesgos/:id')
  @ApiOperation({ operationId: 'obtenerRiesgo' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: RIESGO_DETALLE })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async obtener(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    const d = await this.obtenerRiesgo.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id });
    return { ...d, controles: d.controles.map((c) => ({ ...c })), tratamientosPrevistos: d.tratamientosPrevistos.map((x) => ({ ...x })) };
  }

  @Put('riesgos/:id')
  @ApiOperation({ operationId: 'cambiarRiesgo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoRiesgoCambios })
  @ApiOkResponse({ schema: RIESGO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cambiar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.cambiarRiesgo.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id, ...leerRiesgoCambios(cuerpo) });
  }

  @Get('riesgos/:id/aviso-retiro')
  @ApiOperation({ operationId: 'avisarRetiroRiesgo' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: AVISO_RETIRO_RIESGO })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async aviso(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    const a = await this.avisarRetiro.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id });
    return { ...a, controlesSinMotivo: a.controlesSinMotivo.map((c) => ({ ...c })) };
  }

  @Post('riesgos/:id/retiro')
  @HttpCode(200)
  @ApiOperation({ operationId: 'retirarRiesgo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoRiesgoVersion })
  @ApiOkResponse({ schema: RIESGO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async retirar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.retirarRiesgo.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id, ...leerControlVersion(cuerpo) });
  }

  /** 201 la primera vez; 200 si ya existía (no es un error). */
  @Post('riesgos/:id/controles')
  @ApiOperation({ operationId: 'vincularRiesgoControl' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoVinculoControl })
  @ApiCreatedResponse({ schema: VINCULO_RESULTADO })
  @ApiOkResponse({ schema: VINCULO_RESULTADO, description: 'El vínculo ya existía; no hubo cambios.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async vincular(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown, @Res({ passthrough: true }) respuesta: Respuesta) {
    const r = await this.vincularControl.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, riesgoId: id, ...leerVinculoControl(cuerpo) });
    respuesta.status(r.creado ? 201 : 200);
    return { creado: r.creado };
  }

  @Post('riesgos/:id/controles/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'desvincularRiesgoControl' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoVinculoControl })
  @ApiNoContentResponse({ description: 'El vínculo se quitó.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async desvincular(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.desvincularControl.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, riesgoId: id, ...leerVinculoControl(cuerpo) });
  }

  /** «Tratamiento previsto»: 201 la primera vez; 200 si ya existía (no es un error). */
  @Post('riesgos/:id/tratamientos')
  @ApiOperation({ operationId: 'preverTratamientoRiesgo' })
  @ParametroIdRuta()
  @ApiBody({ type: MapeoEntradaRequest })
  @ApiCreatedResponse({ type: MapeoResultadoResponse })
  @ApiOkResponse({ type: MapeoResultadoResponse, description: 'El tratamiento ya estaba previsto; no hubo cambios.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async prever(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown, @Res({ passthrough: true }) respuesta: Respuesta) {
    const entrada = leerMapeoEntrada(cuerpo);
    const r = await this.preverTratamiento.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, riesgoId: id, ...entrada });
    respuesta.status(r.creado ? 201 : 200);
    return { libreriaCodigo: entrada.libreriaCodigo, idEstable: entrada.idEstable, creado: r.creado };
  }

  @Post('riesgos/:id/tratamientos/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'quitarTratamientoPrevisto' })
  @ParametroIdRuta()
  @ApiBody({ type: MapeoEntradaRequest })
  @ApiNoContentResponse({ description: 'El tratamiento previsto se quitó.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async quitar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.quitarTratamiento.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, riesgoId: id, ...leerMapeoEntrada(cuerpo) });
  }

  @Get('controles/:id/riesgos')
  @ApiOperation({ operationId: 'listarRiesgosDeControl' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: RIESGOS })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async deControl(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return [...(await this.riesgosDeControl.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, controlId: id }))];
  }
}
