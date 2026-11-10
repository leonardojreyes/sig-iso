// API pública de @sig/certificacion (MVP): alcance y diagnóstico. Nadie importa por rutas internas.
export { Alcance, ALCANCE_MAX, COMENTARIO_MAX, ErrorCertificacion, ESTADOS_EVALUACION, esEstadoEvaluacion, Evaluacion, JUSTIFICACION_MIN, calcularMadurez, desglosar } from './domain/index.js';
export type { DatosAlcance, DatosEvaluacion, Desglose, EntradaParaMadurez, EstadoEvaluacion, Madurez, MadurezAgrupador } from './domain/index.js';
export { AprobarAlcanceUseCase, GuardarAlcanceUseCase, ListarAlcancesUseCase, type AlcanceDto } from './application/alcance.use-cases.js';
export { AUTORIZACION, type AutorizacionPort, type Permiso } from './application/autorizacion.port.js';
export { CATALOGO_LECTURA, type CatalogoLecturaPort, type EntradaCatalogo } from './application/catalogo-lectura.port.js';
export type { ContextoCertificacion, RegistradorBitacora, Reloj } from './application/contexto.js';
export { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './application/errores.js';
export { EvaluarEntradaUseCase, type EvaluacionDto, type EvaluarEntradaEntrada } from './application/evaluar-entrada.use-case.js';
export { ListarDiagnosticoUseCase, TOPE_DIAGNOSTICO, type Diagnostico, type FilaDiagnostico, type ListarDiagnosticoEntrada } from './application/listar-diagnostico.use-case.js';
export type { AlcanceRepositoryPort, EvaluacionRepositoryPort } from './application/repositorios.port.js';
export { UNIDAD_DE_TRABAJO, type UnidadDeTrabajoPort } from './application/unidad-de-trabajo.port.js';
export { AlcanceKysely } from './infrastructure/alcance-kysely.adapter.js';
export { EvaluacionKysely } from './infrastructure/evaluacion-kysely.adapter.js';
export { crearUnidadDeTrabajoCertificacion } from './infrastructure/unidad-de-trabajo-certificacion.js';
