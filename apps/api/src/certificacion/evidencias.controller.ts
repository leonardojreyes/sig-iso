import { Controller, Get, HttpCode, Inject, Injectable, Param, Post, Query, Req, Res, StreamableFile, UseInterceptors, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Readable } from 'node:stream';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { ParametroInvalidoError, TIPOS_ARCHIVO, type DescargarEvidenciaUseCase, type EliminarEvidenciaUseCase, type ListarCoberturaUseCase, type ListarEvidenciasUseCase, type ReemplazarEvidenciaUseCase, type SubirEvidenciaUseCase } from '@sig/certificacion';
import { Identidad, type SolicitudHttp } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import { CoberturaResponse, EvidenciaReemplazoRequest, EvidenciaResponse, EvidenciaSubidaRequest } from './dto.js';
import { contentDisposition, descartarSiFalla, LIMITES_SUBIDA, LimitarTamanoSubida, MotorSubida, prepararSubida, subidaPendiente } from './subida.js';
import { COBERTURA, DESCARGAR_EVIDENCIA, ELIMINAR_EVIDENCIA, LISTAR_EVIDENCIAS, REEMPLAZAR_EVIDENCIA, SUBIR_EVIDENCIA } from './tokens.js';

interface SolicitudDeEvidencia extends SolicitudHttp {
  readonly params: Readonly<Record<string, string>>;
  readonly body?: Record<string, unknown>;
}

/** Los campos de texto que llegaron ANTES del archivo; un campo vacío (como manda un formulario HTML) es «no enviado». */
const camposDe = (body: Record<string, unknown> | undefined, nombres: readonly string[]): Record<string, unknown> => {
  const r: Record<string, unknown> = {};
  for (const n of nombres) {
    const v = body?.[n];
    if (v !== undefined && v !== '') r[n] = v;
  }
  return r;
};

const identidadDe = (solicitud: SolicitudDeEvidencia): IdentidadVerificada => {
  if (!solicitud.identidad) throw new Error('No hay identidad verificada en esta solicitud');
  return solicitud.identidad;
};

/** Deja lista la acción que el motor de subida ejecuta cuando llega el archivo: el caso de uso de SUBIR. */
@Injectable()
export class PrepararSubirEvidencia implements NestInterceptor {
  constructor(@Inject(SUBIR_EVIDENCIA) private readonly subir: SubirEvidenciaUseCase) {}

  intercept(contexto: ExecutionContext, siguiente: CallHandler) {
    const solicitud = contexto.switchToHttp().getRequest<SolicitudDeEvidencia>();
    const { empresaId, usuarioId } = identidadDe(solicitud);
    prepararSubida(solicitud, (archivo) =>
      this.subir.iniciar({ empresaId, usuarioId, controlId: solicitud.params['id'] as string, ...camposDe(solicitud.body, ['tipo', 'titulo', 'fechaHecho', 'vigenteHasta']), nombreOriginal: archivo.originalname, flujo: archivo.stream }),
    );
    return descartarSiFalla(solicitud, siguiente.handle());
  }
}

/** Igual, para REEMPLAZAR. */
@Injectable()
export class PrepararReemplazarEvidencia implements NestInterceptor {
  constructor(@Inject(REEMPLAZAR_EVIDENCIA) private readonly reemplazar: ReemplazarEvidenciaUseCase) {}

  intercept(contexto: ExecutionContext, siguiente: CallHandler) {
    const solicitud = contexto.switchToHttp().getRequest<SolicitudDeEvidencia>();
    const { empresaId, usuarioId } = identidadDe(solicitud);
    prepararSubida(solicitud, (archivo) =>
      this.reemplazar.iniciar({ empresaId, usuarioId, id: solicitud.params['id'] as string, ...camposDe(solicitud.body, ['tipo', 'titulo', 'fechaHecho', 'vigenteHasta']), nombreOriginal: archivo.originalname, flujo: archivo.stream }),
    );
    return descartarSiFalla(solicitud, siguiente.handle());
  }
}

/**
 * Llega aquí solo si multer terminó SIN errores (un solo archivo, bien formado): recién ahora se confirma la transacción. Si no llegó
 * ningún archivo, el motor nunca se ejecutó y la petición está mal formada.
 */
const confirmarSubida = async (solicitud: unknown): Promise<EvidenciaResponse> => {
  const pendiente = subidaPendiente(solicitud);
  if (!pendiente) throw new ParametroInvalidoError('archivo');
  return (await pendiente.confirmar()) as EvidenciaResponse;
};

const SUBIDA = () => FileInterceptor('archivo', { storage: new MotorSubida() as never, limits: { ...LIMITES_SUBIDA } });

/** Un `boolean` de la consulta; cualquier otra cosa pasa tal cual y el caso de uso la rechaza con 400. */
const booleano = (v: unknown): unknown => (v === 'true' ? true : v === 'false' ? false : v);

