import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { Identidad } from '../autenticacion/identidad.js';
import { RespuestasProblema } from '../documentacion.js';
import { SesionService } from './sesion.service.js';
import { SESION } from '../empresas/tokens-sesion.js';

@ApiBearerAuth('bearerAuth')
@ApiTags('sesion')
@Controller('sesion')
export class SesionController {
  constructor(@Inject(SESION) private readonly sesion: SesionService) {}

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
}
