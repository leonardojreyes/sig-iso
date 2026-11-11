import { TAMANO_MAX_BYTES, type TipoArchivo } from './tipo-archivo.js';

// Decide de qué tipo es un archivo mirando su CONTENIDO (ADR 032). La extensión y el Content-Type que mande el cliente no cuentan.
// La lógica es pura: lee a través de un `LectorBytes` abstracto (el adaptador lo da sobre el archivo temporal), así se prueba a fondo
// con archivos fabricados y no hay entrada/salida en el dominio. No se descomprime nada: los formatos de oficina se reconocen por
// el directorio central del ZIP, sin riesgo de bomba de compresión.

export interface LectorBytes {
  /** Tamaño total del archivo en bytes. */
  readonly tamano: number;
  /** Bytes de `[desde, hasta)`; puede devolver menos si el rango se pasa del final. */
  leer(desde: number, hasta: number): Promise<Uint8Array>;
}

/** Motivos de rechazo: los tres que entiende la bitácora (listas cerradas). */
export type MotivoRechazoArchivo = 'tipo_no_permitido' | 'tamano_excedido' | 'firma_invalida';
export type ResultadoDeteccion = { readonly ok: true; readonly tipo: TipoArchivo } | { readonly ok: false; readonly motivo: MotivoRechazoArchivo };

const PDF: TipoArchivo = 'application/pdf';
const PNG: TipoArchivo = 'image/png';
const JPEG: TipoArchivo = 'image/jpeg';
const TXT: TipoArchivo = 'text/plain';
const DOCX: TipoArchivo = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX: TipoArchivo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX: TipoArchivo = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const aceptado = (tipo: TipoArchivo): ResultadoDeteccion => ({ ok: true, tipo });
const rechazo = (motivo: MotivoRechazoArchivo): ResultadoDeteccion => ({ ok: false, motivo });

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const FIRMA_JPEG = [0xff, 0xd8, 0xff];
const FIRMA_ZIP = [0x50, 0x4b, 0x03, 0x04];
const FIRMA_OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // Office antiguo (.doc, .xls) o cifrado: no se admite

const empieza = (b: Uint8Array, firma: readonly number[]): boolean => b.length >= firma.length && firma.every((x, i) => b[i] === x);

/** Lee exactamente `[desde, hasta)`; si el lector devuelve menos, el archivo no es lo que dice ser. */
const leerExacto = async (lector: LectorBytes, desde: number, hasta: number): Promise<Uint8Array | null> => {
  const b = await lector.leer(desde, hasta);
  return b.length === hasta - desde ? b : null;
};

export const detectarTipoArchivo = async (lector: LectorBytes): Promise<ResultadoDeteccion> => {
  const { tamano } = lector;
  if (!Number.isInteger(tamano) || tamano < 1) return rechazo('firma_invalida'); // vacío
  if (tamano > TAMANO_MAX_BYTES) return rechazo('tamano_excedido');
  const cabecera = await leerExacto(lector, 0, Math.min(tamano, 16));
  if (!cabecera) return rechazo('firma_invalida');

  if (empieza(cabecera, FIRMA_PDF)) return detectarPdf(cabecera, tamano);
  if (empieza(cabecera, FIRMA_PNG)) return detectarPng(lector, tamano);
  if (empieza(cabecera, FIRMA_JPEG)) return tamano >= 4 ? aceptado(JPEG) : rechazo('firma_invalida');
  if (empieza(cabecera, FIRMA_OLE)) return rechazo('tipo_no_permitido');
  if (empieza(cabecera, FIRMA_ZIP)) return detectarOoxml(lector, tamano);
  return detectarTexto(lector, tamano);
};

/** `%PDF-1.x` o `%PDF-2.x`; un PDF de menos de 20 bytes está truncado. */
const detectarPdf = (cabecera: Uint8Array, tamano: number): ResultadoDeteccion => {
  const version = cabecera[5];
  const punto = cabecera[6];
  const valida = (version === 0x31 || version === 0x32) && punto === 0x2e; // «1.» o «2.»
  return valida && tamano >= 20 ? aceptado(PDF) : rechazo('firma_invalida');
};

/** Tras la firma de 8 bytes un PNG empieza siempre con el bloque IHDR. */
const detectarPng = async (lector: LectorBytes, tamano: number): Promise<ResultadoDeteccion> => {
  if (tamano < 33) return rechazo('firma_invalida');
  const b = await leerExacto(lector, 8, 16);
  if (!b) return rechazo('firma_invalida');
  const esIhdr = b[4] === 0x49 && b[5] === 0x48 && b[6] === 0x44 && b[7] === 0x52;
  return esIhdr ? aceptado(PNG) : rechazo('firma_invalida');
};

// ---- Texto plano (UTF-8, sin bytes nulos ni controles raros)

const BLOQUE = 65_536;
/** Caracteres de control permitidos en un texto: tabulador, salto de línea, salto de página y retorno. */
const CONTROL_PERMITIDO = new Set([0x09, 0x0a, 0x0c, 0x0d]);

const detectarTexto = async (lector: LectorBytes, tamano: number): Promise<ResultadoDeteccion> => {
  const decodificador = new TextDecoder('utf-8', { fatal: true });
  let primero = true;
  for (let desde = 0; desde < tamano; desde += BLOQUE) {
    const hasta = Math.min(desde + BLOQUE, tamano);
    const bloque = await leerExacto(lector, desde, hasta);
    if (!bloque) return rechazo('firma_invalida');
    for (const x of bloque) if ((x < 0x20 && !CONTROL_PERMITIDO.has(x)) || x === 0x7f) return rechazo('tipo_no_permitido');
    let texto: string;
    try {
      texto = decodificador.decode(bloque, { stream: hasta < tamano });
    } catch {
      return rechazo('tipo_no_permitido'); // no es UTF-8: es binario o de otra codificación
    }
    // Un «texto» que abre con una marca (<svg…, <html…, <?xml…) es SVG, HTML o XML disfrazado.
    if (primero) {
      primero = false;
      if (texto.replace(/^﻿/, '').trimStart().startsWith('<')) return rechazo('tipo_no_permitido');
    }
  }
  return aceptado(TXT);
};

