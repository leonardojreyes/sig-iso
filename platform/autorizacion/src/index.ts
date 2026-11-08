// API pública de platform/autorizacion: puerto, roles y permisos, y la implementación en memoria. El adaptador de producción es `AutorizacionPostgres` (platform/db, ADR 029); OpenFGA queda pospuesto.
export { AUTORIZACION, type AutorizacionPort } from './autorizacion.port.js';
export { AutorizacionFake } from './autorizacion-fake.js';
export { ErrorAutorizacion } from './errores.js';
export { esPermiso, esRol, PERMISOS, permisosDe, ROLES, type Permiso, type Rol } from './roles.js';
