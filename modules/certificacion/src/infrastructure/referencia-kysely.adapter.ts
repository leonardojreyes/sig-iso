import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { ReferenciaRepositoryPort } from '../application/repositorios.port.js';
import { ReferenciaTratamiento, type TipoReferencia } from '../domain/referencia-tratamiento.js';

interface Fila {
  norma: string;
  tipo: string;
  titulo: string;
  version_doc: string;
  fecha: string | Date;
  ubicacion: string;
  version: number;
}

/** `fecha` es un `date` de PostgreSQL: se lee como `AAAA-MM-DD` (sin zona horaria) para no desplazar el día. */
const COLUMNAS = sql`norma, tipo, titulo, version_doc, to_char(fecha, 'YYYY-MM-DD') as fecha, ubicacion, version`;

/**
 * Referencias al análisis y al plan de tratamiento sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada,
 * RLS) y además filtra por `empresa_id`. Concurrencia optimista por versión.
 */
export class ReferenciaKysely implements ReferenciaRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: Fila): ReferenciaTratamiento {
    return ReferenciaTratamiento.crear({ empresaId: this.empresaId, norma: f.norma, tipo: f.tipo as TipoReferencia, titulo: f.titulo, versionDoc: f.version_doc, fecha: String(f.fecha), ubicacion: f.ubicacion, version: f.version });
  }

  async listar(norma: string): Promise<readonly ReferenciaTratamiento[]> {
    const r = await sql<Fila>`select ${COLUMNAS} from referencia_tratamiento where empresa_id = ${this.empresaId} and norma = ${norma} order by tipo`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(norma: string, tipo: TipoReferencia): Promise<ReferenciaTratamiento | null> {
    const r = await sql<Fila>`select ${COLUMNAS} from referencia_tratamiento where empresa_id = ${this.empresaId} and norma = ${norma} and tipo = ${tipo}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async crear(x: ReferenciaTratamiento, usuarioId: string, ahora: Date): Promise<boolean> {
    const r = await sql`insert into referencia_tratamiento (empresa_id, norma, tipo, titulo, version_doc, fecha, ubicacion, version, actualizado_por, actualizado_en)
                          values (${this.empresaId}, ${x.norma}, ${x.tipo}, ${x.titulo}, ${x.versionDoc}, ${x.fecha}::date, ${x.ubicacion}, ${x.version}, ${usuarioId}, ${ahora})
                          on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(x: ReferenciaTratamiento, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean> {
    const r = await sql`update referencia_tratamiento set titulo = ${x.titulo}, version_doc = ${x.versionDoc}, fecha = ${x.fecha}::date, ubicacion = ${x.ubicacion}, version = ${x.version},
                          actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                          where empresa_id = ${this.empresaId} and norma = ${x.norma} and tipo = ${x.tipo} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async eliminar(norma: string, tipo: TipoReferencia, versionEsperada: number): Promise<boolean> {
    const r = await sql`delete from referencia_tratamiento where empresa_id = ${this.empresaId} and norma = ${norma} and tipo = ${tipo} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}
