import { Controller, Get, Inject, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { AdoptarLibreriaUseCase, ListarLibreriasUseCase, ListarRequisitosUseCase, ObtenerRequisitoUseCase } from '@sig/normas';
import { Identidad } from '../autenticacion/identidad.js';
import { ConsultaRequisitos, ParametroIdRuta, RespuestaLista, RespuestasProblema } from '../documentacion.js';
import { AdopcionResponse, EntradaLibreriaResponse, LibreriaResumenResponse } from './dto.js';
import { leerFiltrosRequisitos } from './filtros.js';
import { ADOPTAR, LIBRERIAS, REQUISITO, REQUISITOS } from './tokens.js';

/**
 * Librerías del catálogo y requisitos de las que la empresa adoptó. La empresa y la persona salen SOLO del token verificado.
 * Los 403 (rol) y los 404 los traduce el filtro global, que además registra los accesos denegados.
 */
@ApiBearerAuth('bearerAuth')
@Controller()
export class NormasController {
  constructor(
    @Inject(ADOPTAR) private readonly adopcion: AdoptarLibreriaUseCase,
    @Inject(LIBRERIAS) private readonly librerias: ListarLibreriasUseCase,
    @Inject(REQUISITOS) private readonly requisitos: ListarRequisitosUseCase,
    @Inject(REQUISITO) private readonly requisito: ObtenerRequisitoUseCase,
  ) {}

  @Get('librerias')
  @ApiTags('librerias')
  @ApiOperation({ operationId: 'listarLibrerias' })
  @RespuestaLista(LibreriaResumenResponse, 200)
  @RespuestasProblema(401, 500)
  async listarLibrerias(@Identidad() identidad: IdentidadVerificada): Promise<LibreriaResumenResponse[]> {
    return this.librerias.ejecutar(identidad.empresaId);
  }

  /** 201 la primera vez; 200 si ya estaba adoptada (no es un error). El permiso se decide antes de mirar el identificador. */
  @Post('librerias/:id/adopcion')
  @ApiTags('librerias')
  @ApiOperation({ operationId: 'adoptarLibreria' })
  @ParametroIdRuta()
  @RespuestasProblema(400, 401, 403, 404, 500)
  @ApiCreatedResponse({ type: AdopcionResponse })
  @ApiOkResponse({ type: AdopcionResponse, description: 'La librería ya estaba adoptada; no hubo cambios.' })
  async adoptar(
    @Param('id') id: string,
    @Identidad() identidad: IdentidadVerificada,
    @Res({ passthrough: true }) respuesta: { status(codigo: number): unknown },
  ): Promise<AdopcionResponse> {
    const r = await this.adopcion.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, libreriaId: id });
    respuesta.status(r.yaAdoptada ? 200 : 201);
    return r;
  }

  @Get('requisitos')
  @ApiTags('requisitos')
  @ApiOperation({ operationId: 'listarRequisitos' })
  @ConsultaRequisitos()
  @RespuestaLista(EntradaLibreriaResponse, 500)
  @RespuestasProblema(400, 401, 500)
  async listarRequisitos(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Record<string, unknown>): Promise<EntradaLibreriaResponse[]> {
    const entradas = await this.requisitos.ejecutar({ empresaId: identidad.empresaId, ...leerFiltrosRequisitos(consulta) });
    return entradas.map((e) => ({ ...e, aplicaA: [...e.aplicaA] }));
  }

  @Get('requisitos/:id')
  @ApiTags('requisitos')
  @ApiOperation({ operationId: 'obtenerRequisito' })
  @ParametroIdRuta()
  @ApiOkResponse({ type: EntradaLibreriaResponse })
  @RespuestasProblema(400, 401, 404, 500)
  async obtenerRequisito(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<EntradaLibreriaResponse> {
    const e = await this.requisito.ejecutar({ empresaId: identidad.empresaId, id });
    return { ...e, aplicaA: [...e.aplicaA] };
  }
}
