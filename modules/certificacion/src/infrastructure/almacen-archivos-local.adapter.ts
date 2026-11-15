// Almacén de archivos sobre el sistema de archivos (ADR 032). Cada archivo vive en `<base>/<empresa_id>/<uuid>` y la empresa viene
// SIEMPRE del token: nada del cliente forma parte de la ruta. Antes de tocar el disco se valida que los identificadores sean UUID y
// que la ruta resuelta quede dentro de la carpeta de la empresa. Carpetas 0700 y archivos 0600. Los mensajes de error no incluyen rutas.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { isAbsolute, dirname, join, resolve } from 'node:path';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import type { EmpresaId } from '@sig/tenancy';
import type { AlmacenArchivosPort, ResultadoGuardado } from '../application/almacen-archivos.port.js';
import type { LectorBytes } from '../domain/deteccion-archivo.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Fallo del almacén. El mensaje es seguro para registrar: nunca lleva rutas ni nombres. */
export class ErrorAlmacen extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAlmacen';
  }
}

const noExiste = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'ENOENT';

export class AlmacenArchivosLocal implements AlmacenArchivosPort {
  private readonly base: string;

  /** `base` debe ser una ruta ABSOLUTA, fuera del repositorio (variable `EVIDENCIAS_DIR`). */
  constructor(base: string) {
    if (typeof base !== 'string' || base.trim() === '' || !isAbsolute(base)) throw new ErrorAlmacen('La carpeta de evidencias debe ser una ruta absoluta (EVIDENCIAS_DIR).');
    this.base = resolve(base);
  }

  private carpeta(empresaId: EmpresaId): string {
    const id = String(empresaId).toLowerCase();
    if (!UUID.test(id)) throw new ErrorAlmacen('Empresa no válida.');
    return join(this.base, id);
  }

  /** Ruta de un archivo: el nombre debe ser un UUID y el resultado tiene que quedar DIRECTAMENTE dentro de la carpeta de la empresa. */
  private ruta(empresaId: EmpresaId, id: string, temporal: boolean): string {
    const carpeta = this.carpeta(empresaId);
    if (typeof id !== 'string' || !UUID.test(id)) throw new ErrorAlmacen('Identificador de archivo no válido.');
    const ruta = resolve(carpeta, temporal ? `tmp-${id}` : id);
    if (dirname(ruta) !== carpeta) throw new ErrorAlmacen('Ruta fuera de la carpeta de la empresa.');
    return ruta;
  }

  private async asegurarCarpeta(empresaId: EmpresaId): Promise<void> {
    const carpeta = this.carpeta(empresaId);
    await mkdir(carpeta, { recursive: true, mode: 0o700 });
    const st = await lstat(carpeta);
    if (!st.isDirectory() || st.isSymbolicLink()) throw new ErrorAlmacen('La carpeta de la empresa no es una carpeta normal.');
  }

  async guardarTemporal(empresaId: EmpresaId, flujo: AsyncIterable<Uint8Array>, maximoBytes: number): Promise<ResultadoGuardado> {
    if (!Number.isInteger(maximoBytes) || maximoBytes < 1) throw new ErrorAlmacen('Tamaño máximo no válido.');
    await this.asegurarCarpeta(empresaId);
    const id = randomUUID();
    const destino = this.ruta(empresaId, id, true);
    const hash = createHash('sha256');
    const salida = createWriteStream(destino, { flags: 'wx', mode: 0o600 });
    let bytes = 0;
    let excedido = false;
    try {
      for await (const parte of flujo) {
        bytes += parte.length;
        if (bytes > maximoBytes) {
          excedido = true;
          break; // al salir del bucle el iterador cierra el flujo de origen
        }
        hash.update(parte);
        if (!salida.write(parte)) await once(salida, 'drain');
      }
      salida.end();
      await finished(salida);
    } catch (e) {
      // El archivo se abre de forma asíncrona: hay que esperar a que el flujo cierre antes de borrarlo, o el borrado llegaría
      // antes de que exista y quedaría un temporal huérfano.
      await new Promise<void>((listo) => {
        if (salida.closed) return listo();
        salida.once('close', () => listo());
        salida.destroy();
      });
      await unlink(destino).catch(() => undefined);
      throw e;
    }
    if (excedido) {
      await unlink(destino).catch(() => undefined);
      return { ok: false, motivo: 'tamano_excedido' };
    }
    return { ok: true, temporal: { id, bytes, sha256: hash.digest('hex') } };
  }

  async abrirLector(empresaId: EmpresaId, temporalId: string): Promise<LectorBytes> {
    const ruta = this.ruta(empresaId, temporalId, true);
    const st = await lstat(ruta).catch((e: unknown) => {
      throw noExiste(e) ? new ErrorAlmacen('Archivo temporal no encontrado.') : e;
    });
    if (!st.isFile()) throw new ErrorAlmacen('El archivo temporal no es un archivo normal.');
    const tamano = st.size;
    return {
      tamano,
      leer: async (desde, hasta) => {
        const largo = Math.max(0, Math.min(hasta, tamano) - desde);
        const buffer = Buffer.alloc(largo);
        const gestor = await open(ruta, 'r');
        try {
          let leidos = 0;
          while (leidos < largo) {
            const { bytesRead } = await gestor.read(buffer, leidos, largo - leidos, desde + leidos);
            if (bytesRead === 0) break;
            leidos += bytesRead;
          }
          return buffer.subarray(0, leidos);
        } finally {
          await gestor.close();
        }
      },
    };
  }

  async confirmar(empresaId: EmpresaId, temporalId: string, archivoId: string): Promise<void> {
    const origen = this.ruta(empresaId, temporalId, true);
    const destino = this.ruta(empresaId, archivoId, false);
    const existe = await lstat(destino).then(() => true, (e: unknown) => (noExiste(e) ? false : Promise.reject(e)));
    if (existe) throw new ErrorAlmacen('Ya existe un archivo con ese identificador.');
    await rename(origen, destino).catch((e: unknown) => {
      throw noExiste(e) ? new ErrorAlmacen('Archivo temporal no encontrado.') : e;
    });
  }

  async descartar(empresaId: EmpresaId, temporalId: string): Promise<void> {
    await unlink(this.ruta(empresaId, temporalId, true)).catch((e: unknown) => {
      if (!noExiste(e)) throw e;
    });
  }

  async abrir(empresaId: EmpresaId, archivoId: string): Promise<AsyncIterable<Uint8Array>> {
    const ruta = this.ruta(empresaId, archivoId, false);
    const st = await lstat(ruta).catch((e: unknown) => {
      throw noExiste(e) ? new ErrorAlmacen('Archivo no encontrado.') : e;
    });
    if (!st.isFile()) throw new ErrorAlmacen('El archivo no es un archivo normal.');
    return createReadStream(ruta);
  }
}
