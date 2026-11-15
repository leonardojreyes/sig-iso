import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEmpresaId } from '@sig/tenancy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectarTipoArchivo } from '../domain/deteccion-archivo.js';
import { enTrozos, megabytes, pdf, sha256Hex } from '../application/prueba/archivos.js';
import { AlmacenArchivosLocal, ErrorAlmacen } from './almacen-archivos-local.adapter.js';

// Contra el DISCO REAL (en una carpeta temporal): rutas, permisos, tamaños, enlaces simbólicos y separación por empresa.
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000a1');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000b2');
const MAX = 2 * 1024 * 1024;
const posix = process.platform !== 'win32';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const leerTodo = async (f: AsyncIterable<Uint8Array>) => {
  const partes: Uint8Array[] = [];
  for await (const p of f) partes.push(p);
  return Buffer.concat(partes);
};

describe('AlmacenArchivosLocal (disco real)', () => {
  let raiz: string;
  let base: string;
  let afuera: string;
  let almacen: AlmacenArchivosLocal;
  const listar = (dir: string) => readdir(dir).catch(() => [] as string[]);

  beforeAll(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'sigiso-evidencias-'));
    base = join(raiz, 'base');
    afuera = join(raiz, 'afuera');
    await mkdir(base);
    await mkdir(afuera);
    await writeFile(join(afuera, 'secreto.txt'), 'SECRETO-DE-FUERA');
    almacen = new AlmacenArchivosLocal(base);
  });
  afterAll(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  const guardar = async (empresa = A, bytes: Uint8Array = pdf()) => {
    const r = await almacen.guardarTemporal(empresa, enTrozos(bytes, 700), MAX);
    if (!r.ok) throw new Error('no se guardó');
    return r.temporal;
  };

  describe('configuración', () => {
    it.each([['una ruta relativa', 'evidencias'], ['una ruta vacía', ''], ['solo espacios', '   '], ['un punto', '.']])('rechaza %s', (_n, ruta) => {
      expect(() => new AlmacenArchivosLocal(ruta)).toThrow(ErrorAlmacen);
    });
    it('rechaza lo que no es texto', () => {
      expect(() => new AlmacenArchivosLocal(undefined as never)).toThrow(ErrorAlmacen);
    });
  });

  describe('guardar un temporal', () => {
    it('guarda los bytes, cuenta su tamaño y calcula el SHA-256 mientras los recibe', async () => {
      const bytes = pdf();
      const t = await guardar(A, bytes);
      expect(t.bytes).toBe(bytes.length);
      expect(t.sha256).toBe(sha(bytes));
      expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(await readFile(join(base, A, `tmp-${t.id}`))).toEqual(Buffer.from(bytes));
    });

    it('calcula bien la huella de un archivo de varios megabytes (con contrapresión)', async () => {
      const r = await almacen.guardarTemporal(A, megabytes(1), MAX);
      expect(r.ok && r.temporal.bytes).toBe(1024 * 1024);
      expect(r.ok && r.temporal.sha256).toBe(sha(new Uint8Array(1024 * 1024).fill(0x41)));
    });

    it('un flujo vacío da tamaño 0 y la huella del vacío', async () => {
      const r = await almacen.guardarTemporal(A, enTrozos(new Uint8Array(0)), MAX);
      expect(r).toMatchObject({ ok: true, temporal: { bytes: 0, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' } });
    });

    it.skipIf(!posix)('crea la carpeta con permisos 0700 y el archivo con 0600', async () => {
      const t = await guardar(A);
      expect((await stat(join(base, A))).mode & 0o777).toBe(0o700);
      expect((await stat(join(base, A, `tmp-${t.id}`))).mode & 0o777).toBe(0o600);
    });

    it('acepta justo el máximo y rechaza un byte más, sin dejar nada en el disco', async () => {
      const antes = await listar(join(base, A));
      expect((await almacen.guardarTemporal(A, enTrozos(new Uint8Array(MAX).fill(1)), MAX)).ok).toBe(true);
      const r = await almacen.guardarTemporal(A, enTrozos(new Uint8Array(MAX + 1).fill(1)), MAX);
      expect(r).toEqual({ ok: false, motivo: 'tamano_excedido' });
      expect((await listar(join(base, A))).length).toBe(antes.length + 1); // solo quedó el que cabía
    });

    it('al pasarse del máximo corta: no sigue leyendo el flujo de origen', async () => {
      let cerrado = false;
      let entregados = 0;
      async function* infinito(): AsyncGenerator<Uint8Array> {
        try {
          for (;;) {
            entregados += 1;
            yield new Uint8Array(1024 * 1024);
          }
        } finally {
          cerrado = true;
        }
      }
      expect(await almacen.guardarTemporal(A, infinito(), MAX)).toEqual({ ok: false, motivo: 'tamano_excedido' });
      expect(cerrado).toBe(true);
      expect(entregados).toBeLessThanOrEqual(4);
    });

    it('si el flujo falla a la mitad (subida cortada), propaga el error y no deja el temporal', async () => {
      async function* cortado(): AsyncGenerator<Uint8Array> {
        yield new Uint8Array(500).fill(7);
        throw new Error('conexión cortada');
      }
      const antes = (await listar(join(base, A))).length;
      await expect(almacen.guardarTemporal(A, cortado(), MAX)).rejects.toThrow('conexión cortada');
      expect((await listar(join(base, A))).length).toBe(antes);
    });

    it('varias subidas a la vez no se mezclan', async () => {
      const entradas = Array.from({ length: 6 }, (_v, i) => new Uint8Array(3000 + i).fill(i + 1));
      const r = await Promise.all(entradas.map((b) => almacen.guardarTemporal(A, enTrozos(b, 500), MAX)));
      expect(new Set(r.map((x) => (x.ok ? x.temporal.id : ''))).size).toBe(6);
      r.forEach((x, i) => expect(x.ok && x.temporal.sha256).toBe(sha(entradas[i] as Uint8Array)));
    });

    it('un tamaño máximo inválido es un error, no «sin límite»', async () => {
      for (const max of [0, -1, 1.5, Number.NaN, Infinity]) await expect(almacen.guardarTemporal(A, enTrozos(pdf()), max)).rejects.toThrow(ErrorAlmacen);
    });
  });

  describe('leer un temporal para decidir su tipo', () => {
    it('lee rangos exactos, acota al final y alimenta la detección por contenido', async () => {
      const bytes = pdf();
      const t = await guardar(A, bytes);
      const lector = await almacen.abrirLector(A, t.id);
      expect(lector.tamano).toBe(bytes.length);
      expect(Buffer.from(await lector.leer(0, 5)).toString()).toBe('%PDF-');
      expect(Buffer.from(await lector.leer(2, 6))).toEqual(Buffer.from(bytes.subarray(2, 6)));
      expect((await lector.leer(bytes.length - 3, bytes.length + 500)).length).toBe(3);
      expect((await lector.leer(bytes.length + 10, bytes.length + 20)).length).toBe(0);
      expect(await detectarTipoArchivo(lector)).toEqual({ ok: true, tipo: 'application/pdf' });
    });

    it('un temporal inexistente es un error del almacén, sin la ruta', async () => {
      const e = await almacen.abrirLector(A, randomUUID()).catch((x: Error) => x);
      expect(e).toBeInstanceOf(ErrorAlmacen);
      expect((e as Error).message).not.toContain(base);
    });
  });

  describe('confirmar, descartar y abrir', () => {
    it('confirmar mueve el temporal al archivo definitivo, que se puede abrir', async () => {
      const bytes = pdf();
      const t = await guardar(A, bytes);
      const archivoId = randomUUID();
      await almacen.confirmar(A, t.id, archivoId);
      expect(await listar(join(base, A))).not.toContain(`tmp-${t.id}`);
      expect(Buffer.compare(await leerTodo(await almacen.abrir(A, archivoId)), Buffer.from(bytes))).toBe(0);
    });

    it('confirmar no pisa un archivo que ya existe y conserva el temporal', async () => {
      const t1 = await guardar(A, pdf());
      const archivoId = randomUUID();
      await almacen.confirmar(A, t1.id, archivoId);
      const t2 = await guardar(A, new Uint8Array(200).fill(9));
      await expect(almacen.confirmar(A, t2.id, archivoId)).rejects.toThrow(ErrorAlmacen);
      expect(await listar(join(base, A))).toContain(`tmp-${t2.id}`);
      expect((await leerTodo(await almacen.abrir(A, archivoId))).length).toBe(pdf().length); // el original sigue intacto
    });

    it('confirmar un temporal que no existe falla', async () => {
      await expect(almacen.confirmar(A, randomUUID(), randomUUID())).rejects.toThrow(ErrorAlmacen);
    });

    it('descartar borra el temporal y no falla si ya no existe', async () => {
      const t = await guardar(A);
      await almacen.descartar(A, t.id);
      expect(await listar(join(base, A))).not.toContain(`tmp-${t.id}`);
      await expect(almacen.descartar(A, t.id)).resolves.toBeUndefined();
    });

    it('abrir un archivo que no existe falla sin revelar la ruta', async () => {
      const e = await almacen.abrir(A, randomUUID()).catch((x: Error) => x);
      expect(e).toBeInstanceOf(ErrorAlmacen);
      expect((e as Error).message).not.toContain(base);
    });
  });

  describe('intentos de salirse de la carpeta', () => {
    const hostiles = ['../afuera/secreto.txt', '../../etc/passwd', 'a/b', '..', '.', '', ' ', 'tmp-../x', 'C:\\Windows\\win.ini', '%2e%2e%2fsecreto', 'AAAAAAAA-0000-4000-8000-0000000000A1', `${randomUUID()}/../..`, `${randomUUID()}\u0000.txt`];

    it.each(hostiles)('el identificador de archivo %j se rechaza en todas las operaciones', async (id) => {
      await expect(almacen.abrir(A, id)).rejects.toThrow(ErrorAlmacen);
      await expect(almacen.abrirLector(A, id)).rejects.toThrow(ErrorAlmacen);
      await expect(almacen.descartar(A, id)).rejects.toThrow(ErrorAlmacen);
      await expect(almacen.confirmar(A, id, randomUUID())).rejects.toThrow(ErrorAlmacen);
      const t = await guardar(A);
      await expect(almacen.confirmar(A, t.id, id)).rejects.toThrow(ErrorAlmacen);
    });

    it.each(['../afuera', '..', '', 'no-es-uuid', 'aaaaaaaa-0000-4000-8000-0000000000a1/../x', `${A}/..`])('la empresa %j se rechaza (la empresa nunca forma una ruta sin validar)', async (empresa) => {
      const e = empresa as never;
      await expect(almacen.guardarTemporal(e, enTrozos(pdf()), MAX)).rejects.toThrow(ErrorAlmacen);
      await expect(almacen.abrir(e, randomUUID())).rejects.toThrow(ErrorAlmacen);
      await expect(almacen.abrirLector(e, randomUUID())).rejects.toThrow(ErrorAlmacen);
    });

    it('nada se creó ni se tocó fuera de la carpeta base', async () => {
      expect((await listar(raiz)).sort()).toEqual(['afuera', 'base']);
      expect(await listar(afuera)).toEqual(['secreto.txt']);
      expect(await readFile(join(afuera, 'secreto.txt'), 'utf8')).toBe('SECRETO-DE-FUERA');
    });

    it.skipIf(!posix)('un enlace simbólico dentro de la carpeta de la empresa no se sigue', async () => {
      const id = randomUUID();
      await symlink(join(afuera, 'secreto.txt'), join(base, A, id));
      const e = await almacen.abrir(A, id).catch((x: Error) => x);
      expect(e).toBeInstanceOf(ErrorAlmacen);
      const tmp = randomUUID();
      await symlink(join(afuera, 'secreto.txt'), join(base, A, `tmp-${tmp}`));
      await expect(almacen.abrirLector(A, tmp)).rejects.toThrow(ErrorAlmacen);
    });

    it.skipIf(!posix)('si la carpeta de una empresa es un enlace simbólico hacia afuera, no se escribe en él', async () => {
      await symlink(afuera, join(base, B));
      await expect(almacen.guardarTemporal(B, enTrozos(pdf()), MAX)).rejects.toThrow(ErrorAlmacen);
      expect(await listar(afuera)).toEqual(['secreto.txt']);
    });
  });

  describe('separación por empresa', () => {
    it('lo que guarda una empresa no se puede abrir, leer, confirmar ni descartar desde otra', async () => {
      const C = crearEmpresaId('cccccccc-0000-4000-8000-0000000000c3');
      const t = await guardar(A, pdf());
      const archivoId = randomUUID();
      // Desde otra empresa el temporal no existe.
      await expect(almacen.abrirLector(C, t.id)).rejects.toThrow(ErrorAlmacen);
      await expect(almacen.confirmar(C, t.id, archivoId)).rejects.toThrow(ErrorAlmacen);
      await almacen.descartar(C, t.id); // no borra el de A
      expect(await listar(join(base, A))).toContain(`tmp-${t.id}`);
      // Y el definitivo tampoco se abre.
      await almacen.confirmar(A, t.id, archivoId);
      await expect(almacen.abrir(C, archivoId)).rejects.toThrow(ErrorAlmacen);
      expect((await leerTodo(await almacen.abrir(A, archivoId))).length).toBeGreaterThan(0);
    });

    it('cada empresa tiene su carpeta', async () => {
      const D = crearEmpresaId('dddddddd-0000-4000-8000-0000000000d4');
      const t = await guardar(D, pdf());
      expect(await listar(join(base, D))).toEqual([`tmp-${t.id}`]);
    });
  });
});

describe('sha256Hex (el SHA-256 puro de los fakes)', () => {
  it('da lo mismo que node:crypto, también en los bordes del relleno', () => {
    const vectores = [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 1000, 70_000].map((n) => Uint8Array.from({ length: n }, (_v, i) => (i * 31 + 7) & 0xff));
    for (const v of vectores) expect(sha256Hex(v), String(v.length)).toBe(createHash('sha256').update(v).digest('hex'));
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
