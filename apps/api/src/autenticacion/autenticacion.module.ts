import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import type { TokenVerifierPort } from '@sig/autenticacion';
import { AutenticacionGuard } from './autenticacion.guard.js';
import { ContextoEmpresaInterceptor } from './contexto-empresa.interceptor.js';
import { FiltroProblemas } from './filtro-problemas.js';
import { LimitadorPorVentana } from './limitador-por-ventana.js';
import { RegistradorTokenInvalido, type RegistradorHechos } from './registrador-token-invalido.js';
import { HECHOS, REGISTRADOR_TOKEN_INVALIDO, VERIFICADOR } from './tokens.js';

export interface OpcionesAutenticacion {
  readonly verificador: TokenVerifierPort;
  readonly hechos: RegistradorHechos;
  /** Reloj en milisegundos (pruebas). */
  readonly ahora?: () => number;
  /** Una vez por motivo y ventana. Por defecto 60 s. */
  readonly ventanaTokenInvalidoMs?: number;
}

/** Registra la guardia global, el contexto de empresa y el filtro de errores. Las dependencias llegan por las opciones. */
@Module({})
export class AutenticacionModule {
  static register(opciones: OpcionesAutenticacion): DynamicModule {
    const limitador = new LimitadorPorVentana(opciones.ventanaTokenInvalidoMs ?? 60_000, opciones.ahora ?? (() => Date.now()));
    return {
      module: AutenticacionModule,
      providers: [
        { provide: VERIFICADOR, useValue: opciones.verificador },
        { provide: HECHOS, useValue: opciones.hechos },
        { provide: REGISTRADOR_TOKEN_INVALIDO, useValue: new RegistradorTokenInvalido(opciones.hechos, limitador) },
        { provide: APP_GUARD, useClass: AutenticacionGuard },
        { provide: APP_INTERCEPTOR, useClass: ContextoEmpresaInterceptor },
        { provide: APP_FILTER, useClass: FiltroProblemas },
      ],
    };
  }
}
