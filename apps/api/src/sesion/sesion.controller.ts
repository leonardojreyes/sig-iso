import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import { Identidad } from '../autenticacion/identidad.js';
import { SesionService } from './sesion.service.js';
import { SESION } from '../empresas/tokens-sesion.js';

@ApiTags('sesion')
@Controller('sesion')
export class SesionController {
  constructor(@Inject(SESION) private readonly sesion: SesionService) {}

  @Post('inicio')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Inicio de sesión registrado.' })
  async inicio(@Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.sesion.registrarInicio(identidad);
  }

  @Post('cierre')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Cierre de sesión registrado.' })
  async cierre(@Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.sesion.registrarCierre(identidad);
  }
}
