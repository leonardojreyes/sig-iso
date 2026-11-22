import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { TIPO_DOCUMENTO_WORD } from '@sig/certificacion';
import { Identidad } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import { AUDITORIA, type CasosAuditoria } from './auditoria.casos.js';
import { contentDisposition } from './subida.js';
import { CuerpoCierreEntrada, CuerpoHallazgoAnulacion, CuerpoHallazgoCambios, CuerpoHallazgoEntrada, CuerpoInformeEntrada, CuerpoPreguntaEntrada, CuerpoPreguntaQuitar, CuerpoResultadoFila, CuerpoAuditoriaAvance, CuerpoAuditoriaCambios, CuerpoAuditoriaCancelacion, CuerpoAuditoriaEntrada, CuerpoAuditoriaReprogramacion, CuerpoMiembroEntrada, CuerpoMiembroQuitar, CuerpoExclusionEntrada, CuerpoExclusionQuitar, CuerpoProcesoCambios, CuerpoProcesoEntrada, CuerpoProgramaCambios, CuerpoProgramaEntrada, CuerpoProgramaVersion, CuerpoRelacionEntrada } from './cuerpos-auditoria.dto.js';
import { CIERRE_AUDITORIA, FILA_LISTA, HALLAZGO, INFORME_AUDITORIA, LISTA_HALLAZGOS, LISTA_VERIFICACION, PANEL_AUDITORIA, PREGUNTA_LISTA, REGENERACION_LISTA, AUDITORIA as AUDITORIA_ESQUEMA, INDEPENDENCIA, MIEMBRO_EQUIPO, DETALLE_PROGRAMA, EXCLUSION_PROGRAMA, LISTA_PROCESOS, LISTA_PROGRAMAS, LISTA_RELACIONES, PROCESO, PROGRAMA, RELACION_PROCESO } from './esquemas-auditoria.js';

