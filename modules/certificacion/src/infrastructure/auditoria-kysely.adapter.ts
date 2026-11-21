import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type {
  AlcanceDeAuditoriaEscribible,
  AuditoriaRepositoryPort,
  AyudaDeProceso,
  AyudasRepositoryPort,
  CambiosAuditoria,
  CambiosPrograma,
  CambiosProceso,
  CambiosHallazgo,
  CapituloDeAlcance,
  FilaAuditoria,
  FilaHallazgo,
  FilaInforme,
  FilaItem,
  FilaPregunta,
  HallazgoRepositoryPort,
  InformeRepositoryPort,
  ItemRepositoryPort,
  NuevoHallazgo,
  NuevoItem,
  FilaExclusion,
  FilaPrograma,
  FilaProceso,
  FilaRelacion,
  MiembroEquipo,
  NuevaAuditoria,
  NuevaExclusion,
  NuevoProceso,
  ProcesoRepositoryPort,
  ProgramaRepositoryPort,
  RelacionRepositoryPort,
} from '../application/auditoria.port.js';
import type { EstadoAuditoria, EstadoPrograma, MotivoCambioAuditoria } from '../domain/auditoria.js';
import type { ResultadoItem } from '../domain/auditoria-lista.js';
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

// --- Programa anual -----------------------------------------------------------------------------------------------------------------

interface FilaG {
  id: string;
  anio: number;
  objetivo: string;
  estado: string;
  aprobado_por: string | null;
  aprobado_en: Date | null;
  version: number;
  creado_por: string;
  creado_en: Date;
}
const COLS_PROGRAMA: Readonly<Record<keyof CambiosPrograma, string>> = {
  objetivo: 'objetivo',
  estado: 'estado',
  aprobadoPor: 'aprobado_por',
  aprobadoEn: 'aprobado_en',
};

