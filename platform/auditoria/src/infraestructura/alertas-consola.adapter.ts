import type { AlertaIntegridad, AlertasPort } from '../puertos/integridad.port';

/**
 * Alerta mínima: una línea JSON en la salida de error. Es el punto de enganche para correo, chat o monitoreo; la alerta nunca
 * lleva datos personales (solo claves de cadena, secuencias y tipos de problema).
 */
export class AlertasConsola implements AlertasPort {
  async notificar(alerta: AlertaIntegridad): Promise<void> {
    console.error(JSON.stringify({ nivel: alerta.severidad, asunto: alerta.asunto, problemas: alerta.problemas }));
  }
}
