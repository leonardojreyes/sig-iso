import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extraerBearer, TokenInvalidoError, type TokenVerifierPort } from '@sig/autenticacion';
import type { MotivoTokenInvalido } from '@sig/autenticacion';
import type { SolicitudHttp } from './identidad.js';
import { PUBLICO } from './publico.decorator.js';
import { RegistradorTokenInvalido } from './registrador-token-invalido.js';
import { REGISTRADOR_TOKEN_INVALIDO, VERIFICADOR } from './tokens.js';

/**
 * Guardia global: toda ruta exige un token verificado salvo las marcadas con `@Publico()` (cerrado por omisión, ADR 027).
 * - Sin cabecera `Authorization` → 401 sin registrar nada (cualquiera puede curiosear).
 * - Cabecera inválida o token que no verifica → 401 + hecho `token.invalido` (agregado y con límite de frecuencia).
 * - Servicio de claves caído → el error se propaga (500): no se acepta nada y no se registra como token inválido.
 * - Si no se puede registrar el rechazo → el error se propaga (500).
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(VERIFICADOR) private readonly verificador: TokenVerifierPort,
    @Inject(REGISTRADOR_TOKEN_INVALIDO) private readonly registrador: RegistradorTokenInvalido,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean | undefined>(PUBLICO, [contexto.getHandler(), contexto.getClass()])) return true;

    const solicitud = contexto.switchToHttp().getRequest<SolicitudHttp>();
    const cabecera = solicitud.headers['authorization'];
    if (cabecera === undefined) throw new UnauthorizedException();

    const token = extraerBearer(cabecera);
    if (token === null) return this.rechazar('token_alterado');

    let identidad;
    try {
      identidad = await this.verificador.verificar(token);
    } catch (error) {
      if (error instanceof TokenInvalidoError) return this.rechazar(error.motivo);
      throw error;
    }
    solicitud.identidad = identidad;
    return true;
  }

  private async rechazar(motivo: MotivoTokenInvalido): Promise<never> {
    await this.registrador.registrar(motivo);
    throw new UnauthorizedException();
  }
}
