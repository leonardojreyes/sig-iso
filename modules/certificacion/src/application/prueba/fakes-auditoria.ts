// Fakes en memoria de la auditoría interna (ADR 040). Igual que `fakes-documentos.ts`: separan por empresa y revierten si la acción
// falla, pero NO emulan las claves foráneas ni la RLS: eso lo demuestran las pruebas con PostgreSQL real.
import type { EmpresaId } from '@sig/tenancy';
import { codigoDeAuditoria } from '../../domain/auditoria.js';
import { codigoDeProceso } from '../../domain/proceso.js';
import type {
  AlcanceDeAuditoriaEscribible,
  AuditoriaRepositoryPort,
  AyudaDeProceso,
  AyudasRepositoryPort,
  CambiosAuditoria,
  CambiosPrograma,
  CambiosProceso,
  FilaAuditoria,
  FilaExclusion,
  FilaPrograma,
  FilaProceso,
  FilaRelacion,
  MiembroEquipo,
  ProcesoRepositoryPort,
  ProgramaRepositoryPort,
  RelacionRepositoryPort,
} from '../auditoria.port.js';

type ConEmpresa<T> = T & { empresaId: EmpresaId };
type AuditoriaBase = Omit<FilaAuditoria, 'normas' | 'procesosIds' | 'capitulos' | 'equipo'>;

export class EstadoAuditoriaFalso {
  procesos = new Map<string, ConEmpresa<FilaProceso>>();
  /** `empresa|proceso|persona|relacion`. */
  relaciones = new Set<string>();
  programas = new Map<string, ConEmpresa<FilaPrograma>>();
  /** `empresa|programa|norma`. */
  programaNormas = new Set<string>();
  exclusiones = new Map<string, ConEmpresa<FilaExclusion>>();
  auditorias = new Map<string, ConEmpresa<AuditoriaBase>>();
  alcances = new Map<string, AlcanceDeAuditoriaEscribible>();
  equipos = new Map<string, readonly MiembroEquipo[]>();
  /** Ayudas del programa por empresa (la prueba las fija: vienen de auditorías cerradas y hallazgos). */
  ayudas = new Map<EmpresaId, readonly AyudaDeProceso[]>();

  copiar(): EstadoAuditoriaFalso['__copia'] {
    return {
      p: new Map(this.procesos),
      r: new Set(this.relaciones),
      g: new Map(this.programas),
      gn: new Set(this.programaNormas),
      x: new Map(this.exclusiones),
      a: new Map(this.auditorias),
      al: new Map(this.alcances),
      e: new Map(this.equipos),
    };
  }
  declare __copia: {
    p: Map<string, ConEmpresa<FilaProceso>>;
    r: Set<string>;
    g: Map<string, ConEmpresa<FilaPrograma>>;
    gn: Set<string>;
    x: Map<string, ConEmpresa<FilaExclusion>>;
    a: Map<string, ConEmpresa<AuditoriaBase>>;
    al: Map<string, AlcanceDeAuditoriaEscribible>;
    e: Map<string, readonly MiembroEquipo[]>;
  };

  restaurar(c: EstadoAuditoriaFalso['__copia']): void {
    this.procesos = c.p;
    this.relaciones = c.r;
    this.programas = c.g;
    this.programaNormas = c.gn;
    this.exclusiones = c.x;
    this.auditorias = c.a;
    this.alcances = c.al;
    this.equipos = c.e;
  }

  limpiar(): void {
    for (const m of [this.procesos, this.programas, this.exclusiones, this.auditorias, this.alcances, this.equipos, this.ayudas] as Map<
      unknown,
      unknown
    >[])
      m.clear();
    this.relaciones.clear();
    this.programaNormas.clear();
  }
}

const SIN_ALCANCE: AlcanceDeAuditoriaEscribible = { normas: [], procesosIds: [], capitulos: [] };

