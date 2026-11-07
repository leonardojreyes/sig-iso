import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { aplicarSeguridadHttp } from './autenticacion/seguridad-http.js';
import { AppModule } from './app.module.js';
import { crearConfiguracionOpenApi, OPCIONES_DOCUMENTO } from './openapi.js';
import { crearMiddlewareTrazas } from './telemetria/middleware-trazas.js';
import { crearProveedorDeTrazas, leerConfiguracionTrazas } from './telemetria/proveedor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // El primero de la cadena: el span cubre todo, incluido lo que rechaza la guardia.
  app.use(crearMiddlewareTrazas(crearProveedorDeTrazas(leerConfiguracionTrazas(process.env)).getTracer('sig-iso-api')));
  aplicarSeguridadHttp(app, process.env);
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, crearConfiguracionOpenApi(), OPCIONES_DOCUMENTO));
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API:  http://localhost:${port}/health  ·  docs: http://localhost:${port}/docs`);
}
bootstrap();
