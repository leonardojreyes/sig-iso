import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { FilaDeclaracion } from '../domain/declaracion.js';
import type { DeclaracionRepositoryPort, VersionDeclaracion } from '../application/repositorios.port.js';

interface FilaVersion {
  id: string;
  numero: number;
  alcance_texto: string | null;
  total: number;
  aplican: number;
  no_aplican: number;
  sin_control: number;
  aprobada_por: string;
  aprobada_en: Date;
}
interface FilaFila {
  libreria_codigo: string;
  id_estable: string;
  orden: number;
  titulo: string;
  grupo: string | null;
  aplicabilidad: FilaDeclaracion['aplicabilidad'];
  implementacion: FilaDeclaracion['implementacion'];
  justificacion: string | null;
  controles: string[];
  cobertura: FilaDeclaracion['cobertura'];
}

const aVersion = (f: FilaVersion): VersionDeclaracion => ({ id: f.id, numero: f.numero, alcanceTexto: f.alcance_texto, total: f.total, aplican: f.aplican, noAplican: f.no_aplican, sinControl: f.sin_control, aprobadaPor: f.aprobada_por, aprobadaEn: f.aprobada_en });
const COLUMNAS = sql`id, numero, alcance_texto, total, aplican, no_aplican, sin_control, aprobada_por, aprobada_en`;

/** Versiones aprobadas de la declaración sobre PostgreSQL: solo se lee e inserta (la tabla no admite UPDATE ni DELETE de la aplicación). */
export class DeclaracionKysely implements DeclaracionRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async ultimoNumero(): Promise<number> {
    // Dos aprobaciones a la vez calculan el mismo número; la restricción única deja pasar solo una (la otra recibe «falso»).
    const r = await sql<{ n: number }>`select coalesce(max(numero), 0)::int as n from declaracion_version where empresa_id = ${this.empresaId}`.execute(this.db);
    return r.rows[0]?.n ?? 0;
  }

  async crear(v: VersionDeclaracion, filas: readonly FilaDeclaracion[]): Promise<boolean> {
    const r = await sql`insert into declaracion_version (id, empresa_id, numero, alcance_texto, total, aplican, no_aplican, sin_control, aprobada_por, aprobada_en)
                          values (${v.id}, ${this.empresaId}, ${v.numero}, ${v.alcanceTexto}, ${v.total}, ${v.aplican}, ${v.noAplican}, ${v.sinControl}, ${v.aprobadaPor}, ${v.aprobadaEn})
                          on conflict (empresa_id, numero) do nothing`.execute(this.db);
    if ((r.numAffectedRows ?? 0n) !== 1n) return false;
    for (const f of filas) {
      await sql`insert into declaracion_fila (empresa_id, version_id, libreria_codigo, id_estable, orden, titulo, grupo, aplicabilidad, implementacion, justificacion, controles, cobertura)
                values (${this.empresaId}, ${v.id}, ${f.libreriaCodigo}, ${f.idEstable}, ${f.orden}, ${f.titulo}, ${f.grupo}, ${f.aplicabilidad}, ${f.implementacion}, ${f.justificacion}, ${sql.val([...f.controles])}, ${f.cobertura})`.execute(this.db);
    }
    return true;
  }

  async listarVersiones(): Promise<readonly VersionDeclaracion[]> {
    const r = await sql<FilaVersion>`select ${COLUMNAS} from declaracion_version where empresa_id = ${this.empresaId} order by numero desc`.execute(this.db);
    return r.rows.map(aVersion);
  }

  async obtener(id: string): Promise<{ readonly version: VersionDeclaracion; readonly filas: readonly FilaDeclaracion[] } | null> {
    const v = await sql<FilaVersion>`select ${COLUMNAS} from declaracion_version where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    const fila = v.rows[0];
    if (!fila) return null;
    const f = await sql<FilaFila>`select libreria_codigo, id_estable, orden, titulo, grupo, aplicabilidad, implementacion, justificacion, controles, cobertura
                                    from declaracion_fila where empresa_id = ${this.empresaId} and version_id = ${id} order by libreria_codigo, orden, id_estable`.execute(this.db);
    return {
      version: aVersion(fila),
      filas: f.rows.map((x) => ({ libreriaCodigo: x.libreria_codigo, idEstable: x.id_estable, orden: x.orden, titulo: x.titulo, grupo: x.grupo, aplicabilidad: x.aplicabilidad, implementacion: x.implementacion, justificacion: x.justificacion, controles: x.controles, cobertura: x.cobertura })),
    };
  }
}
