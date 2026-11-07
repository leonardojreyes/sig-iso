import { DocumentBuilder } from '@nestjs/swagger';

/** Configuración del documento OpenAPI que genera la API en `/docs`. La prueba de conformidad usa la misma. */
export const crearConfiguracionOpenApi = () =>
  new DocumentBuilder()
    .setTitle('sig-iso API')
    .setDescription('Sistema de Gestión Integrado ISO — SynapTech')
    .setVersion('0.1.0')
    .setOpenAPIVersion('3.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token de acceso emitido por el sistema de identidad. La empresa sale de su contenido.' }, 'bearerAuth')
    .build();

/** Opciones del documento: las etiquetas son las del contrato, no las que Nest deduce del nombre de cada controlador. */
export const OPCIONES_DOCUMENTO = { autoTagControllers: false } as const;
