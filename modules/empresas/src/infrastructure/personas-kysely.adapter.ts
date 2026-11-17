// Adaptadores de PersonasRepositoryPort y SolicitudesRepositoryPort sobre PostgreSQL (ADR 036, migración 0015). Reciben la TRANSACCIÓN de
// una unidad de trabajo con la empresa fijada: la RLS de `usuario` y `solicitud_acceso` solo deja ver y cambiar lo de ESA empresa, y cada
// consulta además filtra por `empresa_id` (defensa en profundidad). La aplicación no puede borrar nada ni cambiar la identidad.
import type { Rol } from '@sig/autorizacion';
import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { PersonaDto, PersonasRepositoryPort, SolicitudDto, SolicitudesRepositoryPort } from '../application/personas.port.js';

interface FilaPersona {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol | null;
  baja_en: Date | null;
  version: number;
}
interface FilaSolicitud {
  id: string;
  usuario_id: string;
  codigo: string;
  creada_en: Date;
  vence_en: Date;
}

const persona = (f: FilaPersona): PersonaDto => ({
  id: f.id,
  nombre: f.nombre,
  correo: f.correo,
  rol: f.rol,
  bajaEn: f.baja_en,
  version: f.version,
});
const solicitud = (f: FilaSolicitud): SolicitudDto => ({
  id: f.id,
  usuarioId: f.usuario_id,
  codigo: f.codigo,
  creadaEn: f.creada_en,
  venceEn: f.vence_en,
});
const filas = (r: { numAffectedRows?: bigint | undefined }): number => Number(r.numAffectedRows ?? 0);

export class PersonasKysely implements PersonasRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async obtener(id: string): Promise<PersonaDto | null> {
    const { rows } = await sql<FilaPersona>`
      select id, nombre, correo, rol, baja_en, version from usuario where empresa_id = ${this.empresaId} and id = ${id}`.execute(this.db);
    return rows[0] ? persona(rows[0]) : null;
  }

  async listar(): Promise<readonly PersonaDto[]> {
    const { rows } = await sql<FilaPersona>`
      select id, nombre, correo, rol, baja_en, version from usuario where empresa_id = ${this.empresaId} order by nombre, id limit 1000`.execute(
      this.db,
    );
    return rows.map(persona);
  }

  // Bloquea las filas de los administradores (`for no key update`, el bloqueo MÁS DÉBIL que basta: el `update` de `rol` pide el mismo, y no
  // estorba a quien solo referencia a esa persona por una clave foránea —autoría de alcances, controles, evidencias—, que toma `for key share`):
  // dos bajas o cambios de rol simultáneos esperan uno al otro, así el segundo
  // ya ve que queda uno solo y se detiene. Sin el bloqueo, dos administradores podrían quitarse el rol a la vez y dejar la empresa sin ninguno.
  async contarAdministradores(): Promise<number> {
    const { rows } = await sql<{ n: number }>`
      select count(*)::int as n from (
        select 1 from usuario where empresa_id = ${this.empresaId} and rol = 'administrador_sig' for no key update
      ) administradores`.execute(this.db);
    return rows[0]?.n ?? 0;
  }

  // `on conflict do nothing` (sin destino): un choque con el correo de otra persona no deja la transacción abortada.
  async insertar(p: { id: string; nombre: string; correo: string; rol: Rol }): Promise<'ok' | 'correo_repetido'> {
    const { rows } = await sql<{ id: string }>`
      insert into usuario (id, empresa_id, nombre, correo, rol) values (${p.id}, ${this.empresaId}, ${p.nombre}, ${p.correo}, ${p.rol})
      on conflict do nothing returning id`.execute(this.db);
    return rows.length === 1 ? 'ok' : 'correo_repetido';
  }

  async reactivar(p: {
    id: string;
    nombre: string;
    correo: string;
    rol: Rol;
    versionEsperada: number;
  }): Promise<'ok' | 'correo_repetido' | 'version_vieja'> {
    const repetido = await sql`
      select 1 from usuario where empresa_id = ${this.empresaId} and correo = ${p.correo} and id <> ${p.id}`.execute(this.db);
    if (repetido.rows.length > 0) return 'correo_repetido';
    const r = await sql`
      update usuario set nombre = ${p.nombre}, correo = ${p.correo}, rol = ${p.rol}, baja_en = null, version = version + 1
      where empresa_id = ${this.empresaId} and id = ${p.id} and version = ${p.versionEsperada} and rol is null`.execute(this.db);
    return filas(r) === 1 ? 'ok' : 'version_vieja';
  }

  async cambiarRol(id: string, rol: Rol, versionEsperada: number): Promise<boolean> {
    const r = await sql`
      update usuario set rol = ${rol}, version = version + 1
      where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada} and rol is not null`.execute(this.db);
    return filas(r) === 1;
  }

  async darDeBaja(id: string, versionEsperada: number, ahora: Date): Promise<boolean> {
    const r = await sql`
      update usuario set rol = null, baja_en = ${ahora}, version = version + 1
      where empresa_id = ${this.empresaId} and id = ${id} and version = ${versionEsperada} and rol is not null`.execute(this.db);
    return filas(r) === 1;
  }
}

