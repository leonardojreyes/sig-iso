import { createHash } from 'node:crypto';
import { esEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { MotivoBitacora } from '../dominio/catalogo';
import type { Bitacora } from './bitacora';

/** El evento del sistema de identidad no se puede interpretar. El mensaje nunca repite valores del evento. */
export class EventoIdentidadInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Evento del sistema de identidad no válido: ${motivo}`);
    this.name = 'EventoIdentidadInvalidoError';
  }
}

export type ResultadoIntento = 'registrado' | 'ya_existia' | 'ignorado';

/** Opcional: dada una cuenta, a qué empresa pertenece. Si no se conoce, el hecho se registra como de plataforma. */
export type ResolverEmpresa = (usuarioId: string) => Promise<EmpresaId | null>;

const MOTIVO_POR_ERROR = new Map<string, MotivoBitacora>([
  ['invalid_user_credentials', 'credenciales_invalidas'],
  ['user_not_found', 'cuenta_inexistente'],
  ['user_disabled', 'cuenta_bloqueada'],
  ['user_temporarily_disabled', 'cuenta_bloqueada'],
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DESDE = Date.UTC(2020, 0, 1);
const HASTA = Date.UTC(2100, 0, 1);

const esObjetoPlano = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Campo con su longitud por delante, para que la huella no admita ambigüedades. */
const campo = (v: string): string => `${v.length}:${v}`;

/**
 * Convierte un intento fallido de ingreso del sistema de identidad (Keycloak, `LOGIN_ERROR`) en un hecho de la bitácora.
 *
 * LISTA BLANCA (ADR 028): de todo el evento solo se leen cuatro cosas: el tipo, la hora, el código de error (traducido a un
 * motivo de la lista cerrada) y el identificador de la cuenta si existe y es un UUID. La dirección de red, el nombre de usuario
 * tecleado, los detalles y cualquier otro campo NO se leen ni se copian, ni siquiera entran en la clave de idempotencia.
 */
export class RegistrarIntentoFallido {
  constructor(
    private readonly bitacora: Pick<Bitacora, 'registrarUnaVez'>,
    private readonly resolverEmpresa?: ResolverEmpresa,
  ) {}

  async ejecutar(crudo: unknown): Promise<ResultadoIntento> {
    if (!esObjetoPlano(crudo)) throw new EventoIdentidadInvalidoError('el evento debe ser un objeto');
    if (crudo.type !== 'LOGIN_ERROR') return 'ignorado';

    const hora = crudo.time;
    if (typeof hora !== 'number' || !Number.isInteger(hora) || hora < DESDE || hora > HASTA) throw new EventoIdentidadInvalidoError('la hora del evento no es válida');

    const motivo = (typeof crudo.error === 'string' ? MOTIVO_POR_ERROR.get(crudo.error) : undefined) ?? 'error_no_clasificado';
    const usuarioId = typeof crudo.userId === 'string' && UUID.test(crudo.userId) ? crudo.userId.toLowerCase() : null;
    const cliente = typeof crudo.clientId === 'string' ? crudo.clientId : '';

    // Clave de idempotencia: hora + tipo + cuenta + aplicación + motivo. Nada que identifique a la persona más allá de la cuenta.
    const huella = createHash('sha256')
      .update([String(hora), 'LOGIN_ERROR', usuarioId ?? '', cliente, motivo].map(campo).join('|'))
      .digest('hex');

    let empresaId: EmpresaId | null = null;
    if (usuarioId !== null && this.resolverEmpresa) {
      try {
        const empresa = await this.resolverEmpresa(usuarioId);
        empresaId = empresa !== null && esEmpresaId(empresa) ? empresa : null;
      } catch {
        empresaId = null; // un fallo al resolver la empresa no debe perder un hecho de seguridad
      }
    }

    return this.bitacora.registrarUnaVez({
      empresaId,
      actor: usuarioId === null ? { tipo: 'proceso' } : { tipo: 'proceso', usuarioId },
      accion: 'login.fallido',
      resultado: 'rechazado',
      motivo,
      origenId: `kc:login_error:${huella}`,
      despues: { ocurrio_en: new Date(hora).toISOString() },
    });
  }
}
