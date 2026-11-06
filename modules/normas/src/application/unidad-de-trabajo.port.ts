import type { EmpresaId } from '@sig/tenancy';

export const UNIDAD_DE_TRABAJO = Symbol('UNIDAD_DE_TRABAJO');

/**
 * Puerto de salida: ejecuta `fn` en una unidad atómica ligada a UNA empresa. Todo lo que `fn` haga con el contexto
 * (repositorios y bitácora incluidos) se confirma junto o se revierte junto: si `fn` falla, no queda nada (H4.10, H6.8).
 * `Ctx` es lo que el caso de uso necesita, ya ligado a la unidad (por ejemplo, el repositorio de adopciones y la bitácora).
 * Las unidades no se anidan y el contexto no debe guardarse fuera de `fn`.
 */
export interface UnidadDeTrabajoPort<Ctx> {
  ejecutar<T>(empresaId: EmpresaId, fn: (contexto: Ctx) => Promise<T>): Promise<T>;
}