export class ProgramaKysely implements ProgramaRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: FilaG): FilaPrograma {
    return {
      id: f.id,
      anio: f.anio,
      objetivo: f.objetivo,
      estado: f.estado as EstadoPrograma,
      aprobadoPor: f.aprobado_por,
      aprobadoEn: f.aprobado_en,
      version: f.version,
      creadoPor: f.creado_por,
      creadoEn: f.creado_en,
    };
  }

  async listar(): Promise<readonly FilaPrograma[]> {
    const r = await sql<FilaG>`select id, anio, objetivo, estado, aprobado_por, aprobado_en, version, creado_por, creado_en
      from programa_auditoria where empresa_id = ${this.empresaId} order by anio`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(id: string): Promise<FilaPrograma | null> {
    const r = await sql<FilaG>`select id, anio, objetivo, estado, aprobado_por, aprobado_en, version, creado_por, creado_en
      from programa_auditoria where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async crear(p: { id: string; anio: number; objetivo: string }, usuarioId: string, ahora: Date): Promise<boolean> {
    const r =
      await sql`insert into programa_auditoria (id, empresa_id, anio, objetivo, creado_por, creado_en, actualizado_por, actualizado_en)
                        values (${p.id}, ${this.empresaId}, ${p.anio}, ${p.objetivo}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(id: string, cambios: CambiosPrograma, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean> {
    const sets = asignaciones(cambios as Record<string, unknown>, COLS_PROGRAMA);
    const r =
      await sql`update programa_auditoria set ${sql.join([...sets, sql`version = version + 1`, sql`actualizado_por = ${usuarioId}`, sql`actualizado_en = ${ahora}`])}
                          where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async normas(programaId: string): Promise<readonly string[]> {
    const r = await sql<{ libreria_codigo: string }>`select libreria_codigo from programa_norma where empresa_id = ${this.empresaId}
      and programa_id = ${programaId} order by libreria_codigo`.execute(this.db);
    return r.rows.map((f) => f.libreria_codigo);
  }

  async fijarNormas(programaId: string, normas: readonly string[], usuarioId: string, ahora: Date): Promise<void> {
    await sql`delete from programa_norma where empresa_id = ${this.empresaId} and programa_id = ${programaId}`.execute(this.db);
    for (const n of normas)
      await sql`insert into programa_norma (empresa_id, programa_id, libreria_codigo, creado_por, creado_en)
        values (${this.empresaId}, ${programaId}, ${n}, ${usuarioId}, ${ahora}) on conflict do nothing`.execute(this.db);
  }

  async exclusiones(programaId: string): Promise<readonly FilaExclusion[]> {
    const r = await sql<{ id: string; programa_id: string; tipo: string; proceso_id: string | null; libreria_codigo: string | null; capitulo: string | null; motivo: string }>`
      select id, programa_id, tipo, proceso_id, libreria_codigo, capitulo, motivo from programa_exclusion
      where empresa_id = ${this.empresaId} and programa_id = ${programaId} order by creado_en, id`.execute(this.db);
    return r.rows.map((f) => ({
      id: f.id,
      programaId: f.programa_id,
      tipo: f.tipo as 'proceso' | 'capitulo',
      procesoId: f.proceso_id,
      libreriaCodigo: f.libreria_codigo,
      capitulo: f.capitulo,
      motivo: f.motivo,
    }));
  }

  async agregarExclusion(e: NuevaExclusion, usuarioId: string, ahora: Date): Promise<boolean> {
    const r =
      await sql`insert into programa_exclusion (id, empresa_id, programa_id, tipo, proceso_id, libreria_codigo, capitulo, motivo, creado_por, creado_en)
                        values (${e.id}, ${this.empresaId}, ${e.programaId}, ${e.tipo}, ${e.procesoId}, ${e.libreriaCodigo}, ${e.capitulo}, ${e.motivo}, ${usuarioId}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async quitarExclusion(programaId: string, id: string): Promise<boolean> {
    const r = await sql`delete from programa_exclusion where empresa_id = ${this.empresaId} and programa_id = ${programaId} and id = ${id}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}

// --- Auditorías ---------------------------------------------------------------------------------------------------------------------

interface FilaA {
  id: string;
  programa_id: string;
  anio: number;
  numero: number;
  codigo: string;
  objetivo: string;
  estado: string;
  inicio: string;
  fin: string;
  reunion_apertura: string | null;
  reunion_cierre: string | null;
  reprogramaciones: number;
  cancelacion_motivo: string | null;
  informe_emitido_en: Date | null;
  cerrada_en: Date | null;
  version: number;
  creado_por: string;
}
// Las fechas salen ya como AAAA-MM-DD (to_char) para no depender de la zona horaria del servidor.
const COLUMNAS_A = sql`id, programa_id, anio, numero, codigo, objetivo, estado, to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fin, 'YYYY-MM-DD') as fin,
  to_char(reunion_apertura, 'YYYY-MM-DD') as reunion_apertura, to_char(reunion_cierre, 'YYYY-MM-DD') as reunion_cierre, reprogramaciones,
  cancelacion_motivo, informe_emitido_en, cerrada_en, version, creado_por`;

const COLS_AUDITORIA: Readonly<Record<keyof CambiosAuditoria, string>> = {
  objetivo: 'objetivo',
  estado: 'estado',
  inicio: 'inicio',
  fin: 'fin',
  reunionApertura: 'reunion_apertura',
  reunionCierre: 'reunion_cierre',
  reprogramaciones: 'reprogramaciones',
  cancelacionMotivo: 'cancelacion_motivo',
  cancelacionNota: 'cancelacion_nota',
  informeEmitidoPor: 'informe_emitido_por',
  informeEmitidoEn: 'informe_emitido_en',
  cerradaPor: 'cerrada_por',
  cerradaEn: 'cerrada_en',
};

export class AuditoriaKysely implements AuditoriaRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private async armar(filas: readonly FilaA[]): Promise<readonly FilaAuditoria[]> {
    if (filas.length === 0) return [];
    const ids = filas.map((f) => f.id);
    const e = this.empresaId;
    const [normas, procesos, capitulos, equipo] = await Promise.all([
      sql<{ auditoria_id: string; libreria_codigo: string }>`select auditoria_id, libreria_codigo from auditoria_norma where empresa_id = ${e} and auditoria_id = any(${ids}::uuid[])`.execute(this.db),
      sql<{ auditoria_id: string; proceso_id: string }>`select auditoria_id, proceso_id from auditoria_proceso where empresa_id = ${e} and auditoria_id = any(${ids}::uuid[])`.execute(this.db),
      sql<{ auditoria_id: string; libreria_codigo: string; capitulo: string }>`select auditoria_id, libreria_codigo, capitulo from auditoria_capitulo where empresa_id = ${e} and auditoria_id = any(${ids}::uuid[]) order by libreria_codigo, capitulo`.execute(this.db),
      sql<{
        auditoria_id: string;
        usuario_id: string;
        rol: string;
        excepcion: boolean;
        excepcion_motivo: string | null;
        excepcion_medida: string | null;
        excepcion_autorizada_por: string | null;
        autoautorizada: boolean;
      }>`select auditoria_id, usuario_id, rol, excepcion, excepcion_motivo, excepcion_medida, excepcion_autorizada_por, autoautorizada
        from auditoria_equipo where empresa_id = ${e} and auditoria_id = any(${ids}::uuid[]) order by rol desc, creado_en, usuario_id`.execute(this.db),
    ]);
    return filas.map((f) => ({
      id: f.id,
      programaId: f.programa_id,
      anio: f.anio,
      numero: f.numero,
      codigo: f.codigo,
      objetivo: f.objetivo,
      estado: f.estado as EstadoAuditoria,
      inicio: f.inicio,
      fin: f.fin,
      reunionApertura: f.reunion_apertura,
      reunionCierre: f.reunion_cierre,
      reprogramaciones: f.reprogramaciones,
      cancelacionMotivo: f.cancelacion_motivo as MotivoCambioAuditoria | null,
      informeEmitidoEn: f.informe_emitido_en,
      cerradaEn: f.cerrada_en,
      version: f.version,
      creadoPor: f.creado_por,
      normas: normas.rows.filter((x) => x.auditoria_id === f.id).map((x) => x.libreria_codigo).sort(),
      procesosIds: procesos.rows.filter((x) => x.auditoria_id === f.id).map((x) => x.proceso_id).sort(),
      capitulos: capitulos.rows.filter((x) => x.auditoria_id === f.id).map((x): CapituloDeAlcance => ({ libreriaCodigo: x.libreria_codigo, capitulo: x.capitulo })),
      equipo: equipo.rows
        .filter((x) => x.auditoria_id === f.id)
        .map(
          (x): MiembroEquipo => ({
            usuarioId: x.usuario_id,
            rol: x.rol as 'lider' | 'auditor',
            excepcion: x.excepcion,
            excepcionMotivo: x.excepcion_motivo,
            excepcionMedida: x.excepcion_medida,
            excepcionAutorizadaPor: x.excepcion_autorizada_por,
            autoautorizada: x.autoautorizada,
          }),
        ),
    }));
  }

  async listar(programaId?: string): Promise<readonly FilaAuditoria[]> {
    const filtro = programaId === undefined ? sql`` : sql`and programa_id = ${programaId}`;
    const r = await sql<FilaA>`select ${COLUMNAS_A} from auditoria where empresa_id = ${this.empresaId} ${filtro} order by anio, numero`.execute(this.db);
    return this.armar(r.rows);
  }

  async obtener(id: string): Promise<FilaAuditoria | null> {
    const r = await sql<FilaA>`select ${COLUMNAS_A} from auditoria where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return (await this.armar(r.rows))[0] ?? null;
  }

  async siguienteNumero(anio: number): Promise<number> {
    const r = await sql<{ n: number }>`select coalesce(max(numero), 0)::int + 1 as n from auditoria where empresa_id = ${this.empresaId} and anio = ${anio}`.execute(this.db);
    return r.rows[0]?.n ?? 1;
  }

  async crear(a: NuevaAuditoria, usuarioId: string, ahora: Date): Promise<boolean> {
    const r =
      await sql`insert into auditoria (id, empresa_id, programa_id, anio, numero, objetivo, inicio, fin, reunion_apertura, reunion_cierre,
                          creado_por, creado_en, actualizado_por, actualizado_en)
                        values (${a.id}, ${this.empresaId}, ${a.programaId}, ${a.anio}, ${a.numero}, ${a.objetivo}, ${a.inicio}, ${a.fin}, ${a.reunionApertura}, ${a.reunionCierre},
                          ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(id: string, cambios: CambiosAuditoria, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean> {
    const sets = asignaciones(cambios as Record<string, unknown>, COLS_AUDITORIA);
    const r =
      await sql`update auditoria set ${sql.join([...sets, sql`version = version + 1`, sql`actualizado_por = ${usuarioId}`, sql`actualizado_en = ${ahora}`])}
                          where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async fijarAlcance(id: string, alcance: AlcanceDeAuditoriaEscribible, usuarioId: string, ahora: Date): Promise<void> {
    const e = this.empresaId;
    await sql`delete from auditoria_norma where empresa_id = ${e} and auditoria_id = ${id}`.execute(this.db);
    await sql`delete from auditoria_proceso where empresa_id = ${e} and auditoria_id = ${id}`.execute(this.db);
    await sql`delete from auditoria_capitulo where empresa_id = ${e} and auditoria_id = ${id}`.execute(this.db);
    for (const n of alcance.normas)
      await sql`insert into auditoria_norma (empresa_id, auditoria_id, libreria_codigo, creado_por, creado_en) values (${e}, ${id}, ${n}, ${usuarioId}, ${ahora}) on conflict do nothing`.execute(this.db);
    for (const p of alcance.procesosIds)
      await sql`insert into auditoria_proceso (empresa_id, auditoria_id, proceso_id, creado_por, creado_en) values (${e}, ${id}, ${p}, ${usuarioId}, ${ahora}) on conflict do nothing`.execute(this.db);
    for (const c of alcance.capitulos)
      await sql`insert into auditoria_capitulo (empresa_id, auditoria_id, libreria_codigo, capitulo, creado_por, creado_en) values (${e}, ${id}, ${c.libreriaCodigo}, ${c.capitulo}, ${usuarioId}, ${ahora}) on conflict do nothing`.execute(this.db);
  }

  async agregarMiembro(auditoriaId: string, m: MiembroEquipo, usuarioId: string, ahora: Date): Promise<boolean> {
    const r =
      await sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, excepcion, excepcion_motivo, excepcion_medida,
                          excepcion_autorizada_por, autoautorizada, creado_por, creado_en)
                        values (${this.empresaId}, ${auditoriaId}, ${m.usuarioId}, ${m.rol}, ${m.excepcion}, ${m.excepcionMotivo}, ${m.excepcionMedida},
                          ${m.excepcionAutorizadaPor}, ${m.autoautorizada}, ${usuarioId}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async quitarMiembro(auditoriaId: string, personaId: string): Promise<boolean> {
    const r = await sql`delete from auditoria_equipo where empresa_id = ${this.empresaId} and auditoria_id = ${auditoriaId} and usuario_id = ${personaId}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}

export class AyudasKysely implements AyudasRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async porProceso(): Promise<readonly AyudaDeProceso[]> {
    const r = await sql<{ proceso_id: string; ultima: string | null; abiertos: number }>`
      select p.id as proceso_id,
        (select to_char(max(a.fin), 'YYYY-MM-DD') from auditoria a join auditoria_proceso ap on ap.empresa_id = a.empresa_id and ap.auditoria_id = a.id
          where a.empresa_id = p.empresa_id and ap.proceso_id = p.id and a.estado = 'cerrada') as ultima,
        (select count(*)::int from hallazgo h where h.empresa_id = p.empresa_id and h.proceso_id = p.id and h.estado = 'abierto') as abiertos
      from proceso p where p.empresa_id = ${this.empresaId} and p.estado = 'vigente' order by p.numero`.execute(this.db);
    return r.rows.map((f) => ({ procesoId: f.proceso_id, ultimaAuditoria: f.ultima, hallazgosAbiertos: f.abiertos }));
  }
}

// --- Lista de verificación, hallazgos e informe -------------------------------------------------------------------------------------

interface FilaI {
  id: string;
  auditoria_id: string;
  libreria_codigo: string;
  libreria_version: string;
  id_estable: string;
  resultado: string;
  nota: string | null;
  evaluado_por: string | null;
  evaluado_en: Date | null;
  version: number;
}
const COLUMNAS_I = sql`id, auditoria_id, libreria_codigo, libreria_version, id_estable, resultado, nota, evaluado_por, evaluado_en, version`;

export class ItemKysely implements ItemRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: FilaI): FilaItem {
    return {
      id: f.id,
      auditoriaId: f.auditoria_id,
      libreriaCodigo: f.libreria_codigo,
      libreriaVersion: f.libreria_version,
      idEstable: f.id_estable,
      resultado: f.resultado as ResultadoItem,
      nota: f.nota,
      evaluadoPor: f.evaluado_por,
      evaluadoEn: f.evaluado_en,
      version: f.version,
    };
  }

  async listar(auditoriaId: string): Promise<readonly FilaItem[]> {
    const r = await sql<FilaI>`select ${COLUMNAS_I} from auditoria_item where empresa_id = ${this.empresaId} and auditoria_id = ${auditoriaId}
      order by libreria_codigo, creado_en, id_estable`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(id: string): Promise<FilaItem | null> {
    const r = await sql<FilaI>`select ${COLUMNAS_I} from auditoria_item where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async listarDeCerradas(): Promise<readonly FilaItem[]> {
    const r = await sql<FilaI>`select i.id, i.auditoria_id, i.libreria_codigo, i.libreria_version, i.id_estable, i.resultado, i.nota, i.evaluado_por, i.evaluado_en, i.version
      from auditoria_item i join auditoria a on a.empresa_id = i.empresa_id and a.id = i.auditoria_id
      where i.empresa_id = ${this.empresaId} and a.estado = 'cerrada'`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async crearVarios(items: readonly NuevoItem[], usuarioId: string, ahora: Date): Promise<void> {
    for (const n of items)
      await sql`insert into auditoria_item (id, empresa_id, auditoria_id, libreria_codigo, libreria_version, id_estable, creado_por, creado_en, actualizado_por, actualizado_en)
        values (${n.id}, ${this.empresaId}, ${n.auditoriaId}, ${n.libreriaCodigo}, ${n.libreriaVersion}, ${n.idEstable}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
        on conflict do nothing`.execute(this.db);
  }

  async quitarPorEvaluar(auditoriaId: string, claves: readonly { libreriaCodigo: string; idEstable: string }[]): Promise<number> {
    let n = 0;
    for (const k of claves) {
      const r = await sql`delete from auditoria_item where empresa_id = ${this.empresaId} and auditoria_id = ${auditoriaId} and libreria_codigo = ${k.libreriaCodigo}
        and id_estable = ${k.idEstable} and resultado = 'por_evaluar'`.execute(this.db);
      n += Number(r.numAffectedRows ?? 0n);
    }
    return n;
  }

  async evaluar(id: string, r: { resultado: ResultadoItem; nota: string | null }, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean> {
    const x = await sql`update auditoria_item set resultado = ${r.resultado}, nota = ${r.nota}, evaluado_por = ${usuarioId}, evaluado_en = ${ahora},
        version = version + 1, actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
      where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada}`.execute(this.db);
    return (x.numAffectedRows ?? 0n) === 1n;
  }

  async preguntas(auditoriaId: string): Promise<readonly FilaPregunta[]> {
    const r = await sql<{ id: string; item_id: string; texto: string }>`select p.id, p.item_id, p.texto from auditoria_pregunta p
      join auditoria_item i on i.empresa_id = p.empresa_id and i.id = p.item_id
      where p.empresa_id = ${this.empresaId} and i.auditoria_id = ${auditoriaId} order by p.creado_en, p.id`.execute(this.db);
    return r.rows.map((f) => ({ id: f.id, itemId: f.item_id, texto: f.texto }));
  }

  async agregarPregunta(p: FilaPregunta, usuarioId: string, ahora: Date): Promise<void> {
    await sql`insert into auditoria_pregunta (id, empresa_id, item_id, texto, creado_por, creado_en) values (${p.id}, ${this.empresaId}, ${p.itemId}, ${p.texto}, ${usuarioId}, ${ahora})`.execute(this.db);
  }

  async quitarPregunta(auditoriaId: string, preguntaId: string): Promise<boolean> {
    const r = await sql`delete from auditoria_pregunta p using auditoria_item i where p.empresa_id = ${this.empresaId} and p.id = ${preguntaId}
      and i.empresa_id = p.empresa_id and i.id = p.item_id and i.auditoria_id = ${auditoriaId}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}

interface FilaH {
  id: string;
  auditoria_id: string;
  item_id: string | null;
  numero: number;
  codigo: string;
  tipo: string;
  proceso_id: string | null;
  libreria_codigo: string | null;
  id_estable: string | null;
  enunciado: string;
  evidencia: string;
  justificacion_gravedad: string | null;
  estado: string;
  anulacion_motivo: string | null;
  registrado_por: string;
  version: number;
}
const COLUMNAS_H = sql`id, auditoria_id, item_id, numero, codigo, tipo, proceso_id, libreria_codigo, id_estable, enunciado, evidencia, justificacion_gravedad,
  estado, anulacion_motivo, registrado_por, version`;
const COLS_HALLAZGO: Readonly<Record<keyof CambiosHallazgo, string>> = {
  tipo: 'tipo',
  procesoId: 'proceso_id',
  libreriaCodigo: 'libreria_codigo',
  idEstable: 'id_estable',
  enunciado: 'enunciado',
  evidencia: 'evidencia',
  justificacionGravedad: 'justificacion_gravedad',
  estado: 'estado',
  anulacionMotivo: 'anulacion_motivo',
  anuladoPor: 'anulado_por',
  anuladoEn: 'anulado_en',
};

export class HallazgoKysely implements HallazgoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: FilaH): FilaHallazgo {
    return {
      id: f.id,
      auditoriaId: f.auditoria_id,
      itemId: f.item_id,
      numero: f.numero,
      codigo: f.codigo,
      tipo: f.tipo as FilaHallazgo['tipo'],
      procesoId: f.proceso_id,
      libreriaCodigo: f.libreria_codigo,
      idEstable: f.id_estable,
      enunciado: f.enunciado,
      evidencia: f.evidencia,
      justificacionGravedad: f.justificacion_gravedad,
      estado: f.estado as FilaHallazgo['estado'],
      anulacionMotivo: f.anulacion_motivo as FilaHallazgo['anulacionMotivo'],
      registradoPor: f.registrado_por,
      version: f.version,
    };
  }

  async listar(auditoriaId: string): Promise<readonly FilaHallazgo[]> {
    const r = await sql<FilaH>`select ${COLUMNAS_H} from hallazgo where empresa_id = ${this.empresaId} and auditoria_id = ${auditoriaId} order by numero`.execute(this.db);
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(id: string): Promise<FilaHallazgo | null> {
    const r = await sql<FilaH>`select ${COLUMNAS_H} from hallazgo where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async siguienteNumero(auditoriaId: string): Promise<number> {
    const r = await sql<{ n: number }>`select coalesce(max(numero), 0)::int + 1 as n from hallazgo where empresa_id = ${this.empresaId} and auditoria_id = ${auditoriaId}`.execute(this.db);
    return r.rows[0]?.n ?? 1;
  }

  async crear(h: NuevoHallazgo, usuarioId: string, ahora: Date): Promise<boolean> {
    const r =
      await sql`insert into hallazgo (id, empresa_id, auditoria_id, item_id, numero, tipo, proceso_id, libreria_codigo, id_estable, enunciado, evidencia,
                          justificacion_gravedad, registrado_por, creado_por, creado_en, actualizado_por, actualizado_en)
                        values (${h.id}, ${this.empresaId}, ${h.auditoriaId}, ${h.itemId}, ${h.numero}, ${h.tipo}, ${h.procesoId}, ${h.libreriaCodigo}, ${h.idEstable}, ${h.enunciado}, ${h.evidencia},
                          ${h.justificacionGravedad}, ${usuarioId}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(id: string, cambios: CambiosHallazgo, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean> {
    const sets = asignaciones(cambios as Record<string, unknown>, COLS_HALLAZGO);
    const r =
      await sql`update hallazgo set ${sql.join([...sets, sql`version = version + 1`, sql`actualizado_por = ${usuarioId}`, sql`actualizado_en = ${ahora}`])}
                          where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}

export class InformeKysely implements InformeRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async obtener(auditoriaId: string): Promise<FilaInforme | null> {
    const r = await sql<{ id: string; auditoria_id: string; contenido: unknown; huella: string; emitido_por: string; emitido_en: Date }>`
      select id, auditoria_id, contenido, huella, emitido_por, emitido_en from auditoria_informe where empresa_id = ${this.empresaId} and auditoria_id = ${auditoriaId}`.execute(this.db);
    const f = r.rows[0];
    return f ? { id: f.id, auditoriaId: f.auditoria_id, contenido: f.contenido, huella: f.huella, emitidoPor: f.emitido_por, emitidoEn: f.emitido_en } : null;
  }

  async crear(i: { id: string; auditoriaId: string; contenido: unknown; huella: string }, usuarioId: string, ahora: Date): Promise<boolean> {
    const r =
      await sql`insert into auditoria_informe (id, empresa_id, auditoria_id, contenido, huella, emitido_por, emitido_en)
                        values (${i.id}, ${this.empresaId}, ${i.auditoriaId}, ${JSON.stringify(i.contenido)}::jsonb, ${i.huella}, ${usuarioId}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}