// ---- OOXML (DOCX, XLSX, PPTX): directorio central del ZIP, sin descomprimir

const MAX_COLA = 22 + 65_535; // el final del ZIP (EOCD) más su comentario más largo posible
const MAX_DIRECTORIO = 4 * 1024 * 1024;
const MAX_ENTRADAS = 10_000;

/** Partes que delatan macros, controles ActiveX u objetos incrustados: no se admiten (ADR 032). */
const PELIGROSAS = [/(^|\/)vbaproject\.bin$/, /(^|\/)vbadata\.xml$/, /(^|\/)(embeddings|activex)\//, /\.(exe|dll|js|vbs|bat|cmd|ps1|scr|jar|com|msi)$/];

const buscarFinDeZip = (cola: Uint8Array): number => {
  for (let i = cola.length - 22; i >= 0; i--) if (cola[i] === 0x50 && cola[i + 1] === 0x4b && cola[i + 2] === 0x05 && cola[i + 3] === 0x06) return i;
  return -1;
};

const detectarOoxml = async (lector: LectorBytes, tamano: number): Promise<ResultadoDeteccion> => {
  if (tamano < 22) return rechazo('firma_invalida');
  const inicioCola = Math.max(0, tamano - MAX_COLA);
  const cola = await leerExacto(lector, inicioCola, tamano);
  if (!cola) return rechazo('firma_invalida');
  const pos = buscarFinDeZip(cola);
  if (pos < 0) return rechazo('firma_invalida');

  const v = new DataView(cola.buffer, cola.byteOffset, cola.byteLength);
  const disco = v.getUint16(pos + 4, true);
  const discoDirectorio = v.getUint16(pos + 6, true);
  const entradasEnDisco = v.getUint16(pos + 8, true);
  const entradas = v.getUint16(pos + 10, true);
  const tamanoDirectorio = v.getUint32(pos + 12, true);
  const inicioDirectorio = v.getUint32(pos + 16, true);
  const largoComentario = v.getUint16(pos + 20, true);

  // ZIP64, varios discos o un comentario que no cierra con el final del archivo: no es un OOXML normal.
  if (disco !== 0 || discoDirectorio !== 0 || entradasEnDisco !== entradas || pos + 22 + largoComentario !== cola.length) return rechazo('firma_invalida');
  if (entradas === 0xffff || tamanoDirectorio === 0xffffffff || inicioDirectorio === 0xffffffff) return rechazo('firma_invalida');
  const finEocd = inicioCola + pos;
  if (entradas < 1 || entradas > MAX_ENTRADAS || tamanoDirectorio < 46 || tamanoDirectorio > MAX_DIRECTORIO || inicioDirectorio + tamanoDirectorio > finEocd) return rechazo('firma_invalida');

  const directorio = await leerExacto(lector, inicioDirectorio, inicioDirectorio + tamanoDirectorio);
  if (!directorio) return rechazo('firma_invalida');
  const d = new DataView(directorio.buffer, directorio.byteOffset, directorio.byteLength);
  const nombres: string[] = [];
  const lector8 = new TextDecoder('utf-8');
  let desde = 0;
  for (let i = 0; i < entradas; i++) {
    if (desde + 46 > directorio.length || d.getUint32(desde, true) !== 0x02014b50) return rechazo('firma_invalida');
    const banderas = d.getUint16(desde + 8, true);
    const largoNombre = d.getUint16(desde + 28, true);
    const largoExtra = d.getUint16(desde + 30, true);
    const largoComentarioEntrada = d.getUint16(desde + 32, true);
    const fin = desde + 46 + largoNombre + largoExtra + largoComentarioEntrada;
    if (largoNombre === 0 || fin > directorio.length) return rechazo('firma_invalida');
    if ((banderas & 0x1) !== 0) return rechazo('tipo_no_permitido'); // contenido cifrado: no se puede revisar
    nombres.push(lector8.decode(directorio.subarray(desde + 46, desde + 46 + largoNombre)).toLowerCase());
    desde = fin;
  }
  if (desde !== directorio.length) return rechazo('firma_invalida');

  // Nombres que intentarían salirse de la carpeta al extraer (zip-slip) o con separadores raros.
  if (nombres.some((n) => n.startsWith('/') || n.includes('\\') || n.split('/').includes('..') || n.includes('\0'))) return rechazo('firma_invalida');
  if (nombres.some((n) => PELIGROSAS.some((p) => p.test(n)))) return rechazo('tipo_no_permitido');
  if (!nombres.includes('[content_types].xml')) return rechazo('tipo_no_permitido'); // un ZIP cualquiera

  const candidatos: TipoArchivo[] = [];
  if (nombres.includes('word/document.xml')) candidatos.push(DOCX);
  if (nombres.includes('xl/workbook.xml')) candidatos.push(XLSX);
  if (nombres.includes('ppt/presentation.xml')) candidatos.push(PPTX);
  if (candidatos.length === 0) return rechazo('tipo_no_permitido');
  if (candidatos.length > 1) return rechazo('firma_invalida'); // un híbrido: no se sabe qué es
  return aceptado(candidatos[0] as TipoArchivo);
};
