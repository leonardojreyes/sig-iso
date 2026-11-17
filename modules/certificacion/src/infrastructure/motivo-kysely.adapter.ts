import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { MotivoRepositoryPort } from '../application/repositorios.port.js';
import type { TipoMotivo } from '../domain/declaracion.js';
import { MotivoInclusion } from '../domain/motivo-inclusion.js';

interface Fila {
  libreria_codigo: string;
  id_estable: string;
  tipo: string;
  nota: string;
  version: number;
}

/**
 * Motivos de inclusión sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y además filtra por
 * `empresa_id`. La concurrencia es optimista: cambiar o quitar solo escribe si la versión sigue siendo la esperada.
 */
export class MotivoKysely implements MotivoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: Fila): MotivoInclusion {
    return MotivoInclusion.crear({ empresaId: this.empresaId, libreriaCodigo: f.libreria_codigo, idEstable: f.id_estable, tipo: f.tipo as TipoMotivo, nota: f.nota, version: f.version });
  }

  async listar(): Promise<readonly MotivoInclusion[]> {
    const r = await sql<Fila>`select libreria_codigo, id_estable, tipo, nota, version from motivo_inclusion where empresa_id = ${this.empresaId} order by libreria_codigo, id_estable, tipo`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(libreriaCodigo: string, idEstable: string, tipo: TipoMotivo): Promise<MotivoInclusion | null> {
    const r = await sql<Fila>`select libreria_codigo, id_estable, tipo, nota, version from motivo_inclusion
                                where empresa_id = ${this.empresaId} and libreria_codigo = ${libreriaCodigo} and id_estable = ${idEstable} and tipo = ${tipo}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async crear(m: MotivoInclusion, usuarioId: string, ahora: Date): Promise<boolean> {
    const r = await sql`insert into motivo_inclusion (empresa_id, libreria_codigo, id_estable, tipo, nota, version, creado_por, creado_en, actualizado_por, actualizado_en)
                          values (${this.empresaId}, ${m.libreriaCodigo}, ${m.idEstable}, ${m.tipo}, ${m.nota}, ${m.version}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                          on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(m: MotivoInclusion, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean> {
    const r = await sql`update motivo_inclusion set nota = ${m.nota}, version = ${m.version}, actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                          where empresa_id = ${this.empresaId} and libreria_codigo = ${m.libreriaCodigo} and id_estable = ${m.idEstable} and tipo = ${m.tipo} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async eliminar(libreriaCodigo: string, idEstable: string, tipo: TipoMotivo, versionEsperada: number): Promise<boolean> {
    const r = await sql`delete from motivo_inclusion where empresa_id = ${this.empresaId} and libreria_codigo = ${libreriaCodigo} and id_estable = ${idEstable} and tipo = ${tipo} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}
