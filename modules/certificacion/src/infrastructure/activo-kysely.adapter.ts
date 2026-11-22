import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { ActivoRepositoryPort, LigaRiesgoActivoFila, RiesgoActivoRepositoryPort } from '../application/activos.port.js';
import { ParametroInvalidoError } from '../application/errores.js';
import { Activo, numeroDeActivo, type ClasificacionActivo, type EstadoActivo, type TipoActivo } from '../domain/activo.js';

interface Fila {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  clasificacion: string;
  responsable_id: string;
  estado: string;
  version: number;
}

const COLUMNAS = sql`id, codigo, nombre, descripcion, tipo, clasificacion, responsable_id, estado, version`;
/** 23503 = violación de clave foránea: el responsable no es una persona de esta empresa (clave compuesta con `empresa_id`). */
const esClaveForanea = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: unknown }).code === '23503';

/**
 * Activos sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y además filtra por `empresa_id`
 * (defensa en profundidad). El código `A-001` lo deriva la base del número; la concurrencia es optimista por versión.
 */
export class ActivoKysely implements ActivoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: Fila): Activo {
    return Activo.crear({
      id: f.id,
      empresaId: this.empresaId,
      codigo: f.codigo,
      nombre: f.nombre,
      descripcion: f.descripcion,
      tipo: f.tipo as TipoActivo,
      clasificacion: f.clasificacion as ClasificacionActivo,
      responsableId: f.responsable_id,
      estado: f.estado as EstadoActivo,
      version: f.version,
    });
  }

  async listar(): Promise<readonly Activo[]> {
    const r = await sql<Fila>`select ${COLUMNAS} from activo where empresa_id = ${this.empresaId} order by numero`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(id: string): Promise<Activo | null> {
    const r = await sql<Fila>`select ${COLUMNAS} from activo where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async siguienteNumero(): Promise<number> {
    const r = await sql<{ n: number }>`select coalesce(max(numero), 0) + 1 as n from activo where empresa_id = ${this.empresaId}`.execute(this.db);
    return Number(r.rows[0]?.n ?? 1);
  }

  async crear(a: Activo, usuarioId: string, ahora: Date): Promise<boolean> {
    try {
      const x = await sql`insert into activo (id, empresa_id, numero, nombre, descripcion, tipo, clasificacion, responsable_id, estado, version, creado_por, creado_en, actualizado_por, actualizado_en)
                            values (${a.id}, ${this.empresaId}, ${numeroDeActivo(a.codigo)}, ${a.nombre}, ${a.descripcion}, ${a.tipo}, ${a.clasificacion}, ${a.responsableId}, ${a.estado}, ${a.version}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                            on conflict (empresa_id, numero) do nothing`.execute(this.db);
      return (x.numAffectedRows ?? 0n) === 1n;
    } catch (e) {
      if (esClaveForanea(e)) throw new ParametroInvalidoError('responsableId');
      throw e;
    }
  }

  async actualizar(a: Activo, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean> {
    try {
      const x = await sql`update activo set nombre = ${a.nombre}, descripcion = ${a.descripcion}, tipo = ${a.tipo}, clasificacion = ${a.clasificacion},
                            responsable_id = ${a.responsableId}, estado = ${a.estado}, version = ${a.version}, actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                          where empresa_id = ${this.empresaId} and id = ${a.id} and version = ${versionEsperada}`.execute(this.db);
      return (x.numAffectedRows ?? 0n) === 1n;
    } catch (e) {
      if (esClaveForanea(e)) throw new ParametroInvalidoError('responsableId');
      throw e;
    }
  }
}

/** Ligas riesgo–activo sobre PostgreSQL; se agregan y se quitan, no se actualizan. */
export class RiesgoActivoKysely implements RiesgoActivoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listar(): Promise<readonly LigaRiesgoActivoFila[]> {
    const r = await sql<{ riesgo_id: string; activo_id: string }>`select riesgo_id, activo_id from riesgo_activo where empresa_id = ${this.empresaId} order by riesgo_id, activo_id`.execute(this.db);
    return r.rows.map((f) => ({ riesgoId: f.riesgo_id, activoId: f.activo_id }));
  }

  async contarDeRiesgo(riesgoId: string): Promise<number> {
    const r = await sql<{ n: string }>`select count(*) as n from riesgo_activo where empresa_id = ${this.empresaId} and riesgo_id = ${riesgoId}`.execute(this.db);
    return Number(r.rows[0]?.n ?? 0);
  }

  async agregar(riesgoId: string, activoId: string, usuarioId: string, ahora: Date): Promise<boolean> {
    const x = await sql`insert into riesgo_activo (empresa_id, riesgo_id, activo_id, creado_por, creado_en)
                          values (${this.empresaId}, ${riesgoId}, ${activoId}, ${usuarioId}, ${ahora}) on conflict do nothing`.execute(this.db);
    return (x.numAffectedRows ?? 0n) === 1n;
  }

  async quitar(riesgoId: string, activoId: string): Promise<boolean> {
    const x = await sql`delete from riesgo_activo where empresa_id = ${this.empresaId} and riesgo_id = ${riesgoId} and activo_id = ${activoId}`.execute(this.db);
    return (x.numAffectedRows ?? 0n) === 1n;
  }
}
