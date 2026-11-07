import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

// Los módulos de negocio se enlazan en la fase 6 (autenticación, autorización y controladores sobre el contrato OpenAPI).
@Module({ controllers: [HealthController] })
export class AppModule {}
