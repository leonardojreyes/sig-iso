// API pública pura de platform/tenancy (sin Node). El contexto con AsyncLocalStorage está en '@sig/tenancy/contexto'.
export { crearEmpresaId, esEmpresaId, type EmpresaId } from './empresa-id';
export { EmpresaIdInvalidoError, SinEmpresaError } from './errores';
