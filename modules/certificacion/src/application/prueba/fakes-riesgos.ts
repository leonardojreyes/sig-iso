// Fakes en memoria de la gestión de riesgos completa (ADR 038). Igual que `fakes.ts`: separan por empresa y revierten si la acción falla,
// pero NO emulan las claves foráneas ni la RLS: eso lo demuestran las pruebas con PostgreSQL real.
import type { EmpresaId } from '@sig/tenancy';
import type { Activo } from '../../domain/activo.js';
import type { CriteriosRepositoryPort, FilaCriterios } from '../criterios.port.js';
import type { ActivoRepositoryPort, LigaRiesgoActivoFila, RiesgoActivoRepositoryPort } from '../activos.port.js';

export class EstadoRiesgosFalso {
  /** `id` → activo (cada uno lleva su empresa). */
  activos = new Map<string, Activo>();
  /** `empresa|riesgo|activo`. */
  ligasActivo = new Set<string>();
  /** `empresa|versión` → criterios. */
  criterios = new Map<string, FilaCriterios>();
  /** Si se pone, la próxima escritura de activo devuelve «falso» (otra persona escribió en medio). */
  carrera = false;

  copiar(): EstadoRiesgosFalso['__copia'] {
    return { a: new Map(this.activos), la: new Set(this.ligasActivo), cr: new Map(this.criterios) };
  }
  declare __copia: { a: Map<string, Activo>; la: Set<string>; cr: Map<string, FilaCriterios> };
  restaurar(c: EstadoRiesgosFalso['__copia']): void {
    this.activos = c.a;
    this.ligasActivo = c.la;
    this.criterios = c.cr;
  }
}

export const crearRepositoriosRiesgosFalsos = (
  estado: EstadoRiesgosFalso,
  empresaId: EmpresaId,
): { activos: ActivoRepositoryPort; ligasActivo: RiesgoActivoRepositoryPort; criterios: CriteriosRepositoryPort } => {
  const propios = (): Activo[] => [...estado.activos.values()].filter((a) => a.empresaId === empresaId);
  const activos: ActivoRepositoryPort = {
    listar: async () => propios().sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })),
    obtener: async (id) => propios().find((a) => a.id === id) ?? null,
    siguienteNumero: async () => Math.max(0, ...propios().map((a) => Number(a.codigo.slice(2)))) + 1,
    crear: async (a) => {
      if (estado.carrera || propios().some((x) => x.codigo === a.codigo)) return false;
      estado.activos.set(a.id, a);
      return true;
    },
    actualizar: async (a, _u, _t, esperada) => {
      const actual = propios().find((x) => x.id === a.id);
      if (estado.carrera || !actual || actual.version !== esperada) return false;
      estado.activos.set(a.id, a);
      return true;
    },
  };
  const clave = (r: string, a: string) => `${empresaId}|${r}|${a}`;
  const ligasActivo: RiesgoActivoRepositoryPort = {
    listar: async (): Promise<readonly LigaRiesgoActivoFila[]> =>
      [...estado.ligasActivo]
        .filter((k) => k.startsWith(`${empresaId}|`))
        .map((k) => k.split('|'))
        .map(([, riesgoId, activoId]) => ({ riesgoId: riesgoId as string, activoId: activoId as string })),
    contarDeRiesgo: async (riesgoId) => [...estado.ligasActivo].filter((k) => k.startsWith(`${empresaId}|${riesgoId}|`)).length,
    agregar: async (r, a) => {
      if (estado.ligasActivo.has(clave(r, a))) return false;
      estado.ligasActivo.add(clave(r, a));
      return true;
    },
    quitar: async (r, a) => estado.ligasActivo.delete(clave(r, a)),
  };
  const criterios: CriteriosRepositoryPort = {
    vigente: async () => {
      const propias = [...estado.criterios.entries()].filter(([k]) => k.startsWith(`${empresaId}|`)).map(([, v]) => v);
      return propias.sort((a, b) => b.version - a.version)[0] ?? null;
    },
    crear: async (version, d, usuarioId, ahora) => {
      if (estado.carrera || estado.criterios.has(`${empresaId}|${version}`)) return false;
      estado.criterios.set(`${empresaId}|${version}`, { version, ...d, creadoPor: usuarioId, creadoEn: ahora });
      return true;
    },
  };
  return { activos, ligasActivo, criterios };
};
