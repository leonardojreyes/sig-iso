import { DynamicModule, Module } from '@nestjs/common';
import type { ActualizarMarcaUseCase, CambiarEmpresaUseCase, ListarMisEmpresasUseCase, ObtenerIdentidadUseCase, ObtenerMarcaUseCase, OlvidarEmpresaActivaUseCase } from '@sig/empresas';
import type { RegistradorHechos } from '../autenticacion/registrador-token-invalido.js';
import { SesionController } from '../sesion/sesion.controller.js';
import { SesionService } from '../sesion/sesion.service.js';
import { EmpresasController } from './empresas.controller.js';
import { ACTUALIZAR_MARCA, IDENTIDADES, MARCAS } from './tokens.js';
import { CAMBIAR_EMPRESA, LISTAR_EMPRESAS, SESION } from './tokens-sesion.js';

export interface OpcionesEmpresaSesion {
  readonly identidades: ObtenerIdentidadUseCase;
  readonly marcas: ObtenerMarcaUseCase;
  /** Edición de la marca (color y logo) de la empresa (M6b-2). */
  readonly actualizarMarca: ActualizarMarcaUseCase;
  readonly hechos: RegistradorHechos;
  /** Una persona en varias empresas (ADR 035). */
  readonly listarEmpresas: ListarMisEmpresasUseCase;
  readonly cambiarEmpresa: CambiarEmpresaUseCase;
  readonly olvidarEmpresa: OlvidarEmpresaActivaUseCase;
}

/** Controladores de `/me`, `/empresa/marca` y `/sesion/*` (inicio, cierre, empresas y cambio de empresa). Los casos de uso llegan ya armados por la composición. */
@Module({})
export class EmpresaSesionModule {
  static register(opciones: OpcionesEmpresaSesion): DynamicModule {
    return {
      module: EmpresaSesionModule,
      controllers: [EmpresasController, SesionController],
      providers: [
        { provide: IDENTIDADES, useValue: opciones.identidades },
        { provide: MARCAS, useValue: opciones.marcas },
        { provide: ACTUALIZAR_MARCA, useValue: opciones.actualizarMarca },
        { provide: SESION, useValue: new SesionService(opciones.identidades, opciones.hechos, opciones.olvidarEmpresa) },
        { provide: LISTAR_EMPRESAS, useValue: opciones.listarEmpresas },
        { provide: CAMBIAR_EMPRESA, useValue: opciones.cambiarEmpresa },
      ],
    };
  }
}
