// Adaptador de BitacoraPort sobre PostgreSQL (Kysely). Los hechos de empresa se escriben con el rol de la aplicación bajo
// su empresa (RLS); los de plataforma, con el rol de plataforma, que solo puede insertar sin empresa y no puede leer.
import { conTenant } from '@sig/db';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { RegistroBitacora } from '../dominio/tipos';
import type { BitacoraPort, ResultadoRegistro } from '../puertos/bitacora.port';

const json = (valor: unknown): string | null => (valor === null ? null : JSON.stringify(valor));

const insertar = (db: Kysely<unknown>, r: RegistroBitacora) =>
  sql`insert into bitacora (empresa_id, actor_tipo, usuario_id, accion, objeto, objeto_version, resultado, motivo, trace_id, origen_id, antes, despues)
      values (${r.empresaId}, ${r.actorTipo}, ${r.usuarioId}, ${r.accion}, ${r.objeto}, ${r.objetoVersion}, ${r.resultado}, ${r.motivo}, ${r.traceId}, ${r.origenId}, ${json(r.antes)}::jsonb, ${json(r.despues)}::jsonb)`.execute(db);

/** Violación del índice único de `origen_id`: el hecho ya estaba registrado. Cualquier otra violación se propaga. */
const esOrigenRepetido = (error: unknown): boolean => typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505' && (error as { constraint?: string }).constraint === 'bitacora_origen_idx';

const exigirOrigen = (r: RegistroBitacora): void => {
  if (r.origenId === null) throw new Error('registrarUnaVez exige que el registro tenga origenId');
};

export interface DestinosBitacora {
  /** Pool del rol de la aplicación. */
  readonly app: Kysely<unknown>;
  /** Pool del rol de plataforma (solo inserta hechos sin empresa). */
  readonly plataforma: Kysely<unknown>;
}

/** Escribe en su PROPIA transacción (la de la empresa del registro, o una sentencia del rol de plataforma). */
export class BitacoraKysely implements BitacoraPort {
  constructor(private readonly destinos: DestinosBitacora) {}

  /**
   * Puerto ligado a una transacción de empresa en curso (la que ya abrió `conTenant`): el registro se confirma o se revierte
   * junto con la acción, y si no se puede escribir la acción no se completa (H6.8).
   */
  static enTransaccion(trx: Transaction<unknown>): BitacoraPort {
    return new BitacoraEnTransaccion(trx);
  }

  async registrar(registro: RegistroBitacora): Promise<void> {
    if (registro.empresaId === null) await insertar(this.destinos.plataforma, registro);
    else await conTenant(this.destinos.app, registro.empresaId, (trx) => insertar(trx, registro));
  }

  async registrarUnaVez(registro: RegistroBitacora): Promise<ResultadoRegistro> {
    exigirOrigen(registro);
    try {
      await this.registrar(registro);
      return 'registrado';
    } catch (error) {
      if (esOrigenRepetido(error)) return 'ya_existia';
      throw error;
    }
  }
}

class BitacoraEnTransaccion implements BitacoraPort {
  constructor(private readonly trx: Transaction<unknown>) {}

  async registrar(registro: RegistroBitacora): Promise<void> {
    if (registro.empresaId === null) throw new Error('Los hechos de plataforma no se escriben dentro de una transacción de empresa');
    await insertar(this.trx, registro);
  }

  async registrarUnaVez(registro: RegistroBitacora): Promise<ResultadoRegistro> {
    exigirOrigen(registro);
    // Punto de guardado: un duplicado aborta solo este intento y la transacción de la acción puede continuar.
    await sql`savepoint bitacora_una_vez`.execute(this.trx);
    try {
      await this.registrar(registro);
      await sql`release savepoint bitacora_una_vez`.execute(this.trx);
      return 'registrado';
    } catch (error) {
      if (!esOrigenRepetido(error)) throw error;
      await sql`rollback to savepoint bitacora_una_vez`.execute(this.trx);
      await sql`release savepoint bitacora_una_vez`.execute(this.trx);
      return 'ya_existia';
    }
  }
}
