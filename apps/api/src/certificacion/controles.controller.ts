import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { AgregarMapeoUseCase, CambiarControlUseCase, CrearControlUseCase, ListarControlesUseCase, QuitarMapeoUseCase, RetirarControlUseCase } from '@sig/certificacion';
import { Identidad } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import { leerControlCambios, leerControlEntrada, leerControlVersion, leerFiltrosControles, leerMapeoEntrada } from './cuerpos.js';
import { ControlCambiosRequest, ControlEntradaRequest, ControlResponse, ControlVersionRequest, MapeoEntradaRequest, MapeoResultadoResponse, MarcoControlesResponse } from './dto.js';
import { AGREGAR_MAPEO, CAMBIAR_CONTROL, CREAR_CONTROL, LISTAR_CONTROLES, QUITAR_MAPEO, RETIRAR_CONTROL } from './tokens.js';

/**
 * Controles de la empresa y sus mapeos con las entradas de las normas. La empresa y la persona salen SOLO del token verificado. Los
 * 403, 404 y 409 los traduce el filtro global; el permiso se decide en el caso de uso antes de mirar nada más (401 → 403 → 400 → 404 → 409).
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('controles')
@Controller()
export class ControlesController {
  constructor(
    @Inject(LISTAR_CONTROLES) private readonly listarControles: ListarControlesUseCase,
    @Inject(CREAR_CONTROL) private readonly crearControl: CrearControlUseCase,
    @Inject(CAMBIAR_CONTROL) private readonly cambiarControl: CambiarControlUseCase,
    @Inject(RETIRAR_CONTROL) private readonly retirarControl: RetirarControlUseCase,
    @Inject(AGREGAR_MAPEO) private readonly agregarMapeo: AgregarMapeoUseCase,
    @Inject(QUITAR_MAPEO) private readonly quitarMapeo: QuitarMapeoUseCase,
  ) {}

  @Get('controles')
  @ApiOperation({ operationId: 'listarControles' })
  @ApiQuery({ name: 'norma', required: false, schema: { type: 'string', minLength: 1, maxLength: 60, pattern: '^[A-Za-z0-9 :./-]+$' } })
  @ApiQuery({ name: 'incluirRetirados', required: false, schema: { type: 'boolean' } })
  @ApiOkResponse({ type: MarcoControlesResponse })
  @RespuestasProblema(400, 401, 403, 429, 500)
  async listar(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Record<string, unknown>): Promise<MarcoControlesResponse> {
    const m = await this.listarControles.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerFiltrosControles(consulta) });
    return {
      controles: m.controles.map((c) => ({ ...c, mapeos: c.mapeos.map((x) => ({ ...x, entrada: x.entrada && { ...x.entrada, aplicaA: [...x.entrada.aplicaA] } })), normas: [...c.normas] })),
      normas: [...m.normas],
    };
  }

  @Post('controles')
  @HttpCode(201)
  @ApiOperation({ operationId: 'crearControl' })
  @ApiBody({ type: ControlEntradaRequest })
  @ApiCreatedResponse({ type: ControlResponse })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async crear(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<ControlResponse> {
    return this.crearControl.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerControlEntrada(cuerpo) });
  }

  @Put('controles/:id')
  @ApiOperation({ operationId: 'cambiarControl' })
  @ParametroIdRuta()
  @ApiBody({ type: ControlCambiosRequest })
  @ApiOkResponse({ type: ControlResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cambiar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<ControlResponse> {
    return this.cambiarControl.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id, ...leerControlCambios(cuerpo) });
  }

  @Post('controles/:id/retiro')
  @HttpCode(200)
  @ApiOperation({ operationId: 'retirarControl' })
  @ParametroIdRuta()
  @ApiBody({ type: ControlVersionRequest })
  @ApiOkResponse({ type: ControlResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async retirar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<ControlResponse> {
    return this.retirarControl.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id, ...leerControlVersion(cuerpo) });
  }

  /** 201 la primera vez; 200 si ya existía (no es un error). */
  @Post('controles/:id/mapeos')
  @ApiOperation({ operationId: 'agregarMapeo' })
  @ParametroIdRuta()
  @ApiBody({ type: MapeoEntradaRequest })
  @ApiCreatedResponse({ type: MapeoResultadoResponse })
  @ApiOkResponse({ type: MapeoResultadoResponse, description: 'El mapeo ya existía; no hubo cambios.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async agregar(
    @Param('id') id: string,
    @Identidad() identidad: IdentidadVerificada,
    @Body() cuerpo: unknown,
    @Res({ passthrough: true }) respuesta: { status(codigo: number): unknown },
  ): Promise<MapeoResultadoResponse> {
    const entrada = leerMapeoEntrada(cuerpo);
    const r = await this.agregarMapeo.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, controlId: id, ...entrada });
    respuesta.status(r.creado ? 201 : 200);
    return { libreriaCodigo: entrada.libreriaCodigo, idEstable: entrada.idEstable, creado: r.creado };
  }

  @Post('controles/:id/mapeos/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'quitarMapeo' })
  @ParametroIdRuta()
  @ApiBody({ type: MapeoEntradaRequest })
  @ApiNoContentResponse({ description: 'El mapeo se quitó.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async quitar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.quitarMapeo.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, controlId: id, ...leerMapeoEntrada(cuerpo) });
  }
}
