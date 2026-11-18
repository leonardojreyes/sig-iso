import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { FilaDeclaracion } from '../domain/declaracion.js';
import type { CopiaJustificacion, DeclaracionRepositoryPort, VersionDeclaracion } from '../application/repositorios.port.js';
import type { ViaRiesgo, TipoMotivo } from '../domain/declaracion.js';
import type { DecisionTratamiento, NivelRiesgo } from '../domain/riesgo.js';
import type { TipoReferencia } from '../domain/referencia-tratamiento.js';

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
  escala_max: number | null;
  corte_medio: number | null;
  corte_alto: number | null;
  corte_critico: number | null;
  con_motivo: number | null;
  riesgos_vigentes: number | null;
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

/** Las versiones anteriores a la Declaración justificada tienen la escala y los conteos en nulo: `justificacion` es nula. */
const aVersion = (f: FilaVersion): VersionDeclaracion => ({
  id: f.id, numero: f.numero, alcanceTexto: f.alcance_texto, total: f.total, aplican: f.aplican, noAplican: f.no_aplican, sinControl: f.sin_control, aprobadaPor: f.aprobada_por, aprobadaEn: f.aprobada_en,
  justificacion:
    f.escala_max === null
      ? null
      : { escala: { escalaMax: f.escala_max, corteMedio: f.corte_medio as number, corteAlto: f.corte_alto as number, corteCritico: f.corte_critico as number }, conMotivo: f.con_motivo as number, riesgosVigentes: f.riesgos_vigentes as number },
});
const COLUMNAS = sql`id, numero, alcance_texto, total, aplican, no_aplican, sin_control, aprobada_por, aprobada_en, escala_max, corte_medio, corte_alto, corte_critico, con_motivo, riesgos_vigentes`;

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

  async crear(v: VersionDeclaracion, filas: readonly FilaDeclaracion[], copia?: CopiaJustificacion): Promise<boolean> {
    const j = v.justificacion ?? null;
    if ((j === null) !== (copia === undefined)) throw new Error('La versión y su copia de justificación van juntas.');
    const r = await sql`insert into declaracion_version (id, empresa_id, numero, alcance_texto, total, aplican, no_aplican, sin_control, aprobada_por, aprobada_en, escala_max, corte_medio, corte_alto, corte_critico, con_motivo, riesgos_vigentes)
                          values (${v.id}, ${this.empresaId}, ${v.numero}, ${v.alcanceTexto}, ${v.total}, ${v.aplican}, ${v.noAplican}, ${v.sinControl}, ${v.aprobadaPor}, ${v.aprobadaEn},
                                  ${j?.escala.escalaMax ?? null}, ${j?.escala.corteMedio ?? null}, ${j?.escala.corteAlto ?? null}, ${j?.escala.corteCritico ?? null}, ${j?.conMotivo ?? null}, ${j?.riesgosVigentes ?? null})
                          on conflict (empresa_id, numero) do nothing`.execute(this.db);
    if ((r.numAffectedRows ?? 0n) !== 1n) return false;
    for (const f of filas) {
      await sql`insert into declaracion_fila (empresa_id, version_id, libreria_codigo, id_estable, orden, titulo, grupo, aplicabilidad, implementacion, justificacion, controles, cobertura)
                values (${this.empresaId}, ${v.id}, ${f.libreriaCodigo}, ${f.idEstable}, ${f.orden}, ${f.titulo}, ${f.grupo}, ${f.aplicabilidad}, ${f.implementacion}, ${f.justificacion}, ${sql.val([...f.controles])}, ${f.cobertura})`.execute(this.db);
    }
    if (copia) await this.guardarCopia(v.id, copia);
    return true;
  }

  /** Copia inmutable de lo que justifica la versión: se inserta dentro de la misma transacción que la versión y sus filas. */
  private async guardarCopia(versionId: string, c: CopiaJustificacion): Promise<void> {
    for (const r of c.riesgos) {
      await sql`insert into declaracion_riesgo (empresa_id, version_id, codigo, titulo, probabilidad, impacto, nivel, decision, responsable_id, controles)
                values (${this.empresaId}, ${versionId}, ${r.codigo}, ${r.titulo}, ${r.probabilidad}, ${r.impacto}, ${r.nivel}, ${r.decision}, ${r.responsableId}, ${sql.val([...r.controles])})`.execute(this.db);
    }
    for (const m of c.motivos) {
      await sql`insert into declaracion_motivo (empresa_id, version_id, libreria_codigo, id_estable, tipo, nota)
                values (${this.empresaId}, ${versionId}, ${m.libreriaCodigo}, ${m.idEstable}, ${m.tipo}, ${m.nota})`.execute(this.db);
    }
    for (const x of c.riesgosPorFila) {
      await sql`insert into declaracion_fila_riesgo (empresa_id, version_id, libreria_codigo, id_estable, riesgo_codigo, via)
                values (${this.empresaId}, ${versionId}, ${x.libreriaCodigo}, ${x.idEstable}, ${x.riesgoCodigo}, ${x.via})`.execute(this.db);
    }
    for (const f of c.referencias) {
      await sql`insert into declaracion_referencia (empresa_id, version_id, tipo, titulo, version_doc, fecha, ubicacion)
                values (${this.empresaId}, ${versionId}, ${f.tipo}, ${f.titulo}, ${f.versionDoc}, ${f.fecha}::date, ${f.ubicacion})`.execute(this.db);
    }
  }

  async listarVersiones(): Promise<readonly VersionDeclaracion[]> {
    const r = await sql<FilaVersion>`select ${COLUMNAS} from declaracion_version where empresa_id = ${this.empresaId} order by numero desc`.execute(this.db);
    return r.rows.map(aVersion);
  }

  async obtener(id: string): Promise<{ readonly version: VersionDeclaracion; readonly filas: readonly FilaDeclaracion[]; readonly copia: CopiaJustificacion | null } | null> {
    const v = await sql<FilaVersion>`select ${COLUMNAS} from declaracion_version where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    const fila = v.rows[0];
    if (!fila) return null;
    const f = await sql<FilaFila>`select libreria_codigo, id_estable, orden, titulo, grupo, aplicabilidad, implementacion, justificacion, controles, cobertura
                                    from declaracion_fila where empresa_id = ${this.empresaId} and version_id = ${id} order by libreria_codigo, orden, id_estable`.execute(this.db);
    return {
      version: aVersion(fila),
      filas: f.rows.map((x) => ({ libreriaCodigo: x.libreria_codigo, idEstable: x.id_estable, orden: x.orden, titulo: x.titulo, grupo: x.grupo, aplicabilidad: x.aplicabilidad, implementacion: x.implementacion, justificacion: x.justificacion, controles: x.controles, cobertura: x.cobertura })),
      copia: fila.escala_max === null ? null : await this.leerCopia(id),
    };
  }

  private async leerCopia(versionId: string): Promise<CopiaJustificacion> {
    const riesgos = await sql<{ codigo: string; titulo: string; probabilidad: number; impacto: number; nivel: string; decision: string; responsable_id: string | null; controles: string[] }>`
      select codigo, titulo, probabilidad, impacto, nivel, decision, responsable_id, controles from declaracion_riesgo
      where empresa_id = ${this.empresaId} and version_id = ${versionId} order by codigo`.execute(this.db);
    const motivos = await sql<{ libreria_codigo: string; id_estable: string; tipo: string; nota: string }>`
      select libreria_codigo, id_estable, tipo, nota from declaracion_motivo
      where empresa_id = ${this.empresaId} and version_id = ${versionId} order by libreria_codigo, id_estable, tipo`.execute(this.db);
    const vinculos = await sql<{ libreria_codigo: string; id_estable: string; riesgo_codigo: string; via: string }>`
      select libreria_codigo, id_estable, riesgo_codigo, via from declaracion_fila_riesgo
      where empresa_id = ${this.empresaId} and version_id = ${versionId} order by libreria_codigo, id_estable, riesgo_codigo, via`.execute(this.db);
    const referencias = await sql<{ tipo: string; titulo: string; version_doc: string; fecha: string; ubicacion: string }>`
      select tipo, titulo, version_doc, to_char(fecha, 'YYYY-MM-DD') as fecha, ubicacion from declaracion_referencia
      where empresa_id = ${this.empresaId} and version_id = ${versionId} order by tipo`.execute(this.db);
    return {
      riesgos: riesgos.rows.map((r) => ({ codigo: r.codigo, titulo: r.titulo, probabilidad: r.probabilidad, impacto: r.impacto, nivel: r.nivel as NivelRiesgo, decision: r.decision as DecisionTratamiento, responsableId: r.responsable_id, controles: r.controles })),
      motivos: motivos.rows.map((m) => ({ libreriaCodigo: m.libreria_codigo, idEstable: m.id_estable, tipo: m.tipo as TipoMotivo, nota: m.nota })),
      riesgosPorFila: vinculos.rows.map((x) => ({ libreriaCodigo: x.libreria_codigo, idEstable: x.id_estable, riesgoCodigo: x.riesgo_codigo, via: x.via as ViaRiesgo })),
      referencias: referencias.rows.map((f) => ({ tipo: f.tipo as TipoReferencia, titulo: f.titulo, versionDoc: f.version_doc, fecha: f.fecha, ubicacion: f.ubicacion })),
    };
  }
}
