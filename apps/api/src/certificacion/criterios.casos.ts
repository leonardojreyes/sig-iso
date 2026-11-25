import { GuardarCriteriosUseCase, ObtenerCriteriosUseCase, type AutorizacionPort, type ContextoCertificacion, type UnidadDeTrabajoPort } from '@sig/certificacion';

/** Token único de los casos de uso de los criterios de evaluación (ADR 038): el controlador los recibe agrupados. */
export const CRITERIOS = Symbol('CRITERIOS');

export interface CasosCriterios {
  readonly obtener: ObtenerCriteriosUseCase;
  readonly guardar: GuardarCriteriosUseCase;
}

export const crearCasosCriterios = (unidad: UnidadDeTrabajoPort<ContextoCertificacion>, autorizacion: AutorizacionPort, reloj: () => Date): CasosCriterios => ({
  obtener: new ObtenerCriteriosUseCase(unidad, autorizacion),
  guardar: new GuardarCriteriosUseCase(unidad, autorizacion, reloj),
});
