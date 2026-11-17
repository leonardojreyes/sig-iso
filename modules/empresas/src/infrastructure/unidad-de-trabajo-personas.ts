import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { UnidadDeTrabajoKysely } from '@sig/db';
import type { Kysely } from 'kysely';
import type { ContextoPersonas, UnidadDeTrabajoPersonasPort } from '../application/personas.port.js';
import { PersonasKysely, SolicitudesKysely } from './personas-kysely.adapter.js';

/**
 * Unidad de trabajo de las personas sobre PostgreSQL. `db` debe ser el pool del rol de la aplicación. En cada ejecución se abre una
 * transacción con la empresa fijada y los repositorios y la bitácora quedan ligados a ELLA: todo se confirma o se revierte junto.
 */
export const crearUnidadDeTrabajoPersonas = (db: Kysely<unknown>): UnidadDeTrabajoPersonasPort =>
  new UnidadDeTrabajoKysely<ContextoPersonas>(db, (trx, empresaId) => ({
    personas: new PersonasKysely(trx, empresaId),
    solicitudes: new SolicitudesKysely(trx, empresaId),
    bitacora: new Bitacora(BitacoraKysely.enTransaccion(trx)),
  }));
