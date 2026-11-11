// Validador de librerías de normas, esquemas v2 y v3 (ADR 026; la v3 agrega los controles del Anexo A): estructura (JSON Schema) y reglas entre campos.
// Los errores se expresan con códigos y rutas: NUNCA repiten el contenido recibido ni nombres de campos desconocidos,
// porque ese contenido podría ser, justamente, lo que no debe guardarse (texto de una norma o datos personales).
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import esquema from '../libreria-norma.schema.json' with { type: 'json' };

export type AlcanceComun = 'comun' | 'parcial' | 'especifico';

export interface ReferenciaNorma {
  readonly norma: string;
  readonly edicion: string;
}

export interface CorrespondenciaNorma extends ReferenciaNorma {
  readonly clausula: string;
}

export interface EntradaLibreria {
  readonly id: string;
  /** Obligatorio en una cláusula; ausente en un control. */
  readonly capitulo?: number;
  readonly nivel: 1 | 2;
  /** Por omisión, cláusula. */
  readonly tipo?: 'clausula' | 'control';
  /** Tema de un control (obligatorio solo en controles). */
  readonly grupo?: string;
  readonly titulo: string;
  readonly guia: string;
  readonly alcance_comun: AlcanceComun;
  readonly aplica_a: readonly CorrespondenciaNorma[];
}

export interface Libreria {
  readonly esquema: 2 | 3;
  readonly codigo: string;
  readonly nombre: string;
  readonly version: string;
  readonly es_ejemplo: boolean;
  readonly fuente: string;
  readonly referencias: readonly ReferenciaNorma[];
  readonly entradas: readonly EntradaLibreria[];
}

export type CodigoError =
  | 'campo_obligatorio'
  | 'campo_desconocido'
  | 'tipo_incorrecto'
  | 'demasiado_largo'
  | 'demasiado_corto'
  | 'formato_invalido'
  | 'valor_no_permitido'
  | 'fuera_de_rango'
  | 'lista_vacia'
  | 'esquema_no_soportado'
  | 'invalido'
  | 'id_repetido'
  | 'referencia_repetida'
  | 'norma_no_declarada'
  | 'aplica_a_repetido';

export interface ErrorLibreria {
  /** Identificador de la entrada afectada, solo si tiene un formato válido; si no, `null` (no se repite lo recibido). */
  readonly entrada: string | null;
  /** Posición de la entrada en la lista, si el error es de una entrada. */
  readonly indice: number | null;
  /** Ruta del campo, por ejemplo `entradas[3].guia`. Vacía si es de la propia librería. */
  readonly ruta: string;
  readonly codigo: CodigoError;
}

export type ResultadoValidacion = { readonly ok: true; readonly libreria: Libreria } | { readonly ok: false; readonly errores: readonly ErrorLibreria[] };

const ID_VALIDO = /^[a-z0-9][a-z0-9.-]{0,40}$/;

const CODIGO_POR_PALABRA: Readonly<Record<string, CodigoError>> = {
  required: 'campo_obligatorio',
  additionalProperties: 'campo_desconocido',
  type: 'tipo_incorrecto',
  maxLength: 'demasiado_largo',
  minLength: 'demasiado_corto',
  pattern: 'formato_invalido',
  enum: 'valor_no_permitido',
  minimum: 'fuera_de_rango',
  maximum: 'fuera_de_rango',
  minItems: 'lista_vacia',
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validarEsquema = ajv.compile(esquema);

/** `/entradas/3/guia` → `entradas[3].guia`. */
const aRuta = (rutaJson: string): string =>
  rutaJson
    .split('/')
    .filter((p) => p !== '')
    .reduce((ruta, parte) => (/^\d+$/.test(parte) ? `${ruta}[${parte}]` : ruta === '' ? parte : `${ruta}.${parte}`), '');

const indiceDeEntrada = (ruta: string): number | null => {
  const m = /^entradas\[(\d+)\]/.exec(ruta);
  return m?.[1] === undefined ? null : Number(m[1]);
};

const idDeEntrada = (datos: unknown, indice: number | null): string | null => {
  if (indice === null || typeof datos !== 'object' || datos === null) return null;
  const entradas = (datos as { entradas?: unknown }).entradas;
  if (!Array.isArray(entradas)) return null;
  const id = (entradas[indice] as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' && ID_VALIDO.test(id) ? id : null;
};

const traducir = (e: ErrorObject, datos: unknown): ErrorLibreria => {
  let ruta = aRuta(e.instancePath);
  if (e.keyword === 'required') ruta = ruta === '' ? String(e.params.missingProperty) : `${ruta}.${String(e.params.missingProperty)}`;
  const codigo: CodigoError = e.keyword === 'const' || (e.keyword === 'enum' && ruta === 'esquema') ? (ruta === 'esquema' ? 'esquema_no_soportado' : 'valor_no_permitido') : (CODIGO_POR_PALABRA[e.keyword] ?? 'invalido');
  const indice = indiceDeEntrada(ruta);
  return { entrada: idDeEntrada(datos, indice), indice, ruta, codigo };
};

/** Reglas que el esquema no puede expresar. Solo se evalúan si la estructura es válida. */
const reglasEntreCampos = (l: Libreria): ErrorLibreria[] => {
  const errores: ErrorLibreria[] = [];
  const error = (ruta: string, codigo: CodigoError, indice: number | null = null): void => {
    errores.push({ entrada: indice === null ? null : l.entradas[indice]!.id, indice, ruta, codigo });
  };
  const clave = (r: ReferenciaNorma): string => JSON.stringify([r.norma, r.edicion]);

  const declaradas = new Set<string>();
  l.referencias.forEach((r, i) => {
    if (declaradas.has(clave(r))) error(`referencias[${i}]`, 'referencia_repetida');
    declaradas.add(clave(r));
  });

  const ids = new Set<string>();
  l.entradas.forEach((e, i) => {
    if (ids.has(e.id)) error(`entradas[${i}].id`, 'id_repetido', i);
    ids.add(e.id);
    const vistas = new Set<string>();
    e.aplica_a.forEach((a, j) => {
      const ruta = `entradas[${i}].aplica_a[${j}]`;
      if (!declaradas.has(clave(a))) error(ruta, 'norma_no_declarada', i);
      if (vistas.has(clave(a))) error(ruta, 'aplica_a_repetido', i);
      vistas.add(clave(a));
    });
  });
  return errores;
};

/** Valida una librería ya leída (por ejemplo, de un YAML). Informa todos los problemas a la vez. */
export const validarLibreria = (datos: unknown): ResultadoValidacion => {
  if (!validarEsquema(datos)) return { ok: false, errores: (validarEsquema.errors ?? []).map((e) => traducir(e, datos)) };
  const libreria = datos as unknown as Libreria;
  const errores = reglasEntreCampos(libreria);
  return errores.length > 0 ? { ok: false, errores } : { ok: true, libreria };
};
