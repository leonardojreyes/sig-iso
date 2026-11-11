import { describe, expect, it } from 'vitest';
import { detectarTipoArchivo, type LectorBytes } from './deteccion-archivo.js';
import { TAMANO_MAX_BYTES } from './tipo-archivo.js';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const lectorDe = (b: Uint8Array): LectorBytes => ({ tamano: b.length, leer: async (d, h) => b.subarray(d, Math.min(h, b.length)) });
const detectar = (b: Uint8Array) => detectarTipoArchivo(lectorDe(b));
const texto = (s: string) => new TextEncoder().encode(s);
const rellenar = (cabecera: number[], total: number) => Uint8Array.from([...cabecera, ...new Array(Math.max(0, total - cabecera.length)).fill(0x41)]);

// ---- Archivos fabricados
const PDF = () => texto('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n');
const png = () => {
  const b = new Uint8Array(70);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  return b;
};
const JPG = () => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

/** ZIP mínimo (sin contenido) con los nombres indicados; lo justo para que lo lea el directorio central. */
const zip = (nombres: string[], o: { comentario?: string; banderas?: number; eocd?: Partial<Record<'entradas' | 'tamano' | 'inicio' | 'disco', number>> } = {}): Uint8Array => {
  const partes: Buffer[] = [];
  const directorio: Buffer[] = [];
  let inicio = 0;
  for (const n of nombres) {
    const nombre = Buffer.from(n);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(nombre.length, 26);
    partes.push(local, nombre);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(o.banderas ?? 0, 8);
    c.writeUInt16LE(nombre.length, 28);
    c.writeUInt32LE(inicio, 42);
    directorio.push(c, nombre);
    inicio += 30 + nombre.length;
  }
  const dir = Buffer.concat(directorio);
  const comentario = Buffer.from(o.comentario ?? '');
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(o.eocd?.disco ?? 0, 4);
  eocd.writeUInt16LE(o.eocd?.entradas ?? nombres.length, 8);
  eocd.writeUInt16LE(o.eocd?.entradas ?? nombres.length, 10);
  eocd.writeUInt32LE(o.eocd?.tamano ?? dir.length, 12);
  eocd.writeUInt32LE(o.eocd?.inicio ?? inicio, 16);
  eocd.writeUInt16LE(comentario.length, 20);
  return new Uint8Array(Buffer.concat([...partes, dir, eocd, comentario]));
};
const ooxml = (...partes: string[]) => zip(['[Content_Types].xml', '_rels/.rels', ...partes]);

describe('detectarTipoArchivo — los tipos permitidos', () => {
  it.each([
    ['PDF', PDF(), 'application/pdf'],
    ['PNG', png(), 'image/png'],
    ['JPEG', JPG(), 'image/jpeg'],
    ['texto UTF-8', texto('Registro de la revisión de accesos del trimestre.\nSin novedades.\n'), 'text/plain'],
    ['texto con tildes, eñes y emoji', texto('Política de contraseñas ✔ 🔒\tcon tabulador\r\n'), 'text/plain'],
    ['texto con marca de orden de bytes (BOM)', Uint8Array.from([0xef, 0xbb, 0xbf, ...texto('hola')]), 'text/plain'],
    ['DOCX', ooxml('word/document.xml'), DOCX],
    ['XLSX', ooxml('xl/workbook.xml', 'xl/worksheets/sheet1.xml'), XLSX],
    ['PPTX', ooxml('ppt/presentation.xml', 'ppt/slides/slide1.xml'), PPTX],
    ['OOXML con comentario final en el ZIP', zip(['[Content_Types].xml', 'word/document.xml'], { comentario: 'creado con una herramienta' }), DOCX],
    ['OOXML con nombres en mayúsculas', zip(['[CONTENT_TYPES].XML', 'WORD/DOCUMENT.XML']), DOCX],
  ])('acepta %s', async (_n, bytes, tipo) => {
    expect(await detectar(bytes)).toEqual({ ok: true, tipo });
  });

  it('acepta un texto que ocupa varios bloques de lectura y un carácter UTF-8 partido entre bloques', async () => {
    const relleno = 'a'.repeat(65_535); // el siguiente carácter (2 bytes) queda partido entre el bloque 1 y el 2
    expect(await detectar(texto(`${relleno}ñ${'b'.repeat(70_000)}`))).toEqual({ ok: true, tipo: 'text/plain' });
  });

  it('acepta justo 25 MB y rechaza un byte más', async () => {
    const justo: LectorBytes = { tamano: TAMANO_MAX_BYTES, leer: async (d, h) => rellenar([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34], h - d).subarray(0, h - d) };
    expect((await detectarTipoArchivo(justo)).ok).toBe(true);
    expect(await detectarTipoArchivo({ ...justo, tamano: TAMANO_MAX_BYTES + 1 })).toEqual({ ok: false, motivo: 'tamano_excedido' });
  });
});