type Cuerpo = Record<string, unknown>;
type Respuesta = { status(codigo: number): unknown };
const DOCUMENTO = { description: 'El documento Word, como adjunto.', content: { [TIPO_DOCUMENTO_WORD]: { schema: { type: 'string' as const, format: 'binary' } } } };

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

  @Get('programas')
  @ApiOperation({ operationId: 'listarProgramas' })
  @ApiOkResponse({ schema: LISTA_PROGRAMAS })
  @RespuestasProblema(401, 403, 429, 500)
  async listarProgramas(@Identidad() identidad: IdentidadVerificada) {
    return this.c.listarProgramas.ejecutar(this.ids(identidad));
  }

  @Post('programas')
  @HttpCode(201)
  @ApiOperation({ operationId: 'crearPrograma' })
  @ApiBody({ type: CuerpoProgramaEntrada })
  @ApiCreatedResponse({ schema: PROGRAMA })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async crearPrograma(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.crearPrograma.ejecutar({ ...this.ids(identidad), ...elegir(cuerpo, ['anio', 'objetivo', 'normas']) });
  }

  @Get('programas/:id')
  @ApiOperation({ operationId: 'obtenerPrograma' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: DETALLE_PROGRAMA })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async obtenerPrograma(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.obtenerPrograma.ejecutar({ ...this.ids(identidad), id });
  }

  @Put('programas/:id')
  @ApiOperation({ operationId: 'cambiarPrograma' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoProgramaCambios })
  @ApiOkResponse({ schema: PROGRAMA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cambiarPrograma(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.cambiarPrograma.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['versionEsperada', 'objetivo', 'normas']) });
  }

  @Post('programas/:id/aprobacion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'aprobarPrograma' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoProgramaVersion })
  @ApiOkResponse({ schema: PROGRAMA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async aprobarPrograma(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.aprobarPrograma.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['versionEsperada']) });
  }

  @Post('programas/:id/exclusiones')
  @HttpCode(201)
  @ApiOperation({ operationId: 'agregarExclusionPrograma' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoExclusionEntrada })
  @ApiCreatedResponse({ schema: EXCLUSION_PROGRAMA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async agregarExclusion(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.agregarExclusion.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['tipo', 'procesoId', 'libreriaCodigo', 'capitulo', 'motivo']),
    });
  }

  @Post('programas/:id/exclusiones/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'quitarExclusionPrograma' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoExclusionQuitar })
  @ApiNoContentResponse()
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async quitarExclusion(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.c.quitarExclusion.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['exclusionId']) });
  }

  @Post('programas/:id/auditorias')
  @HttpCode(201)
  @ApiOperation({ operationId: 'crearAuditoria' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoAuditoriaEntrada })
  @ApiCreatedResponse({ schema: AUDITORIA_ESQUEMA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async crearAuditoria(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.crearAuditoria.ejecutar({
      ...this.ids(identidad),
      programaId: id,
      ...elegir(cuerpo, ['objetivo', 'inicio', 'fin', 'reunionApertura', 'reunionCierre', 'normas', 'procesosIds', 'capitulos', 'motivo', 'nota']),
    });
  }

  @Get('auditorias/:id')
  @ApiOperation({ operationId: 'obtenerAuditoria' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: AUDITORIA_ESQUEMA })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async obtenerAuditoria(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.obtenerAuditoria.ejecutar({ ...this.ids(identidad), id });
  }

  @Put('auditorias/:id')
  @ApiOperation({ operationId: 'cambiarAuditoria' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoAuditoriaCambios })
  @ApiOkResponse({ schema: AUDITORIA_ESQUEMA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cambiarAuditoria(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.cambiarAuditoria.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['versionEsperada', 'objetivo', 'inicio', 'fin', 'reunionApertura', 'reunionCierre', 'normas', 'procesosIds', 'capitulos']),
    });
  }

  @Post('auditorias/:id/reprogramacion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'reprogramarAuditoria' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoAuditoriaReprogramacion })
  @ApiOkResponse({ schema: AUDITORIA_ESQUEMA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async reprogramarAuditoria(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.reprogramarAuditoria.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['versionEsperada', 'inicio', 'fin', 'reunionApertura', 'reunionCierre', 'motivo', 'nota']),
    });
  }

  @Post('auditorias/:id/cancelacion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'cancelarAuditoria' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoAuditoriaCancelacion })
  @ApiOkResponse({ schema: AUDITORIA_ESQUEMA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cancelarAuditoria(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.cancelarAuditoria.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['versionEsperada', 'motivo', 'nota']) });
  }

  @Post('auditorias/:id/avance')
  @HttpCode(200)
  @ApiOperation({ operationId: 'avanzarAuditoria' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoAuditoriaAvance })
  @ApiOkResponse({ schema: AUDITORIA_ESQUEMA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async avanzarAuditoria(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.avanzarAuditoria.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['versionEsperada', 'estado']) });
  }

  @Get('auditorias/:id/independencia')
  @ApiOperation({ operationId: 'comprobarIndependencia' })
  @ParametroIdRuta()
  @ApiQuery({ name: 'personaId', required: true, schema: { type: 'string', format: 'uuid', maxLength: 36 } })
  @ApiOkResponse({ schema: INDEPENDENCIA })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async comprobarIndependencia(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Query() consulta: Cuerpo) {
    return this.c.comprobarIndependencia.ejecutar({ ...this.ids(identidad), id, ...elegir(consulta, ['personaId']) });
  }

  @Post('auditorias/:id/equipo')
  @HttpCode(201)
  @ApiOperation({ operationId: 'designarMiembroAuditoria' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoMiembroEntrada })
  @ApiCreatedResponse({ schema: MIEMBRO_EQUIPO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async designarMiembro(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.designarMiembro.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['personaId', 'rol', 'excepcion']) });
  }

  @Post('auditorias/:id/equipo/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'quitarMiembroAuditoria' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoMiembroQuitar })
  @ApiNoContentResponse()
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async quitarMiembro(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.c.quitarMiembro.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['personaId']) });
  }

  @Get('auditorias/:id/lista')
  @ApiOperation({ operationId: 'obtenerListaVerificacion' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: LISTA_VERIFICACION })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async obtenerLista(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.obtenerLista.ejecutar({ ...this.ids(identidad), id });
  }

  @Post('auditorias/:id/lista/regeneracion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'regenerarListaVerificacion' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: REGENERACION_LISTA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async regenerarLista(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.regenerarLista.ejecutar({ ...this.ids(identidad), id });
  }

  @Put('auditorias/:id/lista/resultado')
  @ApiOperation({ operationId: 'evaluarFilaLista' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoResultadoFila })
  @ApiOkResponse({ schema: FILA_LISTA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async evaluarFila(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.evaluarFila.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['filaId', 'versionEsperada', 'resultado', 'nota']) });
  }

  @Post('auditorias/:id/lista/preguntas')
  @HttpCode(201)
  @ApiOperation({ operationId: 'agregarPreguntaLista' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoPreguntaEntrada })
  @ApiCreatedResponse({ schema: PREGUNTA_LISTA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async agregarPregunta(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.agregarPregunta.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['filaId', 'texto']) });
  }

  @Post('auditorias/:id/lista/preguntas/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'quitarPreguntaLista' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoPreguntaQuitar })
  @ApiNoContentResponse()
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async quitarPregunta(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.c.quitarPregunta.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['preguntaId']) });
  }

  @Get('auditorias/:id/hallazgos')
  @ApiOperation({ operationId: 'listarHallazgos' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: LISTA_HALLAZGOS })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async listarHallazgos(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.listarHallazgos.ejecutar({ ...this.ids(identidad), id });
  }

  @Post('auditorias/:id/hallazgos')
  @HttpCode(201)
  @ApiOperation({ operationId: 'registrarHallazgo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoHallazgoEntrada })
  @ApiCreatedResponse({ schema: HALLAZGO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async registrarHallazgo(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.registrarHallazgo.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['itemId', 'tipo', 'procesoId', 'libreriaCodigo', 'idEstable', 'enunciado', 'evidencia', 'justificacionGravedad']),
    });
  }

  @Put('auditorias/:id/hallazgos')
  @ApiOperation({ operationId: 'cambiarHallazgo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoHallazgoCambios })
  @ApiOkResponse({ schema: HALLAZGO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cambiarHallazgo(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.cambiarHallazgo.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['hallazgoId', 'versionEsperada', 'tipo', 'procesoId', 'libreriaCodigo', 'idEstable', 'enunciado', 'evidencia', 'justificacionGravedad']),
    });
  }

  @Post('auditorias/:id/hallazgos/anulacion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'anularHallazgo' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoHallazgoAnulacion })
  @ApiOkResponse({ schema: HALLAZGO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async anularHallazgo(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.anularHallazgo.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['hallazgoId', 'versionEsperada', 'motivo']) });
  }

  @Get('auditorias/:id/informe')
  @ApiOperation({ operationId: 'obtenerInforme' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: INFORME_AUDITORIA })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async obtenerInforme(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.obtenerInforme.ejecutar({ ...this.ids(identidad), id });
  }

  // La ruta fija («documento») se declara ANTES de la que lleva solo el identificador.
  @Get('auditorias/:id/informe/documento')
  @ApiOperation({ operationId: 'exportarInformeAuditoria' })
  @ParametroIdRuta()
  @ApiOkResponse(DOCUMENTO)
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async exportarInforme(
    @Param('id') id: string,
    @Identidad() identidad: IdentidadVerificada,
    @Res({ passthrough: true }) respuesta: { setHeader(n: string, v: string): void },
  ): Promise<StreamableFile> {
    const x = await this.c.exportarInforme.ejecutar({ ...this.ids(identidad), id });
    // Defensa en profundidad además de las cabeceras globales (nosniff, no-store): un adjunto nunca se interpreta ni se incrusta.
    respuesta.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return new StreamableFile(x.bytes, { type: x.tipo, disposition: contentDisposition(x.nombre), length: x.bytes.length });
  }

  @Post('auditorias/:id/informe')
  @HttpCode(201)
  @ApiOperation({ operationId: 'emitirInforme' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoInformeEntrada })
  @ApiCreatedResponse({ schema: INFORME_AUDITORIA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async emitirInforme(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.emitirInforme.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['versionEsperada', 'conclusion', 'limitaciones']) });
  }

  @Post('auditorias/:id/cierre')
  @HttpCode(200)
  @ApiOperation({ operationId: 'cerrarAuditoria' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoCierreEntrada })
  @ApiOkResponse({ schema: CIERRE_AUDITORIA })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cerrarAuditoria(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.cerrarAuditoria.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['versionEsperada']) });
  }

  @Get('auditoria/panel')
  @ApiOperation({ operationId: 'obtenerPanelAuditoria' })
  @ApiOkResponse({ schema: PANEL_AUDITORIA })
  @RespuestasProblema(401, 403, 429, 500)
  async panel(@Identidad() identidad: IdentidadVerificada) {
    return this.c.panel.ejecutar(this.ids(identidad));
  }
}
