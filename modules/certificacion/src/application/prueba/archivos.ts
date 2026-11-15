// Archivos fabricados para las pruebas de evidencias: válidos y disfrazados. No son documentos reales: llevan lo justo para que la
// detección por contenido los reconozca (o los rechace).
const enc = new TextEncoder();

export const texto = (s: string): Uint8Array => enc.encode(s);
export const pdf = (): Uint8Array => texto('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n');
export const png = (): Uint8Array => {
  const b = new Uint8Array(70);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  return b;
};
/** Un ejecutable de Windows (cabecera «MZ»): se le puede poner el nombre que sea, no es un tipo permitido. */
export const ejecutable = (): Uint8Array => Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, ...new Array(200).fill(0)]);
/** Parece un PDF por su cabecera, pero está truncado. */
export const pdfTruncado = (): Uint8Array => texto('%PDF-1.4');

/** ZIP mínimo (sin contenido) con los nombres indicados; lo justo para que lo lea el directorio central. */
export const zip = (nombres: readonly string[]): Uint8Array => {
  const locales: Buffer[] = [];
  const central: Buffer[] = [];
  let inicio = 0;
  for (const n of nombres) {
    const nombre = Buffer.from(n);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(nombre.length, 26);
    locales.push(local, nombre);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(nombre.length, 28);
    c.writeUInt32LE(inicio, 42);
    central.push(c, nombre);
    inicio += 30 + nombre.length;
  }
  const dir = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(nombres.length, 8);
  fin.writeUInt16LE(nombres.length, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(inicio, 16);
  return new Uint8Array(Buffer.concat([...locales, dir, fin]));
};
export const docx = (): Uint8Array => zip(['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
/** Un DOCX con macros: se rechaza. */
export const docxConMacros = (): Uint8Array => zip(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/vbaProject.bin']);

/** Un flujo que entrega los bytes en trozos, como lo haría una subida real. */
export async function* enTrozos(bytes: Uint8Array, tamano = 1024): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < bytes.length; i += tamano) yield bytes.subarray(i, i + tamano);
}

/** Un flujo que no debe leerse: si alguien lo consume, la prueba falla. Sirve para probar que se decide ANTES de recibir bytes. */
export const flujoProhibido = (): AsyncIterable<Uint8Array> => ({
  [Symbol.asyncIterator]() {
    throw new Error('Se intentó leer el archivo antes de tiempo');
  },
});

/** Un flujo muy grande (n MB) que se genera sobre la marcha, sin guardarlo en memoria. */
export async function* megabytes(n: number): AsyncGenerator<Uint8Array> {
  const trozo = new Uint8Array(1024 * 1024).fill(0x41);
  for (let i = 0; i < n; i++) yield trozo;
}

// SHA-256 puro y síncrono, SOLO para los fakes y las pruebas de esta capa (la aplicación no importa módulos de Node). El adaptador real
// usa `node:crypto`; una prueba de infraestructura comprueba que ambos dan lo mismo.
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const rotar = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

export const sha256Hex = (datos: Uint8Array): string => {
  const largo = datos.length;
  const relleno = new Uint8Array(((largo + 9 + 63) >> 6) << 6);
  relleno.set(datos);
  relleno[largo] = 0x80;
  const vista = new DataView(relleno.buffer);
  vista.setUint32(relleno.length - 8, Math.floor((largo * 8) / 2 ** 32));
  vista.setUint32(relleno.length - 4, (largo * 8) >>> 0);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  for (let bloque = 0; bloque < relleno.length; bloque += 64) {
    for (let i = 0; i < 16; i++) w[i] = vista.getUint32(bloque + 4 * i);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] as number;
      const b = w[i - 2] as number;
      w[i] = ((w[i - 16] as number) + (rotar(a, 7) ^ rotar(a, 18) ^ (a >>> 3)) + (w[i - 7] as number) + (rotar(b, 17) ^ rotar(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotar(e, 6) ^ rotar(e, 11) ^ rotar(e, 25)) + ((e & f) ^ (~e & g)) + (K[i] as number) + (w[i] as number)) >>> 0;
      const t2 = ((rotar(a, 2) ^ rotar(a, 13) ^ rotar(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((x, i) => { h[i] = ((h[i] as number) + x) >>> 0; });
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
};