describe('detectarTipoArchivo — la extensión y el nombre no cuentan, solo el contenido', () => {
  it.each([
    ['un ejecutable de Windows (MZ)', rellenar([0x4d, 0x5a, 0x90, 0x00], 200)],
    ['un ejecutable de Linux (ELF)', rellenar([0x7f, 0x45, 0x4c, 0x46], 200)],
    ['un GIF', texto('GIF89a\u0001\u0000\u0001\u0000')],
    ['un binario cualquiera', Uint8Array.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd])],
    ['un Office antiguo o cifrado (OLE)', rellenar([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 600)],
    ['un SVG', texto('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ['un SVG con XML delante', texto('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')],
    ['un HTML', texto('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>')],
    ['un HTML con espacios y BOM delante', Uint8Array.from([0xef, 0xbb, 0xbf, ...texto('   \n  <html></html>')])],
    ['un texto con un byte nulo', texto('hola\u0000mundo')],
    ['un texto con caracteres de control (escape)', texto('hola\u001b[31mmundo')],
    ['un texto que no es UTF-8 (Latin-1)', Uint8Array.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x6f, 0x6b])],
    ['un texto con UTF-8 truncado al final', Uint8Array.from([...texto('hola '), 0xc3])],
  ])('rechaza %s como tipo no permitido', async (_n, bytes) => {
    expect(await detectar(bytes)).toEqual({ ok: false, motivo: 'tipo_no_permitido' });
  });

  it('un texto que contiene HTML más adelante (no al principio) es un texto', async () => {
    expect((await detectar(texto('Nota: el formato usa etiquetas como <b>negrita</b>.'))).ok).toBe(true);
  });

  it('un archivo vacío es una firma inválida', async () => {
    expect(await detectar(new Uint8Array(0))).toEqual({ ok: false, motivo: 'firma_invalida' });
  });
});

describe('detectarTipoArchivo — cabecera de un formato permitido pero contenido incoherente', () => {
  it.each([
    ['un PDF truncado', texto('%PDF-1.4')],
    ['un «PDF» con versión inventada', texto('%PDF-9.9 y el resto del archivo es otra cosa distinta')],
    ['un PNG truncado', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['un PNG sin el bloque IHDR', (() => { const b = png(); b.set([0x49, 0x44, 0x41, 0x54], 12); return b; })()],
    ['un JPEG de tres bytes', Uint8Array.from([0xff, 0xd8, 0xff])],
    ['un ZIP cortado a la mitad (sin directorio central)', zip(['[Content_Types].xml', 'word/document.xml']).slice(0, 80)],
    ['un ZIP con la cabecera pero sin final', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, ...new Array(100).fill(0)])],
    ['un ZIP cuyo directorio central apunta fuera del archivo', zip(['[Content_Types].xml', 'word/document.xml'], { eocd: { inicio: 4_000_000 } })],
    ['un ZIP que dice tener más entradas de las que hay', zip(['[Content_Types].xml', 'word/document.xml'], { eocd: { entradas: 5 } })],
    ['un ZIP con tamaño de directorio exagerado', zip(['[Content_Types].xml', 'word/document.xml'], { eocd: { tamano: 9_000_000 } })],
    ['un ZIP de varios discos', zip(['[Content_Types].xml', 'word/document.xml'], { eocd: { disco: 1 } })],
    ['un ZIP con ZIP64 (campos 0xFFFFFFFF)', zip(['[Content_Types].xml', 'word/document.xml'], { eocd: { inicio: 0xffffffff } })],
    ['un híbrido de Word y Excel', ooxml('word/document.xml', 'xl/workbook.xml')],
    ['un ZIP con un nombre que se sale de la carpeta (../)', ooxml('word/document.xml', '../../etc/passwd')],
    ['un ZIP con un nombre absoluto', ooxml('word/document.xml', '/tmp/x')],
    ['un ZIP con barra invertida en un nombre', ooxml('word/document.xml', 'word\\..\\x')],
  ])('rechaza %s como firma inválida', async (_n, bytes) => {
    expect(await detectar(bytes)).toEqual({ ok: false, motivo: 'firma_invalida' });
  });
});

