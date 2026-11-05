import { Module } from '@nestjs/common';
import { NormasModule } from '@sig/normas';
import { HealthController } from './health.controller.js';

@Module({ imports: [NormasModule], controllers: [HealthController] })
export class AppModule {}
