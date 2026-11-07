// Adaptador de TokenVerifierPort con `jose`. Reglas del ADR 027 §1: lista blanca de algoritmos, emisor y audiencia fijos
// (de la configuración, no del token), tipo `Bearer`, cliente autorizado (`azp`), vigencia con tolerancia de reloj y vida máxima,
// y `empresa_id` como UUID. Cualquier otra cosa se rechaza sin repetir lo recibido.
import { crearEmpresaId } from '@sig/tenancy';
import { errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { TOKEN_MAX } from '../bearer.js';
import { TokenInvalidoError, VerificadorNoDisponibleError, type MotivoTokenInvalido } from '../dominio/errores.js';
import type { IdentidadVerificada, TokenVerifierPort } from '../puertos/token-verifier.port.js';

export interface OpcionesVerificador {
  /** Emisor esperado (URL del realm). Se compara con `iss`; nunca se toma del token. */
  readonly emisor: string;
  /** Audiencia propia de la API (mapper de audiencia en Keycloak). */
  readonly audiencia: string;
  /** Cliente que obtuvo el token (`azp`), por ejemplo el de la web. */
  readonly clienteAutorizado: string;
  /** Resolutor de claves públicas (JWKS remoto en producción, local en pruebas). */
  readonly claves: JWTVerifyGetKey;
  /** Desfase de reloj admitido. Por defecto 30 s. */
  readonly toleranciaRelojSegundos?: number;
  /** Vida máxima aceptada (`exp - iat`). Por defecto 600 s: el access token del ADR 027 dura 5 minutos. */
  readonly vidaMaximaSegundos?: number;
  /** Reloj inyectable (pruebas). */
  readonly ahora?: () => Date;
}

const ALGORITMOS = ['RS256', 'ES256'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_NULO = '00000000-0000-0000-0000-000000000000';
const SESION = /^[A-Za-z0-9_-]{1,128}$/;

const alterado = (): TokenInvalidoError => new TokenInvalidoError('token_alterado');

/** Errores de `jose` que significan «este token no sirve». Cualquier otro (red, claves) es indisponibilidad. */
const esTokenMalo = (e: unknown): boolean =>
  e instanceof errors.JWTClaimValidationFailed ||
  e instanceof errors.JWTInvalid ||
  e instanceof errors.JWSInvalid ||
  e instanceof errors.JWSSignatureVerificationFailed ||
  e instanceof errors.JOSEAlgNotAllowed ||
  e instanceof errors.JOSENotSupported ||
  e instanceof errors.JWKSNoMatchingKey ||
  e instanceof errors.JWKSMultipleMatchingKeys ||
  e instanceof errors.JWKInvalid;

const aMotivo = (e: unknown): MotivoTokenInvalido | null => {
  if (e instanceof errors.JWTExpired) return 'token_vencido';
  return esTokenMalo(e) ? 'token_alterado' : null;
};

export class TokenVerifierJose implements TokenVerifierPort {
  private readonly tolerancia: number;
  private readonly vidaMaxima: number;
  private readonly ahora: () => Date;

  constructor(private readonly opciones: OpcionesVerificador) {
    this.tolerancia = opciones.toleranciaRelojSegundos ?? 30;
    this.vidaMaxima = opciones.vidaMaximaSegundos ?? 600;
    this.ahora = opciones.ahora ?? (() => new Date());
  }

  async verificar(token: string): Promise<IdentidadVerificada> {
    if (typeof token !== 'string' || token.length === 0 || token.length > TOKEN_MAX) throw alterado();
    const ahora = this.ahora();
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.opciones.claves, {
        issuer: this.opciones.emisor,
        audience: this.opciones.audiencia,
        algorithms: ALGORITMOS,
        clockTolerance: this.tolerancia,
        currentDate: ahora,
        requiredClaims: ['iss', 'aud', 'sub', 'exp', 'iat'],
      }));
    } catch (e) {
      const motivo = aMotivo(e);
      if (motivo) throw new TokenInvalidoError(motivo);
      throw new VerificadorNoDisponibleError();
    }
    return this.identidad(payload, ahora);
  }

  private identidad(p: JWTPayload, ahora: Date): IdentidadVerificada {
    const { exp, iat } = p;
    if (typeof exp !== 'number' || typeof iat !== 'number') throw alterado();
    const ahoraSeg = Math.floor(ahora.getTime() / 1000);
    if (iat > ahoraSeg + this.tolerancia || exp - iat > this.vidaMaxima) throw alterado();
    // Un id_token o un refresh token no sirven como access token; el token debe venir del cliente autorizado.
    if (p['typ'] !== 'Bearer' || p['azp'] !== this.opciones.clienteAutorizado) throw alterado();

    const sub = typeof p.sub === 'string' ? p.sub.toLowerCase() : '';
    if (!UUID.test(sub) || sub === UUID_NULO) throw alterado();

    const sid = p['sid'];
    if (sid !== undefined && !(typeof sid === 'string' && SESION.test(sid))) throw alterado();

    let empresaId;
    try {
      empresaId = crearEmpresaId(p['empresa_id']);
    } catch {
      throw new TokenInvalidoError('sin_empresa');
    }
    return { usuarioId: sub, empresaId, sesionId: sid ?? null, expiraEn: new Date(exp * 1000) };
  }
}
