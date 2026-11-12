// Subida y descarga de archivos de evidencias (ADR 032). Esta capa solo COMPONE: el caso de uso decide el permiso, los datos, el
// control, el tipo (por el contenido), la huella y la transacción. Lo importante aquí es el ORDEN: la API no lee un solo byte del
// archivo hasta que el caso de uso lo pide, y eso ocurre después de decidir el permiso y los datos.
import { Injectable, PayloadTooLargeException, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { TAMANO_MAX_BYTES, type SubidaPendiente } from '@sig/certificacion';
import { catchError, from, mergeMap, throwError, type Observable } from 'rxjs';

/** Lo que llega de multer por cada archivo: el flujo todavía sin leer. */
export interface ArchivoEntrante {
  readonly fieldname: string;
  readonly originalname: string;
  readonly stream: AsyncIterable<Uint8Array>;
}

export const ACCION_SUBIDA = Symbol('ACCION_SUBIDA');
export const RESULTADO_SUBIDA = Symbol('RESULTADO_SUBIDA');

interface SolicitudDeSubida {
  [ACCION_SUBIDA]?: (archivo: ArchivoEntrante) => Promise<SubidaPendiente>;
  [RESULTADO_SUBIDA]?: SubidaPendiente;
}

/**
 * Motor de almacenamiento de multer que NO guarda nada: cuando llega el archivo llama a la acción que preparó la solicitud (el caso
 * de uso, en su primera fase), que lo lee cuando le toca y devuelve una subida PENDIENTE. Si la acción falla, multer corta la subida y
 * la solicitud termina con ese error. La transacción NO se confirma aquí: solo cuando multer termina sin errores (ver `confirmarSubida`),
 * así una petición con un segundo archivo, o cortada, no deja ningún efecto.
 */
export class MotorSubida {
  _handleFile(solicitud: SolicitudDeSubida, archivo: ArchivoEntrante, cb: (error?: unknown, info?: unknown) => void): void {
    const accion = solicitud[ACCION_SUBIDA];
    if (!accion) {
      cb(new Error('Subida sin acción preparada'));
      return;
    }
    accion(archivo).then(
      (resultado) => {
        solicitud[RESULTADO_SUBIDA] = resultado;
        cb(null, {});
      },
      (error: unknown) => cb(error),
    );
  }

  _removeFile(_solicitud: unknown, _archivo: unknown, cb: (error?: unknown) => void): void {
    cb(null);
  }
}

export const prepararSubida = (solicitud: unknown, accion: (archivo: ArchivoEntrante) => Promise<SubidaPendiente>): void => {
  (solicitud as SolicitudDeSubida)[ACCION_SUBIDA] = accion;
};

/** La subida pendiente que dejó el motor, si llegó un archivo. */
export const subidaPendiente = (solicitud: unknown): SubidaPendiente | undefined => (solicitud as SolicitudDeSubida)[RESULTADO_SUBIDA];

/**
 * Si la cadena de interceptores falla (multer rechaza un segundo archivo, cortan la conexión…), descarta la subida pendiente para
 * no dejar ni el archivo temporal ni ningún efecto. Se aplica al `Observable` de la solicitud y vuelve a lanzar el mismo error.
 */
export const descartarSiFalla = (solicitud: unknown, flujo: Observable<unknown>): Observable<unknown> =>
  flujo.pipe(
    catchError((error: unknown) =>
      from(subidaPendiente(solicitud)?.descartar() ?? Promise.resolve()).pipe(mergeMap(() => throwError(() => error))),
    ),
  );

/** Límites de multer: un solo archivo (con un byte de margen, para que el almacén detecte el exceso y lo registre), pocos campos y cortos. */
export const LIMITES_SUBIDA = Object.freeze({ files: 1, fileSize: TAMANO_MAX_BYTES + 1, fields: 8, fieldSize: 4096, parts: 10, headerPairs: 50 });

/** Margen sobre los 25 MB del archivo para los campos de texto y las cabeceras del multipart. */
const MARGEN_PETICION = 256 * 1024;

/**
 * Rechaza con 413, SIN leer el cuerpo, una subida que ya declara un tamaño mayor al permitido, y cierra la conexión para no seguir
 * recibiendo. Las subidas sin `Content-Length` (por trozos) las acota el almacén al pasar de 25 MB.
 */
@Injectable()
export class LimitarTamanoSubida implements NestInterceptor {
  intercept(contexto: ExecutionContext, siguiente: CallHandler) {
    const http = contexto.switchToHttp();
    const declarado = Number(http.getRequest<{ headers: Record<string, string | undefined> }>().headers['content-length']);
    if (Number.isFinite(declarado) && declarado > TAMANO_MAX_BYTES + MARGEN_PETICION) {
      http.getResponse<{ setHeader(n: string, v: string): void }>().setHeader('Connection', 'close');
      throw new PayloadTooLargeException();
    }
    return siguiente.handle();
  }
}

/**
 * `Content-Disposition` de una descarga: SIEMPRE adjunto. El nombre ya es una etiqueta normalizada; aun así se escapa por si acaso:
 * una versión ASCII para clientes viejos y la UTF-8 codificada (RFC 6266 y 5987).
 */
export const contentDisposition = (nombre: string): string => {
  const ascii = nombre.replace(/[^A-Za-z0-9 ._()-]/g, '_').replace(/"/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
};
