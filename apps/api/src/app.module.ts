import { Module } from '@nestjs/common';
import { AutenticacionModule } from './autenticacion/autenticacion.module.js';
import { opcionesAutenticacionDesdeEntorno } from './composicion.js';
import { HealthController } from './health.controller.js';

// Los controladores de negocio se enlazan en las tareas 6.5 y 6.6 (sobre el contrato OpenAPI).
@Module({ imports: [AutenticacionModule.register(opcionesAutenticacionDesdeEntorno(process.env))], controllers: [HealthController] })
export class AppModule {}
