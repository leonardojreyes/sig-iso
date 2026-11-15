import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { UnidadDeTrabajoKysely } from '@sig/db';
import type { Kysely } from 'kysely';
import type { ContextoMarca, UnidadDeTrabajoMarcaPort } from '../application/marca-repository.port.js';
import { MarcaKysely } from './marca-kysely.adapter.js';

/**
 * Unidad de trabajo de la edición de la marca sobre PostgreSQL. `db` debe ser el pool del rol de la aplicación. En cada ejecución se
 * abre una transacción con la empresa fijada y el repositorio y la bitácora quedan ligados a ELLA: todo se confirma o se revierte junto.
 */
export const crearUnidadDeTrabajoMarca = (db: Kysely<unknown>): UnidadDeTrabajoMarcaPort =>
  new UnidadDeTrabajoKysely<ContextoMarca>(db, (trx, empresaId) => ({
    marcas: new MarcaKysely(trx, empresaId),
    bitacora: new Bitacora(BitacoraKysely.enTransaccion(trx)),
  }));
