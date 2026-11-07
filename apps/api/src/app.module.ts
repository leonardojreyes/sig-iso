import { Module } from '@nestjs/common';
import { AutenticacionModule } from './autenticacion/autenticacion.module.js';
import { componerDesdeEntorno } from './composicion.js';
import { EmpresaSesionModule } from './empresas/empresa-sesion.module.js';
import { HealthController } from './health.controller.js';

// Los controladores de normas se enlazan en la tarea 6.6 (sobre el contrato OpenAPI).
const composicion = componerDesdeEntorno(process.env);

@Module({
  imports: [AutenticacionModule.register(composicion.autenticacion), EmpresaSesionModule.register(composicion.negocio)],
  controllers: [HealthController],
})
export class AppModule {}
