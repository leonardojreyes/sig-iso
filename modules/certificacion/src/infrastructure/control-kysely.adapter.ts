import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import { ParametroInvalidoError } from '../application/errores.js';
import type { ControlRepositoryPort } from '../application/repositorios.port.js';
import { Control, type EstadoControl } from '../domain/control.js';

interface Fila {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  responsable_id: string | null;
  estado: string;
  version: number;
}

const COLUMNAS = sql`id, codigo, nombre, descripcion, responsable_id, estado, version`;
/** 23503 = violación de clave foránea: el responsable no es una persona de esta empresa (clave compuesta con `empresa_id`). */
const esClaveForanea = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: unknown }).code === '23503';

/**
 * Controles sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y además filtra por `empresa_id`
 * (defensa en profundidad). La concurrencia es optimista: `actualizar` solo escribe si la versión sigue siendo la esperada.
 */
export class ControlKysely implements ControlRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: Fila): Control {
    return Control.crear({ id: f.id, empresaId: this.empresaId, codigo: f.codigo, nombre: f.nombre, descripcion: f.descripcion, responsableId: f.responsable_id, estado: f.estado as EstadoControl, version: f.version });
  }

  async listar(): Promise<readonly Control[]> {
    const r = await sql<Fila>`select ${COLUMNAS} from control where empresa_id = ${this.empresaId} order by codigo`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(id: string): Promise<Control | null> {
    const r = await sql<Fila>`select ${COLUMNAS} from control where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async crear(c: Control, usuarioId: string, ahora: Date): Promise<boolean> {
    try {
      const r = await sql`insert into control (id, empresa_id, codigo, nombre, descripcion, responsable_id, estado, version, creado_por, creado_en, actualizado_por, actualizado_en)
                            values (${c.id}, ${this.empresaId}, ${c.codigo}, ${c.nombre}, ${c.descripcion}, ${c.responsableId}, ${c.estado}, ${c.version}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                            on conflict (empresa_id, codigo) do nothing`.execute(this.db);
      return (r.numAffectedRows ?? 0n) === 1n;
    } catch (e) {
      if (esClaveForanea(e)) throw new ParametroInvalidoError('responsableId');
      throw e;
    }
  }

  async actualizar(c: Control, usuarioId: string, ahora: Date, versionEsperada: number): Promise<boolean> {
    try {
      const r = await sql`update control set nombre = ${c.nombre}, descripcion = ${c.descripcion}, responsable_id = ${c.responsableId}, estado = ${c.estado}, version = ${c.version},
                            actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                          where empresa_id = ${this.empresaId} and id = ${c.id} and version = ${versionEsperada}`.execute(this.db);
      return (r.numAffectedRows ?? 0n) === 1n;
    } catch (e) {
      if (esClaveForanea(e)) throw new ParametroInvalidoError('responsableId');
      throw e;
    }
  }
}
