// Una persona en varias empresas para las pruebas de la API (ADR 035): casos de uso REALES sobre un puerto en memoria que se
// comporta como la base: la elección solo vale si la persona SIGUE perteneciendo (con rol) a esa empresa, y vence.
import {
  CambiarEmpresaUseCase,
  ListarMisEmpresasUseCase,
  OlvidarEmpresaActivaUseCase,
  ResolverEmpresaActivaUseCase,
  type EmpresaActivaPort,
  type EmpresaDePersona,
  type RegistradorHechosPort,
} from '@sig/empresas';
import type { EmpresaId } from '@sig/tenancy';

export class EmpresaActivaEnMemoria implements EmpresaActivaPort {
  /** Usuario → empresas a las que pertenece (con rol). */
  pertenencias = new Map<string, EmpresaDePersona[]>();
  activas = new Map<string, { usuario: string; empresa: EmpresaId; expira: Date }>();
  falla = false;

  async activaDe(sid: string, usuario: string, ahora: Date): Promise<EmpresaId | null> {
    if (this.falla) throw new Error('base de empresa activa caída');
    const a = this.activas.get(sid);
    if (!a || a.usuario !== usuario || a.expira <= ahora) return null;
    return (this.pertenencias.get(usuario) ?? []).some((e) => e.empresaId === a.empresa) ? a.empresa : null;
  }
  async empresasDe(usuario: string): Promise<readonly EmpresaDePersona[]> {
    return [...(this.pertenencias.get(usuario) ?? [])].sort((x, y) => x.nombre.localeCompare(y.nombre));
  }
  async fijar(sid: string, usuario: string, empresa: EmpresaId, _ahora: Date, expira: Date): Promise<void> {
    this.activas.set(sid, { usuario, empresa, expira });
  }
  async limpiar(sid: string): Promise<void> {
    this.activas.delete(sid);
  }
}

/** Los casos de uso de la empresa activa, listos para `EmpresaSesionModule` y `crearArnes`. Por defecto cada persona de `pertenencias`. */
export const empresaActivaDePrueba = (hechos: RegistradorHechosPort, puerto: EmpresaActivaEnMemoria = new EmpresaActivaEnMemoria()) => ({
  puerto,
  resolver: new ResolverEmpresaActivaUseCase(puerto),
  listarEmpresas: new ListarMisEmpresasUseCase(puerto),
  cambiarEmpresa: new CambiarEmpresaUseCase(puerto, hechos),
  olvidarEmpresa: new OlvidarEmpresaActivaUseCase(puerto),
});
