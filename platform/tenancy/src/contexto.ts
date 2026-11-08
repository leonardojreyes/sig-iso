// Contexto de empresa por operación. Usa Node (AsyncLocalStorage): solo para infraestructura, nunca para el dominio.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { EmpresaId } from './empresa-id';
import { SinEmpresaError } from './errores';

const almacen = new AsyncLocalStorage<EmpresaId>();

/** Ejecuta `fn` con la empresa fijada; el contexto es propio de esta ejecución y de sus continuaciones asíncronas. */
export const ejecutarConEmpresa = <T>(empresaId: EmpresaId, fn: () => T): T => almacen.run(empresaId, fn);

/** La empresa de la operación en curso, o `undefined` si no hay ninguna. */
export const empresaActualOpcional = (): EmpresaId | undefined => almacen.getStore();

/** La empresa de la operación en curso. Sin contexto lanza `SinEmpresaError` (ante la duda, se deniega). */
export const empresaActual = (): EmpresaId => {
  const empresa = almacen.getStore();
  if (!empresa) throw new SinEmpresaError();
  return empresa;
};
