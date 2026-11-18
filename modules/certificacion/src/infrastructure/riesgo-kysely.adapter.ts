import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import { ParametroInvalidoError } from '../application/errores.js';
import type { RiesgoRepositoryPort } from '../application/repositorios.port.js';
import { numeroDeRiesgo, Riesgo, type DecisionTratamiento, type EstadoRiesgo } from '../domain/riesgo.js';

interface Fila {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  probabilidad: number;
  impacto: number;
  decision: string;
  responsable_id: string | null;
  estado: string;
  version: number;
}

const COLUMNAS = sql`id, codigo, titulo, descripcion, probabilidad, impacto, decision, responsable_id, estado, version`;
/** 23503 = violación de clave foránea: el responsable no es una persona de esta empresa (clave compuesta con `empresa_id`). */
const esClaveForanea = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: unknown }).code === '23503';

/**
 * Riesgos sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y además filtra por `empresa_id`
 * (defensa en profundidad). El código `R-001` lo deriva la base del número; la concurrencia es optimista por versión.
 */
export class RiesgoKysely implements RiesgoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: Fila): Riesgo {
    return Riesgo.crear({
      id: f.id,
      empresaId: this.empresaId,
      codigo: f.codigo,
      titulo: f.titulo,
      descripcion: f.descripcion,
      probabilidad: f.probabilidad,
      impacto: f.impacto,
      decision: f.decision as DecisionTratamiento,
      responsableId: f.responsable_id,
      estado: f.estado as EstadoRiesgo,
      version: f.version,
    });
  }

  async listar(): Promise<readonly Riesgo[]> {
    const r = await sql<Fila>`select ${COLUMNAS} from riesgo where empresa_id = ${this.empresaId} order by numero`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(id: string): Promise<Riesgo | null> {
    const r = await sql<Fila>`select ${COLUMNAS} from riesgo where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async siguienteNumero(): Promise<number> {
    const r = await sql<{ n: number }>`select coalesce(max(numero), 0) + 1 as n from riesgo where empresa_id = ${this.empresaId}`.execute(this.db);
    return Number(r.rows[0]?.n ?? 1);
  }

  async crear(r: Riesgo, usuarioId: string, ahora: Date): Promise<boolean> {
    try {
      const x = await sql`insert into riesgo (id, empresa_id, numero, titulo, descripcion, probabilidad, impacto, decision, responsable_id, estado, version, creado_por, creado_en, actualizado_por, actualizado_en)
                            values (${r.id}, ${this.empresaId}, ${numeroDeRiesgo(r.codigo)}, ${r.titulo}, ${r.descripcion}, ${r.probabilidad}, ${r.impacto}, ${r.decision}, ${r.responsableId}, ${r.estado}, ${r.version}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                            on conflict (empresa_id, numero) do nothing`.execute(this.db);
      return (x.numAffectedRows ?? 0n) === 1n;
    } catch (e) {
      if (esClaveForanea(e)) throw new ParametroInvalidoError('responsableId');
      throw e;
    }
  }

  async actualizar(r: Riesgo, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean> {
    try {
      const x = await sql`update riesgo set titulo = ${r.titulo}, descripcion = ${r.descripcion}, probabilidad = ${r.probabilidad}, impacto = ${r.impacto}, decision = ${r.decision},
                            responsable_id = ${r.responsableId}, estado = ${r.estado}, version = ${r.version}, actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                          where empresa_id = ${this.empresaId} and id = ${r.id} and version = ${versionEsperada}`.execute(this.db);
      return (x.numAffectedRows ?? 0n) === 1n;
    } catch (e) {
      if (esClaveForanea(e)) throw new ParametroInvalidoError('responsableId');
      throw e;
    }
  }
}
