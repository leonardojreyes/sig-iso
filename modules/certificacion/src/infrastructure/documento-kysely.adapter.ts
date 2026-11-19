import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Clasificacion, EstadoVersion, MotivoDevolucion, TipoDocumento } from '../domain/documento.js';
import type { TipoArchivo } from '../domain/tipo-archivo.js';
import type {
  CambiosDocumento,
  CambiosVersion,
  DestinatarioRepositoryPort,
  DirectorioPersonasPort,
  DocumentoRepositoryPort,
  FilaDocumento,
  FilaRetencion,
  FilaVersion,
  LecturaDeVersion,
  LecturaPendiente,
  LecturaRepositoryPort,
  NuevaVersion,
  NuevoDocumento,
  PersonaDirectorio,
  RetencionRepositoryPort,
  VersionDocumentoRepositoryPort,
  VinculoDocumentoRepositoryPort,
} from '../application/documentos.port.js';

// Control documental sobre PostgreSQL (ADR 039). Cada repositorio recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y
// además filtra por `empresa_id` (defensa en profundidad). La aplicación no puede borrar documentos ni versiones y solo cambia las
// columnas de estado (permiso por columna, migraciones 0021 y 0022).

/** Arma `col = valor, …` solo con lo que cambia; las claves son nombres fijos del código, nunca del cliente. */
const asignaciones = (cambios: Readonly<Record<string, unknown>>, columnas: Readonly<Record<string, string>>): RawBuilder<unknown>[] =>
  Object.entries(cambios)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const columna = columnas[k];
      if (!columna) throw new Error(`Columna no permitida: ${k}`);
      return sql`${sql.ref(columna)} = ${v}`;
    });

interface FilaD {
  id: string;
  tipo: string;
  numero: number;
  codigo: string;
  titulo: string;
  area: string | null;
  clasificacion: string;
  responsable_id: string;
  emisor: string | null;
  edicion_fuente: string | null;
  estado: string;
  proxima_revision: string | null;
  ultima_revision_en: Date | null;
  ultima_revision_por: string | null;
  version: number;
  creado_por: string;
  creado_en: Date;
}

// Las fechas salen ya como AAAA-MM-DD (to_char) para no depender de la zona horaria del servidor.
const COLUMNAS_D = sql`id, tipo, numero, codigo, titulo, area, clasificacion, responsable_id, emisor, edicion_fuente, estado,
  to_char(proxima_revision, 'YYYY-MM-DD') as proxima_revision, ultima_revision_en, ultima_revision_por, version, creado_por, creado_en`;

const COLS_DOCUMENTO: Readonly<Record<keyof CambiosDocumento, string>> = {
  titulo: 'titulo',
  area: 'area',
  clasificacion: 'clasificacion',
  responsableId: 'responsable_id',
  emisor: 'emisor',
  edicionFuente: 'edicion_fuente',
  estado: 'estado',
  proximaRevision: 'proxima_revision',
  ultimaRevisionEn: 'ultima_revision_en',
  ultimaRevisionPor: 'ultima_revision_por',
};

