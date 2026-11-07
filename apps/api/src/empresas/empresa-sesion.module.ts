import { DynamicModule, Module } from '@nestjs/common';
import type { ObtenerIdentidadUseCase, ObtenerMarcaUseCase } from '@sig/empresas';
import type { RegistradorHechos } from '../autenticacion/registrador-token-invalido.js';
import { SesionController } from '../sesion/sesion.controller.js';
import { SesionService } from '../sesion/sesion.service.js';
import { EmpresasController } from './empresas.controller.js';
import { IDENTIDADES, MARCAS } from './tokens.js';
import { SESION } from './tokens-sesion.js';

export interface OpcionesEmpresaSesion {
  readonly identidades: ObtenerIdentidadUseCase;
  readonly marcas: ObtenerMarcaUseCase;
  readonly hechos: RegistradorHechos;
}

/** Controladores de `/me`, `/empresa/marca` y `/sesion/*`. Los casos de uso llegan ya armados por la composición. */
@Module({})
export class EmpresaSesionModule {
  static register(opciones: OpcionesEmpresaSesion): DynamicModule {
    return {
      module: EmpresaSesionModule,
      controllers: [EmpresasController, SesionController],
      providers: [
        { provide: IDENTIDADES, useValue: opciones.identidades },
        { provide: MARCAS, useValue: opciones.marcas },
        { provide: SESION, useValue: new SesionService(opciones.identidades, opciones.hechos) },
      ],
    };
  }
}
