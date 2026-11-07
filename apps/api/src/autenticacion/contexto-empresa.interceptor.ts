import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ejecutarConEmpresa } from '@sig/tenancy/contexto';
import { Observable } from 'rxjs';
import type { SolicitudHttp } from './identidad.js';

/**
 * Ejecuta el controlador DENTRO del contexto de la empresa del token verificado: el código de negocio y la base de datos la
 * leen de ahí y de ningún otro lado. Las rutas públicas no tienen contexto (pedir la empresa falla).
 */
@Injectable()
export class ContextoEmpresaInterceptor implements NestInterceptor {
  intercept(contexto: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    const identidad = contexto.switchToHttp().getRequest<SolicitudHttp>().identidad;
    if (!identidad) return siguiente.handle();
    return new Observable((suscriptor) => ejecutarConEmpresa(identidad.empresaId, () => siguiente.handle().subscribe(suscriptor)));
  }
}
