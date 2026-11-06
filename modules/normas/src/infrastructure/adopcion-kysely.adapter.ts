// Adaptador de AdopcionRepositoryPort sobre PostgreSQL. Recibe la TRANSACCIÓN de una unidad de trabajo con la empresa fijada
// (la RLS de `empresa_libreria` limita lo que se ve y lo que se inserta a esa empresa).
import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { AdopcionRepositoryPort } from '../application/adopcion-repository.port.js';
import { AdopcionLibreria } from '../domain/adopcion-libreria.js';

export class AdopcionKysely implements AdopcionRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listarLibreriaIds(): Promise<string[]> {
    const { rows } = await sql<{ libreria_id: string }>`select libreria_id from empresa_libreria order by adoptada_en, libreria_id`.execute(this.db);
    return rows.map((f) => f.libreria_id);
  }

  async obtener(libreriaId: string): Promise<AdopcionLibreria | null> {
    const { rows } = await sql<{ libreria_id: string; adoptada_por: string; adoptada_en: Date }>`
      select libreria_id, adoptada_por, adoptada_en from empresa_libreria where libreria_id = ${libreriaId}`.execute(this.db);
    const f = rows[0];
    return f ? AdopcionLibreria.crear({ empresaId: this.empresaId, libreriaId: f.libreria_id, usuarioId: f.adoptada_por, ahora: f.adoptada_en }) : null;
  }

  async crear(adopcion: AdopcionLibreria): Promise<'creada' | 'ya_existia'> {
    const { rows } = await sql`
      insert into empresa_libreria (empresa_id, libreria_id, adoptada_por, adoptada_en)
      values (${adopcion.empresaId}, ${adopcion.libreriaId}, ${adopcion.adoptadaPor}, ${adopcion.adoptadaEn})
      on conflict (empresa_id, libreria_id) do nothing
      returning 1`.execute(this.db);
    return rows.length === 1 ? 'creada' : 'ya_existia';
  }
}
