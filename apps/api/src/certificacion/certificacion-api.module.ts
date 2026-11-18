import { DynamicModule, Module } from '@nestjs/common';
import type { ListarRiesgosUseCase, CrearRiesgoUseCase, ObtenerRiesgoUseCase, CambiarRiesgoUseCase, AvisoRetiroRiesgoUseCase, RetirarRiesgoUseCase, VincularRiesgoControlUseCase, DesvincularRiesgoControlUseCase, PreverTratamientoUseCase, QuitarTratamientoPrevistoUseCase, RiesgosDeUnControlUseCase, ListarMotivosUseCase, RegistrarMotivoUseCase, QuitarMotivoUseCase, ListarReferenciasUseCase, GuardarReferenciaUseCase, QuitarReferenciaUseCase, AprobarDeclaracionUseCase, ExportarDeclaracionUseCase, ListarVersionesDeclaracionUseCase, ObtenerDeclaracionUseCase, ObtenerVersionDeclaracionUseCase, AgregarMapeoUseCase, DescargarEvidenciaUseCase, EliminarEvidenciaUseCase, ListarCoberturaUseCase, ListarEvidenciasUseCase, ReemplazarEvidenciaUseCase, SubirEvidenciaUseCase, AprobarAlcanceUseCase, CambiarControlUseCase, CrearControlUseCase, EvaluarEntradaUseCase, GuardarAlcanceUseCase, ListarAlcancesUseCase, ListarControlesUseCase, ListarDiagnosticoUseCase, QuitarMapeoUseCase, RetirarControlUseCase } from '@sig/certificacion';
import { CertificacionController } from './certificacion.controller.js';
import { ControlesController } from './controles.controller.js';
import { DeclaracionController } from './declaracion.controller.js';
import { JustificacionDeclaracionController } from './justificacion.controller.js';
import { RiesgosController } from './riesgos.controller.js';
import { EvidenciasController, PrepararReemplazarEvidencia, PrepararSubirEvidencia } from './evidencias.controller.js';
import { LimitarTamanoSubida } from './subida.js';
import { LISTAR_RIESGOS, CREAR_RIESGO, OBTENER_RIESGO, CAMBIAR_RIESGO, AVISAR_RETIRO_RIESGO, RETIRAR_RIESGO, VINCULAR_RIESGO_CONTROL, DESVINCULAR_RIESGO_CONTROL, PREVER_TRATAMIENTO, QUITAR_TRATAMIENTO_PREVISTO, RIESGOS_DE_CONTROL, LISTAR_MOTIVOS, REGISTRAR_MOTIVO, QUITAR_MOTIVO, LISTAR_REFERENCIAS, GUARDAR_REFERENCIA, QUITAR_REFERENCIA, APROBAR_DECLARACION, EXPORTAR_DECLARACION, LISTAR_VERSIONES_DECLARACION, OBTENER_DECLARACION, OBTENER_VERSION_DECLARACION, AGREGAR_MAPEO, APROBAR_ALCANCE, COBERTURA, DESCARGAR_EVIDENCIA, ELIMINAR_EVIDENCIA, LISTAR_EVIDENCIAS, REEMPLAZAR_EVIDENCIA, SUBIR_EVIDENCIA, CAMBIAR_CONTROL, CREAR_CONTROL, DIAGNOSTICO, EVALUAR_ENTRADA, GUARDAR_ALCANCE, LISTAR_ALCANCES, LISTAR_CONTROLES, QUITAR_MAPEO, RETIRAR_CONTROL } from './tokens.js';

export interface OpcionesCertificacionApi {
  readonly alcances: ListarAlcancesUseCase;
  readonly guardarAlcance: GuardarAlcanceUseCase;
  readonly aprobarAlcance: AprobarAlcanceUseCase;
  readonly diagnostico: ListarDiagnosticoUseCase;
  readonly evaluar: EvaluarEntradaUseCase;
  readonly listarControles: ListarControlesUseCase;
  readonly crearControl: CrearControlUseCase;
  readonly cambiarControl: CambiarControlUseCase;
  readonly retirarControl: RetirarControlUseCase;
  readonly agregarMapeo: AgregarMapeoUseCase;
  readonly quitarMapeo: QuitarMapeoUseCase;
  readonly listarEvidencias: ListarEvidenciasUseCase;
  readonly subirEvidencia: SubirEvidenciaUseCase;
  readonly reemplazarEvidencia: ReemplazarEvidenciaUseCase;
  readonly eliminarEvidencia: EliminarEvidenciaUseCase;
  readonly descargarEvidencia: DescargarEvidenciaUseCase;
  readonly cobertura: ListarCoberturaUseCase;
  readonly declaracion: ObtenerDeclaracionUseCase;
  readonly aprobarDeclaracion: AprobarDeclaracionUseCase;
  readonly versionesDeclaracion: ListarVersionesDeclaracionUseCase;
  readonly versionDeclaracion: ObtenerVersionDeclaracionUseCase;
  readonly exportarDeclaracion: ExportarDeclaracionUseCase;
  readonly listarRiesgos: ListarRiesgosUseCase;
  readonly crearRiesgo: CrearRiesgoUseCase;
  readonly obtenerRiesgo: ObtenerRiesgoUseCase;
  readonly cambiarRiesgo: CambiarRiesgoUseCase;
  readonly avisarRetiroRiesgo: AvisoRetiroRiesgoUseCase;
  readonly retirarRiesgo: RetirarRiesgoUseCase;
  readonly vincularRiesgoControl: VincularRiesgoControlUseCase;
  readonly desvincularRiesgoControl: DesvincularRiesgoControlUseCase;
  readonly preverTratamiento: PreverTratamientoUseCase;
  readonly quitarTratamientoPrevisto: QuitarTratamientoPrevistoUseCase;
  readonly riesgosDeControl: RiesgosDeUnControlUseCase;
  readonly listarMotivos: ListarMotivosUseCase;
  readonly registrarMotivo: RegistrarMotivoUseCase;
  readonly quitarMotivo: QuitarMotivoUseCase;
  readonly listarReferencias: ListarReferenciasUseCase;
  readonly guardarReferencia: GuardarReferenciaUseCase;
  readonly quitarReferencia: QuitarReferenciaUseCase;
}

