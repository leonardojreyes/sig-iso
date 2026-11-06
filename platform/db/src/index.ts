// API pública de platform/db. Las migraciones y las políticas RLS llegan en la tarea 2.4.
export { ConfiguracionBdError, leerUrls, ROLES_BD, type Entorno, type RolBd, type UrlsPorRol } from './configuracion';
export { GestorPools, type EstadisticasPool, type OpcionesPool } from './pools';
export { conTenant } from './con-tenant';
export {
  CARPETA_MIGRACIONES,
  ejecutarConReintentos,
  leerMigracionesSql,
  MigracionFallidaError,
  MigracionInvalidaError,
  migrarAlUltimo,
  type MigracionSql,
  type OpcionesMigracion,
  type ResultadoEjecucion,
} from './migraciones';
