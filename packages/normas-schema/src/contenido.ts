// Reglas de CONTENIDO de las librerías de normas (ADR 026, regla 3 del proyecto: nunca incluir texto de las normas).
// Funciones puras, sin dependencias: las usan el validador, los scripts y, más adelante, el dominio del módulo de normas.
//
// Son patrones de ESTRUCTURA (cantidad de frases, tono, formato), nunca frases tomadas de una norma: no tenemos ese texto con
// que comparar, y una lista de frases prohibidas sería ella misma texto de la norma. Por eso solo acotan el riesgo; la garantía
// real es la revisión humana de `revisor-cumplimiento` antes de publicar una librería.
// Los hallazgos son códigos: NUNCA repiten el texto revisado.

export const LIMITES = {
  tituloMin: 2,
  tituloMax: 80,
  guiaMin: 10,
  guiaMax: 280,
  frasesMax: 2,
  /** Una sola frase más larga que esto es típica del lenguaje legal. */
  fraseMax: 200,
  /** Una cita entre comillas de al menos esta longitud se considera texto copiado. */
  citaMin: 40,
  /** Más obligaciones que estas en una guía delatan el tono de una norma. */
  obligacionesMax: 1,
  /** Cantidad de punto y coma a partir de la cual el texto parece una enumeración. */
  puntoYComaMax: 2,
} as const;

export type CodigoContenido =
  | 'titulo_demasiado_corto'
  | 'titulo_demasiado_largo'
  | 'guia_demasiado_corta'
  | 'guia_demasiado_larga'
  | 'guia_demasiadas_frases'
  | 'frase_demasiado_larga'
  | 'tono_normativo'
  | 'cita_textual'
  | 'formato_de_lista'
  | 'enlace_o_correo';

export type CampoTexto = 'titulo' | 'guia';

export interface HallazgoContenido {
  readonly entrada: string;
  readonly indice: number;
  readonly campo: CampoTexto;
  readonly codigo: CodigoContenido;
}

export interface EntradaTextual {
  readonly id: string;
  readonly titulo: string;
  readonly guia: string;
}

const longitud = (texto: string): number => [...texto].length;

/** Enmascara los puntos que no terminan una frase (números, identificadores de cláusula y abreviaturas). */
const enmascarar = (texto: string): string =>
  texto
    .replace(/\.{2,}|…/g, '.')
    .replace(/(\d)\.(?=\d)/g, '$1\u0000')
    .replace(/\bp\.\s?ej\./gi, (m) => m.replaceAll('.', '\u0000'))
    .replace(/\b(?:ing|sr|sra|srta|dr|dra|vs|núm|art|pág|cap|apdo)\./gi, (m) => m.replaceAll('.', '\u0000'))
    // «etc.» solo es abreviatura a mitad de frase; seguido de mayúscula termina la frase.
    .replace(/\b[eE]tc\.(?=\s*[a-záéíóúñ,;)])/g, (m) => m.replaceAll('.', '\u0000'));

const frases = (texto: string): string[] =>
  enmascarar(texto)
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((f) => /[\p{L}\p{N}]/u.test(f));

/** Cuenta las frases de un texto (conservador: ante la duda cuenta de más). */
export const contarFrases = (texto: string): number => frases(texto).length;

// `\b` de JavaScript no reconoce las vocales con tilde como letras: los límites de palabra se escriben con \p{L}.
const palabra = (alternativas: string, banderas = 'giu'): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternativas})(?![\\p{L}\\p{N}])`, banderas);
const SUJETO_CON_DEBER = palabra('(?:la|el|las|los)\\s+(?:organizaci(?:ón|ones)|alta\\s+dirección|dirección|personal|empresa|entidad|responsable|auditor(?:es)?)\\s+(?:debe|deben|deberá|deberán)', 'iu');
const OBLIGACION = palabra('debe|deben|deberá|deberán|deberían?|se\\s+requiere|es\\s+necesario\\s+que|se\\s+exige');
const MODAL_EN_INGLES = /\bshall\b/i;
const CITA = /«([^»]*)»|"([^"]*)"|“([^”]*)”/g;
const ENUMERACION_LETRAS = /(?:^|\s)[a-z]\)\s/g;
const ENUMERACION_NUMEROS = /(?:^|\s)\d{1,2}\)\s/g;
const VINETA = /(?:^|\n)\s*[-•*]\s/;
const ENLACE_O_CORREO = /@|https?:\/\/|www\./i;

const coincidencias = (texto: string, patron: RegExp): number => texto.match(patron)?.length ?? 0;

const tonoNormativo = (texto: string): boolean => SUJETO_CON_DEBER.test(texto) || MODAL_EN_INGLES.test(texto) || coincidencias(texto, OBLIGACION) > LIMITES.obligacionesMax;

const hayCitaLarga = (texto: string): boolean => [...texto.matchAll(CITA)].some((m) => longitud(m[1] ?? m[2] ?? m[3] ?? '') >= LIMITES.citaMin);

const formatoDeLista = (texto: string): boolean =>
  texto.includes('\n') || VINETA.test(texto) || coincidencias(texto, ENUMERACION_LETRAS) >= 2 || coincidencias(texto, ENUMERACION_NUMEROS) >= 2 || coincidencias(texto, /;/g) > LIMITES.puntoYComaMax;

/** Revisa un texto. Devuelve los códigos de las reglas que incumple (sin repetidos y sin repetir el texto). */
export const revisarTexto = (campo: CampoTexto, texto: string): CodigoContenido[] => {
  const encontrados = new Set<CodigoContenido>();
  const n = longitud(texto);

  if (campo === 'titulo') {
    if (n < LIMITES.tituloMin) encontrados.add('titulo_demasiado_corto');
    if (n > LIMITES.tituloMax) encontrados.add('titulo_demasiado_largo');
    if (texto.includes('\n')) encontrados.add('formato_de_lista');
    if (ENLACE_O_CORREO.test(texto)) encontrados.add('enlace_o_correo');
    return [...encontrados];
  }

  if (n < LIMITES.guiaMin) encontrados.add('guia_demasiado_corta');
  if (n > LIMITES.guiaMax) encontrados.add('guia_demasiado_larga');
  const lista = frases(texto);
  if (lista.length > LIMITES.frasesMax) encontrados.add('guia_demasiadas_frases');
  if (lista.some((f) => longitud(f) > LIMITES.fraseMax)) encontrados.add('frase_demasiado_larga');
  if (tonoNormativo(texto)) encontrados.add('tono_normativo');
  if (hayCitaLarga(texto)) encontrados.add('cita_textual');
  if (formatoDeLista(texto)) encontrados.add('formato_de_lista');
  if (ENLACE_O_CORREO.test(texto)) encontrados.add('enlace_o_correo');
  return [...encontrados];
};

/** Revisa título y guía de cada entrada. */
export const revisarContenido = (libreria: { readonly entradas: readonly EntradaTextual[] }): readonly HallazgoContenido[] =>
  libreria.entradas.flatMap((e, indice) =>
    (['titulo', 'guia'] as const).flatMap((campo) => revisarTexto(campo, e[campo]).map((codigo): HallazgoContenido => ({ entrada: e.id, indice, campo, codigo }))),
  );
