import {
  ActivosDeUnRiesgoUseCase,
  AvisoRetiroActivoUseCase,
  CambiarActivoUseCase,
  CrearActivoUseCase,
  DesligarActivoUseCase,
  LigarActivoUseCase,
  ListarActivosUseCase,
  ObtenerActivoUseCase,
  RetirarActivoUseCase,
  type AutorizacionPort,
  type ContextoCertificacion,
  type UnidadDeTrabajoPort,
} from '@sig/certificacion';

/** Token único de los casos de uso de los activos (ADR 038): el controlador los recibe agrupados. */
export const ACTIVOS = Symbol('ACTIVOS');

export interface CasosActivos {
  readonly listar: ListarActivosUseCase;
  readonly crear: CrearActivoUseCase;
  readonly obtener: ObtenerActivoUseCase;
  readonly cambiar: CambiarActivoUseCase;
  readonly avisarRetiro: AvisoRetiroActivoUseCase;
  readonly retirar: RetirarActivoUseCase;
  readonly deRiesgo: ActivosDeUnRiesgoUseCase;
  readonly ligar: LigarActivoUseCase;
  readonly desligar: DesligarActivoUseCase;
}

export const crearCasosActivos = (unidad: UnidadDeTrabajoPort<ContextoCertificacion>, autorizacion: AutorizacionPort, reloj: () => Date, nuevoId: () => string): CasosActivos => ({
  listar: new ListarActivosUseCase(unidad, autorizacion),
  crear: new CrearActivoUseCase(unidad, autorizacion, reloj, nuevoId),
  obtener: new ObtenerActivoUseCase(unidad, autorizacion),
  cambiar: new CambiarActivoUseCase(unidad, autorizacion, reloj),
  avisarRetiro: new AvisoRetiroActivoUseCase(unidad, autorizacion),
  retirar: new RetirarActivoUseCase(unidad, autorizacion, reloj),
  deRiesgo: new ActivosDeUnRiesgoUseCase(unidad, autorizacion),
  ligar: new LigarActivoUseCase(unidad, autorizacion, reloj),
  desligar: new DesligarActivoUseCase(unidad, autorizacion),
});
