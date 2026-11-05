// Ejecuta una función dentro de una transacción con la empresa fijada para PostgreSQL (ADR 024).
// `app.tenant_id` vive solo durante la transacción (`set_config(..., true)`): nunca se queda en la conexión del pool.
import { esEmpresaId, EmpresaIdInvalidoError, type EmpresaId } from '@sig/tenancy';
import { sql, type Kysely, type Transaction } from 'kysely';

/**
 * Abre una transacción, fija `app.tenant_id` y ejecuta `fn`. Si `fn` falla, todo se revierte.
 * Las políticas RLS leen ese valor con `app_tenant_id()`, que falla si no hay empresa (migración 0001a).
 *
 * El identificador se pasa como parámetro, nunca concatenado. Se vuelve a validar en ejecución porque
 * el tipo `EmpresaId` puede forzarse con una conversión en TypeScript.
 */
export const conTenant = async <DB, T>(db: Kysely<DB>, empresaId: EmpresaId, fn: (trx: Transaction<DB>) => Promise<T>): Promise<T> => {
  if (!esEmpresaId(empresaId)) throw new EmpresaIdInvalidoError();
  if (db.isTransaction) throw new Error('conTenant no se puede anidar: la empresa no cambia dentro de una transacción');
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.tenant_id', ${empresaId}, true)`.execute(trx);
    return fn(trx);
  });
};
