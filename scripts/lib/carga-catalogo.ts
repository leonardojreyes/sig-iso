// Carga del catálogo global de librerías de normas (ADR 026, tarea 4.5). Corre con el rol `sigiso_catalogo`; NUNCA desde la API.
// - Cada versión es inmutable: se guarda su huella SHA-256 (contenido canónico). Misma versión y misma huella = «ya cargada»;
//   misma versión con OTRA huella se rechaza.
// - La carga de cada librería es todo o nada (una transacción).
// - Cada carga aceptada o rechazada deja un hecho de plataforma `catalogo.cargado` (sin empresa), una sola vez por contenido,
//   con códigos y nunca con el contenido del archivo.
import { createHash } from 'node:crypto';
import type { Bitacora } from '@sig/auditoria';
import type { Libreria } from '@sig/normas-schema';
import type { Kysely } from 'kysely';
import { archivosYaml, evaluarArchivo } from './validar-librerias.mjs';

interface BdCatalogo {
  libreria: {
    id: string;
    codigo: string;
    nombre: string;
    version: string;
    hash: string;
    es_ejemplo: boolean;
    fuente: string;
  };
  libreria_entrada: {
    id: string;
    libreria_id: string;
    id_estable: string;
    capitulo: number;
    nivel: number;
    titulo: string;
    guia: string;
    alcance_comun: string;
    orden: number;
  };
  libreria_entrada_norma: { entrada_id: string; libreria_id: string; norma: string; edicion: string; clausula: string };
}

export interface ErrorArchivo {
  readonly entrada: string | null;
  readonly indice: number | null;
  readonly ruta: string;
  readonly codigo: string;
}

/** Resultado de `evaluarArchivo` (validar-librerias.mjs). */
export type EvaluacionArchivo =
  | {
      readonly archivo: string;
      readonly ok: true;
      readonly huellaArchivo: string;
      readonly libreria: Libreria;
      readonly errores: readonly [];
    }
  | {
      readonly archivo: string;
      readonly ok: false;
      readonly motivo: 'formato_invalido' | 'contenido_no_permitido';
      readonly huellaArchivo: string;
      readonly errores: readonly ErrorArchivo[];
    };

export type EstadoCarga = 'cargada' | 'ya_cargada' | 'hash_distinto' | 'formato_invalido' | 'contenido_no_permitido';

export interface ResultadoCarga {
  readonly archivo: string;
  readonly codigo: string | null;
  readonly version: string | null;
  readonly estado: EstadoCarga;
  readonly entradas: number | null;
  /** SHA-256 del contenido canónico (si es válida) o de los bytes del archivo (si no). */
  readonly huella: string;
  readonly evento: 'registrado' | 'ya_existia';
  /** Códigos y rutas de lo que falló (nunca el contenido). */
  readonly errores: readonly ErrorArchivo[];
}

const canonico = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
};

/** SHA-256 del contenido canónico: no depende del formato del archivo ni del orden de las claves, pero sí del de las entradas. */
export const huellaCanonica = (libreria: unknown): string =>
  createHash('sha256').update(canonico(libreria)).digest('hex');

export const evaluarCarpeta = (dir: string): EvaluacionArchivo[] =>
  (archivosYaml(dir) as string[]).map((a) => evaluarArchivo(a) as EvaluacionArchivo);

type Intento = 'nueva' | 'ya' | 'distinto';

