// Adaptador de AutorizacionPort sobre PostgreSQL (ADR 029): el rol de cada persona vive en `usuario.rol` y los permisos salen de
// la matriz de `platform/autorizacion`. Corre con el rol `sigiso_app` y dentro de `conTenant`, así que la RLS solo deja ver a las
// personas de ESA empresa: el rol de A no se puede leer ni usar desde B. Sin caché: un cambio de rol vale de inmediato.
import {
  ErrorAutorizacion,
  esPermiso,
  esRol,
  permisosDe,
  type AutorizacionPort,
  type Permiso,
  type Rol,
} from '@sig/autorizacion';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { Kysely } from 'kysely';
import { conTenant } from './con-tenant';

interface BdAutorizacion {
  usuario: { id: string; empresa_id: string; rol: string | null };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_NULO = '00000000-0000-0000-0000-000000000000';

const usuario = (valor: unknown): string => {
  const v = typeof valor === 'string' ? valor.toLowerCase() : '';
  if (!UUID.test(v) || v === UUID_NULO) throw new ErrorAutorizacion('usuarioId');
  return v;
};

export class AutorizacionPostgres implements AutorizacionPort {
  private readonly db: Kysely<BdAutorizacion>;

  /** Recibe el `Kysely` del pool del rol de la aplicación (los pools no conocen el esquema); aquí se le da el tipo de lo que se lee. */
  constructor(db: Kysely<unknown>) {
    this.db = db as Kysely<BdAutorizacion>;
  }

  async rolesDe(usuarioId: string, empresaId: EmpresaId): Promise<readonly Rol[]> {
    const u = usuario(usuarioId);
    const e = crearEmpresaId(empresaId);
    const fila = await conTenant(this.db, e, async (trx) =>
      trx.selectFrom('usuario').select('rol').where('id', '=', u).where('empresa_id', '=', e).executeTakeFirst(),
    );
    if (!fila || fila.rol === null) return Object.freeze([]);
    // Un valor fuera del catálogo (dato dañado) no se interpreta: se falla, nunca se concede.
    if (!esRol(fila.rol)) throw new ErrorAutorizacion('rol');
    return Object.freeze([fila.rol]);
  }

  async puede(usuarioId: string, permiso: Permiso, empresaId: EmpresaId): Promise<boolean> {
    const u = usuario(usuarioId);
    const e = crearEmpresaId(empresaId);
    if (!esPermiso(permiso)) return false;
    const roles = await this.rolesDe(u, e);
    return roles.some((r) => permisosDe(r).includes(permiso));
  }
}
