import {
  ActualizarProcesoUseCase,
  AgregarExclusionUseCase,
  AgregarRelacionUseCase,
  AprobarProgramaUseCase,
  CambiarProgramaUseCase,
  CrearProgramaUseCase,
  ListarProgramasUseCase,
  ObtenerProgramaUseCase,
  QuitarExclusionUseCase,
  CrearGestionSigUseCase,
  CrearProcesoUseCase,
  ListarProcesosUseCase,
  ListarRelacionesUseCase,
  QuitarRelacionUseCase,
  RetirarProcesoUseCase,
  type AutorizacionPort,
  type CatalogoLecturaPort,
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
  readonly listarProgramas: ListarProgramasUseCase;
  readonly crearPrograma: CrearProgramaUseCase;
  readonly obtenerPrograma: ObtenerProgramaUseCase;
  readonly cambiarPrograma: CambiarProgramaUseCase;
  readonly aprobarPrograma: AprobarProgramaUseCase;
  readonly agregarExclusion: AgregarExclusionUseCase;
  readonly quitarExclusion: QuitarExclusionUseCase;
}

export const crearCasosAuditoria = (
  unidad: UnidadDeTrabajoPort<ContextoCertificacion>,
  autorizacion: AutorizacionPort,
  catalogo: CatalogoLecturaPort,
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
  listarProgramas: new ListarProgramasUseCase(unidad, autorizacion),
  crearPrograma: new CrearProgramaUseCase(unidad, autorizacion, catalogo, reloj, nuevoId),
  obtenerPrograma: new ObtenerProgramaUseCase(unidad, autorizacion, catalogo),
  cambiarPrograma: new CambiarProgramaUseCase(unidad, autorizacion, catalogo, reloj),
  aprobarPrograma: new AprobarProgramaUseCase(unidad, autorizacion, catalogo, reloj),
  agregarExclusion: new AgregarExclusionUseCase(unidad, autorizacion, reloj, nuevoId),
  quitarExclusion: new QuitarExclusionUseCase(unidad, autorizacion),
});
