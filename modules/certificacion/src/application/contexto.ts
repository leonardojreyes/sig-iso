import type { EventoBitacora } from '@sig/auditoria';
import type { AlcanceRepositoryPort, ControlRepositoryPort, EvaluacionRepositoryPort, MapeoRepositoryPort } from './repositorios.port.js';

/** Registra un hecho en la bitácora DENTRO de la misma unidad de trabajo que la acción (si falla, la acción se revierte). */
export interface RegistradorBitacora {
  registrar(evento: EventoBitacora): Promise<void>;
}

/** Lo que reciben los casos de uso dentro de la unidad de trabajo, todo ligado a la misma transacción y empresa. */
export interface ContextoCertificacion {
  readonly evaluaciones: EvaluacionRepositoryPort;
  readonly alcances: AlcanceRepositoryPort;
  readonly controles: ControlRepositoryPort;
  readonly mapeos: MapeoRepositoryPort;
  readonly bitacora: RegistradorBitacora;
}

export type Reloj = () => Date;
