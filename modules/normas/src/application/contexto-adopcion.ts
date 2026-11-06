import type { EventoBitacora } from '@sig/auditoria';
import type { AdopcionRepositoryPort } from './adopcion-repository.port.js';
import type { CatalogoRepositoryPort } from './catalogo-repository.port.js';

/** Registra un hecho en la bitácora DENTRO de la misma unidad de trabajo que la acción (si falla, la acción se revierte). */
export interface RegistradorBitacora {
  registrar(evento: EventoBitacora): Promise<void>;
}

/** Lo que `AdoptarLibreria` recibe dentro de la unidad de trabajo, todo ligado a la misma transacción y empresa. */
export interface ContextoAdopcion {
  readonly adopciones: AdopcionRepositoryPort;
  readonly catalogo: CatalogoRepositoryPort;
  readonly bitacora: RegistradorBitacora;
}
