// API pública de platform/auditoria. El adaptador de base de datos y el servicio de mantenimiento llegan en la tarea 3.5.
export { ACCIONES, ACTORES, CATALOGO, MOTIVOS, RESULTADOS, ROLES, type AccionBitacora, type ActorTipo, type DefinicionAccion, type MotivoBitacora, type Resultado, type TipoValor } from './dominio/catalogo';
export { EventoBitacoraInvalidoError } from './dominio/errores';
export type { EventoBitacora, RegistroBitacora, ValorBitacora } from './dominio/tipos';
export { validarEvento } from './dominio/validacion';
export { BITACORA_PORT, type BitacoraPort } from './puertos/bitacora.port';
export { Bitacora } from './servicio/bitacora';
