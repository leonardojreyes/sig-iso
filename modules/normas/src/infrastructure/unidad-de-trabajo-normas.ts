import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { UnidadDeTrabajoKysely } from '@sig/db';
import type { Kysely } from 'kysely';
import type { ContextoAdopcion } from '../application/contexto-adopcion.js';
import { AdopcionKysely } from './adopcion-kysely.adapter.js';
import { CatalogoKysely } from './catalogo-kysely.adapter.js';

/**
 * Unidad de trabajo del módulo sobre PostgreSQL. `db` debe ser el pool del rol de la aplicación. En cada ejecución se abre una
 * transacción con la empresa fijada y repositorios y bitácora quedan ligados a ELLA: todo se confirma o se revierte junto.
 * El contexto sirve tanto para `AdoptarLibreria` como para las consultas (`ContextoConsulta` es un subconjunto).
 */
export const crearUnidadDeTrabajoNormas = (db: Kysely<unknown>): UnidadDeTrabajoKysely<ContextoAdopcion> =>
  new UnidadDeTrabajoKysely<ContextoAdopcion>(db, (trx, empresaId) => ({
    catalogo: new CatalogoKysely(trx),
    adopciones: new AdopcionKysely(trx, empresaId),
    bitacora: new Bitacora(BitacoraKysely.enTransaccion(trx)),
  }));
