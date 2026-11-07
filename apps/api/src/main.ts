import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { aplicarSeguridadHttp } from './autenticacion/seguridad-http.js';
import { AppModule } from './app.module.js';
import { crearConfiguracionOpenApi, OPCIONES_DOCUMENTO } from './openapi.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  aplicarSeguridadHttp(app, process.env);
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, crearConfiguracionOpenApi(), OPCIONES_DOCUMENTO));
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API:  http://localhost:${port}/health  ·  docs: http://localhost:${port}/docs`);
}
bootstrap();
