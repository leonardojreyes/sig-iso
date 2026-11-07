import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { IdentidadVerificada } from '@sig/autenticacion';

/** Solicitud HTTP con lo mínimo que usa esta capa (sin depender de los tipos de Express). */
export interface SolicitudHttp {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  identidad?: IdentidadVerificada;
}

/** Identidad de quien llama, verificada por la guardia. Solo existe en rutas protegidas. */
export const Identidad = createParamDecorator((_dato: unknown, contexto: ExecutionContext): IdentidadVerificada => {
  const identidad = contexto.switchToHttp().getRequest<SolicitudHttp>().identidad;
  if (!identidad) throw new Error('No hay identidad verificada en esta solicitud');
  return identidad;
});