const intentarCarga = (catalogo: Kysely<unknown>, l: Libreria, huella: string): Promise<Intento> =>
  (catalogo as Kysely<BdCatalogo>).transaction().execute(async (trx) => {
    const previa = await trx
      .selectFrom('libreria')
      .select('hash')
      .where('codigo', '=', l.codigo)
      .where('version', '=', l.version)
      .executeTakeFirst();
    if (previa) return previa.hash === huella ? 'ya' : 'distinto';
    const lib = await trx
      .insertInto('libreria')
      .values({
        codigo: l.codigo,
        nombre: l.nombre,
        version: l.version,
        hash: huella,
        es_ejemplo: l.es_ejemplo,
        fuente: l.fuente,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [i, e] of l.entradas.entries()) {
      const entrada = await trx
        .insertInto('libreria_entrada')
        .values({
          libreria_id: lib.id,
          id_estable: e.id,
          capitulo: e.capitulo,
          nivel: e.nivel,
          titulo: e.titulo,
          guia: e.guia,
          alcance_comun: e.alcance_comun,
          orden: i + 1,
        } as never)
        .returning('id')
        .executeTakeFirstOrThrow();
      for (const a of e.aplica_a) {
        await trx
          .insertInto('libreria_entrada_norma')
          .values({
            entrada_id: entrada.id,
            libreria_id: lib.id,
            norma: a.norma,
            edicion: a.edicion,
            clausula: a.clausula,
          } as never)
          .execute();
      }
    }
    return 'nueva';
  });

const esChoqueDeUnicidad = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === '23505';

// Dos cargas simultáneas de la misma versión: la segunda choca con la restricción única; se vuelve a mirar y ya es «ya»/«distinto».
const cargarUna = async (catalogo: Kysely<unknown>, l: Libreria, huella: string): Promise<Intento> => {
  try {
    return await intentarCarga(catalogo, l, huella);
  } catch (e) {
    if (!esChoqueDeUnicidad(e)) throw e;
    return intentarCarga(catalogo, l, huella);
  }
};

const objetoDeArchivo = (archivo: string): string => {
  const nombre = (archivo.split(/[\\/]/).pop() ?? '').replace(/\.ya?ml$/i, '');
  return /^[A-Za-z0-9._-]{1,100}$/.test(nombre) ? `libreria:${nombre}` : 'libreria:archivo';
};

export const cargarCatalogo = async (
  destinos: { catalogo: Kysely<unknown>; bitacora: Bitacora },
  evaluaciones: readonly EvaluacionArchivo[],
): Promise<ResultadoCarga[]> => {
  const resultados: ResultadoCarga[] = [];
  for (const ev of evaluaciones) {
    if (!ev.ok) {
      // Rechazo previo a la base: se identifica por el contenido del archivo (su huella), sin repetirlo.
      const evento = await destinos.bitacora.registrarUnaVez({
        empresaId: null,
        actor: { tipo: 'plataforma' },
        accion: 'catalogo.cargado',
        resultado: 'rechazado',
        motivo: ev.motivo,
        objeto: objetoDeArchivo(ev.archivo),
        objetoVersion: ev.huellaArchivo,
        origenId: `catalogo:rechazo:${ev.huellaArchivo}:${ev.motivo}`,
      });
      resultados.push({
        archivo: ev.archivo,
        codigo: null,
        version: null,
        estado: ev.motivo,
        entradas: null,
        huella: ev.huellaArchivo,
        evento,
        errores: ev.errores,
      });
      continue;
    }
    const l = ev.libreria;
    const huella = huellaCanonica(l);
    const intento = await cargarUna(destinos.catalogo, l, huella);
    const base = { archivo: ev.archivo, codigo: l.codigo, version: l.version, huella, errores: [] as const };
    if (intento === 'distinto') {
      const evento = await destinos.bitacora.registrarUnaVez({
        empresaId: null,
        actor: { tipo: 'plataforma' },
        accion: 'catalogo.cargado',
        resultado: 'rechazado',
        motivo: 'hash_distinto',
        objeto: `libreria:${l.codigo}`,
        objetoVersion: huella,
        origenId: `catalogo:${l.codigo}:${l.version}:${huella}:hash_distinto`,
      });
      resultados.push({ ...base, estado: 'hash_distinto', entradas: null, evento });
      continue;
    }
    // El hecho se registra DESPUÉS de los datos y una sola vez por contenido: si la corrida se interrumpe entre ambos, la siguiente
    // ve «ya cargada» y lo completa.
    const evento = await destinos.bitacora.registrarUnaVez({
      empresaId: null,
      actor: { tipo: 'plataforma' },
      accion: 'catalogo.cargado',
      resultado: 'ok',
      motivo: 'carga_inicial',
      objeto: `libreria:${l.codigo}`,
      objetoVersion: huella,
      despues: { entradas: l.entradas.length },
      origenId: `catalogo:${l.codigo}:${l.version}:${huella}`,
    });
    resultados.push({
      ...base,
      estado: intento === 'nueva' ? 'cargada' : 'ya_cargada',
      entradas: l.entradas.length,
      evento,
    });
  }
  return resultados;
};
