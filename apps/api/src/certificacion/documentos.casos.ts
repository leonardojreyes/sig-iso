import {
  AprobarVersionUseCase,
  CambiarDistribucionUseCase,
  CambiarDocumentoUseCase,
  ConfirmarLecturaUseCase,
  CrearDocumentoUseCase,
  DescargarVersionUseCase,
  DescartarVersionUseCase,
  DesvincularDocumentoUseCase,
  DevolverVersionUseCase,
  EnviarARevisionUseCase,
  GuardarRetencionUseCase,
  ListarCoberturaDocumentalUseCase,
  ListarDirectorioUseCase,
  ListarDocumentosUseCase,
  ListarRetencionUseCase,
  MisLecturasPendientesUseCase,
  ObtenerDocumentoUseCase,
  RetirarDocumentoUseCase,
  RevisarDocumentoUseCase,
  SubirVersionUseCase,
  VincularDocumentoUseCase,
  type AlmacenArchivosPort,
  type AutorizacionPort,
  type CatalogoLecturaPort,
  type ContextoCertificacion,
  type UnidadDeTrabajoPort,
} from '@sig/certificacion';

/** Token único de los casos de uso del control documental (ADR 039): el controlador los recibe agrupados. */
export const DOCUMENTOS = Symbol('DOCUMENTOS');

export interface CasosDocumentales {
  readonly listar: ListarDocumentosUseCase;
  readonly crear: CrearDocumentoUseCase;
  readonly obtener: ObtenerDocumentoUseCase;
  readonly cambiar: CambiarDocumentoUseCase;
  readonly retirar: RetirarDocumentoUseCase;
  readonly revisar: RevisarDocumentoUseCase;
  readonly distribuir: CambiarDistribucionUseCase;
  readonly vincular: VincularDocumentoUseCase;
  readonly desvincular: DesvincularDocumentoUseCase;
  readonly subirVersion: SubirVersionUseCase;
  readonly enviar: EnviarARevisionUseCase;
  readonly devolver: DevolverVersionUseCase;
  readonly aprobar: AprobarVersionUseCase;
  readonly descartar: DescartarVersionUseCase;
  readonly descargar: DescargarVersionUseCase;
  readonly confirmarLectura: ConfirmarLecturaUseCase;
  readonly lecturasPendientes: MisLecturasPendientesUseCase;
  readonly cobertura: ListarCoberturaDocumentalUseCase;
  readonly listarRetencion: ListarRetencionUseCase;
  readonly guardarRetencion: GuardarRetencionUseCase;
  readonly directorio: ListarDirectorioUseCase;
}

export const crearCasosDocumentales = (
  unidad: UnidadDeTrabajoPort<ContextoCertificacion>,
  autorizacion: AutorizacionPort,
  catalogo: CatalogoLecturaPort,
  almacen: AlmacenArchivosPort,
  reloj: () => Date,
  nuevoId: () => string,
): CasosDocumentales => ({
  listar: new ListarDocumentosUseCase(unidad, autorizacion, catalogo, reloj),
  crear: new CrearDocumentoUseCase(unidad, autorizacion, reloj, nuevoId),
  obtener: new ObtenerDocumentoUseCase(unidad, autorizacion, reloj),
  cambiar: new CambiarDocumentoUseCase(unidad, autorizacion, reloj),
  retirar: new RetirarDocumentoUseCase(unidad, autorizacion, reloj),
  revisar: new RevisarDocumentoUseCase(unidad, autorizacion, reloj),
  distribuir: new CambiarDistribucionUseCase(unidad, autorizacion),
  vincular: new VincularDocumentoUseCase(unidad, autorizacion, catalogo),
  desvincular: new DesvincularDocumentoUseCase(unidad, autorizacion),
  subirVersion: new SubirVersionUseCase(unidad, autorizacion, almacen, reloj, nuevoId),
  enviar: new EnviarARevisionUseCase(unidad, autorizacion, reloj),
  devolver: new DevolverVersionUseCase(unidad, autorizacion, reloj),
  aprobar: new AprobarVersionUseCase(unidad, autorizacion, reloj),
  descartar: new DescartarVersionUseCase(unidad, autorizacion, reloj),
  descargar: new DescargarVersionUseCase(unidad, autorizacion, almacen),
  confirmarLectura: new ConfirmarLecturaUseCase(unidad, autorizacion, reloj),
  lecturasPendientes: new MisLecturasPendientesUseCase(unidad, autorizacion),
  cobertura: new ListarCoberturaDocumentalUseCase(unidad, autorizacion, catalogo),
  listarRetencion: new ListarRetencionUseCase(unidad, autorizacion),
  guardarRetencion: new GuardarRetencionUseCase(unidad, autorizacion, reloj),
  directorio: new ListarDirectorioUseCase(unidad, autorizacion),
});
