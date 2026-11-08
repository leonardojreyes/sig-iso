import { UnauthorizedException } from '@nestjs/common';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type { ObtenerIdentidadUseCase } from '@sig/empresas';
import type { RegistradorHechos } from '../autenticacion/registrador-token-invalido.js';

/**
 * Inicio y cierre de sesión (H6.1, H6.3). El hecho se deriva del token verificado, nunca de datos del cliente, y es idempotente
 * por sesión (`sid`): repetirlo no escribe otro registro. Si no se puede escribir, el error se propaga (H6.8).
 */
export class SesionService {
  constructor(
    private readonly identidades: ObtenerIdentidadUseCase,
    private readonly hechos: RegistradorHechos,
  ) {}

  async registrarInicio(identidad: IdentidadVerificada): Promise<void> {
    const sid = this.sesionDe(identidad);
    // La cuenta debe existir y tener roles en la empresa: no se registra un ingreso exitoso de una cuenta que ya no vale.
    await this.identidades.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId });
    await this.hechos.registrarUnaVez({
      empresaId: identidad.empresaId,
      actor: { tipo: 'usuario', usuarioId: identidad.usuarioId },
      accion: 'login.ok',
      resultado: 'ok',
      origenId: `login:${sid}`,
    });
  }

  /** El cierre no exige roles: una cuenta desactivada también puede cerrar su sesión. */
  async registrarCierre(identidad: IdentidadVerificada): Promise<void> {
    const sid = this.sesionDe(identidad);
    await this.hechos.registrarUnaVez({
      empresaId: identidad.empresaId,
      actor: { tipo: 'usuario', usuarioId: identidad.usuarioId },
      accion: 'logout',
      resultado: 'ok',
      origenId: `logout:${sid}`,
    });
  }

  /** Sin identificador de sesión no hay idempotencia posible: el token no sirve para estas operaciones. */
  private sesionDe(identidad: IdentidadVerificada): string {
    if (identidad.sesionId === null) throw new UnauthorizedException();
    return identidad.sesionId;
  }
}
