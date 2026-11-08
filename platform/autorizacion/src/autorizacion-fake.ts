import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { AutorizacionPort } from './autorizacion.port.js';
import { ErrorAutorizacion } from './errores.js';
import { esPermiso, esRol, permisosDe, ROLES, type Permiso, type Rol } from './roles.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_NULO = '00000000-0000-0000-0000-000000000000';

const usuario = (valor: unknown): string => {
  const v = typeof valor === 'string' ? valor.toLowerCase() : '';
  if (!UUID.test(v) || v === UUID_NULO) throw new ErrorAutorizacion('usuarioId');
  return v;
};
const rol = (valor: unknown): Rol => {
  if (!esRol(valor)) throw new ErrorAutorizacion('rol');
  return valor;
};

/**
 * Implementación en memoria para pruebas y desarrollo: los roles se asignan POR EMPRESA (el rol de A no vale en B).
 * El adaptador de producción (`AutorizacionPostgres`, ADR 029) cumple el mismo puerto.
 */
export class AutorizacionFake implements AutorizacionPort {
  private readonly roles = new Map<string, Set<Rol>>();

  private static clave(empresaId: EmpresaId, usuarioId: string): string {
    return `${empresaId}|${usuarioId}`;
  }

  asignar(empresa: EmpresaId, usuarioId: string, nuevo: Rol): void {
    const k = AutorizacionFake.clave(crearEmpresaId(empresa), usuario(usuarioId));
    const r = rol(nuevo);
    this.roles.set(k, (this.roles.get(k) ?? new Set<Rol>()).add(r));
  }

  revocar(empresa: EmpresaId, usuarioId: string, quitar: Rol): void {
    const k = AutorizacionFake.clave(crearEmpresaId(empresa), usuario(usuarioId));
    const r = rol(quitar);
    this.roles.get(k)?.delete(r);
  }

  async puede(usuarioId: string, permiso: Permiso, empresa: EmpresaId): Promise<boolean> {
    const u = usuario(usuarioId);
    const e = crearEmpresaId(empresa);
    if (!esPermiso(permiso)) return false;
    const propios = this.roles.get(AutorizacionFake.clave(e, u));
    if (!propios) return false;
    return [...propios].some((r) => permisosDe(r).includes(permiso));
  }

  async rolesDe(usuarioId: string, empresa: EmpresaId): Promise<readonly Rol[]> {
    const u = usuario(usuarioId);
    const e = crearEmpresaId(empresa);
    const propios = this.roles.get(AutorizacionFake.clave(e, u));
    return Object.freeze(ROLES.filter((r) => propios?.has(r) ?? false));
  }
}
