import { esCombinada, trimestreDe, validarAnio, validarObjetivo, type EstadoAuditoria, type EstadoPrograma } from '../domain/auditoria.js';
import {
  calcularPendientesDePrograma,
  EXCLUSIONES_POR_PROGRAMA_MAX,
  NORMAS_POR_PROGRAMA_MAX,
  validarCapitulo,
  validarMotivoExclusion,
  type PendientesDePrograma,
} from '../domain/auditoria-programa.js';
import type { CambioRelevante, FrecuenciaProceso, ImportanciaProceso } from '../domain/proceso.js';
import type { FilaAuditoria, FilaExclusion, FilaPrograma } from './auditoria.port.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { traducirDominio } from './documentos.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

// Auditoría interna (ADR 040): el programa anual. Permisos: `auditoria.ver` para consultar, `auditoria.planificar` para armarlo y
// `auditoria.aprobar` para aprobarlo (solo administrador SIG). Orden de evaluación: 401 → 403 → 400 → 404 → 409.

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

export interface ProgramaDto {
  readonly id: string;
  readonly anio: number;
  readonly objetivo: string;
  readonly estado: EstadoPrograma;
  readonly aprobadoPor: string | null;
  readonly aprobadoEn: string | null;
  readonly version: number;
  readonly normas: readonly string[];
}
export interface AuditoriaDeProgramaDto {
  readonly id: string;
  readonly codigo: string;
  readonly objetivo: string;
  readonly estado: EstadoAuditoria;
  readonly inicio: string;
  readonly fin: string;
  readonly trimestre: 1 | 2 | 3 | 4;
  readonly normas: readonly string[];
  readonly combinada: boolean;
  readonly procesosIds: readonly string[];
  readonly liderId: string | null;
}
export interface ExclusionDto {
  readonly id: string;
  readonly tipo: 'proceso' | 'capitulo';
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly capitulo: string | null;
  readonly motivo: string;
}
export interface ProcesoDeProgramaDto {
  readonly procesoId: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly importancia: ImportanciaProceso;
  readonly frecuencia: FrecuenciaProceso;
  readonly cambioRelevante: CambioRelevante | null;
  readonly ultimaAuditoria: string | null;
  readonly hallazgosAbiertos: number;
  readonly incluido: boolean;
}
export interface DetalleProgramaDto {
  readonly programa: ProgramaDto;
  readonly auditorias: readonly AuditoriaDeProgramaDto[];
  readonly exclusiones: readonly ExclusionDto[];
  readonly procesos: readonly ProcesoDeProgramaDto[];
  readonly pendientes: {
    readonly procesos: readonly string[];
    readonly capitulos: readonly { readonly libreriaCodigo: string; readonly capitulo: string }[];
    readonly procesosIncluidos: number;
    readonly capitulosIncluidos: number;
  };
}

const NORMA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

const aProgramaDto = (p: FilaPrograma, normas: readonly string[]): ProgramaDto => ({
  id: p.id,
  anio: p.anio,
  objetivo: p.objetivo,
  estado: p.estado,
  aprobadoPor: p.aprobadoPor,
  aprobadoEn: p.aprobadoEn ? p.aprobadoEn.toISOString() : null,
  version: p.version,
  normas,
});
const aAuditoriaDto = (a: FilaAuditoria): AuditoriaDeProgramaDto => ({
  id: a.id,
  codigo: a.codigo,
  objetivo: a.objetivo,
  estado: a.estado,
  inicio: a.inicio,
  fin: a.fin,
  trimestre: trimestreDe(a.inicio),
  normas: a.normas,
  combinada: esCombinada(a.normas),
  procesosIds: a.procesosIds,
  liderId: a.equipo.find((m) => m.rol === 'lider')?.usuarioId ?? null,
});
const aExclusionDto = (x: FilaExclusion): ExclusionDto => ({
  id: x.id,
  tipo: x.tipo,
  procesoId: x.procesoId,
  libreriaCodigo: x.libreriaCodigo,
  capitulo: x.capitulo,
  motivo: x.motivo,
});