export const crearRepositoriosAuditoriaFalsos = (
  s: EstadoAuditoriaFalso,
  empresaId: EmpresaId,
): {
  procesos: ProcesoRepositoryPort;
  relaciones: RelacionRepositoryPort;
  programas: ProgramaRepositoryPort;
  auditorias: AuditoriaRepositoryPort;
  ayudas: AyudasRepositoryPort;
} => {
  const procs = (): FilaProceso[] => [...s.procesos.values()].filter((p) => p.empresaId === empresaId);
  const k = (r: FilaRelacion): string => [empresaId, r.procesoId, r.usuarioId, r.relacion].join('|');
  const sinIndefinidos = <T extends object>(o: T): Partial<T> =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

  const procesos: ProcesoRepositoryPort = {
    listar: async () => procs(),
    obtener: async (id) => procs().find((p) => p.id === id) ?? null,
    transversalVigente: async () => procs().find((p) => p.transversal && p.estado === 'vigente') ?? null,
    siguienteNumero: async () => Math.max(0, ...procs().map((p) => p.numero)) + 1,
    crear: async (p, usuarioId, ahora) => {
      if (procs().some((x) => x.numero === p.numero)) return false;
      if (p.transversal && procs().some((x) => x.transversal && x.estado === 'vigente')) return false;
      s.procesos.set(p.id, {
        ...p,
        empresaId,
        codigo: codigoDeProceso(p.numero),
        cambioRelevante: null,
        estado: 'vigente',
        version: 1,
        creadoPor: usuarioId,
        creadoEn: ahora,
      });
      return true;
    },
    actualizar: async (id, cambios: CambiosProceso, esperada) => {
      const actual = procs().find((p) => p.id === id);
      if (!actual || actual.version !== esperada) return false;
      s.procesos.set(id, { ...actual, ...sinIndefinidos(cambios), empresaId, version: actual.version + 1 } as ConEmpresa<FilaProceso>);
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

  const progs = (): FilaPrograma[] => [...s.programas.values()].filter((p) => p.empresaId === empresaId).sort((a, b) => a.anio - b.anio);
  const programas: ProgramaRepositoryPort = {
    listar: async () => progs(),
    obtener: async (id) => progs().find((p) => p.id === id) ?? null,
    crear: async (p, usuarioId, ahora) => {
      if (progs().some((x) => x.anio === p.anio)) return false;
      s.programas.set(p.id, {
        ...p,
        empresaId,
        estado: 'sin_aprobar',
        aprobadoPor: null,
        aprobadoEn: null,
        version: 1,
        creadoPor: usuarioId,
        creadoEn: ahora,
      });
      return true;
    },
    actualizar: async (id, cambios: CambiosPrograma, esperada) => {
      const actual = progs().find((p) => p.id === id);
      if (!actual || actual.version !== esperada) return false;
      s.programas.set(id, { ...actual, ...sinIndefinidos(cambios), empresaId, version: actual.version + 1 } as ConEmpresa<FilaPrograma>);
      return true;
    },
    normas: async (programaId) =>
      [...s.programaNormas]
        .filter((x) => x.startsWith(`${empresaId}|${programaId}|`))
        .map((x) => x.split('|')[2] as string)
        .sort(),
    fijarNormas: async (programaId, normas) => {
      for (const x of [...s.programaNormas]) if (x.startsWith(`${empresaId}|${programaId}|`)) s.programaNormas.delete(x);
      for (const n of normas) s.programaNormas.add(`${empresaId}|${programaId}|${n}`);
    },
    exclusiones: async (programaId) => [...s.exclusiones.values()].filter((x) => x.empresaId === empresaId && x.programaId === programaId),
    agregarExclusion: async (e) => {
      const repetida = [...s.exclusiones.values()].some(
        (x) =>
          x.empresaId === empresaId &&
          x.programaId === e.programaId &&
          x.tipo === e.tipo &&
          x.procesoId === e.procesoId &&
          x.libreriaCodigo === e.libreriaCodigo &&
          x.capitulo === e.capitulo,
      );
      if (repetida) return false;
      s.exclusiones.set(e.id, { ...e, empresaId });
      return true;
    },
    quitarExclusion: async (programaId, id) => {
      const x = s.exclusiones.get(id);
      if (!x || x.empresaId !== empresaId || x.programaId !== programaId) return false;
      return s.exclusiones.delete(id);
    },
  };

  const completa = (a: ConEmpresa<AuditoriaBase>): FilaAuditoria => {
    const alc = s.alcances.get(a.id) ?? SIN_ALCANCE;
    const { empresaId: _omitida, ...base } = a;
    void _omitida;
    return {
      ...base,
      normas: [...alc.normas].sort(),
      procesosIds: [...alc.procesosIds].sort(),
      capitulos: alc.capitulos,
      equipo: s.equipos.get(a.id) ?? [],
    };
  };
  const auds = (): ConEmpresa<AuditoriaBase>[] =>
    [...s.auditorias.values()].filter((a) => a.empresaId === empresaId).sort((a, b) => a.anio - b.anio || a.numero - b.numero);
  const auditorias: AuditoriaRepositoryPort = {
    listar: async (programaId) =>
      auds()
        .filter((a) => programaId === undefined || a.programaId === programaId)
        .map(completa),
    obtener: async (id) => {
      const a = auds().find((x) => x.id === id);
      return a ? completa(a) : null;
    },
    siguienteNumero: async (anio) =>
      Math.max(
        0,
        ...auds()
          .filter((a) => a.anio === anio)
          .map((a) => a.numero),
      ) + 1,
    crear: async (a, usuarioId, ahora) => {
      if (auds().some((x) => x.anio === a.anio && x.numero === a.numero)) return false;
      void ahora;
      s.auditorias.set(a.id, {
        ...a,
        empresaId,
        codigo: codigoDeAuditoria(a.anio, a.numero),
        estado: 'planificada',
        reprogramaciones: 0,
        cancelacionMotivo: null,
        informeEmitidoEn: null,
        cerradaEn: null,
        version: 1,
        creadoPor: usuarioId,
      });
      return true;
    },
    actualizar: async (id, cambios: CambiosAuditoria, esperada) => {
      const actual = auds().find((a) => a.id === id);
      if (!actual || actual.version !== esperada) return false;
      const { cancelacionNota: _n, informeEmitidoPor: _i, cerradaPor: _c, ...resto } = cambios;
      void _n;
      void _i;
      void _c;
      s.auditorias.set(id, { ...actual, ...sinIndefinidos(resto), empresaId, version: actual.version + 1 } as ConEmpresa<AuditoriaBase>);
      return true;
    },
    fijarAlcance: async (id, alcance) => void s.alcances.set(id, alcance),
    agregarMiembro: async (auditoriaId, m) => {
      const equipo = s.equipos.get(auditoriaId) ?? [];
      if (equipo.some((x) => x.usuarioId === m.usuarioId)) return false;
      if (m.rol === 'lider' && equipo.some((x) => x.rol === 'lider')) return false;
      s.equipos.set(auditoriaId, [...equipo, m]);
      return true;
    },
    quitarMiembro: async (auditoriaId, personaId) => {
      const equipo = s.equipos.get(auditoriaId) ?? [];
      if (!equipo.some((x) => x.usuarioId === personaId)) return false;
      s.equipos.set(
        auditoriaId,
        equipo.filter((x) => x.usuarioId !== personaId),
      );
      return true;
    },
  };

  const ayudas: AyudasRepositoryPort = { porProceso: async () => s.ayudas.get(empresaId) ?? [] };

  return { procesos, relaciones, programas, auditorias, ayudas };
};
