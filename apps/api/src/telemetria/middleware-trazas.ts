import { SpanKind, SpanStatusCode, type Tracer } from '@opentelemetry/api';
import { esEmpresaId } from '@sig/tenancy';
import type { EventEmitter } from 'node:events';

interface Solicitud {
  readonly method?: string;
  readonly route?: { readonly path?: unknown };
  /** La fija la guardia de autenticación cuando verifica el token. */
  readonly identidad?: { readonly empresaId?: unknown };
}
interface Respuesta extends EventEmitter {
  readonly statusCode: number;
}

const METODOS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Un span de servidor por solicitud, con SOLO estos atributos: método, ruta (el patrón, por ejemplo `/requisitos/:id`, nunca la
 * dirección real), código de estado y, si la persona está autenticada, `empresa_id` (el de su token verificado). No se registran
 * la consulta, los identificadores, las cabeceras, el token, la persona ni la dirección de red.
 */
export const crearMiddlewareTrazas = (tracer: Tracer) => (req: Solicitud, res: Respuesta, siguiente: () => void): void => {
  const metodo = METODOS.has(String(req.method)) ? String(req.method) : '_OTHER';
  const span = tracer.startSpan(metodo, { kind: SpanKind.SERVER });
  let cerrado = false;

  const cerrar = (terminoLaRespuesta: boolean): void => {
    if (cerrado) return;
    cerrado = true;
    const patron = req.route?.path;
    const ruta = typeof patron === 'string' ? patron : 'desconocida';
    span.updateName(`${metodo} ${ruta}`);
    span.setAttribute('http.request.method', metodo);
    span.setAttribute('http.route', ruta);
    // Si la conexión se cortó antes de responder no hay código de estado que informar.
    if (terminoLaRespuesta) {
      span.setAttribute('http.response.status_code', res.statusCode);
      if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
    }
    const empresaId = req.identidad?.empresaId;
    if (esEmpresaId(empresaId)) span.setAttribute('empresa_id', empresaId);
    span.end();
  };

  res.once('finish', () => cerrar(true));
  res.once('close', () => cerrar(false));
  siguiente();
};
