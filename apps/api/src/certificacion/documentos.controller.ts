import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NestInterceptor,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Readable } from 'node:stream';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { ParametroInvalidoError, TIPOS_ARCHIVO } from '@sig/certificacion';
import { Identidad, type SolicitudHttp } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import {
  CuerpoAprobacionVersion,
  CuerpoDevolucionVersion,
  CuerpoDistribucion,
  CuerpoDocumentoCambios,
  CuerpoDocumentoEntrada,
  CuerpoEnvioRevision,
  CuerpoRetencionEntrada,
  CuerpoRevisionDocumento,
  CuerpoVersionSubida,
  CuerpoVinculoDocumento,
} from './cuerpos-documentos.dto.js';
import { DOCUMENTOS, type CasosDocumentales } from './documentos.casos.js';
import {
  CLASIFICACIONES_API,
  COBERTURA_DOCUMENTAL,
  DIRECTORIO_PERSONAS,
  DISTRIBUCION,
  DOCUMENTO,
  DOCUMENTO_DETALLE,
  LECTURAS_PENDIENTES,
  LISTA_DOCUMENTOS,
  RETENCION,
  RETENCIONES,
  TIPOS_DOCUMENTO_API,
  VERSION_DOCUMENTO,
  VINCULO_DOCUMENTO_RESULTADO,
} from './esquemas-documentos.js';
import {
  contentDisposition,
  descartarSiFalla,
  LIMITES_SUBIDA,
  LimitarTamanoSubida,
  MotorSubida,
  prepararSubida,
  subidaPendiente,
} from './subida.js';

type Cuerpo = Record<string, unknown>;
type Respuesta = { status(codigo: number): unknown; setHeader(n: string, v: string): void };

const campos = (cuerpo: unknown): Cuerpo =>
  typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Cuerpo) : {};

/** Copia solo las claves conocidas que vengan presentes: los demás campos se ignoran y el caso de uso valida lo que pasa. */
const elegir = (cuerpo: unknown, claves: readonly string[]): Cuerpo => {
  const o = campos(cuerpo);
  const r: Cuerpo = {};
  for (const k of claves) if (o[k] !== undefined) r[k] = o[k];
  return r;
};

/** Un `boolean` de la consulta; cualquier otra cosa pasa tal cual y el caso de uso la rechaza con 400. */
const booleano = (v: unknown): unknown => (v === 'true' ? true : v === 'false' ? false : v);

const consultaDe = (consulta: Cuerpo, claves: readonly string[], booleanas: readonly string[] = []): Cuerpo => {
  const r: Cuerpo = {};
  for (const k of claves) if (consulta[k] !== undefined) r[k] = booleanas.includes(k) ? booleano(consulta[k]) : consulta[k];
  return r;
};

interface SolicitudDeVersion extends SolicitudHttp {
  readonly params: Readonly<Record<string, string>>;
  readonly body?: Cuerpo;
}

/** Deja lista la acción que el motor de subida ejecuta cuando llega el archivo: el caso de uso de SUBIR una versión. */
@Injectable()
export class PrepararSubirVersion implements NestInterceptor {
  constructor(@Inject(DOCUMENTOS) private readonly casos: CasosDocumentales) {}

  intercept(contexto: ExecutionContext, siguiente: CallHandler) {
    const solicitud = contexto.switchToHttp().getRequest<SolicitudDeVersion>();
    if (!solicitud.identidad) throw new Error('No hay identidad verificada en esta solicitud');
    const { empresaId, usuarioId } = solicitud.identidad;
    // La nota se lee CUANDO LLEGA el archivo (no antes): multer va llenando `body` con los campos que llegaron antes que él.
    // Un campo vacío (como manda un formulario HTML) es «no enviado».
    prepararSubida(solicitud, (archivo) => {
      const nota = solicitud.body?.['nota'];
      return this.casos.subirVersion.iniciar({
        empresaId,
        usuarioId,
        documentoId: solicitud.params['id'] as string,
        ...(nota !== undefined && nota !== '' ? { nota } : {}),
        nombreOriginal: archivo.originalname,
        flujo: archivo.stream,
      });
    });
    return descartarSiFalla(solicitud, siguiente.handle());
  }
}

