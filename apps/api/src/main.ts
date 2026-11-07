import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { aplicarSeguridadHttp } from './autenticacion/seguridad-http.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  aplicarSeguridadHttp(app, process.env);
  const config = new DocumentBuilder()
    .setTitle('sig-iso API')
    .setDescription('Sistema de Gestión Integrado ISO — SynapTech')
    .setVersion('0.1.0')
    .setOpenAPIVersion('3.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API:  http://localhost:${port}/health  ·  docs: http://localhost:${port}/docs`);
}
bootstrap();
