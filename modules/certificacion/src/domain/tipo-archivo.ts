/** Lista CERRADA de tipos de archivo para evidencias (ADR 032). Sin SVG, HTML ni formatos con macros. */
export const TIPOS_ARCHIVO = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];

export const esTipoArchivo = (valor: unknown): valor is TipoArchivo => typeof valor === 'string' && (TIPOS_ARCHIVO as readonly string[]).includes(valor);

/** 25 MB. */
export const TAMANO_MAX_BYTES = 26_214_400;
export const NOMBRE_ARCHIVO_MAX = 120;

const EXTENSION: Readonly<Record<TipoArchivo, string>> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'text/plain': 'txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};
export const extensionDeTipo = (tipo: TipoArchivo): string => EXTENSION[tipo];

// Solo letras (con tildes y ñ), números, espacio, punto, guion, guion bajo y paréntesis: lo demás se vuelve «_».
const NO_SEGURO = /[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ ._()-]/gu;

/**
 * Nombre que el cliente manda, convertido en una etiqueta SEGURA: sin carpetas (`../`, `C:\`), sin caracteres de control ni
 * símbolos, de hasta 120 y nunca vacío. Se usa solo para mostrar y para nombrar la descarga; en disco el archivo es un UUID.
 */
export const normalizarNombreArchivo = (original: unknown): string => {
  const texto = typeof original === 'string' ? original : '';
  const base = texto.split(/[\\/]/).pop() ?? '';
  const limpio = base
    .normalize('NFC')
    .replace(NO_SEGURO, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+|[ .]+$/g, '')
    .slice(0, NOMBRE_ARCHIVO_MAX)
    .replace(/[ .]+$/g, '');
  return limpio === '' ? 'archivo' : limpio;
};

/**
 * Nombre con el que se entrega la descarga: el de la etiqueta SIN su extensión y con la que corresponde al tipo que se detectó
 * al subir. Así un «informe.pdf» que en realidad era un TXT no se descarga como PDF.
 */
export const nombreDeDescarga = (nombre: string, tipo: TipoArchivo): string => {
  const sinExtension = nombre.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  const base = sinExtension === '' ? 'archivo' : sinExtension;
  const extension = `.${extensionDeTipo(tipo)}`;
  return `${base.slice(0, NOMBRE_ARCHIVO_MAX - extension.length)}${extension}`;
};
