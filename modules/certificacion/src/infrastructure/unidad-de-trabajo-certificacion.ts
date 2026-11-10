import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { UnidadDeTrabajoKysely } from '@sig/db';
import type { Kysely } from 'kysely';
import type { ContextoCertificacion } from '../application/contexto.js';
import { AlcanceKysely } from './alcance-kysely.adapter.js';
import { EvaluacionKysely } from './evaluacion-kysely.adapter.js';

/**
 * Unidad de trabajo del módulo sobre PostgreSQL. `db` debe ser el pool del rol de la aplicación. En cada ejecución se abre una
 * transacción con la empresa fijada y repositorios y bitácora quedan ligados a ELLA: todo se confirma o se revierte junto.
 */
export const crearUnidadDeTrabajoCertificacion = (db: Kysely<unknown>): UnidadDeTrabajoKysely<ContextoCertificacion> =>
  new UnidadDeTrabajoKysely<ContextoCertificacion>(db, (trx, empresaId) => ({
    evaluaciones: new EvaluacionKysely(trx, empresaId),
    alcances: new AlcanceKysely(trx, empresaId),
    bitacora: new Bitacora(BitacoraKysely.enTransaccion(trx)),
  }));