const SUBIDA = () => FileInterceptor('archivo', { storage: new MotorSubida() as never, limits: { ...LIMITES_SUBIDA } });

const QUERY_NORMA = {
  name: 'norma',
  required: false,
  schema: { type: 'string', minLength: 1, maxLength: 60, pattern: '^[A-Za-z0-9 :./-]+$' },
} as const;

/**
 * Control documental (ADR 039). La empresa y la persona salen SOLO del token verificado. Los 403, 404 y 409 los traduce el filtro
 * global; el permiso se decide en el caso de uso antes de mirar nada más (401 → 403 → 400 → 404 → 409). La subida de una versión
 * llega por `multipart/form-data`: el caso de uso decide permiso, datos y documento antes de leer un solo byte del archivo.
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('documentos')
@Controller()
export class DocumentosController {
  constructor(@Inject(DOCUMENTOS) private readonly c: CasosDocumentales) {}

  private ids(i: IdentidadVerificada): { empresaId: string; usuarioId: string } {
    return { empresaId: i.empresaId, usuarioId: i.usuarioId };
  }

  @Get('documentos')
  @ApiOperation({ operationId: 'listarDocumentos' })
  @ApiQuery({ name: 'tipo', required: false, schema: { type: 'string', enum: TIPOS_DOCUMENTO_API } })
  @ApiQuery({ name: 'estado', required: false, schema: { type: 'string', enum: ['activo', 'retirado'] } })
  @ApiQuery({ name: 'responsableId', required: false, schema: { type: 'string', format: 'uuid', maxLength: 36 } })
  @ApiQuery({ name: 'area', required: false, schema: { type: 'string', maxLength: 60 } })
  @ApiQuery(QUERY_NORMA)
  @ApiQuery({ name: 'sinVigente', required: false, schema: { type: 'boolean' } })
  @ApiQuery({ name: 'revisionVencida', required: false, schema: { type: 'boolean' } })
  @ApiOkResponse({ schema: LISTA_DOCUMENTOS })
  @RespuestasProblema(400, 401, 403, 429, 500)
  async listar(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Cuerpo) {
    return this.c.listar.ejecutar({
      ...this.ids(identidad),
      ...consultaDe(
        consulta,
        ['tipo', 'estado', 'responsableId', 'area', 'norma', 'sinVigente', 'revisionVencida'],
        ['sinVigente', 'revisionVencida'],
      ),
    });
  }

  @Post('documentos')
  @HttpCode(201)
  @ApiOperation({ operationId: 'crearDocumento' })
  @ApiBody({ type: CuerpoDocumentoEntrada })
  @ApiCreatedResponse({ schema: DOCUMENTO })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async crear(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.crear.ejecutar({
      ...this.ids(identidad),
      ...elegir(cuerpo, ['tipo', 'titulo', 'area', 'clasificacion', 'responsableId', 'emisor', 'edicionFuente']),
    });
  }

  @Get('documentos/:id')
  @ApiOperation({ operationId: 'obtenerDocumento' })
  @ParametroIdRuta()
  @ApiOkResponse({ schema: DOCUMENTO_DETALLE })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async obtener(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada) {
    return this.c.obtener.ejecutar({ ...this.ids(identidad), id });
  }

  @Put('documentos/:id')
  @ApiOperation({ operationId: 'cambiarDocumento' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoDocumentoCambios })
  @ApiOkResponse({ schema: DOCUMENTO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async cambiar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.cambiar.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['titulo', 'area', 'clasificacion', 'responsableId', 'emisor', 'edicionFuente']),
      versionEsperada: campos(cuerpo)['versionEsperada'],
    });
  }

  @Post('documentos/:id/retiro')
  @HttpCode(204)
  @ApiOperation({ operationId: 'retirarDocumento' })
  @ParametroIdRuta()
  @ApiNoContentResponse({ description: 'El documento se retiró.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async retirar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.c.retirar.ejecutar({ ...this.ids(identidad), id });
  }

  @Post('documentos/:id/revision')
  @HttpCode(200)
  @ApiOperation({ operationId: 'revisarDocumento' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoRevisionDocumento })
  @ApiOkResponse({ schema: DOCUMENTO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async revisar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.revisar.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['motivo', 'proximaRevision']) });
  }

  @Put('documentos/:id/distribucion')
  @ApiOperation({ operationId: 'cambiarDistribucion' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoDistribucion })
  @ApiOkResponse({ schema: DISTRIBUCION })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async distribuir(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return {
      destinatarios: [...(await this.c.distribuir.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['usuarioIds', 'roles']) }))],
    };
  }

  /** 201 la primera vez; 200 si ya existía (no es un error). */
  @Post('documentos/:id/vinculos')
  @ApiOperation({ operationId: 'vincularDocumento' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoVinculoDocumento })
  @ApiCreatedResponse({ schema: VINCULO_DOCUMENTO_RESULTADO })
  @ApiOkResponse({ schema: VINCULO_DOCUMENTO_RESULTADO, description: 'El vínculo ya existía; no hubo cambios.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async vincular(
    @Param('id') id: string,
    @Identidad() identidad: IdentidadVerificada,
    @Body() cuerpo: unknown,
    @Res({ passthrough: true }) respuesta: Respuesta,
  ) {
    const r = await this.c.vincular.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['controlId', 'libreriaCodigo', 'idEstable']),
    });
    respuesta.status(r.creado ? 201 : 200);
    return { creado: r.creado };
  }

  @Post('documentos/:id/vinculos/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'desvincularDocumento' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoVinculoDocumento })
  @ApiNoContentResponse({ description: 'El vínculo se quitó.' })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async desvincular(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<void> {
    await this.c.desvincular.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['controlId', 'libreriaCodigo', 'idEstable']) });
  }

  @Post('documentos/:id/versiones')
  @HttpCode(201)
  @UseInterceptors(LimitarTamanoSubida, PrepararSubirVersion, SUBIDA())
  @ApiOperation({ operationId: 'subirVersion' })
  @ParametroIdRuta()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CuerpoVersionSubida })
  @ApiCreatedResponse({ schema: VERSION_DOCUMENTO })
  @RespuestasProblema(400, 401, 403, 404, 409, 413, 415, 429, 500)
  async subir(@Req() solicitud: unknown) {
    // Llega aquí solo si multer terminó SIN errores (un solo archivo, bien formado): recién ahora se confirma la transacción.
    const pendiente = subidaPendiente(solicitud);
    if (!pendiente) throw new ParametroInvalidoError('archivo');
    return (await pendiente.confirmar()) as unknown;
  }

  @Post('versiones/:id/envio')
  @HttpCode(200)
  @ApiOperation({ operationId: 'enviarARevision' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoEnvioRevision })
  @ApiOkResponse({ schema: VERSION_DOCUMENTO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async enviar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.enviar.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['aprobadorId']) });
  }

  @Post('versiones/:id/devolucion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'devolverVersion' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoDevolucionVersion })
  @ApiOkResponse({ schema: VERSION_DOCUMENTO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async devolver(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.devolver.ejecutar({ ...this.ids(identidad), id, ...elegir(cuerpo, ['motivo', 'nota']) });
  }

  @Post('versiones/:id/aprobacion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'aprobarVersion' })
  @ParametroIdRuta()
  @ApiBody({ type: CuerpoAprobacionVersion })
  @ApiOkResponse({ schema: VERSION_DOCUMENTO })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async aprobar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.aprobar.ejecutar({
      ...this.ids(identidad),
      id,
      ...elegir(cuerpo, ['proximaRevision', 'requiereLectura', 'motivoExcepcion']),
    });
  }

  @Post('versiones/:id/descarte')
  @HttpCode(204)
  @ApiOperation({ operationId: 'descartarVersion' })
  @ParametroIdRuta()
  @ApiNoContentResponse({ description: 'El borrador se descartó.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async descartar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.c.descartar.ejecutar({ ...this.ids(identidad), id });
  }

  @Get('versiones/:id/archivo')
  @ApiOperation({ operationId: 'descargarVersion' })
  @ParametroIdRuta()
  @ApiOkResponse({
    description: 'El archivo, como adjunto.',
    content: Object.fromEntries(TIPOS_ARCHIVO.map((t) => [t, { schema: { type: 'string', format: 'binary' } }])),
  })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async descargar(
    @Param('id') id: string,
    @Identidad() identidad: IdentidadVerificada,
    @Res({ passthrough: true }) respuesta: Respuesta,
  ): Promise<StreamableFile> {
    const d = await this.c.descargar.ejecutar({ ...this.ids(identidad), id });
    // Defensa en profundidad además de las cabeceras globales (nosniff, no-store): un adjunto nunca se interpreta ni se incrusta.
    respuesta.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return new StreamableFile(Readable.from(d.flujo, { objectMode: false }), {
      type: d.tipo,
      disposition: contentDisposition(d.nombre),
      length: d.bytes,
    }).setErrorHandler((_error, res) => {
      // Un fallo a mitad de la entrega corta la conexión: no se manda un cuerpo de error mezclado con bytes del archivo.
      (res as unknown as { destroy(): void }).destroy();
    });
  }

  @Post('versiones/:id/lectura')
  @HttpCode(204)
  @ApiOperation({ operationId: 'confirmarLectura' })
  @ParametroIdRuta()
  @ApiNoContentResponse({ description: 'La lectura quedó confirmada.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async confirmar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.c.confirmarLectura.ejecutar({ ...this.ids(identidad), id });
  }

  @Get('lecturas/pendientes')
  @ApiOperation({ operationId: 'listarLecturasPendientes' })
  @ApiOkResponse({ schema: LECTURAS_PENDIENTES })
  @RespuestasProblema(401, 403, 429, 500)
  async pendientes(@Identidad() identidad: IdentidadVerificada) {
    return [...(await this.c.lecturasPendientes.ejecutar(this.ids(identidad)))];
  }

  @Get('cobertura-documental')
  @ApiOperation({ operationId: 'obtenerCoberturaDocumental' })
  @ApiQuery(QUERY_NORMA)
  @ApiQuery({ name: 'soloSinDocumento', required: false, schema: { type: 'boolean' } })
  @ApiOkResponse({ schema: COBERTURA_DOCUMENTAL })
  @RespuestasProblema(400, 401, 403, 429, 500)
  async cobertura(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Cuerpo) {
    const c = await this.c.cobertura.ejecutar({
      ...this.ids(identidad),
      ...consultaDe(consulta, ['norma', 'soloSinDocumento'], ['soloSinDocumento']),
    });
    return {
      normas: [...c.normas],
      total: c.total,
      cubiertas: c.cubiertas,
      entradas: c.entradas.map((e) => ({ ...e, normas: [...e.normas], documentos: e.documentos.map((d) => ({ ...d })) })),
    };
  }

  @Get('retencion')
  @ApiOperation({ operationId: 'listarRetencion' })
  @ApiOkResponse({ schema: RETENCIONES })
  @RespuestasProblema(401, 403, 429, 500)
  async listarRetencion(@Identidad() identidad: IdentidadVerificada) {
    return [...(await this.c.listarRetencion.ejecutar(this.ids(identidad)))];
  }

  @Put('retencion')
  @ApiOperation({ operationId: 'guardarRetencion' })
  @ApiBody({ type: CuerpoRetencionEntrada })
  @ApiOkResponse({ schema: RETENCION })
  @RespuestasProblema(400, 401, 403, 409, 429, 500)
  async guardarRetencion(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown) {
    return this.c.guardarRetencion.ejecutar({ ...this.ids(identidad), ...elegir(cuerpo, ['tipo', 'anios', 'motivo', 'versionEsperada']) });
  }

  @Get('certificacion/personas')
  @ApiOperation({ operationId: 'listarDirectorioPersonas' })
  @ApiOkResponse({ schema: DIRECTORIO_PERSONAS })
  @RespuestasProblema(401, 403, 429, 500)
  async directorio(@Identidad() identidad: IdentidadVerificada) {
    return [...(await this.c.directorio.ejecutar(this.ids(identidad)))];
  }
}

export { CLASIFICACIONES_API };
