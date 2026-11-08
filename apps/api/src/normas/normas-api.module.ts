import { DynamicModule, Module } from '@nestjs/common';
import type { AdoptarLibreriaUseCase, ListarLibreriasUseCase, ListarRequisitosUseCase, ObtenerRequisitoUseCase } from '@sig/normas';
import { NormasController } from './normas.controller.js';
import { ADOPTAR, LIBRERIAS, REQUISITO, REQUISITOS } from './tokens.js';

export interface OpcionesNormasApi {
  readonly adoptar: AdoptarLibreriaUseCase;
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
      controllers: [NormasController],
      providers: [
        { provide: ADOPTAR, useValue: opciones.adoptar },
        { provide: LIBRERIAS, useValue: opciones.librerias },
        { provide: REQUISITOS, useValue: opciones.requisitos },
        { provide: REQUISITO, useValue: opciones.requisito },
      ],
    };
  }
}
