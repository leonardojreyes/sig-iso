// Unidad de trabajo sobre PostgreSQL: una transacción con la empresa fijada (`conTenant`). Todo lo que haga `fn` con el
// contexto —acción de negocio y registro de bitácora incluidos— se confirma junto o se revierte junto (H4.10, H6.8).
import type { EmpresaId } from '@sig/tenancy';
import type { Kysely, Transaction } from 'kysely';
import { conTenant } from './con-tenant';

/**
 * `crearContexto` construye, a partir de la transacción abierta, lo que la función necesita (repositorios, bitácora...).
 * Se crea uno nuevo por ejecución y no debe guardarse: al terminar la unidad, su transacción ya no sirve.
 */
export class UnidadDeTrabajoKysely<Ctx> {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly crearContexto: (trx: Transaction<unknown>, empresaId: EmpresaId) => Ctx,
  ) {}

  /** Si `fn` falla (o falla la confirmación), se revierte todo y el error se propaga sin cambios. */
  ejecutar<T>(empresaId: EmpresaId, fn: (contexto: Ctx) => Promise<T>): Promise<T> {
    return conTenant(this.db, empresaId, (trx) => fn(this.crearContexto(trx, empresaId)));
  }
}
