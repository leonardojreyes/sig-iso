import type { EventoBitacora } from '@sig/auditoria';
import type { AlcanceRepositoryPort, ControlRepositoryPort, DeclaracionRepositoryPort, EvaluacionRepositoryPort, EvidenciaRepositoryPort, MapeoRepositoryPort, MotivoRepositoryPort, ReferenciaRepositoryPort, RiesgoRepositoryPort, VinculoRiesgoRepositoryPort } from './repositorios.port.js';

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
  readonly riesgos: RiesgoRepositoryPort;
  readonly vinculosRiesgo: VinculoRiesgoRepositoryPort;
  readonly motivos: MotivoRepositoryPort;
  readonly referencias: ReferenciaRepositoryPort;
  readonly evidencias: EvidenciaRepositoryPort;
  readonly declaraciones: DeclaracionRepositoryPort;
  readonly bitacora: RegistradorBitacora;
}

export type Reloj = () => Date;
