import {
  ActualizarProcesoUseCase,
  AgregarPreguntaUseCase,
  AnularHallazgoUseCase,
  CambiarHallazgoUseCase,
  CerrarAuditoriaUseCase,
  EmitirInformeUseCase,
  EvaluarFilaUseCase,
  ListarHallazgosUseCase,
  ListarListaUseCase,
  ObtenerInformeUseCase,
  ObtenerPanelAuditoriaUseCase,
  QuitarPreguntaUseCase,
  RegenerarListaUseCase,
  RegistrarHallazgoUseCase,
  AvanzarAuditoriaUseCase,
  CambiarAuditoriaUseCase,
  CancelarAuditoriaUseCase,
  ComprobarIndependenciaUseCase,
  CrearAuditoriaUseCase,
  DesignarMiembroUseCase,
  ObtenerAuditoriaUseCase,
  QuitarMiembroUseCase,
  ReprogramarAuditoriaUseCase,
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
  readonly crearAuditoria: CrearAuditoriaUseCase;
  readonly obtenerAuditoria: ObtenerAuditoriaUseCase;
  readonly cambiarAuditoria: CambiarAuditoriaUseCase;
  readonly reprogramarAuditoria: ReprogramarAuditoriaUseCase;
  readonly cancelarAuditoria: CancelarAuditoriaUseCase;
  readonly avanzarAuditoria: AvanzarAuditoriaUseCase;
  readonly comprobarIndependencia: ComprobarIndependenciaUseCase;
  readonly designarMiembro: DesignarMiembroUseCase;
  readonly quitarMiembro: QuitarMiembroUseCase;
  readonly obtenerLista: ListarListaUseCase;
  readonly regenerarLista: RegenerarListaUseCase;
  readonly evaluarFila: EvaluarFilaUseCase;
  readonly agregarPregunta: AgregarPreguntaUseCase;
  readonly quitarPregunta: QuitarPreguntaUseCase;
  readonly listarHallazgos: ListarHallazgosUseCase;
  readonly registrarHallazgo: RegistrarHallazgoUseCase;
  readonly cambiarHallazgo: CambiarHallazgoUseCase;
  readonly anularHallazgo: AnularHallazgoUseCase;
  readonly emitirInforme: EmitirInformeUseCase;
  readonly obtenerInforme: ObtenerInformeUseCase;
  readonly cerrarAuditoria: CerrarAuditoriaUseCase;
  readonly panel: ObtenerPanelAuditoriaUseCase;
}

export const crearCasosAuditoria = (
  unidad: UnidadDeTrabajoPort<ContextoCertificacion>,
  autorizacion: AutorizacionPort,
  catalogo: CatalogoLecturaPort,
  reloj: () => Date,
  nuevoId: () => string,
  /** SHA-256 en hexadecimal de un texto (la composición lo aporta con `node:crypto`). */
  hash: (texto: string) => string,
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
  crearAuditoria: new CrearAuditoriaUseCase(unidad, autorizacion, catalogo, reloj, nuevoId),
  obtenerAuditoria: new ObtenerAuditoriaUseCase(unidad, autorizacion, catalogo),
  cambiarAuditoria: new CambiarAuditoriaUseCase(unidad, autorizacion, catalogo, reloj),
  reprogramarAuditoria: new ReprogramarAuditoriaUseCase(unidad, autorizacion, catalogo, reloj),
  cancelarAuditoria: new CancelarAuditoriaUseCase(unidad, autorizacion, catalogo, reloj),
  avanzarAuditoria: new AvanzarAuditoriaUseCase(unidad, autorizacion, catalogo, reloj, nuevoId),
  comprobarIndependencia: new ComprobarIndependenciaUseCase(unidad, autorizacion, catalogo, reloj),
  designarMiembro: new DesignarMiembroUseCase(unidad, autorizacion, catalogo, reloj),
  quitarMiembro: new QuitarMiembroUseCase(unidad, autorizacion),
  obtenerLista: new ListarListaUseCase(unidad, autorizacion, catalogo),
  regenerarLista: new RegenerarListaUseCase(unidad, autorizacion, catalogo, reloj, nuevoId),
  evaluarFila: new EvaluarFilaUseCase(unidad, autorizacion, reloj),
  agregarPregunta: new AgregarPreguntaUseCase(unidad, autorizacion, reloj, nuevoId),
  quitarPregunta: new QuitarPreguntaUseCase(unidad, autorizacion),
  listarHallazgos: new ListarHallazgosUseCase(unidad, autorizacion),
  registrarHallazgo: new RegistrarHallazgoUseCase(unidad, autorizacion, catalogo, reloj, nuevoId),
  cambiarHallazgo: new CambiarHallazgoUseCase(unidad, autorizacion, catalogo, reloj),
  anularHallazgo: new AnularHallazgoUseCase(unidad, autorizacion, reloj),
  emitirInforme: new EmitirInformeUseCase(unidad, autorizacion, catalogo, reloj, nuevoId, hash),
  obtenerInforme: new ObtenerInformeUseCase(unidad, autorizacion),
  cerrarAuditoria: new CerrarAuditoriaUseCase(unidad, autorizacion, reloj),
  panel: new ObtenerPanelAuditoriaUseCase(unidad, autorizacion, catalogo, reloj),
});
