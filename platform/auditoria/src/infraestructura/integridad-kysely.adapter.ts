// Adaptador de IntegridadBitacoraPort: usa las funciones SQL `bitacora_verificar` y `bitacora_anclar`, que solo ejecuta el dueño de la base.
import { sql, type Kysely } from 'kysely';
import type { IntegridadBitacoraPort, ProblemaIntegridad, TipoProblema } from '../puertos/integridad.port';

export class IntegridadKysely implements IntegridadBitacoraPort {
  /** `db` debe ser el pool del rol dueño. */
  constructor(private readonly db: Kysely<unknown>) {}

  async verificar(): Promise<readonly ProblemaIntegridad[]> {
    const r = await sql<{ clave: string; secuencia: string | null; problema: TipoProblema }>`select clave, secuencia::text as secuencia, problema from bitacora_verificar()`.execute(this.db);
    return r.rows.map((f) => ({ clave: f.clave, secuencia: f.secuencia === null ? null : Number(f.secuencia), problema: f.problema }));
  }

  async anclar(): Promise<number> {
    const r = await sql<{ n: number }>`select bitacora_anclar() as n`.execute(this.db);
    return Number(r.rows[0]?.n ?? 0);
  }
}