export class DocumentoKysely implements DocumentoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: FilaD): FilaDocumento {
    return {
      id: f.id,
      tipo: f.tipo as TipoDocumento,
      numero: f.numero,
      codigo: f.codigo,
      titulo: f.titulo,
      area: f.area,
      clasificacion: f.clasificacion as Clasificacion,
      responsableId: f.responsable_id,
      emisor: f.emisor,
      edicionFuente: f.edicion_fuente,
      estado: f.estado as 'activo' | 'retirado',
      proximaRevision: f.proxima_revision,
      ultimaRevisionEn: f.ultima_revision_en,
      ultimaRevisionPor: f.ultima_revision_por,
      version: f.version,
      creadoPor: f.creado_por,
      creadoEn: f.creado_en,
    };
  }

  async listar(): Promise<readonly FilaDocumento[]> {
    const r = await sql<FilaD>`select ${COLUMNAS_D} from documento where empresa_id = ${this.empresaId} order by tipo, numero`.execute(
      this.db,
    );
    return r.rows.map((f) => this.aDominio(f));
  }

  async obtener(id: string): Promise<FilaDocumento | null> {
    const r = await sql<FilaD>`select ${COLUMNAS_D} from documento where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async siguienteNumero(tipo: TipoDocumento): Promise<number> {
    const r = await sql<{
      n: number;
    }>`select coalesce(max(numero), 0)::int + 1 as n from documento where empresa_id = ${this.empresaId} and tipo = ${tipo}`.execute(
      this.db,
    );
    return r.rows[0]?.n ?? 1;
  }

  async crear(d: NuevoDocumento, usuarioId: string, ahora: Date): Promise<boolean> {
    const r =
      await sql`insert into documento (id, empresa_id, tipo, numero, titulo, area, clasificacion, responsable_id, emisor, edicion_fuente,
                          creado_por, creado_en, actualizado_por, actualizado_en)
                        values (${d.id}, ${this.empresaId}, ${d.tipo}, ${d.numero}, ${d.titulo}, ${d.area}, ${d.clasificacion}, ${d.responsableId}, ${d.emisor}, ${d.edicionFuente},
                          ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                        on conflict (empresa_id, tipo, numero) do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(id: string, cambios: CambiosDocumento, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean> {
    const sets = asignaciones(cambios as Record<string, unknown>, COLS_DOCUMENTO);
    const r =
      await sql`update documento set ${sql.join([...sets, sql`version = version + 1`, sql`actualizado_por = ${usuarioId}`, sql`actualizado_en = ${ahora}`])}
                          where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}

interface FilaV {
  id: string;
  documento_id: string;
  numero: number;
  estado: string;
  nota: string;
  archivo_id: string;
  archivo_nombre: string;
  archivo_tipo: string;
  archivo_bytes: number;
  archivo_sha256: string;
  autor_id: string;
  aprobador_id: string | null;
  enviada_en: Date | null;
  aprobada_por: string | null;
  aprobada_en: Date | null;
  por_su_autor: boolean;
  motivo_excepcion: string | null;
  requiere_lectura: boolean;
  devuelta_motivo: string | null;
  devuelta_nota: string | null;
  obsoleta_en: Date | null;
  version: number;
  creado_en: Date;
}

const COLUMNAS_V = sql`id, documento_id, numero, estado, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes::int as archivo_bytes, archivo_sha256,
  autor_id, aprobador_id, enviada_en, aprobada_por, aprobada_en, por_su_autor, motivo_excepcion, requiere_lectura, devuelta_motivo, devuelta_nota,
  obsoleta_en, version, creado_en`;

const COLS_VERSION: Readonly<Record<keyof CambiosVersion, string>> = {
  estado: 'estado',
  aprobadorId: 'aprobador_id',
  enviadaEn: 'enviada_en',
  aprobadaPor: 'aprobada_por',
  aprobadaEn: 'aprobada_en',
  porSuAutor: 'por_su_autor',
  motivoExcepcion: 'motivo_excepcion',
  requiereLectura: 'requiere_lectura',
  devueltaMotivo: 'devuelta_motivo',
  devueltaNota: 'devuelta_nota',
  obsoletaEn: 'obsoleta_en',
};

export class VersionDocumentoKysely implements VersionDocumentoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  private aDominio(f: FilaV): FilaVersion {
    return {
      id: f.id,
      documentoId: f.documento_id,
      numero: f.numero,
      estado: f.estado as EstadoVersion,
      nota: f.nota,
      archivo: {
        id: f.archivo_id,
        nombre: f.archivo_nombre,
        tipo: f.archivo_tipo as TipoArchivo,
        bytes: f.archivo_bytes,
        sha256: f.archivo_sha256,
      },
      autorId: f.autor_id,
      aprobadorId: f.aprobador_id,
      enviadaEn: f.enviada_en,
      aprobadaPor: f.aprobada_por,
      aprobadaEn: f.aprobada_en,
      porSuAutor: f.por_su_autor,
      motivoExcepcion: f.motivo_excepcion,
      requiereLectura: f.requiere_lectura,
      devueltaMotivo: f.devuelta_motivo as MotivoDevolucion | null,
      devueltaNota: f.devuelta_nota,
      obsoletaEn: f.obsoleta_en,
      version: f.version,
      creadaEn: f.creado_en,
    };
  }

  async obtener(id: string): Promise<FilaVersion | null> {
    const r = await sql<FilaV>`select ${COLUMNAS_V} from documento_version where empresa_id = ${this.empresaId} and id = ${id}`.execute(
      this.db,
    );
    return r.rows[0] ? this.aDominio(r.rows[0]) : null;
  }

  async listarDeDocumento(documentoId: string): Promise<readonly FilaVersion[]> {
    const r =
      await sql<FilaV>`select ${COLUMNAS_V} from documento_version where empresa_id = ${this.empresaId} and documento_id = ${documentoId} order by numero desc`.execute(
        this.db,
      );
    return r.rows.map((f) => this.aDominio(f));
  }

  async listarVigentes(): Promise<readonly FilaVersion[]> {
    const r =
      await sql<FilaV>`select ${COLUMNAS_V} from documento_version where empresa_id = ${this.empresaId} and estado = 'aprobada'`.execute(
        this.db,
      );
    return r.rows.map((f) => this.aDominio(f));
  }

  async listarObsoletas(): Promise<readonly FilaVersion[]> {
    const r =
      await sql<FilaV>`select ${COLUMNAS_V} from documento_version where empresa_id = ${this.empresaId} and estado = 'obsoleta'`.execute(
        this.db,
      );
    return r.rows.map((f) => this.aDominio(f));
  }

  async siguienteNumero(documentoId: string): Promise<number> {
    // Bloquea la fila del documento hasta el fin de la transacción: dos subidas a la vez se turnan y no repiten número.
    await sql`select 1 from documento where empresa_id = ${this.empresaId} and id = ${documentoId} for update`.execute(this.db);
    const r = await sql<{
      n: number;
    }>`select coalesce(max(numero), 0)::int + 1 as n from documento_version where empresa_id = ${this.empresaId} and documento_id = ${documentoId}`.execute(
      this.db,
    );
    return r.rows[0]?.n ?? 1;
  }

  async crear(v: NuevaVersion, usuarioId: string, ahora: Date): Promise<boolean> {
    const a = v.archivo;
    const r =
      await sql`insert into documento_version (id, empresa_id, documento_id, numero, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256,
                          autor_id, creado_por, creado_en, actualizado_por, actualizado_en)
                        values (${v.id}, ${this.empresaId}, ${v.documentoId}, ${v.numero}, ${v.nota}, ${a.id}, ${a.nombre}, ${a.tipo}, ${a.bytes}, ${a.sha256},
                          ${usuarioId}, ${usuarioId}, ${ahora}, ${usuarioId}, ${ahora})
                        on conflict do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(id: string, cambios: CambiosVersion, versionEsperada: number, usuarioId: string, ahora: Date): Promise<boolean> {
    const sets = asignaciones(cambios as Record<string, unknown>, COLS_VERSION);
    const r =
      await sql`update documento_version set ${sql.join([...sets, sql`version = version + 1`, sql`actualizado_por = ${usuarioId}`, sql`actualizado_en = ${ahora}`])}
                          where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada}`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async obsoletizarVigente(documentoId: string, ahora: Date, usuarioId: string): Promise<string | null> {
    const r = await sql<{
      id: string;
    }>`update documento_version set estado = 'obsoleta', obsoleta_en = ${ahora}, version = version + 1, actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                                          where empresa_id = ${this.empresaId} and documento_id = ${documentoId} and estado = 'aprobada' returning id`.execute(
      this.db,
    );
    return r.rows[0]?.id ?? null;
  }
}

export class DestinatarioKysely implements DestinatarioRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listar(documentoId: string): Promise<readonly string[]> {
    const r = await sql<{
      usuario_id: string;
    }>`select usuario_id from documento_destinatario where empresa_id = ${this.empresaId} and documento_id = ${documentoId} order by usuario_id`.execute(
      this.db,
    );
    return r.rows.map((f) => f.usuario_id);
  }

  async reemplazar(documentoId: string, usuarioIds: readonly string[], usuarioId: string): Promise<void> {
    await sql`delete from documento_destinatario where empresa_id = ${this.empresaId} and documento_id = ${documentoId}`.execute(this.db);
    for (const u of usuarioIds)
      await sql`insert into documento_destinatario (empresa_id, documento_id, usuario_id, creado_por) values (${this.empresaId}, ${documentoId}, ${u}, ${usuarioId}) on conflict do nothing`.execute(
        this.db,
      );
  }
}

export class LecturaKysely implements LecturaRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async crearPendientes(versionId: string, usuarioIds: readonly string[]): Promise<void> {
    for (const u of usuarioIds)
      await sql`insert into documento_lectura (empresa_id, version_id, usuario_id) values (${this.empresaId}, ${versionId}, ${u}) on conflict do nothing`.execute(
        this.db,
      );
  }

  private aDominio(f: { version_id: string; usuario_id: string; confirmada_en: Date | null }): LecturaDeVersion {
    return { versionId: f.version_id, usuarioId: f.usuario_id, confirmadaEn: f.confirmada_en };
  }

  async listarDeVersion(versionId: string): Promise<readonly LecturaDeVersion[]> {
    const r = await sql<{
      version_id: string;
      usuario_id: string;
      confirmada_en: Date | null;
    }>`select version_id, usuario_id, confirmada_en from documento_lectura where empresa_id = ${this.empresaId} and version_id = ${versionId}`.execute(
      this.db,
    );
    return r.rows.map((f) => this.aDominio(f));
  }

  async listarDeVersiones(versionIds: readonly string[]): Promise<readonly LecturaDeVersion[]> {
    if (versionIds.length === 0) return [];
    const r = await sql<{
      version_id: string;
      usuario_id: string;
      confirmada_en: Date | null;
    }>`select version_id, usuario_id, confirmada_en from documento_lectura
                                                                                                  where empresa_id = ${this.empresaId} and version_id in (${sql.join(versionIds.map((v) => sql`${v}`))})`.execute(
      this.db,
    );
    return r.rows.map((f) => this.aDominio(f));
  }

  async confirmar(versionId: string, usuarioId: string, ahora: Date): Promise<boolean> {
    // Solo si estaba pendiente: la fecha de una lectura ya confirmada no se reescribe.
    const r = await sql`update documento_lectura set confirmada_en = ${ahora}
                          where empresa_id = ${this.empresaId} and version_id = ${versionId} and usuario_id = ${usuarioId} and confirmada_en is null`.execute(
      this.db,
    );
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async pendientesDe(usuarioId: string): Promise<readonly LecturaPendiente[]> {
    const r = await sql<{ version_id: string; documento_id: string; codigo: string; titulo: string; numero: number }>`
      select l.version_id, d.id as documento_id, d.codigo, d.titulo, v.numero
        from documento_lectura l
        join documento_version v on v.empresa_id = l.empresa_id and v.id = l.version_id and v.estado = 'aprobada'
        join documento d on d.empresa_id = v.empresa_id and d.id = v.documento_id and d.estado = 'activo'
       where l.empresa_id = ${this.empresaId} and l.usuario_id = ${usuarioId} and l.confirmada_en is null
       order by d.codigo`.execute(this.db);
    return r.rows.map((f) => ({
      versionId: f.version_id,
      documentoId: f.documento_id,
      codigo: f.codigo,
      titulo: f.titulo,
      numeroVersion: f.numero,
    }));
  }
}

export class VinculoDocumentoKysely implements VinculoDocumentoRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listarControles(documentoId: string): Promise<readonly string[]> {
    const r = await sql<{
      control_id: string;
    }>`select control_id from documento_control where empresa_id = ${this.empresaId} and documento_id = ${documentoId} order by control_id`.execute(
      this.db,
    );
    return r.rows.map((f) => f.control_id);
  }

  async listarEntradas(documentoId: string): Promise<readonly { libreriaCodigo: string; idEstable: string }[]> {
    const r = await sql<{
      libreria_codigo: string;
      id_estable: string;
    }>`select libreria_codigo, id_estable from documento_entrada where empresa_id = ${this.empresaId} and documento_id = ${documentoId} order by libreria_codigo, id_estable`.execute(
      this.db,
    );
    return r.rows.map((f) => ({ libreriaCodigo: f.libreria_codigo, idEstable: f.id_estable }));
  }

  async listarTodasEntradas(): Promise<readonly { documentoId: string; libreriaCodigo: string; idEstable: string }[]> {
    const r = await sql<{
      documento_id: string;
      libreria_codigo: string;
      id_estable: string;
    }>`select documento_id, libreria_codigo, id_estable from documento_entrada where empresa_id = ${this.empresaId}`.execute(this.db);
    return r.rows.map((f) => ({ documentoId: f.documento_id, libreriaCodigo: f.libreria_codigo, idEstable: f.id_estable }));
  }

  async agregarControl(documentoId: string, controlId: string, usuarioId: string): Promise<boolean> {
    const r =
      await sql`insert into documento_control (empresa_id, documento_id, control_id, creado_por) values (${this.empresaId}, ${documentoId}, ${controlId}, ${usuarioId}) on conflict do nothing`.execute(
        this.db,
      );
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async quitarControl(documentoId: string, controlId: string): Promise<boolean> {
    const r =
      await sql`delete from documento_control where empresa_id = ${this.empresaId} and documento_id = ${documentoId} and control_id = ${controlId}`.execute(
        this.db,
      );
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async agregarEntrada(documentoId: string, libreriaCodigo: string, idEstable: string, usuarioId: string): Promise<boolean> {
    const r =
      await sql`insert into documento_entrada (empresa_id, documento_id, libreria_codigo, id_estable, creado_por) values (${this.empresaId}, ${documentoId}, ${libreriaCodigo}, ${idEstable}, ${usuarioId}) on conflict do nothing`.execute(
        this.db,
      );
    return (r.numAffectedRows ?? 0n) === 1n;
  }

  async quitarEntrada(documentoId: string, libreriaCodigo: string, idEstable: string): Promise<boolean> {
    const r =
      await sql`delete from documento_entrada where empresa_id = ${this.empresaId} and documento_id = ${documentoId} and libreria_codigo = ${libreriaCodigo} and id_estable = ${idEstable}`.execute(
        this.db,
      );
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}

export class RetencionKysely implements RetencionRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listar(): Promise<readonly FilaRetencion[]> {
    const r = await sql<{
      tipo: string;
      anios: number;
      motivo: string;
      version: number;
    }>`select tipo, anios::int as anios, motivo, version from retencion_tipo where empresa_id = ${this.empresaId} order by tipo`.execute(
      this.db,
    );
    return r.rows.map((f) => ({ tipo: f.tipo as TipoDocumento, anios: f.anios, motivo: f.motivo, version: f.version }));
  }

  async crear(r: Omit<FilaRetencion, 'version'>, usuarioId: string, ahora: Date): Promise<boolean> {
    const x =
      await sql`insert into retencion_tipo (empresa_id, tipo, anios, motivo, actualizado_por, actualizado_en) values (${this.empresaId}, ${r.tipo}, ${r.anios}, ${r.motivo}, ${usuarioId}, ${ahora})
                          on conflict do nothing`.execute(this.db);
    return (x.numAffectedRows ?? 0n) === 1n;
  }

  async actualizar(
    tipo: TipoDocumento,
    anios: number,
    motivo: string,
    versionEsperada: number,
    usuarioId: string,
    ahora: Date,
  ): Promise<boolean> {
    const x =
      await sql`update retencion_tipo set anios = ${anios}, motivo = ${motivo}, version = version + 1, actualizado_por = ${usuarioId}, actualizado_en = ${ahora}
                          where empresa_id = ${this.empresaId} and tipo = ${tipo} and version = ${versionEsperada}`.execute(this.db);
    return (x.numAffectedRows ?? 0n) === 1n;
  }
}

/**
 * Las personas de la empresa de la sesión, leídas de `usuario` con la empresa fijada y la RLS. Solo identificador, nombre, rol y si está
 * activa (con rol y sin baja); nunca el correo. El módulo no importa código de otros módulos (ADR 039).
 */
export class DirectorioPersonasKysely implements DirectorioPersonasPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async listar(): Promise<readonly PersonaDirectorio[]> {
    const r = await sql<{
      id: string;
      nombre: string;
      rol: string | null;
      baja_en: Date | null;
    }>`select id, nombre, rol, baja_en from usuario where empresa_id = ${this.empresaId} order by nombre limit 1000`.execute(this.db);
    return r.rows.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol, activa: f.rol !== null && f.baja_en === null }));
  }
}
