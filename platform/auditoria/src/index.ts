// API pública de platform/auditoria.
export { ACCIONES, ACTORES, CATALOGO, MOTIVOS, RESULTADOS, ROLES, type AccionBitacora, type ActorTipo, type DefinicionAccion, type MotivoBitacora, type Resultado, type TipoValor } from './dominio/catalogo';
export { EventoBitacoraInvalidoError } from './dominio/errores';
export type { EventoBitacora, RegistroBitacora, ValorBitacora } from './dominio/tipos';
export { validarEvento } from './dominio/validacion';
export { BITACORA_PORT, type BitacoraPort, type ResultadoRegistro } from './puertos/bitacora.port';
export type { AlertaIntegridad, AlertasPort, IntegridadBitacoraPort, ProblemaIntegridad, TipoProblema } from './puertos/integridad.port';
export { Bitacora } from './servicio/bitacora';
export { MantenimientoBitacora, type ResultadoMantenimiento } from './servicio/mantenimiento';
export { EventoIdentidadInvalidoError, RegistrarIntentoFallido, type ResolverEmpresa, type ResultadoIntento } from './servicio/registrar-intento-fallido';
export { AlertasConsola } from './infraestructura/alertas-consola.adapter';
export { BitacoraKysely, type DestinosBitacora } from './infraestructura/bitacora-kysely.adapter';
export { IntegridadKysely } from './infraestructura/integridad-kysely.adapter';
