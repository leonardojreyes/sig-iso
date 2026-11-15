import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { UnidadDeTrabajoKysely } from '@sig/db';
import type { Kysely } from 'kysely';
import type { ContextoAdopcion } from '../application/contexto-adopcion.js';
import { AdopcionKysely } from './adopcion-kysely.adapter.js';
import type { ContextoCarga } from '../application/cargar-libreria.use-case.js';
import { LibreriaPropiaKysely } from './libreria-propia-kysely.adapter.js';
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

/** Unidad de trabajo de la carga de librerías propias (ADR 034): el repositorio y la bitácora comparten la transacción. */
export const crearUnidadDeTrabajoCarga = (db: Kysely<unknown>): UnidadDeTrabajoKysely<ContextoCarga> =>
  new UnidadDeTrabajoKysely<ContextoCarga>(db, (trx, empresaId) => ({
    propias: new LibreriaPropiaKysely(trx, empresaId),
    bitacora: new Bitacora(BitacoraKysely.enTransaccion(trx)),
  }));