/** Capítulos (cláusulas) y temas (controles) de cada norma, según las entradas que la empresa adoptó. */
export const agrupadoresPorNorma = (entradas: readonly EntradaCatalogo[], normas: readonly string[]): Map<string, readonly string[]> => {
  const r = new Map<string, readonly string[]>();
  for (const n of normas) {
    const set = new Set<string>();
    for (const e of entradas.filter((x) => x.libreriaCodigo === n)) {
      const g = e.tipo === 'clausula' ? (e.capitulo === null ? null : String(e.capitulo)) : e.grupo;
      if (g) set.add(g);
    }
    r.set(
      n,
      [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
    );
  }
  return r;
};

/** Las normas del programa deben ser códigos de librerías que la empresa adoptó (sin repetidos, al menos una). */
const validarNormas = (valor: unknown, adoptadas: ReadonlySet<string>): readonly string[] => {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > NORMAS_POR_PROGRAMA_MAX) throw new ParametroInvalidoError('normas');
  const normas = valor.map((n) => (typeof n === 'string' && NORMA.test(n) ? n : null));
  if (normas.some((n) => n === null) || new Set(normas).size !== normas.length) throw new ParametroInvalidoError('normas');
  // «No adoptada» se informa igual que «mal formada»: no se revela qué librerías existen.
  if (normas.some((n) => !adoptadas.has(n as string))) throw new ParametroInvalidoError('normas');
  return (normas as string[]).sort();
};

const exigirPrograma = async (c: ContextoCertificacion, id: string): Promise<FilaPrograma> => {
  const p = await c.programas.obtener(id);
  if (!p) throw new EntradaNoEncontradaError();
  return p;
};

export class ListarProgramasUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string }): Promise<{ programas: readonly ProgramaDto[] }> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const lista = await c.programas.listar();
      return { programas: await Promise.all(lista.map(async (p) => aProgramaDto(p, await c.programas.normas(p.id)))) };
    });
  }
}

export class ObtenerProgramaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<DetalleProgramaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const p = await exigirPrograma(c, id);
      const [normas, auditorias, exclusiones, procesos, ayudas] = await Promise.all([
        c.programas.normas(id),
        c.auditorias.listar(id),
        c.programas.exclusiones(id),
        c.procesos.listar(),
        c.ayudas.porProceso(),
      ]);
      const vigentes = procesos.filter((x) => x.estado === 'vigente');
      const pend: PendientesDePrograma = calcularPendientesDePrograma({
        procesosVigentes: vigentes.map((x) => x.id),
        capitulosPorNorma: agrupadoresPorNorma(entradas, normas),
        auditorias,
        exclusiones,
      });
      const enAuditoria = new Set(auditorias.filter((a) => a.estado !== 'cancelada').flatMap((a) => a.procesosIds));
      return {
        programa: aProgramaDto(p, normas),
        auditorias: auditorias.map(aAuditoriaDto),
        exclusiones: exclusiones.map(aExclusionDto),
        procesos: vigentes.map((x) => {
          const ayuda = ayudas.find((y) => y.procesoId === x.id);
          return {
            procesoId: x.id,
            codigo: x.codigo,
            nombre: x.nombre,
            importancia: x.importancia,
            frecuencia: x.frecuencia,
            cambioRelevante: x.cambioRelevante,
            ultimaAuditoria: ayuda?.ultimaAuditoria ?? null,
            hallazgosAbiertos: ayuda?.hallazgosAbiertos ?? 0,
            incluido: enAuditoria.has(x.id),
          };
        }),
        pendientes: {
          procesos: pend.procesosSinMotivo,
          capitulos: pend.capitulosSinMotivo,
          procesosIncluidos: pend.procesosIncluidos,
          capitulosIncluidos: pend.capitulosIncluidos,
        },
      };
    });
  }
}

