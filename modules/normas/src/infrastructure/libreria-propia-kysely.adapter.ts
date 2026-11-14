// Adaptador de LibreriaPropiaRepositoryPort sobre PostgreSQL. Recibe la TRANSACCIÓN de una unidad de trabajo con la empresa fijada:
// la RLS de `libreria` (migración 0011) solo deja insertar librerías de ESA empresa. Todo o nada: si algo falla, no queda nada.
import { randomUUID } from 'node:crypto';
import type { Libreria } from '@sig/normas-schema';
import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { LibreriaPropiaRepositoryPort } from '../application/libreria-propia.port.js';

export class LibreriaPropiaKysely implements LibreriaPropiaRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async guardar(l: Libreria, huella: string): Promise<'nueva' | 'ya' | 'distinto'> {
    const insertada = await sql<{ id: string }>`
      insert into libreria (empresa_id, codigo, nombre, version, hash, es_ejemplo, fuente)
      values (${this.empresaId}, ${l.codigo}, ${l.nombre}, ${l.version}, ${huella}, false, ${l.fuente})
      on conflict (empresa_id, codigo, version) where empresa_id is not null do nothing
      returning id`.execute(this.db);
    const lib = insertada.rows[0];
    if (!lib) {
      const previa = await sql<{ hash: string }>`
        select hash from libreria where empresa_id = ${this.empresaId} and codigo = ${l.codigo} and version = ${l.version}`.execute(this.db);
      return previa.rows[0]?.hash === huella ? 'ya' : 'distinto';
    }
    for (const [i, e] of l.entradas.entries()) {
      // El id se genera aquí y no se usa `returning`: las entradas solo se VEN si la librería está adoptada (RLS), y devolver la
      // fila recién insertada exige poder verla.
      const entradaId = randomUUID();
      await sql`
        insert into libreria_entrada (id, libreria_id, id_estable, capitulo, tipo, grupo, nivel, titulo, guia, alcance_comun, orden)
        values (${entradaId}, ${lib.id}, ${e.id}, ${e.capitulo ?? null}, ${e.tipo ?? 'clausula'}, ${e.grupo ?? null}, ${e.nivel}, ${e.titulo}, ${e.guia}, ${e.alcance_comun}, ${i + 1})`.execute(this.db);
      for (const a of e.aplica_a) {
        await sql`insert into libreria_entrada_norma (entrada_id, libreria_id, norma, edicion, clausula)
          values (${entradaId}, ${lib.id}, ${a.norma}, ${a.edicion}, ${a.clausula})`.execute(this.db);
      }
    }
    return 'nueva';
  }
}
