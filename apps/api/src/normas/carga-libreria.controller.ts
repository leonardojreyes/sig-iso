// Carga de una librería propia desde un archivo YAML (ADR 034). Esta capa solo COMPONE: el caso de uso decide el permiso, valida el
// contenido y guarda. El orden es 401 (guardia global) → 403 → 413 → lectura del archivo → 400 si no llegó → validación del contenido.
import { Controller, HttpCode, Inject, Injectable, PayloadTooLargeException, Post, Res, UploadedFile, UseInterceptors, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { ParametroInvalidoError, TAMANO_MAX_LIBRERIA, type CargarLibreriaUseCase } from '@sig/normas';
import { from, mergeMap } from 'rxjs';
import { Identidad, type SolicitudHttp } from '../autenticacion/identidad.js';
import { RespuestasProblema } from '../documentacion.js';
import { CargaLibreriaResponse, LibreriaSubidaRequest } from './dto.js';
import { CARGAR_LIBRERIA } from './tokens.js';

/** El permiso se decide ANTES de leer el cuerpo: quien no puede cargar recibe 403 aunque mande un archivo enorme o ninguno. */
@Injectable()
export class ExigirPermisoCarga implements NestInterceptor {
  constructor(@Inject(CARGAR_LIBRERIA) private readonly cargar: CargarLibreriaUseCase) {}

  intercept(contexto: ExecutionContext, siguiente: CallHandler) {
    const { identidad } = contexto.switchToHttp().getRequest<SolicitudHttp>();
    if (!identidad) throw new Error('No hay identidad verificada en esta solicitud');
    return from(this.cargar.comprobarPermiso(identidad.empresaId, identidad.usuarioId)).pipe(mergeMap(() => siguiente.handle()));
  }
}

/** Margen sobre el megabyte del archivo para el multipart (cabeceras y delimitadores). */
const MARGEN_PETICION = 16 * 1024;

/** 413 sin leer el cuerpo si ya declara más de lo permitido, y cierra la conexión. Sin `Content-Length`, lo acota multer. */
@Injectable()
export class LimitarTamanoCarga implements NestInterceptor {
  intercept(contexto: ExecutionContext, siguiente: CallHandler) {
    const http = contexto.switchToHttp();
    const declarado = Number(http.getRequest<{ headers: Record<string, string | undefined> }>().headers['content-length']);
    if (Number.isFinite(declarado) && declarado > TAMANO_MAX_LIBRERIA + MARGEN_PETICION) {
      http.getResponse<{ setHeader(n: string, v: string): void }>().setHeader('Connection', 'close');
      throw new PayloadTooLargeException();
    }
    return siguiente.handle();
  }
}

/** Un solo archivo de hasta 1 MB exactos (más es 413), sin campos de texto y pocas partes. */
const ARCHIVO = () => FileInterceptor('archivo', { limits: { files: 1, fileSize: TAMANO_MAX_LIBRERIA, fields: 0, parts: 2, headerPairs: 50 } });

interface ArchivoEnMemoria {
  readonly buffer: Buffer;
}

@ApiBearerAuth('bearerAuth')
@ApiTags('librerias')
@Controller()
export class CargaLibreriaController {
  constructor(@Inject(CARGAR_LIBRERIA) private readonly cargar: CargarLibreriaUseCase) {}

  /** 201 si se cargó ahora; 200 si ya estaba cargada o si el archivo se rechazó (con sus errores, sin contenido). */
  @Post('librerias/carga')
  @HttpCode(200)
  @UseInterceptors(ExigirPermisoCarga, LimitarTamanoCarga, ARCHIVO())
  @ApiOperation({ operationId: 'cargarLibreria' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: LibreriaSubidaRequest })
  @ApiCreatedResponse({ type: CargaLibreriaResponse })
  @ApiOkResponse({ type: CargaLibreriaResponse, description: 'Ya estaba cargada (mismo contenido) o el archivo se rechazó; ver `estado`.' })
  @RespuestasProblema(400, 401, 403, 413, 429, 500)
  async cargarLibreria(
    @UploadedFile() archivo: ArchivoEnMemoria | undefined,
    @Identidad() identidad: IdentidadVerificada,
    @Res({ passthrough: true }) respuesta: { status(codigo: number): unknown },
  ): Promise<CargaLibreriaResponse> {
    if (!archivo) throw new ParametroInvalidoError('archivo');
    const r = await this.cargar.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, contenido: new Uint8Array(archivo.buffer) });
    respuesta.status(r.estado === 'cargada' ? 201 : 200);
    return { ...r, errores: r.errores.map((e) => ({ ...e })) };
  }
}
