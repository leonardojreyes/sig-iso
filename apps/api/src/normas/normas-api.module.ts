import { DynamicModule, Module } from '@nestjs/common';
import type { AdoptarLibreriaUseCase, CargarLibreriaUseCase, ListarLibreriasUseCase, ListarRequisitosUseCase, ObtenerRequisitoUseCase } from '@sig/normas';
import { CargaLibreriaController, ExigirPermisoCarga, LimitarTamanoCarga } from './carga-libreria.controller.js';
import { NormasController } from './normas.controller.js';
import { ADOPTAR, CARGAR_LIBRERIA, LIBRERIAS, REQUISITO, REQUISITOS } from './tokens.js';

export interface OpcionesNormasApi {
  readonly adoptar: AdoptarLibreriaUseCase;
  readonly cargar: CargarLibreriaUseCase;
  readonly librerias: ListarLibreriasUseCase;
  readonly requisitos: ListarRequisitosUseCase;
  readonly requisito: ObtenerRequisitoUseCase;
}

/** Controladores de `/librerias`, la adopción y `/requisitos`. Los casos de uso llegan ya armados por la composición. */
@Module({})
export class NormasApiModule {
  static register(opciones: OpcionesNormasApi): DynamicModule {
    return {
      module: NormasApiModule,
      controllers: [NormasController, CargaLibreriaController],
      providers: [
        ExigirPermisoCarga,
        LimitarTamanoCarga,
        { provide: ADOPTAR, useValue: opciones.adoptar },
        { provide: CARGAR_LIBRERIA, useValue: opciones.cargar },
        { provide: LIBRERIAS, useValue: opciones.librerias },
        { provide: REQUISITOS, useValue: opciones.requisitos },
        { provide: REQUISITO, useValue: opciones.requisito },
      ],
    };
  }
}
