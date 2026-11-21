// Fakes en memoria de la auditoría interna (ADR 040). Igual que `fakes-documentos.ts`: separan por empresa y revierten si la acción
// falla, pero NO emulan las claves foráneas ni la RLS: eso lo demuestran las pruebas con PostgreSQL real.
import type { EmpresaId } from '@sig/tenancy';
import { codigoDeProceso } from '../../domain/proceso.js';
import type { CambiosProceso, FilaProceso, FilaRelacion, ProcesoRepositoryPort, RelacionRepositoryPort } from '../auditoria.port.js';

type ConEmpresa<T> = T & { empresaId: EmpresaId };

export class EstadoAuditoriaFalso {
  procesos = new Map<string, ConEmpresa<FilaProceso>>();
  /** `empresa|proceso|persona|relacion`. */
  relaciones = new Set<string>();

  copiar(): EstadoAuditoriaFalso['__copia'] {
    return { p: new Map(this.procesos), r: new Set(this.relaciones) };
  }
  declare __copia: { p: Map<string, ConEmpresa<FilaProceso>>; r: Set<string> };

  restaurar(c: EstadoAuditoriaFalso['__copia']): void {
    this.procesos = c.p;
    this.relaciones = c.r;
  }
}

export const crearRepositoriosAuditoriaFalsos = (
  s: EstadoAuditoriaFalso,
  empresaId: EmpresaId,
): { procesos: ProcesoRepositoryPort; relaciones: RelacionRepositoryPort } => {
  const procs = (): FilaProceso[] => [...s.procesos.values()].filter((p) => p.empresaId === empresaId);
  const k = (r: FilaRelacion): string => [empresaId, r.procesoId, r.usuarioId, r.relacion].join('|');

  const procesos: ProcesoRepositoryPort = {
    listar: async () => procs(),
    obtener: async (id) => procs().find((p) => p.id === id) ?? null,
    transversalVigente: async () => procs().find((p) => p.transversal && p.estado === 'vigente') ?? null,
    siguienteNumero: async () => Math.max(0, ...procs().map((p) => p.numero)) + 1,
    crear: async (p, usuarioId, ahora) => {
      if (procs().some((x) => x.numero === p.numero)) return false;
      if (p.transversal && procs().some((x) => x.transversal && x.estado === 'vigente')) return false;
      s.procesos.set(p.id, { ...p, empresaId, codigo: codigoDeProceso(p.numero), cambioRelevante: null, estado: 'vigente', version: 1, creadoPor: usuarioId, creadoEn: ahora });
      return true;
    },
    actualizar: async (id, cambios: CambiosProceso, esperada) => {
      const actual = procs().find((p) => p.id === id);
      if (!actual || actual.version !== esperada) return false;
      const sinIndefinidos = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
      s.procesos.set(id, { ...actual, ...sinIndefinidos, empresaId, version: actual.version + 1 } as ConEmpresa<FilaProceso>);
      return true;
    },
  };

  const relaciones: RelacionRepositoryPort = {
    listar: async () =>
      [...s.relaciones]
        .filter((x) => x.startsWith(`${empresaId}|`))
        .map((x) => {
          const [, procesoId, usuarioId, relacion] = x.split('|') as [string, string, string, FilaRelacion['relacion']];
          return { procesoId, usuarioId, relacion };
        }),
    agregar: async (r) => {
      if (s.relaciones.has(k(r))) return false;
      s.relaciones.add(k(r));
      return true;
    },
    quitar: async (r) => s.relaciones.delete(k(r)),
  };

  return { procesos, relaciones };
};