export class CrearProgramaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; anio?: unknown; objetivo?: unknown; normas?: unknown }): Promise<ProgramaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const datos = traducirDominio(() => ({ anio: validarAnio(e.anio), objetivo: validarObjetivo(e.objetivo) }));
    const adoptadas = new Set((await this.catalogo.listarEntradasVigentes(empresaId)).map((x) => x.libreriaCodigo));
    const normas = validarNormas(e.normas, adoptadas);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const id = this.nuevoId();
      if (!(await c.programas.crear({ id, ...datos }, usuarioId, ahora))) throw new ConflictoError('anio_repetido');
      await c.programas.fijarNormas(id, normas, usuarioId, ahora);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'programa.creado',
        resultado: 'ok',
        objeto: `programa:${datos.anio}`,
      });
      return aProgramaDto(await exigirPrograma(c, id), normas);
    });
  }
}

export class CambiarProgramaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  /** Cambiar el objetivo o las normas de un programa aprobado lo devuelve a «sin aprobar». */
  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    versionEsperada?: unknown;
    objetivo?: unknown;
    normas?: unknown;
  }): Promise<ProgramaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = e.versionEsperada;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new ParametroInvalidoError('versionEsperada');
    if (e.objetivo === undefined && e.normas === undefined) throw new ParametroInvalidoError('cambios');
    const objetivo = e.objetivo === undefined ? undefined : traducirDominio(() => validarObjetivo(e.objetivo));
    const adoptadas = new Set((await this.catalogo.listarEntradasVigentes(empresaId)).map((x) => x.libreriaCodigo));
    const normas = e.normas === undefined ? undefined : validarNormas(e.normas, adoptadas);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const p = await exigirPrograma(c, id);
      const actualesNormas = await c.programas.normas(id);
      const cambiaNormas = normas !== undefined && normas.join('|') !== actualesNormas.join('|');
      const cambiaObjetivo = objetivo !== undefined && objetivo !== p.objetivo;
      const vuelveASinAprobar = p.estado === 'aprobado' && (cambiaNormas || cambiaObjetivo);
      if (
        !(await c.programas.actualizar(
          id,
          {
            ...(objetivo !== undefined ? { objetivo } : {}),
            ...(vuelveASinAprobar ? { estado: 'sin_aprobar' as const, aprobadoPor: null, aprobadoEn: null } : {}),
          },
          version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      if (cambiaNormas && normas) await c.programas.fijarNormas(id, normas, usuarioId, ahora);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'programa.cambiado',
        resultado: 'ok',
        objeto: `programa:${p.anio}`,
      });
      return aProgramaDto(await exigirPrograma(c, id), await c.programas.normas(id));
    });
  }
}

/** Aprueba el programa: cada proceso vigente y cada capítulo o tema de sus normas debe estar en alguna auditoría o llevar un motivo. */
export class AprobarProgramaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; versionEsperada?: unknown }): Promise<ProgramaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.aprobar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = e.versionEsperada;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new ParametroInvalidoError('versionEsperada');
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const p = await exigirPrograma(c, id);
      if (p.estado === 'aprobado') throw new ConflictoError('ya_aprobado');
      const [normas, auditorias, exclusiones, procesos] = await Promise.all([
        c.programas.normas(id),
        c.auditorias.listar(id),
        c.programas.exclusiones(id),
        c.procesos.listar(),
      ]);
      if (normas.length === 0) throw new ConflictoError('sin_normas');
      const pend = calcularPendientesDePrograma({
        procesosVigentes: procesos.filter((x) => x.estado === 'vigente').map((x) => x.id),
        capitulosPorNorma: agrupadoresPorNorma(entradas, normas),
        auditorias,
        exclusiones,
      });
      if (pend.procesosSinMotivo.length > 0 || pend.capitulosSinMotivo.length > 0) throw new ConflictoError('faltan_motivos');
      if (!(await c.programas.actualizar(id, { estado: 'aprobado', aprobadoPor: usuarioId, aprobadoEn: ahora }, version, usuarioId, ahora)))
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'programa.aprobado',
        resultado: 'ok',
        objeto: `programa:${p.anio}`,
      });
      return aProgramaDto(await exigirPrograma(c, id), normas);
    });
  }
}

