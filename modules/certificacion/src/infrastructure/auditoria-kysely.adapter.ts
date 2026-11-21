import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { CambiosProceso, FilaProceso, FilaRelacion, NuevoProceso, ProcesoRepositoryPort, RelacionRepositoryPort } from '../application/auditoria.port.js';
import type { RelacionProceso } from '../domain/independencia.js';
import type { CambioRelevante, EstadoProceso, FrecuenciaProceso, ImportanciaProceso } from '../domain/proceso.js';

// Auditoría interna sobre PostgreSQL (ADR 040). Cada repositorio recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y
// además filtra por `empresa_id` (defensa en profundidad). La aplicación no puede borrar procesos y solo cambia las columnas permitidas
// (permiso por columna, migraciones 0023 a 0025).

/** Arma `col = valor, …` solo con lo que cambia; las claves son nombres fijos del código, nunca del cliente. */
const asignaciones = (cambios: Readonly<Record<string, unknown>>, columnas: Readonly<Record<string, string>>): RawBuilder<unknown>[] =>
  Object.entries(cambios)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const columna = columnas[k];
      if (!columna) throw new Error(`Columna no permitida: ${k}`);
      return sql`${sql.ref(columna)} = ${v}`;
    });

interface FilaP {
  id: string;
  numero: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  duena_id: string;
  importancia: string;
  frecuencia: string;
  transversal: boolean;
  cambio_relevante: string | null;
  estado: string;
  version: number;
  creado_por: string;
  creado_en: Date;
}

const COLUMNAS_P = sql`id, numero, codigo, nombre, descripcion, duena_id, importancia, frecuencia, transversal, cambio_relevante, estado, version, creado_por, creado_en`;

const COLS_PROCESO: Readonly<Record<keyof CambiosProceso, string>> = {
  nombre: 'nombre',
  descripcion: 'descripcion',
  duenaId: 'duena_id',
  importancia: 'importancia',
  frecuencia: 'frecuencia',
  cambioRelevante: 'cambio_relevante',
  estado: 'estado',
};

export class ProcesoKysely implements ProcesoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: FilaP): FilaProceso {
    return {
      id: f.id,
      numero: f.numero,
      codigo: f.codigo,
      nombre: f.nombre,
      descripcion: f.descripcion,
      duenaId: f.duena_id,
      importancia: f.importancia as ImportanciaProceso,
      frecuencia: f.frecuencia as FrecuenciaProceso,
      transversal: f.transversal,
      cambioRelevante: f.cambio_relevante as CambioRelevante | null,
      estado: f.estado as EstadoProceso,
      version: f.version,
      creadoPor: f.creado_por,
      creadoEn: f.creado_en,
    };
  }

  async listar(): Promise<readonly FilaProceso[]> {
    const r = await sql<FilaP>`select ${COLUMNAS_P} from proceso where empresa_id = ${this.empresaId} order by numero`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(id: string): Promise<FilaProceso | null> {
    const r = await sql<FilaP>`select ${COLUMNAS_P} from proceso where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async transversalVigente(): Promise<FilaProceso | null> {
    const r = await sql<FilaP>`select ${COLUMNAS_P} from proceso where empresa_id = ${this.empresaId} and transversal and estado = 'vigente'`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async siguienteNumero(): Promise<number> {
    const r = await sql<{ n: number }>`select coalesce(max(numero), 0)::int + 1 as n from proceso where empresa_id = ${this.empresaId}`.execute(this.db);
    return r.rows[0]?.n ?? 1;
  }

  async crear(p: NuevoProceso, usuarioId: string, ahora: Date): Promise<boolean> {
    // Sin objetivo de conflicto: cubre el correlativo repetido y el índice de «un solo transversal vigente».
    const r =
      await sql`insert into proceso (id, empresa_id, numero, nombre, descripcion, duena_id, importancia, frecuencia, transversal,
                          creado_por, creado_en, actualizado_por, actualizado_en)
                        values (${p.id}, ${this.empresaId}, ${p.numero}, ${p.nombre}, ${p.descripcion}, ${p.duenaId}, ${p.importancia}, ${p.frecuencia}, ${p.transversal},
                          ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(id: string, cambios: CambiosProceso, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean> {
    const sets = asignaciones(cambios as Record<string, unknown>, COLS_PROCESO);
    const r =
      await sql`update proceso set ${sql.join([...sets, sql`version = version + 1`, sql`actualizado_por = ${usuarioId}`, sql`actualizado_en = ${ahora}`])}
                          where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}

export class RelacionKysely implements RelacionRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listar(): Promise<readonly FilaRelacion[]> {
    const r = await sql<{ proceso_id: string; usuario_id: string; relacion: string }>`select proceso_id, usuario_id, relacion from persona_proceso
      where empresa_id = ${this.empresaId} order by proceso_id, usuario_id, relacion`.execute(this.db);
    return r.rows.map((f) => ({ procesoId: f.proceso_id, usuarioId: f.usuario_id, relacion: f.relacion as RelacionProceso }));
  }

  async agregar(r: FilaRelacion, creadoPor: string, ahora: Date): Promise<boolean> {
    const x =
      await sql`insert into persona_proceso (empresa_id, proceso_id, usuario_id, relacion, creado_por, creado_en)
                        values (${this.empresaId}, ${r.procesoId}, ${r.usuarioId}, ${r.relacion}, ${creadoPor}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (x.numAffectedRows ?? 0n) === 1n;
  }

  async quitar(r: FilaRelacion): Promise<boolean> {
    const x =
      await sql`delete from persona_proceso where empresa_id = ${this.empresaId} and proceso_id = ${r.procesoId}
                        and usuario_id = ${r.usuarioId} and relacion = ${r.relacion}`.execute(this.db);
    return (x.numAffectedRows ?? 0n) === 1n;
  }
}
