import type { INestApplication } from '@nestjs/common';
import { leerOrigenesCors, type Entorno } from './configuracion.js';

interface Respuesta { setHeader(nombre: string, valor: string): void }
interface Solicitud { path?: string; url?: string }

/**
 * Cabeceras de seguridad de la API y CORS con lista blanca. La documentación (`/docs`) queda fuera de la política de contenido
 * y de `no-store` porque su interfaz necesita cargar scripts y estilos.
 */
export const aplicarSeguridadHttp = (app: INestApplication, env: Entorno): void => {
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((solicitud: Solicitud, respuesta: Respuesta, siguiente: () => void) => {
    const ruta = solicitud.path ?? solicitud.url ?? '';
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    respuesta.setHeader('Referrer-Policy', 'no-referrer');
    if (ruta !== '/docs' && !ruta.startsWith('/docs/')) {
      respuesta.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      respuesta.setHeader('Cache-Control', 'no-store');
    }
    siguiente();
  });
  const origenes = leerOrigenesCors(env);
  if (origenes.length > 0) {
    app.enableCors({ origin: origenes, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type'], credentials: false, maxAge: 600 });
  }
};