/** Controladores de `/alcances` y `/diagnostico`. Los casos de uso llegan ya armados por la composición. */
@Module({})
export class CertificacionApiModule {
  static register(opciones: OpcionesCertificacionApi): DynamicModule {
    return {
      module: CertificacionApiModule,
      controllers: [CertificacionController, ControlesController, EvidenciasController, DeclaracionController, RiesgosController, JustificacionDeclaracionController],
      providers: [
        { provide: LISTAR_ALCANCES, useValue: opciones.alcances },
        { provide: GUARDAR_ALCANCE, useValue: opciones.guardarAlcance },
        { provide: APROBAR_ALCANCE, useValue: opciones.aprobarAlcance },
        { provide: DIAGNOSTICO, useValue: opciones.diagnostico },
        { provide: EVALUAR_ENTRADA, useValue: opciones.evaluar },
        { provide: LISTAR_CONTROLES, useValue: opciones.listarControles },
        { provide: CREAR_CONTROL, useValue: opciones.crearControl },
        { provide: CAMBIAR_CONTROL, useValue: opciones.cambiarControl },
        { provide: RETIRAR_CONTROL, useValue: opciones.retirarControl },
        { provide: AGREGAR_MAPEO, useValue: opciones.agregarMapeo },
        { provide: QUITAR_MAPEO, useValue: opciones.quitarMapeo },
        { provide: LISTAR_EVIDENCIAS, useValue: opciones.listarEvidencias },
        { provide: SUBIR_EVIDENCIA, useValue: opciones.subirEvidencia },
        { provide: REEMPLAZAR_EVIDENCIA, useValue: opciones.reemplazarEvidencia },
        { provide: ELIMINAR_EVIDENCIA, useValue: opciones.eliminarEvidencia },
        { provide: DESCARGAR_EVIDENCIA, useValue: opciones.descargarEvidencia },
        { provide: COBERTURA, useValue: opciones.cobertura },
        { provide: OBTENER_DECLARACION, useValue: opciones.declaracion },
        { provide: APROBAR_DECLARACION, useValue: opciones.aprobarDeclaracion },
        { provide: LISTAR_VERSIONES_DECLARACION, useValue: opciones.versionesDeclaracion },
        { provide: OBTENER_VERSION_DECLARACION, useValue: opciones.versionDeclaracion },
        { provide: EXPORTAR_DECLARACION, useValue: opciones.exportarDeclaracion },
        { provide: LISTAR_RIESGOS, useValue: opciones.listarRiesgos },
        { provide: CREAR_RIESGO, useValue: opciones.crearRiesgo },
        { provide: OBTENER_RIESGO, useValue: opciones.obtenerRiesgo },
        { provide: CAMBIAR_RIESGO, useValue: opciones.cambiarRiesgo },
        { provide: AVISAR_RETIRO_RIESGO, useValue: opciones.avisarRetiroRiesgo },
        { provide: RETIRAR_RIESGO, useValue: opciones.retirarRiesgo },
        { provide: VINCULAR_RIESGO_CONTROL, useValue: opciones.vincularRiesgoControl },
        { provide: DESVINCULAR_RIESGO_CONTROL, useValue: opciones.desvincularRiesgoControl },
        { provide: PREVER_TRATAMIENTO, useValue: opciones.preverTratamiento },
        { provide: QUITAR_TRATAMIENTO_PREVISTO, useValue: opciones.quitarTratamientoPrevisto },
        { provide: RIESGOS_DE_CONTROL, useValue: opciones.riesgosDeControl },
        { provide: LISTAR_MOTIVOS, useValue: opciones.listarMotivos },
        { provide: REGISTRAR_MOTIVO, useValue: opciones.registrarMotivo },
        { provide: QUITAR_MOTIVO, useValue: opciones.quitarMotivo },
        { provide: LISTAR_REFERENCIAS, useValue: opciones.listarReferencias },
        { provide: GUARDAR_REFERENCIA, useValue: opciones.guardarReferencia },
        { provide: QUITAR_REFERENCIA, useValue: opciones.quitarReferencia },
        PrepararSubirEvidencia,
        PrepararReemplazarEvidencia,
        LimitarTamanoSubida,
      ],
    };
  }
}
