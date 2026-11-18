import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { VinculoRiesgoControlFila, VinculoRiesgoEntradaFila, VinculoRiesgoRepositoryPort } from '../application/repositorios.port.js';

/**
 * Vínculos de los riesgos sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y además filtra por
 * `empresa_id`. Las claves foráneas compuestas impiden vincular un riesgo o un control de otra empresa.
 */
export class VinculoRiesgoKysely implements VinculoRiesgoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listarControles(): Promise<readonly VinculoRiesgoControlFila[]> {
    const r = await sql<{ riesgo_id: string; control_id: string }>`select riesgo_id, control_id from riesgo_control where empresa_id = ${this.empresaId} order by riesgo_id, control_id`.execute(this.db);
    return r.rows.map((f) => ({ riesgoId: f.riesgo_id, controlId: f.control_id }));
  }

  async listarEntradas(): Promise<readonly VinculoRiesgoEntradaFila[]> {
    const r = await sql<{ riesgo_id: string; libreria_codigo: string; id_estable: string }>`select riesgo_id, libreria_codigo, id_estable from riesgo_entrada where empresa_id = ${this.empresaId} order by riesgo_id, libreria_codigo, id_estable`.execute(this.db);
    return r.rows.map((f) => ({ riesgoId: f.riesgo_id, libreriaCodigo: f.libreria_codigo, idEstable: f.id_estable }));
  }

  async contar(riesgoId: string): Promise<number> {
    const r = await sql<{ n: string }>`select (select count(*) from riesgo_control where empresa_id = ${this.empresaId} and riesgo_id = ${riesgoId})
                                          + (select count(*) from riesgo_entrada where empresa_id = ${this.empresaId} and riesgo_id = ${riesgoId}) as n`.execute(this.db);
    return Number(r.rows[0]?.n ?? 0);
  }

  async agregarControl(riesgoId: string, controlId: string, usuarioId: string, ahora: Date): Promise<boolean> {
    const r = await sql`insert into riesgo_control (empresa_id, riesgo_id, control_id, creado_por, creado_en) values (${this.empresaId}, ${riesgoId}, ${controlId}, ${usuarioId}, ${ahora})
                          on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async quitarControl(riesgoId: string, controlId: string): Promise<boolean> {
    const r = await sql`delete from riesgo_control where empresa_id = ${this.empresaId} and riesgo_id = ${riesgoId} and control_id = ${controlId}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async agregarEntrada(riesgoId: string, libreriaCodigo: string, idEstable: string, usuarioId: string, ahora: Date): Promise<boolean> {
    const r = await sql`insert into riesgo_entrada (empresa_id, riesgo_id, libreria_codigo, id_estable, creado_por, creado_en)
                          values (${this.empresaId}, ${riesgoId}, ${libreriaCodigo}, ${idEstable}, ${usuarioId}, ${ahora}) on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async quitarEntrada(riesgoId: string, libreriaCodigo: string, idEstable: string): Promise<boolean> {
    const r = await sql`delete from riesgo_entrada where empresa_id = ${this.empresaId} and riesgo_id = ${riesgoId} and libreria_codigo = ${libreriaCodigo} and id_estable = ${idEstable}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}
