export { crearMarca, ErrorMarca, validarCambioMarca } from './domain/marca-empresa.js';
export type { MarcaEmpresa, DatosMarca, CambioMarca } from './domain/marca-empresa.js';
export { EMPRESA_REPOSITORY } from './application/empresa-repository.port.js';
export type { DatosEmpresa, DatosPersona, EmpresaRepositoryPort } from './application/empresa-repository.port.js';
export { EmpresaNoEncontradaError, ObtenerMarcaUseCase } from './application/obtener-marca.use-case.js';
export { ObtenerIdentidadUseCase, PersonaNoEncontradaError, type IdentidadDto, type RolesPort } from './application/obtener-identidad.use-case.js';
export { EmpresaKysely } from './infrastructure/empresa-kysely.adapter.js';
export { EMPRESA_ACTIVA } from './application/empresa-activa.port.js';
export type { EleccionDeSesion, EmpresaActivaPort, EmpresaDePersona } from './application/empresa-activa.port.js';
export {
  CambiarEmpresaUseCase,
  EleccionDeEmpresaInvalidaError,
  EmpresaAjenaError,
  EmpresaPedidaInvalidaError,
  ListarMisEmpresasUseCase,
  OlvidarEmpresaActivaUseCase,
  ResolverEmpresaActivaUseCase,
  VIDA_EMPRESA_ACTIVA_MS,
  type CambiarEmpresaEntrada,
  type EmpresaDePersonaDto,
  type RegistradorHechosPort,
} from './application/empresa-activa.use-cases.js';
export { EmpresaActivaKysely } from './infrastructure/empresa-activa-kysely.adapter.js';
export { ActualizarMarcaUseCase, MarcaNoValidaError, SinPermisoMarcaError } from './application/actualizar-marca.use-case.js';
export type { BitacoraDeUnidad, ContextoMarca, MarcaRepositoryPort, PermisoMarcaPort, UnidadDeTrabajoMarcaPort } from './application/marca-repository.port.js';
export { MarcaKysely } from './infrastructure/marca-kysely.adapter.js';
export { crearUnidadDeTrabajoMarca } from './infrastructure/unidad-de-trabajo-marca.js';
