import { ErrorCertificacion } from './errores.js';
import { JUSTIFICACION_MIN } from './evaluacion.js';
import { restarMeses } from './fechas.js';

// Auditoría interna (ADR 040): lista de verificación, cobertura y prerrequisito de la Etapa 2. Funciones puras. La lista solo lleva el
// identificador de la entrada de la norma (con su título breve y guía propia, nunca texto de la norma).

export const RESULTADOS_ITEM = [
  'por_evaluar',
  'conforme',
  'no_conforme',
  'observacion',
  'oportunidad',
  'no_aplica',
  'no_verificado',
] as const;
export type ResultadoItem = (typeof RESULTADOS_ITEM)[number];
export const NOTA_ITEM_MAX = 500;
export const PREGUNTAS_POR_ITEM_MAX = 5;
export const TEXTO_PREGUNTA_MAX = 300;
/** Las cláusulas de gestión (4 a 10) siempre aplican en un SGSI: no admiten exclusión. */
export const CAPITULO_GESTION_MIN = 4;
export const CAPITULO_GESTION_MAX = 10;

export const esResultadoItem = (v: unknown): v is ResultadoItem => (RESULTADOS_ITEM as readonly unknown[]).includes(v);
const EXIGEN_NOTA: readonly ResultadoItem[] = ['no_conforme', 'observacion', 'oportunidad', 'no_aplica'];

/** Valida un resultado: los distintos de «conforme» y «no verificado» exigen la evidencia objetiva o la justificación (nota). */
export const validarResultado = (resultado: unknown, nota: unknown): { resultado: ResultadoItem; nota: string | null } => {
  if (!esResultadoItem(resultado) || resultado === 'por_evaluar') throw new ErrorCertificacion('resultado', ['resultado no válido']);
  if (nota !== undefined && nota !== null && typeof nota !== 'string') throw new ErrorCertificacion('nota', ['debe ser texto']);
  const texto = typeof nota === 'string' && nota.trim() !== '' ? nota.trim() : null;
  if (texto !== null && texto.length > NOTA_ITEM_MAX) throw new ErrorCertificacion('nota', [`máximo ${NOTA_ITEM_MAX} caracteres`]);
  if (EXIGEN_NOTA.includes(resultado) && texto === null) throw new ErrorCertificacion('nota', ['obligatoria con este resultado']);
  if (resultado === 'no_aplica' && texto !== null && texto.length < JUSTIFICACION_MIN)
    throw new ErrorCertificacion('nota', ['justificacion_requerida']);
  return { resultado, nota: texto };
};

export const validarPregunta = (texto: unknown): string => {
  if (typeof texto !== 'string' || texto.trim() === '') throw new ErrorCertificacion('texto', ['obligatorio']);
  const t = texto.trim();
  if (t.length > TEXTO_PREGUNTA_MAX) throw new ErrorCertificacion('texto', [`máximo ${TEXTO_PREGUNTA_MAX} caracteres`]);
  return t;
};

// --- Generar la lista ---------------------------------------------------------------------------------------------------------------

export interface EntradaDeNorma {
  readonly idEstable: string;
  readonly orden: number;
  readonly titulo: string;
  readonly tipo: 'clausula' | 'control';
  /** Capítulo de una cláusula (4 a 10). */
  readonly capitulo: number | null;
  /** Tema de un control del Anexo A. */
  readonly grupo: string | null;
}
export interface NormaParaLista {
  readonly libreriaCodigo: string;
  readonly libreriaVersion: string;
  readonly entradas: readonly EntradaDeNorma[];
}
export interface AlcanceCapitulo {
  readonly libreriaCodigo: string;
  /** Capítulo (`'9'`) o tema (`'Controles organizacionales'`), tal como lo ve quien planifica. */
  readonly capitulo: string;
}
export interface FilaDeLista {
  readonly libreriaCodigo: string;
  readonly libreriaVersion: string;
  readonly idEstable: string;
  readonly titulo: string;
  readonly orden: number;
}

const agrupadorDe = (e: EntradaDeNorma): string | null =>
  e.tipo === 'clausula' ? (e.capitulo === null ? null : String(e.capitulo)) : e.grupo;

/**
 * Una fila por entrada de las normas elegidas (solo las que la empresa adoptó: el llamador pasa únicamente esas), limitada a los capítulos
 * o temas del alcance si se indicaron para esa norma; si no se indicó ninguno para una norma, todas sus entradas. Ordenada por norma y
 * por el orden de la librería. Fija la versión de la librería con que se genera.
 */