export class SolicitudesKysely implements SolicitudesRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async vencerVencidas(ahora: Date): Promise<void> {
    await sql`
      update solicitud_acceso set estado = 'vencida', resuelta_en = ${ahora}
      where empresa_id = ${this.empresaId} and estado = 'pendiente' and vence_en <= ${ahora}`.execute(this.db);
  }

  async vigenteDe(usuarioId: string, ahora: Date): Promise<SolicitudDto | null> {
    const { rows } = await sql<FilaSolicitud>`
      select id, usuario_id, codigo, creada_en, vence_en from solicitud_acceso
      where empresa_id = ${this.empresaId} and usuario_id = ${usuarioId} and estado = 'pendiente' and vence_en > ${ahora}`.execute(this.db);
    return rows[0] ? solicitud(rows[0]) : null;
  }

  async obtenerVigente(id: string, ahora: Date): Promise<SolicitudDto | null> {
    const { rows } = await sql<FilaSolicitud>`
      select id, usuario_id, codigo, creada_en, vence_en from solicitud_acceso
      where empresa_id = ${this.empresaId} and id = ${id} and estado = 'pendiente' and vence_en > ${ahora}`.execute(this.db);
    return rows[0] ? solicitud(rows[0]) : null;
  }

  async listarVigentes(ahora: Date): Promise<readonly SolicitudDto[]> {
    const { rows } = await sql<FilaSolicitud>`
      select id, usuario_id, codigo, creada_en, vence_en from solicitud_acceso
      where empresa_id = ${this.empresaId} and estado = 'pendiente' and vence_en > ${ahora} order by creada_en, id`.execute(this.db);
    return rows.map(solicitud);
  }

  async contarVigentes(ahora: Date): Promise<number> {
    const { rows } = await sql<{ n: number }>`
      select count(*)::int as n from solicitud_acceso where empresa_id = ${this.empresaId} and estado = 'pendiente' and vence_en > ${ahora}`.execute(
      this.db,
    );
    return rows[0]?.n ?? 0;
  }

  // `on conflict do nothing` (sin destino): cubre tanto «la persona ya tiene una vigente» como «el código ya lo usa otra vigente» sin
  // abortar la transacción; el caso de uso mira cuál fue y, si hace falta, genera otro código.
  async crear(s: { id: string; usuarioId: string; codigo: string; creadaEn: Date; venceEn: Date }): Promise<'creada' | 'conflicto'> {
    const { rows } = await sql<{ id: string }>`
      insert into solicitud_acceso (id, empresa_id, usuario_id, codigo, creada_en, vence_en)
      values (${s.id}, ${this.empresaId}, ${s.usuarioId}, ${s.codigo}, ${s.creadaEn}, ${s.venceEn})
      on conflict do nothing returning id`.execute(this.db);
    return rows.length === 1 ? 'creada' : 'conflicto';
  }

  async resolver(id: string, estado: 'aprobada' | 'descartada', por: string, ahora: Date): Promise<boolean> {
    const r = await sql`
      update solicitud_acceso set estado = ${estado}, resuelta_en = ${ahora}, resuelta_por = ${por}
      where empresa_id = ${this.empresaId} and id = ${id} and estado = 'pendiente'`.execute(this.db);
    return filas(r) === 1;
  }
}
