import { DynamicModule, Module } from '@nestjs/common';
import type { AprobarSolicitudUseCase, CambiarRolUseCase, DarDeBajaUseCase, DescartarSolicitudUseCase, ListarPersonasUseCase, SolicitarAccesoUseCase } from '@sig/empresas';
import { PersonasController } from './personas.controller.js';
import { APROBAR_SOLICITUD, CAMBIAR_ROL, DAR_DE_BAJA, DESCARTAR_SOLICITUD, LISTAR_PERSONAS, RELOJ_PERSONAS, SOLICITAR_ACCESO } from './tokens.js';

export interface OpcionesPersonasApi {
  readonly solicitarAcceso: SolicitarAccesoUseCase;
  readonly listarPersonas: ListarPersonasUseCase;
  readonly aprobarSolicitud: AprobarSolicitudUseCase;
  readonly descartarSolicitud: DescartarSolicitudUseCase;
  readonly cambiarRol: CambiarRolUseCase;
  readonly darDeBaja: DarDeBajaUseCase;
  /** Reloj de las solicitudes (vencimiento a los 7 días); por omisión, la hora real. */
  readonly reloj?: () => Date;
}

/** Controlador de las personas y las solicitudes de acceso (ADR 036). Los casos de uso llegan ya armados por la composición. */
@Module({})
export class PersonasApiModule {
  static register(opciones: OpcionesPersonasApi): DynamicModule {
    return {
      module: PersonasApiModule,
      controllers: [PersonasController],
      providers: [
        { provide: SOLICITAR_ACCESO, useValue: opciones.solicitarAcceso },
        { provide: LISTAR_PERSONAS, useValue: opciones.listarPersonas },
        { provide: APROBAR_SOLICITUD, useValue: opciones.aprobarSolicitud },
        { provide: DESCARTAR_SOLICITUD, useValue: opciones.descartarSolicitud },
        { provide: CAMBIAR_ROL, useValue: opciones.cambiarRol },
        { provide: DAR_DE_BAJA, useValue: opciones.darDeBaja },
        { provide: RELOJ_PERSONAS, useValue: opciones.reloj ?? (() => new Date()) },
      ],
    };
  }
}
