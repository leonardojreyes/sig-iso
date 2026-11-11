// Cobertura documental (M4): qué entradas de las normas adoptadas están respaldadas por evidencia, a través de los mapeos de M3.
// Es una función pura que se calcula cada vez; no se guarda nada. NO opina sobre la eficacia de los controles: mide si hay
// documentos vigentes que respalden cada entrada.

export type EstadoCobertura = 'cubierta' | 'evidencia_vencida' | 'sin_evidencia' | 'sin_control' | 'no_aplica';

export interface EntradaParaCobertura {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  /** Normas a las que aplica (una entrada común cuenta en cada una). */
  readonly normas: readonly string[];
  /** La empresa la evaluó como «no aplica»: no se le pide cobertura. */
  readonly noAplica: boolean;
}
export interface ControlParaCobertura {
  readonly id: string;
  readonly vigente: boolean;
}
export interface MapeoParaCobertura {
  readonly controlId: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
}
export interface EvidenciaParaCobertura {
  readonly controlId: string;
  readonly activa: boolean;
  /** AAAA-MM-DD o nulo (sin vencimiento). */
  readonly vigenteHasta: string | null;
}

export interface CoberturaEntrada {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly estado: EstadoCobertura;
  /** Controles vigentes que la cubren por un mapeo. */
  readonly controles: number;
  /** Evidencias activas de esos controles (vigentes o no). */
  readonly evidencias: number;
}

export interface ResumenCobertura {
  readonly total: number;
  readonly cubiertas: number;
  readonly evidenciaVencida: number;
  readonly sinEvidencia: number;
  readonly sinControl: number;
  /** 0–100 de entradas cubiertas sobre las que se pide cobertura, o nulo si no hay ninguna (no es 0). */
  readonly porcentaje: number | null;
}

export interface Cobertura {
  readonly entradas: readonly CoberturaEntrada[];
  readonly porNorma: Readonly<Record<string, ResumenCobertura>>;
  readonly total: ResumenCobertura;
}

const resumir = (estados: readonly EstadoCobertura[]): ResumenCobertura => {
  const contar = (e: EstadoCobertura) => estados.filter((x) => x === e).length;
  const total = estados.filter((e) => e !== 'no_aplica').length;
  const cubiertas = contar('cubierta');
  return {
    total,
    cubiertas,
    evidenciaVencida: contar('evidencia_vencida'),
    sinEvidencia: contar('sin_evidencia'),
    sinControl: contar('sin_control'),
    porcentaje: total === 0 ? null : Math.round((cubiertas / total) * 100),
  };
};

export const calcularCobertura = (p: {
  readonly entradas: readonly EntradaParaCobertura[];
  readonly controles: readonly ControlParaCobertura[];
  readonly mapeos: readonly MapeoParaCobertura[];
  readonly evidencias: readonly EvidenciaParaCobertura[];
  /** AAAA-MM-DD, fecha de hoy en Ecuador. */
  readonly hoy: string;
}): Cobertura => {
  const vigentes = new Set(p.controles.filter((c) => c.vigente).map((c) => c.id));
  const controlesDe = new Map<string, Set<string>>();
  for (const m of p.mapeos) {
    if (!vigentes.has(m.controlId)) continue;
    const clave = `${m.libreriaCodigo}|${m.idEstable}`;
    controlesDe.set(clave, (controlesDe.get(clave) ?? new Set()).add(m.controlId));
  }
  const evidenciasDe = new Map<string, { activas: number; vigentes: number }>();
  for (const e of p.evidencias) {
    if (!e.activa) continue;
    const acum = evidenciasDe.get(e.controlId) ?? { activas: 0, vigentes: 0 };
    acum.activas += 1;
    if (e.vigenteHasta === null || e.vigenteHasta >= p.hoy) acum.vigentes += 1;
    evidenciasDe.set(e.controlId, acum);
  }

  const entradas: CoberturaEntrada[] = p.entradas.map((e) => {
    const controles = controlesDe.get(`${e.libreriaCodigo}|${e.idEstable}`) ?? new Set<string>();
    let activas = 0;
    let vigentesN = 0;
    for (const id of controles) {
      const x = evidenciasDe.get(id);
      activas += x?.activas ?? 0;
      vigentesN += x?.vigentes ?? 0;
    }
    const estado: EstadoCobertura = e.noAplica ? 'no_aplica' : controles.size === 0 ? 'sin_control' : activas === 0 ? 'sin_evidencia' : vigentesN === 0 ? 'evidencia_vencida' : 'cubierta';
    return { libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, estado, controles: controles.size, evidencias: activas };
  });

  const normasDe = new Map<string, EstadoCobertura[]>();
  p.entradas.forEach((e, i) => {
    for (const n of e.normas) normasDe.set(n, [...(normasDe.get(n) ?? []), (entradas[i] as CoberturaEntrada).estado]);
  });
  const porNorma: Record<string, ResumenCobertura> = {};
  for (const n of [...normasDe.keys()].sort((a, b) => a.localeCompare(b, 'es'))) porNorma[n] = resumir(normasDe.get(n) as EstadoCobertura[]);
  return { entradas, porNorma, total: resumir(entradas.map((e) => e.estado)) };
};
