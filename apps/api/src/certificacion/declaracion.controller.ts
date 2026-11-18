import { Controller, Get, HttpCode, Inject, Param, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { TIPO_DOCUMENTO_WORD, type AprobarDeclaracionUseCase, type ExportarDeclaracionUseCase, type ListarVersionesDeclaracionUseCase, type ObtenerDeclaracionUseCase, type ObtenerVersionDeclaracionUseCase } from '@sig/certificacion';
import { Identidad } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import { DeclaracionResponse, VersionDeclaracionConFilasResponse, VersionDeclaracionResponse } from './dto.js';
import { contentDisposition } from './subida.js';
import { APROBAR_DECLARACION, EXPORTAR_DECLARACION, LISTAR_VERSIONES_DECLARACION, OBTENER_DECLARACION, OBTENER_VERSION_DECLARACION } from './tokens.js';

const DOCUMENTO = { description: 'El documento Word, como adjunto.', content: { [TIPO_DOCUMENTO_WORD]: { schema: { type: 'string' as const, format: 'binary' } } } };

/**
 * Declaración de Aplicabilidad de ISO/IEC 27001. La empresa y la persona salen SOLO del token. Los datos los deriva y congela el módulo
 * de certificación; aquí solo se compone (sin lógica de negocio).
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('declaracion')
@Controller('declaracion')
export class DeclaracionController {
  constructor(
    @Inject(OBTENER_DECLARACION) private readonly obtener: ObtenerDeclaracionUseCase,
    @Inject(APROBAR_DECLARACION) private readonly aprobarCaso: AprobarDeclaracionUseCase,
    @Inject(LISTAR_VERSIONES_DECLARACION) private readonly listar: ListarVersionesDeclaracionUseCase,
    @Inject(OBTENER_VERSION_DECLARACION) private readonly version: ObtenerVersionDeclaracionUseCase,
    @Inject(EXPORTAR_DECLARACION) private readonly exportar: ExportarDeclaracionUseCase,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'obtenerDeclaracion' })
  @ApiOkResponse({ type: DeclaracionResponse })
  @RespuestasProblema(401, 403, 429, 500)
  async borrador(@Identidad() identidad: IdentidadVerificada): Promise<DeclaracionResponse> {
    const d = await this.obtener.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId });
    const j = d.justificacion;
    return {
      norma: d.norma,
      hoy: d.hoy,
      resumen: { total: d.resumen.total, aplican: d.resumen.aplican, noAplican: d.resumen.noAplican, porDecidir: d.resumen.porDecidir, sinControl: d.resumen.sinControl, aprobable: d.resumen.aprobable },
      filas: d.filas.map((f) => ({ ...f, controles: [...f.controles] })),
      alcance: d.alcance ? { ...d.alcance } : null,
      ultimaVersion: d.ultimaVersion ? { ...d.ultimaVersion } : null,
      justificacion: {
        conMotivo: j.resumen.conMotivo,
        sinMotivo: j.resumen.sinMotivo,
        riesgosVigentes: j.resumen.riesgosVigentes,
        riesgosSinTratamiento: j.resumen.riesgosSinTratamiento,
        bloqueos: [...j.resumen.bloqueos],
        filas: j.filas.map((f) => ({ libreriaCodigo: f.libreriaCodigo, idEstable: f.idEstable, sinMotivo: f.sinMotivo, motivos: f.motivos.map((m) => ({ ...m })), riesgos: f.riesgos.map((r) => ({ ...r })) })),
        referencias: j.referencias.map((r) => ({ ...r })),
        escala: { ...j.escala },
        faltaPlanTratamiento: j.faltaPlanTratamiento,
      },
    };
  }

  @Post('aprobacion')
  @HttpCode(201)
  @ApiOperation({ operationId: 'aprobarDeclaracion' })
  @ApiCreatedResponse({ type: VersionDeclaracionResponse })
  @RespuestasProblema(401, 403, 409, 429, 500)
  async aprobar(@Identidad() identidad: IdentidadVerificada): Promise<VersionDeclaracionResponse> {
    return { ...(await this.aprobarCaso.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId })) };
  }

  @Get('versiones')
  @ApiOperation({ operationId: 'listarVersionesDeclaracion' })
  @ApiOkResponse({ schema: { type: 'array', maxItems: 100, items: { $ref: '#/components/schemas/VersionDeclaracionResponse' } } })
  @RespuestasProblema(401, 403, 429, 500)
  async versiones(@Identidad() identidad: IdentidadVerificada): Promise<VersionDeclaracionResponse[]> {
    return (await this.listar.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId })).map((v) => ({ ...v }));
  }

  // Las rutas fijas («documento») se declaran ANTES que las que llevan identificador.
  @Get('documento')
  @ApiOperation({ operationId: 'exportarBorradorDeclaracion' })
  @ApiOkResponse(DOCUMENTO)
  @RespuestasProblema(401, 403, 429, 500)
  async documentoBorrador(@Identidad() identidad: IdentidadVerificada, @Res({ passthrough: true }) respuesta: { setHeader(n: string, v: string): void }): Promise<StreamableFile> {
    return this.entregar(await this.exportar.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId }), respuesta);
  }

  @Get('versiones/:id')
  @ApiOperation({ operationId: 'obtenerVersionDeclaracion' })
  @ParametroIdRuta()
  @ApiOkResponse({ type: VersionDeclaracionConFilasResponse })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async unaVersion(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<VersionDeclaracionConFilasResponse> {
    const v = await this.version.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, id });
    return { id: v.id, numero: v.numero, total: v.total, aplican: v.aplican, noAplican: v.noAplican, sinControl: v.sinControl, aprobadaPor: v.aprobadaPor, aprobadaEn: v.aprobadaEn, alcance: v.alcance,
      filas: v.filas.map((f) => ({ ...f, controles: [...f.controles] })),
      // Una versión aprobada antes de la Declaración justificada no tiene justificación (nula).
      justificacion: v.justificacion && {
        escala: { ...v.justificacion.escala },
        conMotivo: v.justificacion.conMotivo,
        riesgosVigentes: v.justificacion.riesgosVigentes,
        motivos: v.justificacion.motivos.map((m) => ({ ...m })),
        riesgos: v.justificacion.riesgos.map((r) => ({ ...r, controles: [...r.controles] })),
        riesgosPorFila: v.justificacion.riesgosPorFila.map((x) => ({ ...x })),
        referencias: v.justificacion.referencias.map((r) => ({ ...r })),
      },
    };
  }

  @Get('versiones/:id/documento')
  @ApiOperation({ operationId: 'exportarVersionDeclaracion' })
  @ParametroIdRuta()
  @ApiOkResponse(DOCUMENTO)
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async documentoVersion(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Res({ passthrough: true }) respuesta: { setHeader(n: string, v: string): void }): Promise<StreamableFile> {
    return this.entregar(await this.exportar.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, versionId: id }), respuesta);
  }

  private entregar(x: { nombre: string; tipo: string; bytes: Uint8Array }, respuesta: { setHeader(n: string, v: string): void }): StreamableFile {
    // Defensa en profundidad además de las cabeceras globales (nosniff, no-store): un adjunto nunca se interpreta ni se incrusta.
    respuesta.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return new StreamableFile(x.bytes, { type: x.tipo, disposition: contentDisposition(x.nombre), length: x.bytes.length });
  }
}
