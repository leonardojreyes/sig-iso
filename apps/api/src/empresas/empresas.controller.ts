import { Body, Controller, Get, HttpCode, Inject, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { ActualizarMarcaUseCase, ObtenerIdentidadUseCase, ObtenerMarcaUseCase } from '@sig/empresas';
import { Identidad } from '../autenticacion/identidad.js';
import { RespuestasProblema } from '../documentacion.js';
import { IdentidadResponse, MarcaEdicionRequest, MarcaResponse } from './dto.js';
import { ACTUALIZAR_MARCA, IDENTIDADES, MARCAS } from './tokens.js';

/** Identidad y marca de la empresa de quien consulta. La empresa y la persona salen SOLO del token verificado. */
@ApiBearerAuth('bearerAuth')
@Controller()
export class EmpresasController {
  constructor(
    @Inject(IDENTIDADES) private readonly identidades: ObtenerIdentidadUseCase,
    @Inject(MARCAS) private readonly marcas: ObtenerMarcaUseCase,
    @Inject(ACTUALIZAR_MARCA) private readonly actualizarMarca: ActualizarMarcaUseCase,
  ) {}

  @Get('me')
  @ApiTags('sesion')
  @ApiOperation({ operationId: 'obtenerIdentidad' })
  @ApiOkResponse({ type: IdentidadResponse })
  @RespuestasProblema(401, 429, 500)
  async yo(@Identidad() identidad: IdentidadVerificada): Promise<IdentidadResponse> {
    const r = await this.identidades.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId });
    return { usuarioId: r.usuarioId, nombre: r.nombre, roles: [...r.roles], empresa: { slug: r.empresa.slug, nombre: r.empresa.nombre } };
  }

  @Get('empresa/marca')
  @ApiTags('empresa')
  @ApiOperation({ operationId: 'obtenerMarcaEmpresa' })
  @ApiOkResponse({ type: MarcaResponse })
  @RespuestasProblema(401, 429, 500)
  async marca(@Identidad() identidad: IdentidadVerificada): Promise<MarcaResponse> {
    const m = await this.marcas.ejecutar(identidad.empresaId);
    // El monograma lo deriva la interfaz del nombre: el contrato no lo incluye.
    return { nombre: m.nombre, colorPrimario: m.colorPrimario, colorOriginal: m.colorOriginal, ajustadoPorContraste: m.ajustadoPorContraste, logoUrl: m.logoUrl };
  }

  /**
   * Edita el color y el logo de la empresa del token (solo `marca.editar`). La empresa y la persona salen SOLO del token. Un cuerpo
   * con campos de más no es válido (400). El permiso se decide antes de mirar lo enviado (401 → 403 → 400).
   */
  @Put('empresa/marca')
  @HttpCode(200)
  @ApiTags('empresa')
  @ApiOperation({ operationId: 'actualizarMarcaEmpresa' })
  @ApiBody({ type: MarcaEdicionRequest })
  @ApiOkResponse({ type: MarcaResponse })
  @RespuestasProblema(400, 401, 403, 429, 500)
  async editarMarca(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<MarcaResponse> {
    const objeto = typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : null;
    // Solo los dos campos del contrato: cualquier otra cosa (por ejemplo, una empresa) hace inválido el cuerpo.
    const valido = objeto !== null && Object.keys(objeto).sort().join(',') === 'colorPrimario,logoUrl';
    const m = await this.actualizarMarca.ejecutar({
      empresaId: identidad.empresaId,
      usuarioId: identidad.usuarioId,
      colorPrimario: valido ? objeto['colorPrimario'] : undefined,
      logoUrl: valido ? objeto['logoUrl'] : undefined,
    });
    return { nombre: m.nombre, colorPrimario: m.colorPrimario, colorOriginal: m.colorOriginal, ajustadoPorContraste: m.ajustadoPorContraste, logoUrl: m.logoUrl };
  }
}
