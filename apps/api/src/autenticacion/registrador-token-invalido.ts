import type { EventoBitacora } from '@sig/auditoria';
import type { MotivoTokenInvalido } from '@sig/autenticacion';
import type { LimitadorPorVentana } from './limitador-por-ventana.js';

/** Escribe un hecho en la bitácora. Si no puede, FALLA (el rechazo no se da por bueno sin rastro). */
export interface RegistradorHechos {
  registrar(evento: EventoBitacora): Promise<void>;
  /** Igual, pero sin repetir un hecho con el mismo `origenId` (idempotencia: inicio y cierre de sesión). Exige `origenId`. */
  registrarUnaVez(evento: EventoBitacora): Promise<'registrado' | 'ya_existia'>;
}

/**
 * Registra `token.invalido` como hecho de plataforma (sin empresa: ninguna es de fiar si el token no se verificó), como mucho
 * una vez por motivo y ventana. Nunca guarda el token ni sus datos. Si el registro falla, el error se propaga.
 */
export class RegistradorTokenInvalido {
  constructor(
    private readonly hechos: RegistradorHechos,
    private readonly limitador: LimitadorPorVentana,
  ) {}

  async registrar(motivo: MotivoTokenInvalido): Promise<void> {
    if (!this.limitador.permitir(motivo)) return;
    await this.hechos.registrar({ empresaId: null, actor: { tipo: 'sistema' }, accion: 'token.invalido', resultado: 'rechazado', motivo });
  }
}