describe('detectarTipoArchivo — ZIP de oficina con contenido que no se admite', () => {
  it.each([
    ['un ZIP cualquiera', zip(['a.txt', 'b/c.png'])],
    ['un ZIP con [Content_Types] pero que no es de oficina', zip(['[Content_Types].xml', 'datos.json'])],
    ['un documento con macros (vbaProject.bin)', ooxml('word/document.xml', 'word/vbaProject.bin')],
    ['una hoja con macros de Excel 4 (vbaData)', ooxml('xl/workbook.xml', 'xl/vbaData.xml')],
    ['una presentación con macros', ooxml('ppt/presentation.xml', 'ppt/vbaProject.bin')],
    ['un documento con objetos incrustados', ooxml('word/document.xml', 'word/embeddings/oleObject1.bin')],
    ['un documento con controles ActiveX', ooxml('word/document.xml', 'word/activeX/activeX1.xml')],
    ['un documento con un ejecutable dentro', ooxml('word/document.xml', 'word/media/instalador.exe')],
    ['un documento con un script dentro', ooxml('word/document.xml', 'word/media/x.js')],
    ['un APK o JAR', zip(['META-INF/MANIFEST.MF', 'classes.dex'])],
    ['un ZIP cifrado', zip(['[Content_Types].xml', 'word/document.xml'], { banderas: 1 })],
  ])('rechaza %s como tipo no permitido', async (_n, bytes) => {
    expect(await detectar(bytes)).toEqual({ ok: false, motivo: 'tipo_no_permitido' });
  });
});

describe('detectarTipoArchivo — robustez', () => {
  it('un lector que devuelve menos bytes de los pedidos es una firma inválida, no un error', async () => {
    const roto: LectorBytes = { tamano: 500, leer: async () => new Uint8Array(3) };
    expect(await detectarTipoArchivo(roto)).toEqual({ ok: false, motivo: 'firma_invalida' });
  });

  it('un tamaño que no es un entero positivo es una firma inválida', async () => {
    for (const tamano of [0, -5, 1.5, Number.NaN]) expect(await detectarTipoArchivo({ tamano, leer: async () => new Uint8Array(0) })).toEqual({ ok: false, motivo: 'firma_invalida' });
  });

  it('un error de lectura del almacén NO se disfraza de rechazo del archivo: se propaga', async () => {
    const caido: LectorBytes = { tamano: 500, leer: async () => { throw new Error('disco no disponible'); } };
    await expect(detectarTipoArchivo(caido)).rejects.toThrow('disco no disponible');
  });

  it('no lee más de lo necesario de un archivo grande de otro tipo (cabecera, y solo bloques de 64 KB en texto)', async () => {
    const lecturas: number[] = [];
    const lector: LectorBytes = { tamano: 1_000_000, leer: async (d, h) => { lecturas.push(h - d); return rellenar([0x61], h - d); } };
    expect((await detectarTipoArchivo(lector)).ok).toBe(true);
    expect(Math.max(...lecturas)).toBeLessThanOrEqual(65_536);
  });
});