export const generarFilas = (normas: readonly NormaParaLista[], alcance: readonly AlcanceCapitulo[]): readonly FilaDeLista[] => {
  const filas: FilaDeLista[] = [];
  for (const n of [...normas].sort((a, b) => a.libreriaCodigo.localeCompare(b.libreriaCodigo))) {
    const elegidos = new Set(alcance.filter((c) => c.libreriaCodigo === n.libreriaCodigo).map((c) => c.capitulo));
    const entradas = [...n.entradas].sort((a, b) => a.orden - b.orden);
    for (const e of entradas) {
      if (elegidos.size > 0) {
        const g = agrupadorDe(e);
        if (g === null || !elegidos.has(g)) continue;
      }
      filas.push({
        libreriaCodigo: n.libreriaCodigo,
        libreriaVersion: n.libreriaVersion,
        idEstable: e.idEstable,
        titulo: e.titulo,
        orden: e.orden,
      });
    }
  }
  return filas;
};

export interface FilaActual {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly resultado: ResultadoItem;
}
export interface PlanDeRegeneracion {
  readonly agregar: readonly FilaDeLista[];
  /** Solo filas «por evaluar»: nunca se pierde lo ya evaluado. */
  readonly quitar: readonly { libreriaCodigo: string; idEstable: string }[];
  /** Filas ya evaluadas que quedan fuera del nuevo alcance: se conservan y se avisa. */
  readonly conservadasFueraDeAlcance: readonly { libreriaCodigo: string; idEstable: string }[];
  readonly conservadas: number;
}

/** Regenerar la lista a propósito: agrega lo que falta, quita lo «por evaluar» que ya no corresponde y conserva lo evaluado. */
export const planificarRegeneracion = (actuales: readonly FilaActual[], nuevas: readonly FilaDeLista[]): PlanDeRegeneracion => {
  const clave = (f: { libreriaCodigo: string; idEstable: string }): string => `${f.libreriaCodigo}\u0000${f.idEstable}`;
  const nuevasPorClave = new Set(nuevas.map(clave));
  const actualesPorClave = new Set(actuales.map(clave));
  const quitar: { libreriaCodigo: string; idEstable: string }[] = [];
  const fuera: { libreriaCodigo: string; idEstable: string }[] = [];
  let conservadas = 0;
  for (const a of actuales) {
    if (nuevasPorClave.has(clave(a))) conservadas += 1;
    else if (a.resultado === 'por_evaluar') quitar.push({ libreriaCodigo: a.libreriaCodigo, idEstable: a.idEstable });
    else fuera.push({ libreriaCodigo: a.libreriaCodigo, idEstable: a.idEstable });
  }
  return { agregar: nuevas.filter((f) => !actualesPorClave.has(clave(f))), quitar, conservadasFueraDeAlcance: fuera, conservadas };
};

// --- Cobertura y prerrequisito -------------------------------------------------------------------------------------------------------

export interface FilaEvaluada {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly resultado: ResultadoItem;
  readonly nota: string | null;
}
export interface AuditoriaParaCobertura {
  readonly estado: string;
  /** Fecha de cierre `AAAA-MM-DD` (para la ventana de 12 meses móviles). */
  readonly cerradaEn: string | null;
  readonly tieneInforme: boolean;
  readonly filas: readonly FilaEvaluada[];
  readonly procesosIds: readonly string[];
}
export interface EntradaDeReferencia {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: 'clausula' | 'control';
  readonly capitulo: number | null;
}
export interface ReferenciaDeCobertura {
  /** Entradas de las normas elegidas (cláusulas y controles). */
  readonly entradas: readonly EntradaDeReferencia[];
  /** Procesos vigentes del alcance (incluido «Gestión del SIG»). */
  readonly procesosIds: readonly string[];
  /** Controles aplicables según la Declaración de Aplicabilidad aprobada; `null` si todavía no hay Declaración aprobada. */
  readonly controlesAplicables: readonly { libreriaCodigo: string; idEstable: string }[] | null;
}
export interface Cobertura {
  readonly clausulas: { readonly total: number; readonly cubiertas: number; readonly faltantes: readonly string[] };
  readonly controles: {
    readonly total: number;
    readonly cubiertos: number;
    readonly faltantes: readonly string[];
    readonly sinDeclaracion: boolean;
  };
  readonly procesos: { readonly total: number; readonly cubiertos: number; readonly faltantes: readonly string[] };
}

const clave = (c: string, i: string): string => `${c}\u0000${i}`;

/** Una fila cuenta como cubierta solo si se evaluó de verdad: «no verificado», «por evaluar» y «no aplica» sin justificación no cuentan. */
export const filaCubierta = (f: FilaEvaluada): boolean => {
  if (f.resultado === 'conforme' || f.resultado === 'no_conforme' || f.resultado === 'observacion' || f.resultado === 'oportunidad')
    return true;
  return f.resultado === 'no_aplica' && f.nota !== null && f.nota.trim().length >= JUSTIFICACION_MIN;
};

