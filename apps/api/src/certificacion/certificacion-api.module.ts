import { DynamicModule, Module } from '@nestjs/common';
import type { AprobarAlcanceUseCase, EvaluarEntradaUseCase, GuardarAlcanceUseCase, ListarAlcancesUseCase, ListarDiagnosticoUseCase } from '@sig/certificacion';
import { CertificacionController } from './certificacion.controller.js';
import { APROBAR_ALCANCE, DIAGNOSTICO, EVALUAR_ENTRADA, GUARDAR_ALCANCE, LISTAR_ALCANCES } from './tokens.js';

export interface OpcionesCertificacionApi {
  readonly alcances: ListarAlcancesUseCase;
  readonly guardarAlcance: GuardarAlcanceUseCase;
  readonly aprobarAlcance: AprobarAlcanceUseCase;
  readonly diagnostico: ListarDiagnosticoUseCase;
  readonly evaluar: EvaluarEntradaUseCase;
}

/** Controladores de `/alcances` y `/diagnostico`. Los casos de uso llegan ya armados por la composición. */
@Module({})
export class CertificacionApiModule {
  static register(opciones: OpcionesCertificacionApi): DynamicModule {
    return {
      module: CertificacionApiModule,
      controllers: [CertificacionController],
      providers: [
        { provide: LISTAR_ALCANCES, useValue: opciones.alcances },
        { provide: GUARDAR_ALCANCE, useValue: opciones.guardarAlcance },
        { provide: APROBAR_ALCANCE, useValue: opciones.aprobarAlcance },
        { provide: DIAGNOSTICO, useValue: opciones.diagnostico },
        { provide: EVALUAR_ENTRADA, useValue: opciones.evaluar },
      ],
    };
  }
}
