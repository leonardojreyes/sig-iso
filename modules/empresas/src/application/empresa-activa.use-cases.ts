// Una persona en varias empresas (ADR 035). Tres casos de uso: resolver la empresa de la petición (lo usa la guardia), listar las
// empresas de la persona y cambiar la empresa activa de la sesión. La empresa pedida es lo ÚNICO que un cliente puede nombrar, y solo
// aquí: se comprueba contra las pertenencias de la persona verificada y no se acepta nada que no esté en ellas.
import type { EventoBitacora } from '@sig/auditoria';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { EmpresaActivaPort } from './empresa-activa.port.js';

/** La persona no pertenece a esa empresa (o no existe). Se responde como «no encontrada», sin distinguir un caso del otro. */
export class EmpresaAjenaError extends Error {
  constructor(readonly slug: string) {
    super('Empresa no encontrada');
    this.name = 'EmpresaAjenaError';
  }
}

/** El dato recibido no tiene la forma esperada. No repite el valor. */
export class EmpresaPedidaInvalidaError extends Error {
  constructor() {
    super('La empresa pedida no es válida');
    this.name = 'EmpresaPedidaInvalidaError';
  }
}

/** Escribe un hecho en la bitácora. Si no puede, FALLA (no hay cambio sin rastro). */
export interface RegistradorHechosPort {
  registrar(evento: EventoBitacora): Promise<void>;
}

/** Lo que dura una empresa activa: la sesión máxima (ADR 027). */
export const VIDA_EMPRESA_ACTIVA_MS = 8 * 3600 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9-]{1,32}$/;
const exigirUuid = (v: unknown): string => {
  if (typeof v !== 'string' || !UUID.test(v.toLowerCase())) throw new Error('El identificador de la persona no es un UUID válido');
  return v.toLowerCase();
};

/** La empresa con la que se atiende la petición: la activa de la sesión si vale, y si no, la del token verificado. */
export class ResolverEmpresaActivaUseCase {
  constructor(private readonly puerto: EmpresaActivaPort) {}

  async ejecutar(e: { readonly usuarioId: string; readonly sesionId: string | null; readonly empresaDelToken: EmpresaId; readonly ahora: Date }): Promise<EmpresaId> {
    const empresaDelToken = crearEmpresaId(e.empresaDelToken);
    // Sin sesión no hay dónde guardar una elección: manda el token.
    if (e.sesionId === null) return empresaDelToken;
    const activa = await this.puerto.activaDe(e.sesionId, exigirUuid(e.usuarioId), e.ahora);
    return activa === null ? empresaDelToken : crearEmpresaId(activa);
  }
}

export interface EmpresaDePersonaDto {
  readonly slug: string;
  readonly nombre: string;
  /** Es la empresa de esta sesión ahora. */
  readonly activa: boolean;
}

/** Las empresas a las que pertenece la persona del token, marcando la activa. */
export class ListarMisEmpresasUseCase {
  constructor(private readonly puerto: EmpresaActivaPort) {}

  async ejecutar(e: { readonly usuarioId: string; readonly empresaActual: EmpresaId }): Promise<EmpresaDePersonaDto[]> {
    const actual = crearEmpresaId(e.empresaActual);
    const empresas = await this.puerto.empresasDe(exigirUuid(e.usuarioId));
    return empresas.map((x) => ({ slug: x.slug, nombre: x.nombre, activa: x.empresaId === actual }));
  }
}

export interface CambiarEmpresaEntrada {
  readonly usuarioId: string;
  /** La sesión del token: sin ella no hay dónde guardar la elección. */
  readonly sesionId: string | null;
  readonly slug: unknown;
  readonly traceId?: string;
}

/**
 * Cambia la empresa activa de la sesión. Orden: forma del dato (400) → pertenencia de la persona (404 si no pertenece) → hecho en la
 * bitácora de la empresa destino → guardar. Sin sesión (`sid`) no se puede cambiar (el llamador lo responde como 401).
 */
export class CambiarEmpresaUseCase {
  constructor(
    private readonly puerto: EmpresaActivaPort,
    private readonly hechos: RegistradorHechosPort,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async ejecutar(e: CambiarEmpresaEntrada): Promise<{ readonly slug: string; readonly nombre: string }> {
    if (typeof e.slug !== 'string' || !SLUG.test(e.slug)) throw new EmpresaPedidaInvalidaError();
    if (e.sesionId === null) throw new Error('El token no trae identificador de sesión');
    const usuarioId = exigirUuid(e.usuarioId);
    const destino = (await this.puerto.empresasDe(usuarioId)).find((x) => x.slug === e.slug);
    if (!destino) throw new EmpresaAjenaError(e.slug);

    // Primero el rastro: si no se puede registrar, no se cambia nada.
    await this.hechos.registrar({
      empresaId: destino.empresaId,
      actor: { tipo: 'usuario', usuarioId },
      accion: 'empresa.cambiada',
      resultado: 'ok',
      objeto: `empresa:${destino.slug}`,
      ...(e.traceId === undefined ? {} : { traceId: e.traceId }),
    });
    const ahora = this.reloj();
    await this.puerto.fijar(e.sesionId, usuarioId, destino.empresaId, ahora, new Date(ahora.getTime() + VIDA_EMPRESA_ACTIVA_MS));
    return { slug: destino.slug, nombre: destino.nombre };
  }
}

/** Al cerrar la sesión se olvida la empresa activa: quien vuelva a entrar empieza en la de su token. */
export class OlvidarEmpresaActivaUseCase {
  constructor(private readonly puerto: EmpresaActivaPort) {}

  async ejecutar(sesionId: string | null): Promise<void> {
    if (sesionId !== null) await this.puerto.limpiar(sesionId);
  }
}
