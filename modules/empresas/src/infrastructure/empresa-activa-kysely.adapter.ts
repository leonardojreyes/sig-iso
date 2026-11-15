// Adaptador de EmpresaActivaPort sobre PostgreSQL. Debe recibir el pool del rol de PLATAFORMA (migración 0012): ese rol lee solo
// identificador, empresa y rol de `usuario` y identificador, slug y nombre de `empresa`, y es el único que toca `empresa_activa`.
// No se usa `conTenant`: la consulta ocurre antes de conocer la empresa. La clave foránea compuesta de `empresa_activa` garantiza que
// la persona pertenece a la empresa que se guarda.
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { EleccionDeSesion, EmpresaActivaPort, EmpresaDePersona } from '../application/empresa-activa.port.js';

export class EmpresaActivaKysely implements EmpresaActivaPort {
  constructor(private readonly db: Kysely<unknown>) {}

  async activaDe(sesionId: string, usuarioId: string, ahora: Date): Promise<EleccionDeSesion> {
    // La fila de ESTA persona y esta sesión (la de otra persona con el mismo `sid` no cuenta); `vigente` = sigue teniendo un rol allí.
    const { rows } = await sql<{ empresa_id: string; vence: boolean; vigente: boolean }>`
      select a.empresa_id, (a.expira_en > ${ahora}) as vence, (u.rol is not null) as vigente from empresa_activa a
        left join usuario u on u.empresa_id = a.empresa_id and u.id = a.usuario_id
       where a.sid = ${sesionId} and a.usuario_id = ${usuarioId}`.execute(this.db);
    const f = rows[0];
    if (!f) return { tipo: 'sin_eleccion' };
    return f.vence && f.vigente ? { tipo: 'activa', empresaId: crearEmpresaId(f.empresa_id) } : { tipo: 'invalida' };
  }

  async empresasDe(usuarioId: string): Promise<readonly EmpresaDePersona[]> {
    const { rows } = await sql<{ id: string; slug: string; nombre: string }>`
      select e.id, e.slug, e.nombre from usuario u join empresa e on e.id = u.empresa_id
       where u.id = ${usuarioId} and u.rol is not null order by e.nombre, e.slug`.execute(this.db);
    return rows.map((f) => ({ empresaId: crearEmpresaId(f.id), slug: f.slug, nombre: f.nombre }));
  }

  async fijar(sesionId: string, usuarioId: string, empresaId: EmpresaId, ahora: Date, expiraEn: Date): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await sql`delete from empresa_activa where expira_en <= ${ahora}`.execute(trx);
      // Una sesión de OTRA persona con el mismo identificador no se pisa (no debería pasar: el `sid` es opaco y único).
      const r = await sql`
        insert into empresa_activa (sid, usuario_id, empresa_id, cambiada_en, expira_en)
        values (${sesionId}, ${usuarioId}, ${empresaId}, ${ahora}, ${expiraEn})
        on conflict (sid) do update set empresa_id = excluded.empresa_id, cambiada_en = excluded.cambiada_en, expira_en = excluded.expira_en
          where empresa_activa.usuario_id = excluded.usuario_id
        returning 1`.execute(trx);
      if (r.rows.length !== 1) throw new Error('La sesión pertenece a otra persona');
    });
  }

  async limpiar(sesionId: string): Promise<void> {
    await sql`delete from empresa_activa where sid = ${sesionId}`.execute(this.db);
  }
}
