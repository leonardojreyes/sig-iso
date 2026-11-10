import { Body, Controller, Get, HttpCode, Inject, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { AprobarAlcanceUseCase, EvaluarEntradaUseCase, GuardarAlcanceUseCase, ListarAlcancesUseCase, ListarDiagnosticoUseCase } from '@sig/certificacion';
import { Identidad } from '../autenticacion/identidad.js';
import { RespuestaLista, RespuestasProblema } from '../documentacion.js';
import { AlcanceEntradaRequest, AlcanceNormaRequest, AlcanceResponse, DiagnosticoResponse, EvaluacionEntradaRequest, EvaluacionResponse } from './dto.js';
import { leerAlcanceEntrada, leerAlcanceNorma, leerEvaluacionEntrada, leerFiltrosDiagnostico } from './cuerpos.js';
import { APROBAR_ALCANCE, DIAGNOSTICO, EVALUAR_ENTRADA, GUARDAR_ALCANCE, LISTAR_ALCANCES } from './tokens.js';

/**
 * Alcance y diagnóstico de la empresa. La empresa y la persona salen SOLO del token verificado. Los 403, 404 y 409 los traduce el
 * filtro global; el permiso se decide en el caso de uso antes de mirar el recurso (401 → 403 → 400 → 404 → 409).
 */
@ApiBearerAuth('bearerAuth')
@Controller()
export class CertificacionController {
  constructor(
    @Inject(LISTAR_ALCANCES) private readonly listarAlcances: ListarAlcancesUseCase,
    @Inject(GUARDAR_ALCANCE) private readonly guardarAlcance: GuardarAlcanceUseCase,
    @Inject(APROBAR_ALCANCE) private readonly aprobarAlcance: AprobarAlcanceUseCase,
    @Inject(DIAGNOSTICO) private readonly diagnostico: ListarDiagnosticoUseCase,
    @Inject(EVALUAR_ENTRADA) private readonly evaluarEntrada: EvaluarEntradaUseCase,
  ) {}

  @Get('alcances')
  @ApiTags('alcance')
  @ApiOperation({ operationId: 'listarAlcances' })
  @RespuestaLista(AlcanceResponse, 20)
  @RespuestasProblema(401, 403, 429, 500)
  async listar(@Identidad() identidad: IdentidadVerificada): Promise<AlcanceResponse[]> {
    return this.listarAlcances.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId });
  }

  @Put('alcances')
  @ApiTags('alcance')
  @ApiOperation({ operationId: 'guardarAlcance' })
  @ApiBody({ type: AlcanceEntradaRequest })
  @ApiOkResponse({ type: AlcanceResponse })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async guardar(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<AlcanceResponse> {
    // El permiso se decide primero: el caso de uso lo exige antes de validar nada, pero la forma del cuerpo se lee aquí.
    // Si la forma es mala y la persona no tiene permiso, el caso de uso no llega a ejecutarse; por eso se valida en él también.
    const { norma, texto } = leerAlcanceEntrada(cuerpo);
    return this.guardarAlcance.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, norma, texto });
  }

  @Post('alcances/aprobacion')
  @HttpCode(200)
  @ApiTags('alcance')
  @ApiOperation({ operationId: 'aprobarAlcance' })
  @ApiBody({ type: AlcanceNormaRequest })
  @ApiOkResponse({ type: AlcanceResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async aprobar(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<AlcanceResponse> {
    const { norma } = leerAlcanceNorma(cuerpo);
    return this.aprobarAlcance.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, norma });
  }

  @Get('diagnostico')
  @ApiTags('diagnostico')
  @ApiOperation({ operationId: 'obtenerDiagnostico' })
  @ApiQuery({ name: 'q', required: false, schema: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .:-]+$' } })
  @ApiQuery({ name: 'norma', required: false, schema: { type: 'string', minLength: 1, maxLength: 60, pattern: '^[A-Za-z0-9 :./-]+$' } })
  @ApiQuery({ name: 'tipo', required: false, schema: { type: 'string', enum: ['clausula', 'control'] } })
  @ApiQuery({ name: 'estado', required: false, schema: { type: 'string', enum: ['cumple', 'parcial', 'no_cumple', 'no_aplica', 'sin_evaluar'] } })
  @ApiOkResponse({ type: DiagnosticoResponse })
  @RespuestasProblema(400, 401, 403, 429, 500)
  async obtener(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Record<string, unknown>): Promise<DiagnosticoResponse> {
    const d = await this.diagnostico.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerFiltrosDiagnostico(consulta) });
    return {
      filas: d.filas.map((f) => ({ ...f, aplicaA: [...f.aplicaA] })),
      madurez: {
        porNorma: Object.entries(d.madurez.porNorma).map(([norma, desglose]) => ({ norma, desglose })),
        porAgrupador: d.madurez.porAgrupador.map((a) => ({ tipo: a.tipo, nombre: a.clave, desglose: a.desglose })),
        clausulas: d.madurez.clausulas,
      },
      normas: [...d.normas],
    };
  }

  @Put('diagnostico/evaluaciones')
  @ApiTags('diagnostico')
  @ApiOperation({ operationId: 'evaluarEntrada' })
  @ApiBody({ type: EvaluacionEntradaRequest })
  @ApiOkResponse({ type: EvaluacionResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async evaluar(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<EvaluacionResponse> {
    return this.evaluarEntrada.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ...leerEvaluacionEntrada(cuerpo) });
  }
}
