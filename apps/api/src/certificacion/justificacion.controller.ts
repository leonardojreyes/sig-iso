import { Body, Controller, Get, HttpCode, Inject, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { GuardarReferenciaUseCase, ListarMotivosUseCase, ListarReferenciasUseCase, QuitarMotivoUseCase, QuitarReferenciaUseCase, RegistrarMotivoUseCase } from '@sig/certificacion';
import { Identidad } from '../autenticacion/identidad.js';
import { RespuestasProblema } from '../documentacion.js';
import { leerMotivoEntrada, leerMotivoQuitar, leerReferenciaEntrada, leerReferenciaQuitar } from './cuerpos.js';
import { CuerpoMotivoEntrada, CuerpoMotivoQuitar, CuerpoReferenciaEntrada, CuerpoReferenciaQuitar } from './cuerpos-riesgos.dto.js';
import { MOTIVO, MOTIVOS, REFERENCIA, REFERENCIAS } from './esquemas-riesgos.js';
import { GUARDAR_REFERENCIA, LISTAR_MOTIVOS, LISTAR_REFERENCIAS, QUITAR_MOTIVO, QUITAR_REFERENCIA, REGISTRAR_MOTIVO } from './tokens.js';

/**
 * Motivos de inclusión y referencias al tratamiento de riesgos de la Declaración (ADR 037). La empresa y la persona salen SOLO del
 * token. Sin `versionEsperada` se CREA; con ella se CAMBIA (409 si otra persona lo cambió antes). El motivo «riesgo» no se registra: se deriva.
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('declaracion')
@Controller('declaracion')
export class JustificacionDeclaracionController {
  constructor(
    @Inject(LISTAR_MOTIVOS) private readonly listarMotivos: ListarMotivosUseCase,
    @Inject(REGISTRAR_MOTIVO) private readonly registrarMotivo: RegistrarMotivoUseCase,
    @Inject(QUITAR_MOTIVO) private readonly quitarMotivo: QuitarMotivoUseCase,
    @Inject(LISTAR_REFERENCIAS) private readonly listarReferencias: ListarReferenciasUseCase,
    @Inject(GUARDAR_REFERENCIA) private readonly guardarReferencia: GuardarReferenciaUseCase,
    @Inject(QUITAR_REFERENCIA) private readonly quitarReferencia: QuitarReferenciaUseCase,
  ) {}

  @Get('motivos')
  @ApiOperation({ operationId: 'listarMotivosDeclaracion' })
  @ApiOkResponse({ schema: MOTIVOS })
  @RespuestasProblema(401, 403, 429, 500)
  async motivos(@Identidad() identidad: IdentidadVerificada) {
    return (await this.listarMotivos.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId })).map((m) => ({ ...m }));
  }

  @Put('motivos')
  @ApiOperation({ operationId: 'registrarMotivoDeclaracion' })
  @ApiBody({ type: CuerpoMotivoEntrada })
  @ApiOkResponse({ schema: MOTIVO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async registrar(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return { ...(await this.registrarMotivo.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerMotivoEntrada(cuerpo) })) };
  }

  @Post('motivos/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'quitarMotivoDeclaracion' })
  @ApiBody({ type: CuerpoMotivoQuitar })
  @ApiNoContentResponse({ description: 'El motivo se quitó.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async quitar(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.quitarMotivo.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerMotivoQuitar(cuerpo) });
  }

  @Get('referencias')
  @ApiOperation({ operationId: 'listarReferenciasDeclaracion' })
  @ApiOkResponse({ schema: REFERENCIAS })
  @RespuestasProblema(401, 403, 429, 500)
  async referencias(@Identidad() identidad: IdentidadVerificada) {
    return (await this.listarReferencias.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId })).map((r) => ({ ...r }));
  }

  @Put('referencias')
  @ApiOperation({ operationId: 'guardarReferenciaDeclaracion' })
  @ApiBody({ type: CuerpoReferenciaEntrada })
  @ApiOkResponse({ schema: REFERENCIA })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async guardar(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return { ...(await this.guardarReferencia.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerReferenciaEntrada(cuerpo) })) };
  }

  @Post('referencias/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'quitarReferenciaDeclaracion' })
  @ApiBody({ type: CuerpoReferenciaQuitar })
  @ApiNoContentResponse({ description: 'La referencia se quitó.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async quitarRef(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.quitarReferencia.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerReferenciaQuitar(cuerpo) });
  }
}