/** `AAAA-MM-DD` de hace `meses` meses, para la cobertura de 12 meses móviles. */
export const ventanaMovil = (hoy: string, meses = 12): string => restarMeses(hoy, meses);

/**
 * Cobertura con las auditorías CERRADAS con informe (las demás no cuentan). Cláusulas 4 a 10 de cada norma elegida, procesos del alcance
 * y controles aplicables según la Declaración. Una cláusula, control o proceso está cubierto si alguna auditoría cerrada lo evaluó de
 * verdad. `desde` (opcional) limita a las cerradas desde esa fecha: la cobertura en 12 meses móviles.
 */
export const calcularCoberturaAuditoria = (
  auditorias: readonly AuditoriaParaCobertura[],
  referencia: ReferenciaDeCobertura,
  desde: string | null = null,
): Cobertura => {
  const cerradas = auditorias.filter(
    (a) => a.estado === 'cerrada' && a.tieneInforme && (desde === null || (a.cerradaEn !== null && a.cerradaEn >= desde)),
  );
  const cubiertas = new Set<string>();
  const procesos = new Set<string>();
  for (const a of cerradas) {
    for (const f of a.filas) if (filaCubierta(f)) cubiertas.add(clave(f.libreriaCodigo, f.idEstable));
    for (const p of a.procesosIds) procesos.add(p);
  }
  const clausulas = referencia.entradas.filter(
    (e) => e.tipo === 'clausula' && e.capitulo !== null && e.capitulo >= CAPITULO_GESTION_MIN && e.capitulo <= CAPITULO_GESTION_MAX,
  );
  const faltanClausulas = clausulas
    .filter((e) => !cubiertas.has(clave(e.libreriaCodigo, e.idEstable)))
    .map((e) => `${e.libreriaCodigo}:${e.idEstable}`);
  const aplicables = referencia.controlesAplicables ?? [];
  const faltanControles = aplicables
    .filter((c) => !cubiertas.has(clave(c.libreriaCodigo, c.idEstable)))
    .map((c) => `${c.libreriaCodigo}:${c.idEstable}`);
  const faltanProcesos = referencia.procesosIds.filter((p) => !procesos.has(p));
  return {
    clausulas: { total: clausulas.length, cubiertas: clausulas.length - faltanClausulas.length, faltantes: faltanClausulas },
    controles: {
      total: aplicables.length,
      cubiertos: aplicables.length - faltanControles.length,
      faltantes: faltanControles,
      sinDeclaracion: referencia.controlesAplicables === null,
    },
    procesos: {
      total: referencia.procesosIds.length,
      cubiertos: referencia.procesosIds.length - faltanProcesos.length,
      faltantes: faltanProcesos,
    },
  };
};

export interface Prerrequisito {
  readonly cumple: boolean;
  readonly auditoriasCerradas: number;
  /** Lo que falta, listo para mostrarse como brecha visible. */
  readonly brechas: {
    readonly clausulas: readonly string[];
    readonly procesos: readonly string[];
    readonly controles: readonly string[];
    readonly sinDeclaracion: boolean;
  };
}

/**
 * Prerrequisito de la Etapa 2 (ADR 040): al menos una auditoría interna cerrada con informe Y cobertura completa de las cláusulas 4 a 10,
 * de los procesos del alcance y de los controles aplicables de la Declaración aprobada. Sin Declaración aprobada no se puede decir que
 * cumple. Este módulo calcula y muestra el dato; no decide la etapa.
 */
export const evaluarPrerrequisito = (auditorias: readonly AuditoriaParaCobertura[], referencia: ReferenciaDeCobertura): Prerrequisito => {
  const cobertura = calcularCoberturaAuditoria(auditorias, referencia);
  const cerradas = auditorias.filter((a) => a.estado === 'cerrada' && a.tieneInforme).length;
  const brechas = {
    clausulas: cobertura.clausulas.faltantes,
    procesos: cobertura.procesos.faltantes,
    controles: cobertura.controles.faltantes,
    sinDeclaracion: cobertura.controles.sinDeclaracion,
  };
  const cumple =
    cerradas >= 1 &&
    !brechas.sinDeclaracion &&
    brechas.clausulas.length === 0 &&
    brechas.procesos.length === 0 &&
    brechas.controles.length === 0 &&
    cobertura.clausulas.total > 0;
  return { cumple, auditoriasCerradas: cerradas, brechas };
};
