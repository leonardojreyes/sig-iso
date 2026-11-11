import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { AlcanceRepositoryPort } from '../application/repositorios.port.js';
import { Alcance } from '../domain/alcance.js';

interface Fila {
  norma: string;
  texto: string;
  actualizado_por: string;
  actualizado_en: Date;
  aprobado_por: string | null;
  aprobado_en: Date | null;
}

/** Alcances sobre PostgreSQL, ligados a la transacción de la unidad de trabajo (empresa fijada, RLS) y filtrados por empresa además. */
export class AlcanceKysely implements AlcanceRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: Fila): Alcance {
    return Alcance.crear({ empresaId: this.empresaId, norma: f.norma, texto: f.texto, actualizadoPor: f.actualizado_por, actualizadoEn: f.actualizado_en, aprobadoPor: f.aprobado_por, aprobadoEn: f.aprobado_en });
  }

  async listar(): Promise<readonly Alcance[]> {
    const r = await sql<Fila>`select norma, texto, actualizado_por, actualizado_en, aprobado_por, aprobado_en from alcance where empresa_id = ${this.empresaId} order by norma`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(norma: string): Promise<Alcance | null> {
    const r = await sql<Fila>`select norma, texto, actualizado_por, actualizado_en, aprobado_por, aprobado_en from alcance where empresa_id = ${this.empresaId} and norma = ${norma}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async guardar(a: Alcance): Promise<void> {
    await sql`insert into alcance (empresa_id, norma, texto, actualizado_por, actualizado_en, aprobado_por, aprobado_en)
                values (${this.empresaId}, ${a.norma}, ${a.texto}, ${a.actualizadoPor}, ${a.actualizadoEn}, ${a.aprobadoPor}, ${a.aprobadoEn})
              on conflict (empresa_id, norma) do update set texto = excluded.texto, actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en,
                aprobado_por = excluded.aprobado_por, aprobado_en = excluded.aprobado_en`.execute(this.db);
  }
}
