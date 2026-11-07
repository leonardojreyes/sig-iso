import { Controller, Get, Inject, Param, Post, Query, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { AdoptarLibreriaUseCase, ListarLibreriasUseCase, ListarRequisitosUseCase, ObtenerRequisitoUseCase } from '@sig/normas';
import { Identidad } from '../autenticacion/identidad.js';
import { AdopcionResponse, EntradaLibreriaResponse, LibreriaResumenResponse } from './dto.js';
import { leerFiltrosRequisitos } from './filtros.js';
import { ADOPTAR, LIBRERIAS, REQUISITO, REQUISITOS } from './tokens.js';

/**
 * Librerías del catálogo y requisitos de las que la empresa adoptó. La empresa y la persona salen SOLO del token verificado.
 * Los 403 (rol) y los 404 los traduce el filtro global, que además registra los accesos denegados.
 */
@ApiTags('librerias', 'requisitos')
@Controller()
export class NormasController {
  constructor(
    @Inject(ADOPTAR) private readonly adopcion: AdoptarLibreriaUseCase,
    @Inject(LIBRERIAS) private readonly librerias: ListarLibreriasUseCase,
    @Inject(REQUISITOS) private readonly requisitos: ListarRequisitosUseCase,
    @Inject(REQUISITO) private readonly requisito: ObtenerRequisitoUseCase,
  ) {}

  @Get('librerias')
  @ApiOkResponse({ type: [LibreriaResumenResponse] })
  async listarLibrerias(@Identidad() identidad: IdentidadVerificada): Promise<LibreriaResumenResponse[]> {
    return this.librerias.ejecutar(identidad.empresaId);
  }

  /** 201 la primera vez; 200 si ya estaba adoptada (no es un error). El permiso se decide antes de mirar el identificador. */
  @Post('librerias/:id/adopcion')
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
  @ApiOkResponse({ type: [EntradaLibreriaResponse] })
  async listarRequisitos(@Identidad() identidad: IdentidadVerificada, @Query() consulta: Record<string, unknown>): Promise<EntradaLibreriaResponse[]> {
    const entradas = await this.requisitos.ejecutar({ empresaId: identidad.empresaId, ...leerFiltrosRequisitos(consulta) });
    return entradas.map((e) => ({ ...e, aplicaA: [...e.aplicaA] }));
  }

  @Get('requisitos/:id')
  @ApiOkResponse({ type: EntradaLibreriaResponse })
  async obtenerRequisito(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<EntradaLibreriaResponse> {
    const e = await this.requisito.ejecutar({ empresaId: identidad.empresaId, id });
    return { ...e, aplicaA: [...e.aplicaA] };
  }
}