export class AgregarExclusionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    tipo?: unknown;
    procesoId?: unknown;
    libreriaCodigo?: unknown;
    capitulo?: unknown;
    motivo?: unknown;
  }): Promise<ExclusionDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    if (e.tipo !== 'proceso' && e.tipo !== 'capitulo') throw new ParametroInvalidoError('tipo');
    const motivo = traducirDominio(() => validarMotivoExclusion(e.motivo));
    const procesoId = e.tipo === 'proceso' ? validarUuid(e.procesoId, 'procesoId') : null;
    const capitulo = e.tipo === 'capitulo' ? traducirDominio(() => validarCapitulo(e.capitulo)) : null;
    const libreriaCodigo =
      e.tipo === 'capitulo' ? (typeof e.libreriaCodigo === 'string' && NORMA.test(e.libreriaCodigo) ? e.libreriaCodigo : null) : null;
    if (e.tipo === 'capitulo' && libreriaCodigo === null) throw new ParametroInvalidoError('libreriaCodigo');
    if (e.tipo === 'proceso' && (e.libreriaCodigo !== undefined || e.capitulo !== undefined)) throw new ParametroInvalidoError('tipo');
    if (e.tipo === 'capitulo' && e.procesoId !== undefined) throw new ParametroInvalidoError('tipo');
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const p = await exigirPrograma(c, id);
      if (p.estado === 'aprobado') throw new ConflictoError('programa_aprobado');
      if (procesoId !== null) {
        const proceso = await c.procesos.obtener(procesoId);
        if (!proceso || proceso.estado !== 'vigente') throw new ParametroInvalidoError('procesoId');
      }
      if (libreriaCodigo !== null && !(await c.programas.normas(id)).includes(libreriaCodigo))
        throw new ParametroInvalidoError('libreriaCodigo');
      if ((await c.programas.exclusiones(id)).length >= EXCLUSIONES_POR_PROGRAMA_MAX) throw new ConflictoError('tope_de_exclusiones');
      const nueva = {
        id: this.nuevoId(),
        programaId: id,
        tipo: e.tipo as 'proceso' | 'capitulo',
        procesoId,
        libreriaCodigo,
        capitulo,
        motivo,
      };
      if (!(await c.programas.agregarExclusion(nueva, usuarioId, ahora))) throw new ConflictoError('ya_tiene_motivo');
      const codigo = procesoId !== null ? (await c.procesos.obtener(procesoId))?.codigo : 'capitulo';
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'exclusion.creada',
        resultado: 'ok',
        objeto: `exclusion:${p.anio}.${codigo}`,
      });
      return aExclusionDto(nueva);
    });
  }
}

export class QuitarExclusionUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; exclusionId?: unknown }): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const exclusionId = validarUuid(e.exclusionId, 'exclusionId');
    await this.unidad.ejecutar(empresaId, async (c) => {
      const p = await exigirPrograma(c, id);
      if (p.estado === 'aprobado') throw new ConflictoError('programa_aprobado');
      const x = (await c.programas.exclusiones(id)).find((y) => y.id === exclusionId);
      if (!x || !(await c.programas.quitarExclusion(id, exclusionId))) throw new EntradaNoEncontradaError();
      const codigo = x.procesoId !== null ? ((await c.procesos.obtener(x.procesoId))?.codigo ?? 'capitulo') : 'capitulo';
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'exclusion.eliminada',
        resultado: 'ok',
        objeto: `exclusion:${p.anio}.${codigo}`,
      });
    });
  }
}
