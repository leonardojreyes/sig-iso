import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { problemaDeEstado } from './problema.js';

interface RespuestaHttp {
  status(codigo: number): RespuestaHttp;
  setHeader(nombre: string, valor: string): RespuestaHttp;
  send(cuerpo: string): void;
}

/**
 * Convierte TODA excepción en `application/problem+json` con el contrato cerrado. Nunca incluye el mensaje, la pila ni datos de
 * la solicitud. De los errores inesperados solo se registra en el servidor el nombre de la clase.
 */
@Catch()
export class FiltroProblemas implements ExceptionFilter {
  private readonly log = new Logger('Problemas');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<RespuestaHttp>();
    const estado = excepcion instanceof HttpException ? excepcion.getStatus() : 500;
    if (!(excepcion instanceof HttpException)) {
      this.log.error(`Error no controlado: ${excepcion instanceof Error ? excepcion.name : typeof excepcion}`);
    }
    const problema = problemaDeEstado(estado);
    res.status(problema.status).setHeader('Content-Type', 'application/problem+json; charset=utf-8').setHeader('Cache-Control', 'no-store').send(JSON.stringify(problema));
  }
}
