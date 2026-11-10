import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { EvaluacionRepositoryPort } from '../application/repositorios.port.js';
import { Evaluacion } from '../domain/evaluacion.js';
import type { EstadoEvaluacion } from '../domain/estado-evaluacion.js';

interface Fila {
  libreria_codigo: string;
  id_estable: string;
  libreria_id: string;
  estado: string;
  comentario: string | null;
  responsable_id: string | null;
  fecha_objetivo: string | Date | null;
  version: number;
}

const fecha = (v: string | Date | null): string | null => (v === null ? null : typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10));

/**
 * Evaluaciones sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (con la empresa ya fijada, RLS): además filtra por
 * `empresa_id` como defensa en profundidad. La concurrencia es optimista: `actualizar` solo escribe si la versión sigue siendo la esperada.
 */
export class EvaluacionKysely implements EvaluacionRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: Fila): Evaluacion {
    return Evaluacion.crear({
      empresaId: this.empresaId,
      libreriaCodigo: f.libreria_codigo,
      idEstable: f.id_estable,
      libreriaId: f.libreria_id,
      estado: f.estado as EstadoEvaluacion,
      comentario: f.comentario,
      responsableId: f.responsable_id,
      fechaObjetivo: fecha(f.fecha_objetivo),
      version: f.version,
    });
  }

  async listar(): Promise<readonly Evaluacion[]> {
    const r = await sql<Fila>`select libreria_codigo, id_estable, libreria_id, estado, comentario, responsable_id, fecha_objetivo, version
                                from evaluacion where empresa_id = ${this.empresaId} order by libreria_codigo, id_estable`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(libreriaCodigo: string, idEstable: string): Promise<Evaluacion | null> {
    const r = await sql<Fila>`select libreria_codigo, id_estable, libreria_id, estado, comentario, responsable_id, fecha_objetivo, version
                                from evaluacion where empresa_id = ${this.empresaId} and libreria_codigo = ${libreriaCodigo} and id_estable = ${idEstable}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async crear(e: Evaluacion, usuarioId: string, ahora: Date): Promise<boolean> {
    const r = await sql`insert into evaluacion (empresa_id, libreria_codigo, id_estable, libreria_id, estado, comentario, responsable_id, fecha_objetivo, version, actualizado_por, actualizado_en)
                          values (${this.empresaId}, ${e.libreriaCodigo}, ${e.idEstable}, ${e.libreriaId}, ${e.estado}, ${e.comentario}, ${e.responsableId}, ${e.fechaObjetivo}, ${e.version}, ${usuarioId}, ${ahora})
                          on conflict (empresa_id, libreria_codigo, id_estable) do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(e: Evaluacion, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean> {
    const r = await sql`update evaluacion set libreria_id = ${e.libreriaId}, estado = ${e.estado}, comentario = ${e.comentario}, responsable_id = ${e.responsableId},
                          fecha_objetivo = ${e.fechaObjetivo}, version = ${e.version}, actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                        where empresa_id = ${this.empresaId} and libreria_codigo = ${e.libreriaCodigo} and id_estable = ${e.idEstable} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}