/**
 * Evidencias con archivo y cobertura. La empresa y la persona salen SOLO del token. La subida llega por `multipart/form-data`: el
 * caso de uso decide permiso, datos y control antes de leer un solo byte del archivo (ver `subida.ts`).
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('evidencias')
@Controller()
export class EvidenciasController {
  constructor(
    @Inject(LISTAR_EVIDENCIAS) private readonly listarEvidencias: ListarEvidenciasUseCase,
    @Inject(ELIMINAR_EVIDENCIA) private readonly eliminarEvidencia: EliminarEvidenciaUseCase,
    @Inject(DESCARGAR_EVIDENCIA) private readonly descargarEvidencia: DescargarEvidenciaUseCase,
    @Inject(COBERTURA) private readonly cobertura: ListarCoberturaUseCase,
  ) {}

  @Get('controles/:id/evidencias')
  @ApiOperation({ operationId: 'listarEvidencias' })
  @ParametroIdRuta()
  @ApiQuery({ name: 'incluirHistoricas', required: false, schema: { type: 'boolean' } })
  @ApiOkResponse({ schema: { type: 'array', maxItems: 100, items: { $ref: '#/components/schemas/EvidenciaResponse' } } })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async listar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Query() consulta: Record<string, unknown>): Promise<EvidenciaResponse[]> {
    return this.listarEvidencias.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, controlId: id, ...(consulta['incluirHistoricas'] !== undefined ? { incluirHistoricas: booleano(consulta['incluirHistoricas']) as boolean } : {}) });
  }

  @Post('controles/:id/evidencias')
  @HttpCode(201)
  @UseInterceptors(LimitarTamanoSubida, PrepararSubirEvidencia, SUBIDA())
  @ApiOperation({ operationId: 'subirEvidencia' })
  @ParametroIdRuta()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: EvidenciaSubidaRequest })
  @ApiCreatedResponse({ type: EvidenciaResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 413, 415, 429, 500)
  subir(@Req() solicitud: unknown): Promise<EvidenciaResponse> {
    return confirmarSubida(solicitud);
  }

  @Post('evidencias/:id/reemplazo')
  @HttpCode(201)
  @UseInterceptors(LimitarTamanoSubida, PrepararReemplazarEvidencia, SUBIDA())
  @ApiOperation({ operationId: 'reemplazarEvidencia' })
  @ParametroIdRuta()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: EvidenciaReemplazoRequest })
  @ApiCreatedResponse({ type: EvidenciaResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 413, 415, 429, 500)
  reemplazar(@Req() solicitud: unknown): Promise<EvidenciaResponse> {
    return confirmarSubida(solicitud);
  }

  @Post('evidencias/:id/eliminacion')
  @HttpCode(204)
  @ApiOperation({ operationId: 'eliminarEvidencia' })
  @ParametroIdRuta()
  @ApiNoContentResponse({ description: 'La evidencia se eliminó.' })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async eliminar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.eliminarEvidencia.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id });
  }

  @Get('evidencias/:id/archivo')
  @ApiOperation({ operationId: 'descargarEvidencia' })
  @ParametroIdRuta()
  @ApiOkResponse({ description: 'El archivo, como adjunto.', content: Object.fromEntries(TIPOS_ARCHIVO.map((t) => [t, { schema: { type: 'string', format: 'binary' } }])) })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async descargar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Res({ passthrough: true }) respuesta: { setHeader(n: string, v: string): void }): Promise<StreamableFile> {
    const d = await this.descargarEvidencia.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id });
    // Defensa en profundidad además de las cabeceras globales (nosniff, no-store): un adjunto nunca se interpreta ni se incrusta.
    respuesta.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return new StreamableFile(Readable.from(d.flujo, { objectMode: false }), { type: d.tipo, disposition: contentDisposition(d.nombre), length: d.bytes }).setErrorHandler((_error, res) => {
      // Un fallo a mitad de la entrega corta la conexión: no se manda un cuerpo de error mezclado con bytes del archivo.
      (res as unknown as { destroy(): void }).destroy();
    });
  }

  @Get('cobertura')
  @ApiOperation({ operationId: 'obtenerCobertura' })
  @ApiQuery({ name: 'norma', required: false, schema: { type: 'string', minLength: 1, maxLength: 60, pattern: '^[A-Za-z0-9 :./-]+$' } })
  @ApiOkResponse({ type: CoberturaResponse })
  @RespuestasProblema(400, 401, 403, 429, 500)
  async obtenerCobertura(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Record<string, unknown>): Promise<CoberturaResponse> {
    const c = await this.cobertura.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...(consulta['norma'] !== undefined ? { norma: consulta['norma'] as string } : {}) });
    return { hoy: c.hoy, entradas: c.entradas.map((e) => ({ ...e, normas: [...e.normas] })), porNorma: c.porNorma.map((n) => ({ ...n })), total: { ...c.total }, normas: [...c.normas] };
  }
}
