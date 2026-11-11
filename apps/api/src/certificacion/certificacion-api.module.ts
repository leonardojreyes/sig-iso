import { DynamicModule, Module } from '@nestjs/common';
import type { AgregarMapeoUseCase, AprobarAlcanceUseCase, CambiarControlUseCase, CrearControlUseCase, EvaluarEntradaUseCase, GuardarAlcanceUseCase, ListarAlcancesUseCase, ListarControlesUseCase, ListarDiagnosticoUseCase, QuitarMapeoUseCase, RetirarControlUseCase } from '@sig/certificacion';
import { CertificacionController } from './certificacion.controller.js';
import { ControlesController } from './controles.controller.js';
import { AGREGAR_MAPEO, APROBAR_ALCANCE, CAMBIAR_CONTROL, CREAR_CONTROL, DIAGNOSTICO, EVALUAR_ENTRADA, GUARDAR_ALCANCE, LISTAR_ALCANCES, LISTAR_CONTROLES, QUITAR_MAPEO, RETIRAR_CONTROL } from './tokens.js';

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
}

/** Controladores de `/alcances` y `/diagnostico`. Los casos de uso llegan ya armados por la composición. */
@Module({})
export class CertificacionApiModule {
  static register(opciones: OpcionesCertificacionApi): DynamicModule {
    return {
      module: CertificacionApiModule,
      controllers: [CertificacionController, ControlesController],
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
      ],
    };
  }
}
