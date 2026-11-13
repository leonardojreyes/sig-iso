import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { TIPO_DOCUMENTO_WORD, type DocumentoDeclaracion } from '../application/generador-documento.port.js';
import { sha256Hex } from '../application/prueba/archivos.js';
import { detectarTipoArchivo } from '../domain/deteccion-archivo.js';
import { GeneradorDocumentoDocx } from './generador-documento-docx.adapter.js';

const base: DocumentoDeclaracion = {
  norma: 'ISO/IEC 27001',
  preliminar: true,
  version: null,
  aprobadaEl: null,
  generadaEl: '2026-11-12',
  alcance: 'Desarrollo de software.\nSoporte a clientes.',
  resumen: { total: 3, aplican: 2, noAplican: 1, porDecidir: 0, sinControl: 1 },
  filas: [
    { libreriaCodigo: 'l', idEstable: 'a27-5-1', orden: 1, titulo: 'Políticas de seguridad', grupo: 'Organizacionales', aplicabilidad: 'aplica', implementacion: 'implementado', justificacion: null, controles: ['C-001', 'C-002'], cobertura: 'cubierta' },
    { libreriaCodigo: 'l', idEstable: 'a27-5-2', orden: 2, titulo: 'Roles', grupo: null, aplicabilidad: 'aplica', implementacion: 'parcial', justificacion: null, controles: [], cobertura: 'sin_control' },
    { libreriaCodigo: 'l', idEstable: 'a27-5-3', orden: 3, titulo: 'Separación de funciones', grupo: 'Organizacionales', aplicabilidad: 'no_aplica', implementacion: null, justificacion: 'No hay personal propio', controles: [], cobertura: 'no_aplica' },
  ],
};

/** Lee una parte del ZIP por su directorio central (solo para probar; sin librerías). */
const parte = (zip: Uint8Array, nombre: string): string | null => {
  const b = Buffer.from(zip);
  let fin = -1;
  for (let i = b.length - 22; i >= 0; i--) if (b.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  let p = b.readUInt32LE(fin + 16);
  for (let k = 0; k < b.readUInt16LE(fin + 10); k++) {
    const metodo = b.readUInt16LE(p + 10);
    const comp = b.readUInt32LE(p + 20);
    const lNombre = b.readUInt16LE(p + 28);
    const lExtra = b.readUInt16LE(p + 30);
    const lComentario = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const n = b.toString('utf8', p + 46, p + 46 + lNombre);
    if (n === nombre) {
      const datos = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
      const crudo = b.subarray(datos, datos + comp);
      return (metodo === 0 ? crudo : inflateRawSync(crudo)).toString('utf8');
    }
    p += 46 + lNombre + lExtra + lComentario;
  }
  return null;
};
const nombres = (zip: Uint8Array): string[] => {
  const b = Buffer.from(zip);
  let fin = -1;
  for (let i = b.length - 22; i >= 0; i--) if (b.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  const salida: string[] = [];
  let p = b.readUInt32LE(fin + 16);
  for (let k = 0; k < b.readUInt16LE(fin + 10); k++) {
    const l = b.readUInt16LE(p + 28);
    salida.push(b.toString('utf8', p + 46, p + 46 + l));
    p += 46 + l + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  return salida;
};
const generar = (d: DocumentoDeclaracion) => new GeneradorDocumentoDocx().generarDeclaracion(d);
const texto = async (d: DocumentoDeclaracion) => parte((await generar(d)).bytes, 'word/document.xml') ?? '';

describe('GeneradorDocumentoDocx', () => {
  it('produce un Word que el detector de archivos reconoce como DOCX (sin macros ni objetos)', async () => {
    const { bytes } = await generar(base);
    const lector = { tamano: bytes.length, leer: async (d: number, h: number) => bytes.subarray(d, Math.min(h, bytes.length)) };
    expect(await detectarTipoArchivo(lector)).toEqual({ ok: true, tipo: TIPO_DOCUMENTO_WORD });
    const partes = nombres(bytes);
    expect(partes).toContain('word/document.xml');
    expect(partes.filter((n) => /vbaProject|embeddings|activeX|\.bin$|oleObject/i.test(n))).toEqual([]);
  });

  it('devuelve la huella SHA-256 de lo que entrega', async () => {
    const g = await generar(base);
    expect(g.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(g.sha256).toBe(sha256Hex(g.bytes));
  });

  it('el borrador lleva el rótulo de preliminar; una versión aprobada, no', async () => {
    const borrador = await texto(base);
    expect(borrador).toContain('DOCUMENTO PRELIMINAR');
    const aprobada = await texto({ ...base, preliminar: false, version: 3, aprobadaEl: '2026-11-10' });
    expect(aprobada).not.toContain('PRELIMINAR');
    expect(aprobada).toContain('Versión 3, aprobada el 2026-11-10.');
  });

  it('incluye alcance, resumen y cada fila con su aplicabilidad, controles y justificación', async () => {
    const x = await texto(base);
    for (const t of ['Desarrollo de software.', 'Soporte a clientes.', 'a27-5-1', 'Políticas de seguridad', 'C-001, C-002', 'Implementado', 'Con evidencia vigente', 'No hay personal propio', 'Separación de funciones', 'No aplica', 'Aplican sin control asignado: 1']) expect(x, t).toContain(t);
    expect(x).toContain('Sin control asignado'); // la fila que aplica y ningún control cubre
  });

  it('sin alcance lo dice', async () => {
    expect(await texto({ ...base, alcance: null })).toContain('No se registró un alcance');
  });

  it('lo que escribió la empresa sale como texto: nada de campos, enlaces ni marcado activo', async () => {
    const hostil = '<script>alert(1)</script> =HYPERLINK("http://x") ]]> &amp; {{ ${x} }}';
    const x = await texto({ ...base, alcance: hostil, filas: [{ ...(base.filas[2] as DocumentoDeclaracion['filas'][number]), justificacion: hostil }] });
    expect(x).not.toContain('<script>');
    expect(x).toContain('&lt;script&gt;');
    expect(x).not.toMatch(/<w:fldChar|<w:fldSimple|<w:instrText|<w:hyperlink|<w:object|<w:altChunk/);
  });

  it('quita los caracteres de control que XML no admite sin romper el documento', async () => {
    const { bytes } = await generar({ ...base, alcance: 'Con\u0000nulo y\u0008retroceso', filas: [{ ...(base.filas[2] as DocumentoDeclaracion['filas'][number]), justificacion: 'Linea1\nLinea2\u0007' }] });
    const x = parte(bytes, 'word/document.xml') ?? '';
    expect(x).toContain('Connulo');
    expect(x).toMatch(/Linea1 Linea2/);
    expect(x).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
  });

  it('un documento sin filas también se genera', async () => {
    const { bytes } = await generar({ ...base, filas: [], resumen: { total: 0, aplican: 0, noAplican: 0, porDecidir: 0, sinControl: 0 } });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
