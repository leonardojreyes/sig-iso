import type { EmpresaId } from '@sig/tenancy';

export const FLAGS = Symbol('FLAGS');

/** Funciones que se pueden encender o apagar sin desplegar (OpenFeature). */
export type NombreFlag = 'adopcion-habilitada';

/**
 * Puerto de salida: ¿está encendida esta función para esta empresa? La implementación decide qué valor usar si el servicio de
 * flags no responde; si lanza un error, el caso de uso no asume «encendido»: el error se propaga.
 */
export interface FlagsPort {
  habilitado(flag: NombreFlag, empresaId: EmpresaId): Promise<boolean>;
}

/** Valor por omisión de los casos de uso: todo encendido. */
export const TODO_HABILITADO: FlagsPort = { habilitado: async () => true };
