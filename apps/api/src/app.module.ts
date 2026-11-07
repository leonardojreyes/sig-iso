import { Module } from '@nestjs/common';
import { AutenticacionModule } from './autenticacion/autenticacion.module.js';
import { componerDesdeEntorno } from './composicion.js';
import { EmpresaSesionModule } from './empresas/empresa-sesion.module.js';
import { HealthController } from './health.controller.js';
import { NormasApiModule } from './normas/normas-api.module.js';

const composicion = componerDesdeEntorno(process.env);

@Module({
  imports: [AutenticacionModule.register(composicion.autenticacion), EmpresaSesionModule.register(composicion.negocio), NormasApiModule.register(composicion.normas)],
  controllers: [HealthController],
})
export class AppModule {}
