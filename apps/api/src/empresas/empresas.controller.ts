import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { ObtenerIdentidadUseCase, ObtenerMarcaUseCase } from '@sig/empresas';
import { Identidad } from '../autenticacion/identidad.js';
import { IdentidadResponse, MarcaResponse } from './dto.js';
import { IDENTIDADES, MARCAS } from './tokens.js';

/** Identidad y marca de la empresa de quien consulta. La empresa y la persona salen SOLO del token verificado. */
@ApiTags('empresa')
@Controller()
export class EmpresasController {
  constructor(
    @Inject(IDENTIDADES) private readonly identidades: ObtenerIdentidadUseCase,
    @Inject(MARCAS) private readonly marcas: ObtenerMarcaUseCase,
  ) {}

  @Get('me')
  @ApiOkResponse({ type: IdentidadResponse })
  async yo(@Identidad() identidad: IdentidadVerificada): Promise<IdentidadResponse> {
    const r = await this.identidades.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId });
    return { usuarioId: r.usuarioId, nombre: r.nombre, roles: [...r.roles], empresa: { slug: r.empresa.slug, nombre: r.empresa.nombre } };
  }

  @Get('empresa/marca')
  @ApiOkResponse({ type: MarcaResponse })
  async marca(@Identidad() identidad: IdentidadVerificada): Promise<MarcaResponse> {
    const m = await this.marcas.ejecutar(identidad.empresaId);
    // El monograma lo deriva la interfaz del nombre: el contrato no lo incluye.
    return { nombre: m.nombre, colorPrimario: m.colorPrimario, colorOriginal: m.colorOriginal, ajustadoPorContraste: m.ajustadoPorContraste, logoUrl: m.logoUrl };
  }
}
