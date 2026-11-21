import { ErrorCertificacion } from './errores.js';

// Auditoría interna (ADR 040): qué del sistema queda sin auditar en el programa del año. Reglas puras.

export interface AlcanceDeAuditoria {
  /** Estado de la auditoría: las canceladas no cuentan. */
  readonly estado: string;
  readonly normas: readonly string[];
  readonly procesosIds: readonly string[];
  /** Capítulos o temas indicados; vacío = todos los de sus normas. */
  readonly capitulos: readonly { readonly libreriaCodigo: string; readonly capitulo: string }[];
}
export interface ExclusionDePrograma {
  readonly tipo: 'proceso' | 'capitulo';
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly capitulo: string | null;
}
export interface PendientesDePrograma {
  /** Procesos vigentes que ninguna auditoría del año incluye y que no tienen motivo de exclusión. */
  readonly procesosSinMotivo: readonly string[];
  /** Capítulos o temas de las normas del programa que ninguna auditoría incluye y que no tienen motivo. */
  readonly capitulosSinMotivo: readonly { readonly libreriaCodigo: string; readonly capitulo: string }[];
  /** Lo que sí entra al año (planificado, no necesariamente realizado). */
  readonly procesosIncluidos: number;
  readonly capitulosIncluidos: number;
}

/**
 * Para aprobar el programa, cada proceso vigente y cada capítulo o tema de las normas del programa debe estar en alguna auditoría no
 * cancelada del año o llevar un motivo de por qué no entra (por ejemplo «auditado el año pasado sin hallazgos»).
 */
export const calcularPendientesDePrograma = (entrada: {
  readonly procesosVigentes: readonly string[];
  /** Capítulos y temas de cada norma del programa (según las entradas adoptadas). */
  readonly capitulosPorNorma: ReadonlyMap<string, readonly string[]>;
  readonly auditorias: readonly AlcanceDeAuditoria[];
  readonly exclusiones: readonly ExclusionDePrograma[];
}): PendientesDePrograma => {
  const activas = entrada.auditorias.filter((a) => a.estado !== 'cancelada');
  const procesosEnAuditoria = new Set(activas.flatMap((a) => a.procesosIds));
  const procesosExcluidos = new Set(entrada.exclusiones.filter((e) => e.tipo === 'proceso' && e.procesoId).map((e) => e.procesoId as string));
  const clave = (c: string, k: string): string => `${c}\u0000${k}`;
  const incluidos = new Set<string>();
  for (const a of activas) {
    for (const n of a.normas) {
      const elegidos = a.capitulos.filter((c) => c.libreriaCodigo === n).map((c) => c.capitulo);
      for (const k of elegidos.length > 0 ? elegidos : (entrada.capitulosPorNorma.get(n) ?? [])) incluidos.add(clave(n, k));
    }
  }
  const excluidos = new Set(entrada.exclusiones.filter((e) => e.tipo === 'capitulo' && e.libreriaCodigo && e.capitulo).map((e) => clave(e.libreriaCodigo as string, e.capitulo as string)));
  const capitulosSinMotivo: { libreriaCodigo: string; capitulo: string }[] = [];
  let capitulosIncluidos = 0;
  for (const [norma, capitulos] of [...entrada.capitulosPorNorma].sort(([a], [b]) => a.localeCompare(b))) {
    for (const k of capitulos) {
      if (incluidos.has(clave(norma, k))) capitulosIncluidos += 1;
      else if (!excluidos.has(clave(norma, k))) capitulosSinMotivo.push({ libreriaCodigo: norma, capitulo: k });
    }
  }
  return {
    procesosSinMotivo: entrada.procesosVigentes.filter((p) => !procesosEnAuditoria.has(p) && !procesosExcluidos.has(p)),
    capitulosSinMotivo,
    procesosIncluidos: entrada.procesosVigentes.filter((p) => procesosEnAuditoria.has(p)).length,
    capitulosIncluidos,
  };
};

export const NOTA_EXCLUSION_MAX = 300;
export const NORMAS_POR_PROGRAMA_MAX = 10;
export const EXCLUSIONES_POR_PROGRAMA_MAX = 500;

/** El motivo de no incluir algo en el año es un texto de la empresa (acotado; no va a la bitácora). */
export const validarMotivoExclusion = (v: unknown): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new ErrorCertificacion('motivo', ['obligatorio']);
  const t = v.trim();
  if (t.length > NOTA_EXCLUSION_MAX) throw new ErrorCertificacion('motivo', [`máximo ${NOTA_EXCLUSION_MAX} caracteres`]);
  return t;
};

export const validarCapitulo = (v: unknown): string => {
  if (typeof v !== 'string' || v.trim() === '' || v.trim().length > 60) throw new ErrorCertificacion('capitulo', ['capítulo no válido']);
  return v.trim();
};
