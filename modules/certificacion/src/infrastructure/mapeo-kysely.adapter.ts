import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { MapeoRepositoryPort } from '../application/repositorios.port.js';
import { MapeoControl } from '../domain/mapeo-control.js';

interface Fila {
  control_id: string;
  libreria_codigo: string;
  id_estable: string;
}

/** Mapeos control ↔ entrada sobre PostgreSQL, ligados a la transacción (empresa fijada, RLS) y filtrados por empresa además. */
export class MapeoKysely implements MapeoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listar(): Promise<readonly MapeoControl[]> {
    const r = await sql<Fila>`select control_id, libreria_codigo, id_estable from control_mapeo where empresa_id = ${this.empresaId} order by control_id, libreria_codigo, id_estable`.execute(this.db);
    return r.rows.map((f) => MapeoControl.crear({ empresaId: this.empresaId, controlId: f.control_id, libreriaCodigo: f.libreria_codigo, idEstable: f.id_estable }));
  }

  async contar(controlId: string): Promise<number> {
    const r = await sql<{ n: string }>`select count(*)::text as n from control_mapeo where empresa_id = ${this.empresaId} and control_id = ${controlId}`.execute(this.db);
    return Number(r.rows[0]?.n ?? 0);
  }

  async agregar(m: MapeoControl, usuarioId: string, ahora: Date): Promise<boolean> {
    const r = await sql`insert into control_mapeo (empresa_id, control_id, libreria_codigo, id_estable, creado_por, creado_en)
                          values (${this.empresaId}, ${m.controlId}, ${m.libreriaCodigo}, ${m.idEstable}, ${usuarioId}, ${ahora})
                          on conflict (empresa_id, control_id, libreria_codigo, id_estable) do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async quitar(m: MapeoControl): Promise<boolean> {
    const r = await sql`delete from control_mapeo where empresa_id = ${this.empresaId} and control_id = ${m.controlId} and libreria_codigo = ${m.libreriaCodigo} and id_estable = ${m.idEstable}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}
