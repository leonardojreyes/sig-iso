import { PayloadTooLargeException, type ExecutionContext } from '@nestjs/common';
import { TAMANO_MAX_BYTES } from '@sig/certificacion';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { contentDisposition, descartarSiFalla, LimitarTamanoSubida, LIMITES_SUBIDA, MotorSubida, prepararSubida, subidaPendiente } from './subida.js';

describe('contentDisposition', () => {
  it('siempre es un adjunto, con una versión ASCII y la codificada en UTF-8', () => {
    expect(contentDisposition('informe.pdf')).toBe(`attachment; filename="informe.pdf"; filename*=UTF-8''informe.pdf`);
    expect(contentDisposition('Política de contraseñas (v2).docx')).toBe(`attachment; filename="Pol_tica de contrase_as (v2).docx"; filename*=UTF-8''Pol%C3%ADtica%20de%20contrase%C3%B1as%20%28v2%29.docx`);
  });

  it.each(['a"b.pdf', 'a\r\nX-Inyectada: 1.pdf', "a'b*c.pdf", 'a\u0000b.pdf', '../../etc/passwd', 'a;b=c.pdf'])('no se deja inyectar con %j', (nombre) => {
    const cabecera = contentDisposition(nombre);
    expect(cabecera).not.toMatch(/[\r\n\u0000]/);
    expect(cabecera.startsWith('attachment; filename="')).toBe(true);
    // El nombre entre comillas no puede cerrarlas ni traer separadores de parámetros.
    const ascii = /^attachment; filename="([^"]*)"; filename\*=UTF-8''([A-Za-z0-9%._~!-]*)$/.exec(cabecera);
    expect(ascii, cabecera).not.toBeNull();
    expect(ascii?.[1]).not.toMatch(/[";\\]/);
  });
});

describe('MotorSubida y el control de la subida', () => {
  const archivo = { fieldname: 'archivo', originalname: 'x.pdf', stream: (async function* () { yield new Uint8Array(1); })() };

  it('llama a la acción preparada y deja la subida pendiente en la solicitud', async () => {
    const solicitud: Record<symbol, unknown> = {};
    const pendiente = { confirmar: async () => ({}) as never, descartar: async () => undefined };
    prepararSubida(solicitud, async () => pendiente);
    await new Promise<void>((listo, falla) => new MotorSubida()._handleFile(solicitud as never, archivo, (e) => (e ? falla(e as Error) : listo())));
    expect(subidaPendiente(solicitud)).toBe(pendiente);
  });

  it('sin acción preparada falla (nunca guarda por su cuenta); y si la acción falla, el error llega a multer', async () => {
    await expect(new Promise((listo, falla) => new MotorSubida()._handleFile({} as never, archivo, (e) => (e ? falla(e as Error) : listo(null))))).rejects.toThrow('sin acción');
    const solicitud: Record<symbol, unknown> = {};
    prepararSubida(solicitud, async () => { throw new Error('rechazado'); });
    await expect(new Promise((listo, falla) => new MotorSubida()._handleFile(solicitud as never, archivo, (e) => (e ? falla(e as Error) : listo(null))))).rejects.toThrow('rechazado');
    expect(subidaPendiente(solicitud)).toBeUndefined();
  });

  it('_removeFile no hace nada (no hay archivo que quitar)', async () => {
    await expect(new Promise<void>((listo) => new MotorSubida()._removeFile({}, {}, () => listo()))).resolves.toBeUndefined();
  });

  it('los límites de multer: un archivo, con un byte de margen sobre los 25 MB, y pocos campos cortos', () => {
    expect(LIMITES_SUBIDA).toMatchObject({ files: 1, fileSize: TAMANO_MAX_BYTES + 1, fieldSize: 4096 });
    expect(Object.isFrozen(LIMITES_SUBIDA)).toBe(true);
  });
});

describe('descartarSiFalla', () => {
  const pendiente = () => {
    const estado = { descartes: 0 };
    return { estado, subida: { confirmar: async () => ({}) as never, descartar: async () => { estado.descartes += 1; } } };
  };

  it('si la cadena falla, descarta la subida pendiente y vuelve a lanzar el MISMO error', async () => {
    const { estado, subida } = pendiente();
    const solicitud: Record<symbol, unknown> = {};
    prepararSubida(solicitud, async () => subida);
    await new Promise<void>((listo) => new MotorSubida()._handleFile(solicitud as never, { fieldname: 'archivo', originalname: 'x', stream: (async function* () {})() }, () => listo()));
    const error = new Error('segundo archivo');
    await expect(lastValueFrom(descartarSiFalla(solicitud, throwError(() => error)))).rejects.toBe(error);
    expect(estado.descartes).toBe(1);
  });

  it('si no había subida pendiente (falló antes de llegar el archivo), solo relanza el error', async () => {
    const error = new Error('multer');
    await expect(lastValueFrom(descartarSiFalla({}, throwError(() => error)))).rejects.toBe(error);
  });

  it('si todo sale bien, no descarta nada y deja pasar el resultado', async () => {
    const { estado, subida } = pendiente();
    const solicitud: Record<symbol, unknown> = {};
    prepararSubida(solicitud, async () => subida);
    await new Promise<void>((listo) => new MotorSubida()._handleFile(solicitud as never, { fieldname: 'archivo', originalname: 'x', stream: (async function* () {})() }, () => listo()));
    await expect(lastValueFrom(descartarSiFalla(solicitud, of('listo')))).resolves.toBe('listo');
    expect(estado.descartes).toBe(0);
  });
});

describe('LimitarTamanoSubida', () => {
  const contexto = (longitud: string | undefined) => {
    const cabeceras: string[] = [];
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ headers: longitud === undefined ? {} : { 'content-length': longitud } }), getResponse: () => ({ setHeader: (n: string, v: string) => cabeceras.push(`${n}: ${v}`) }) }) } as unknown as ExecutionContext;
    return { ctx, cabeceras };
  };
  const siguiente = { handle: () => of('pasó') };

  it('deja pasar lo que cabe (los 25 MB más un margen para los campos de texto)', async () => {
    for (const l of [undefined, '0', '1000', String(TAMANO_MAX_BYTES), String(TAMANO_MAX_BYTES + 200 * 1024)]) {
      const { ctx } = contexto(l);
      await expect(lastValueFrom(new LimitarTamanoSubida().intercept(ctx, siguiente))).resolves.toBe('pasó');
    }
  });

  it('rechaza con 413, sin leer el cuerpo, lo que ya declara más, y pide cerrar la conexión', () => {
    const { ctx, cabeceras } = contexto(String(TAMANO_MAX_BYTES + 300 * 1024));
    expect(() => new LimitarTamanoSubida().intercept(ctx, siguiente)).toThrow(PayloadTooLargeException);
    expect(cabeceras).toEqual(['Connection: close']);
  });

  it('un Content-Length ilegible no se confunde con «enorme» (lo acotan multer y el almacén)', async () => {
    const { ctx } = contexto('abc');
    await expect(lastValueFrom(new LimitarTamanoSubida().intercept(ctx, siguiente))).resolves.toBe('pasó');
  });
});
