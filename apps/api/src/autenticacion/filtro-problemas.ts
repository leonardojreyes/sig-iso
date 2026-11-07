import { ArgumentsHost, Catch, Inject, Logger, type ExceptionFilter } from '@nestjs/common';
import type { EventoBitacora } from '@sig/auditoria';
import { clasificarExcepcion, type Clasificacion } from './clasificar-excepcion.js';
import type { SolicitudHttp } from './identidad.js';
import { problemaDeEstado, type Problema } from './problema.js';
import type { RegistradorHechos } from './registrador-token-invalido.js';
import { HECHOS } from './tokens.js';

interface RespuestaHttp {
  readonly headersSent?: boolean;
  status(codigo: number): RespuestaHttp;
  setHeader(nombre: string, valor: string): RespuestaHttp;
  send(cuerpo: string): void;
}

/**
 * Convierte TODA excepción en `application/problem+json` con el contrato cerrado (sin mensajes, pilas ni datos de la solicitud)
 * y registra los accesos denegados (403) y cruzados (404) en la bitácora, cada uno en su PROPIA transacción.
 *
 * H6.8 prevalece sobre la respuesta: si el hecho no se puede registrar, se responde 500 en lugar del 403 o el 404.
 * Un 404 cruzado produce exactamente la misma respuesta que un 404 normal.
 */
@Catch()
export class FiltroProblemas implements ExceptionFilter {
  private readonly log = new Logger('Problemas');

  constructor(@Inject(HECHOS) private readonly hechos: RegistradorHechos) {}

  async catch(excepcion: unknown, host: ArgumentsHost): Promise<void> {
    const contexto = host.switchToHttp();
    const res = contexto.getResponse<RespuestaHttp>();
    const solicitud = contexto.getRequest<SolicitudHttp>();
    let problema: Problema;
    try {
      const clasificacion = clasificarExcepcion(excepcion);
      if (clasificacion.tipo === 'http' && clasificacion.estado >= 500) {
        this.log.error(`Error no controlado: ${excepcion instanceof Error ? excepcion.name : typeof excepcion}`);
      }
      if (clasificacion.tipo !== 'http') await this.registrar(clasificacion, solicitud);
      problema = problemaDeEstado(clasificacion.tipo === 'denegado' ? 403 : clasificacion.tipo === 'cruzado' ? 404 : clasificacion.estado);
    } catch (errorAlRegistrar) {
      // No se pudo dejar rastro del rechazo: no se da por bueno (H6.8).
      this.log.error(`No se pudo registrar el acceso rechazado: ${errorAlRegistrar instanceof Error ? errorAlRegistrar.name : typeof errorAlRegistrar}`);
      problema = problemaDeEstado(500);
    }
    if (res.headersSent) return;
    res.status(problema.status).setHeader('Content-Type', 'application/problem+json; charset=utf-8').setHeader('Cache-Control', 'no-store').send(JSON.stringify(problema));
  }

  private async registrar(c: Exclude<Clasificacion, { tipo: 'http' }>, solicitud: SolicitudHttp): Promise<void> {
    const identidad = solicitud.identidad;
    if (!identidad) throw new Error('Un acceso rechazado sin identidad verificada no se puede registrar');
    const evento: EventoBitacora = {
      empresaId: identidad.empresaId,
      actor: { tipo: 'usuario', usuarioId: identidad.usuarioId },
      accion: c.tipo === 'denegado' ? 'acceso.denegado' : 'acceso.cruzado',
      resultado: 'rechazado',
      motivo: c.tipo === 'denegado' ? 'sin_permiso' : 'empresa_distinta',
      ...(c.objeto ? { objeto: c.objeto } : {}),
    };
    await this.hechos.registrar(evento);
  }
}
