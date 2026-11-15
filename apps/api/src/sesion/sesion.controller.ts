import { Body, Controller, Get, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { CambiarEmpresaUseCase, ListarMisEmpresasUseCase } from '@sig/empresas';
import { Identidad } from '../autenticacion/identidad.js';
import { RespuestaLista, RespuestasProblema } from '../documentacion.js';
import { EmpresaActualResponse, EmpresaDePersonaResponse, EmpresaElegidaRequest } from '../empresas/dto.js';
import { SesionService } from './sesion.service.js';
import { CAMBIAR_EMPRESA, LISTAR_EMPRESAS, SESION } from '../empresas/tokens-sesion.js';

@ApiBearerAuth('bearerAuth')
@ApiTags('sesion')
@Controller('sesion')
export class SesionController {
  constructor(
    @Inject(SESION) private readonly sesion: SesionService,
    @Inject(LISTAR_EMPRESAS) private readonly listarEmpresas: ListarMisEmpresasUseCase,
    @Inject(CAMBIAR_EMPRESA) private readonly cambiarEmpresa: CambiarEmpresaUseCase,
  ) {}

  @Post('inicio')
  @HttpCode(204)
  @ApiOperation({ operationId: 'registrarInicioSesion' })
  @ApiNoContentResponse({ description: 'Inicio de sesión registrado.' })
  @RespuestasProblema(401, 429, 500)
  async inicio(@Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.sesion.registrarInicio(identidad);
  }

  @Post('cierre')
  @HttpCode(204)
  @ApiOperation({ operationId: 'registrarCierreSesion' })
  @ApiNoContentResponse({ description: 'Cierre de sesión registrado.' })
  @RespuestasProblema(401, 429, 500)
  async cierre(@Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.sesion.registrarCierre(identidad);
  }

  /** Las empresas de la persona del token (un consultor puede tener varias). La empresa actual es la de esta sesión. */
  @Get('empresas')
  @ApiOperation({ operationId: 'listarMisEmpresas' })
  @RespuestaLista(EmpresaDePersonaResponse, 50)
  @RespuestasProblema(401, 429, 500)
  async empresas(@Identidad() identidad: IdentidadVerificada): Promise<EmpresaDePersonaResponse[]> {
    return this.listarEmpresas.ejecutar({ usuarioId: identidad.usuarioId, empresaActual: identidad.empresaId });
  }

  /**
   * ÚNICA operación que nombra una empresa (ADR 035). La persona y la sesión salen del token; la empresa pedida se compara con las
   * pertenencias de la persona en la base (404 si no pertenece). Un cuerpo con campos de más no es válido (400).
   */
  @Post('empresa')
  @HttpCode(200)
  @ApiOperation({ operationId: 'cambiarEmpresa' })
  @ApiBody({ type: EmpresaElegidaRequest })
  @ApiOkResponse({ type: EmpresaActualResponse })
  @RespuestasProblema(400, 401, 404, 429, 500)
  async cambiar(@Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<EmpresaActualResponse> {
    // Sin identificador de sesión no hay dónde guardar la elección: el token no sirve para esta operación (como inicio y cierre).
    if (identidad.sesionId === null) throw new UnauthorizedException();
    const objeto = typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : null;
    const slug = objeto !== null && Object.keys(objeto).length === 1 ? objeto['slug'] : undefined;
    return this.cambiarEmpresa.ejecutar({ usuarioId: identidad.usuarioId, sesionId: identidad.sesionId, slug });
  }
}
