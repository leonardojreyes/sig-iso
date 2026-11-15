import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { EvidenciaRepositoryPort, FilaEvidencia } from '../application/repositorios.port.js';
import { Evidencia, type EstadoEvidencia, type TipoEvidencia } from '../domain/evidencia.js';
import type { TipoArchivo } from '../domain/tipo-archivo.js';

interface Fila {
  id: string;
  control_id: string;
  tipo: string;
  titulo: string;
  fecha_hecho: string;
  vigente_hasta: string | null;
  estado: string;
  reemplaza_id: string | null;
  archivo_id: string;
  archivo_nombre: string;
  archivo_tipo: string;
  archivo_bytes: number;
  archivo_sha256: string;
  creado_en: Date;
}

// Las fechas salen ya como AAAA-MM-DD (to_char) para no depender de la zona horaria del servidor, y el tamaño como entero.
const COLUMNAS = sql`id, control_id, tipo, titulo, to_char(fecha_hecho, 'YYYY-MM-DD') as fecha_hecho, to_char(vigente_hasta, 'YYYY-MM-DD') as vigente_hasta,
  estado, reemplaza_id, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes::int as archivo_bytes, archivo_sha256, creado_en`;

/**
 * Evidencias sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y además filtra por `empresa_id`
 * (defensa en profundidad). La aplicación solo puede cambiar el estado y quién y cuándo (permiso por columna) y no puede borrar.
 */
export class EvidenciaKysely implements EvidenciaRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: Fila): FilaEvidencia {
    const evidencia = Evidencia.crear({
      id: f.id,
      empresaId: this.empresaId,
      controlId: f.control_id,
      tipo: f.tipo as TipoEvidencia,
      titulo: f.titulo,
      fechaHecho: f.fecha_hecho,
      vigenteHasta: f.vigente_hasta,
      estado: f.estado as EstadoEvidencia,
      reemplazaId: f.reemplaza_id,
      archivo: { id: f.archivo_id, nombre: f.archivo_nombre, tipo: f.archivo_tipo as TipoArchivo, bytes: f.archivo_bytes, sha256: f.archivo_sha256 },
    });
    return { evidencia, creadaEn: f.creado_en };
  }

  async obtener(id: string): Promise<FilaEvidencia | null> {
    const r = await sql<Fila>`select ${COLUMNAS} from evidencia where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async listarDeControl(controlId: string, incluirHistoricas: boolean): Promise<readonly FilaEvidencia[]> {
    const r = await sql<Fila>`select ${COLUMNAS} from evidencia
                               where empresa_id = ${this.empresaId} and control_id = ${controlId} and (${incluirHistoricas} or estado = 'activa')
                               order by creado_en desc, id`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async listarActivas(): Promise<readonly Evidencia[]> {
    const r = await sql<Fila>`select ${COLUMNAS} from evidencia where empresa_id = ${this.empresaId} and estado = 'activa' order by control_id, creado_en`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f).evidencia);
  }

  async contarActivas(controlId: string): Promise<number> {
    // Bloquea la fila del control hasta el fin de la transacción: dos subidas a la vez al mismo control se turnan y no pasan el tope.
    await sql`select 1 from control where empresa_id = ${this.empresaId} and id = ${controlId} for update`.execute(this.db);
    const r = await sql<{ n: string }>`select count(*)::text as n from evidencia where empresa_id = ${this.empresaId} and control_id = ${controlId} and estado = 'activa'`.execute(this.db);
    return Number(r.rows[0]?.n ?? 0);
  }

  async crear(e: Evidencia, usuarioId: string, ahora: Date): Promise<boolean> {
    const a = e.archivo;
    const r = await sql`insert into evidencia (id, empresa_id, control_id, tipo, titulo, fecha_hecho, vigente_hasta, estado, reemplaza_id,
                          archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, creado_por, creado_en, actualizado_por, actualizado_en)
                        values (${e.id}, ${this.empresaId}, ${e.controlId}, ${e.tipo}, ${e.titulo}, ${e.fechaHecho}, ${e.vigenteHasta}, ${e.estado}, ${e.reemplazaId},
                          ${a.id}, ${a.nombre}, ${a.tipo}, ${a.bytes}, ${a.sha256}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                        on conflict (empresa_id, archivo_id) do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async cambiarEstado(e: Evidencia, usuarioId: string, ahora: Date): Promise<boolean> {
    const r = await sql`update evidencia set estado = ${e.estado}, actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                          where empresa_id = ${this.empresaId} and id = ${e.id} and estado = 'activa'`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}
