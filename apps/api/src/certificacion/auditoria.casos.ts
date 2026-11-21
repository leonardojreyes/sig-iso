import {
  ActualizarProcesoUseCase,
  AgregarRelacionUseCase,
  CrearGestionSigUseCase,
  CrearProcesoUseCase,
  ListarProcesosUseCase,
  ListarRelacionesUseCase,
  QuitarRelacionUseCase,
  RetirarProcesoUseCase,
  type AutorizacionPort,
  type ContextoCertificacion,
  type UnidadDeTrabajoPort,
} from '@sig/certificacion';

/** Token único de los casos de uso de la auditoría interna (ADR 040): el controlador los recibe agrupados. */
export const AUDITORIA = Symbol('AUDITORIA');

export interface CasosAuditoria {
  readonly listarProcesos: ListarProcesosUseCase;
  readonly crearProceso: CrearProcesoUseCase;
  readonly crearGestionSig: CrearGestionSigUseCase;
  readonly cambiarProceso: ActualizarProcesoUseCase;
  readonly retirarProceso: RetirarProcesoUseCase;
  readonly listarRelaciones: ListarRelacionesUseCase;
  readonly agregarRelacion: AgregarRelacionUseCase;
  readonly quitarRelacion: QuitarRelacionUseCase;
}

export const crearCasosAuditoria = (
  unidad: UnidadDeTrabajoPort<ContextoCertificacion>,
  autorizacion: AutorizacionPort,
  reloj: () => Date,
  nuevoId: () => string,
): CasosAuditoria => ({
  listarProcesos: new ListarProcesosUseCase(unidad, autorizacion),
  crearProceso: new CrearProcesoUseCase(unidad, autorizacion, reloj, nuevoId),
  crearGestionSig: new CrearGestionSigUseCase(unidad, autorizacion, reloj, nuevoId),
  cambiarProceso: new ActualizarProcesoUseCase(unidad, autorizacion, reloj),
  retirarProceso: new RetirarProcesoUseCase(unidad, autorizacion, reloj),
  listarRelaciones: new ListarRelacionesUseCase(unidad, autorizacion),
  agregarRelacion: new AgregarRelacionUseCase(unidad, autorizacion, reloj),
  quitarRelacion: new QuitarRelacionUseCase(unidad, autorizacion),
});
