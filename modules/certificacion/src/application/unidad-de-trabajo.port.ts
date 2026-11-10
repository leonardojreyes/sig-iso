import type { EmpresaId } from '@sig/tenancy';

export const UNIDAD_DE_TRABAJO = Symbol('UNIDAD_DE_TRABAJO');

/**
 * Puerto de salida: ejecuta `fn` en una unidad atómica ligada a UNA empresa. Lo que `fn` haga con el contexto (repositorios y
 * bitácora incluidos) se confirma junto o se revierte junto. Las unidades no se anidan.
 */
export interface UnidadDeTrabajoPort<Ctx> {
  ejecutar<T>(empresaId: EmpresaId, fn: (contexto: Ctx) => Promise<T>): Promise<T>;
}
