import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extraerBearer, TokenInvalidoError, type TokenVerifierPort } from '@sig/autenticacion';
import type { MotivoTokenInvalido } from '@sig/autenticacion';
import { EleccionDeEmpresaInvalidaError, type ResolverEmpresaActivaUseCase } from '@sig/empresas';
import type { SolicitudHttp } from './identidad.js';
import { PUBLICO } from './publico.decorator.js';
import { RegistradorTokenInvalido } from './registrador-token-invalido.js';
import { LimiteExcedidoException } from './limite-excedido.exception.js';
import type { LimiteFrecuencia } from './limite-frecuencia.js';
import { LIMITE, REGISTRADOR_TOKEN_INVALIDO, RESOLVER_EMPRESA, VERIFICADOR } from './tokens.js';

/**
 * Guardia global: toda ruta exige un token verificado salvo las marcadas con `@Publico()` (cerrado por omisión, ADR 027).
 * - Sin cabecera `Authorization` → 401 sin registrar nada (cualquiera puede curiosear).
 * - Cabecera inválida o token que no verifica → 401 + hecho `token.invalido` (agregado y con límite de frecuencia).
 * - Token válido pero por encima del límite de frecuencia (persona o empresa) → 429 con `Retry-After`.
 * - El límite de frecuencia se aplica antes de consultar la empresa activa (así protege también a la base).
 * - La empresa de la petición es la activa de la sesión o la del token (ADR 035); si la elección ya no vale, 401 (y se olvida); si no se
 *   puede decidir, el error se propaga (500).
 * - Servicio de claves caído → el error se propaga (500): no se acepta nada y no se registra como token inválido.
 * - Si no se puede registrar el rechazo → el error se propaga (500).
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(VERIFICADOR) private readonly verificador: TokenVerifierPort,
    @Inject(REGISTRADOR_TOKEN_INVALIDO) private readonly registrador: RegistradorTokenInvalido,
    @Inject(LIMITE) private readonly limite: LimiteFrecuencia,
    @Inject(RESOLVER_EMPRESA) private readonly empresaActiva: ResolverEmpresaActivaUseCase | null,
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
    // El límite de frecuencia va ANTES de consultar la base (la empresa activa es una consulta por petición): así el tope por persona
    // protege también a la base. Se cuenta contra la empresa del token verificado; solo las solicitudes AUTENTICADAS gastan fichas.
    const espera = this.limite.intentar(identidad.usuarioId, identidad.empresaId);
    if (espera > 0) throw new LimiteExcedidoException(espera);
    // La empresa de la petición es la ACTIVA de la sesión (si la persona sigue perteneciendo a ella) o, si no hay elección, la del
    // token (ADR 035). Si hay una elección que ya no vale, o si no se puede decidir (la base no responde), la petición falla: no se
    // cae a otra empresa en silencio.
    let empresaId = identidad.empresaId;
    if (this.empresaActiva) {
      try {
        empresaId = await this.empresaActiva.ejecutar({ usuarioId: identidad.usuarioId, sesionId: identidad.sesionId, empresaDelToken: identidad.empresaId, ahora: new Date() });
      } catch (error) {
        if (error instanceof EleccionDeEmpresaInvalidaError) throw new UnauthorizedException();
        throw error;
      }
    }
    solicitud.identidad = empresaId === identidad.empresaId ? identidad : { ...identidad, empresaId };
    return true;
  }

  private async rechazar(motivo: MotivoTokenInvalido): Promise<never> {
    await this.registrador.registrar(motivo);
    throw new UnauthorizedException();
  }
}
