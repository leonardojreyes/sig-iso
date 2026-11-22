import {
  admiteCambioDeAlcance,
  esAuditoriaInmutable,
  esCombinada,
  motivoDeBloqueoDeTransicion,
  puedeTransitar,
  validarFechas,
  validarMotivoCambio,
  validarObjetivo,
  type EstadoAuditoria,
  type MotivoCambioAuditoria,
} from '../domain/auditoria.js';
import { cubreClausulas4a10 } from '../domain/auditoria-programa.js';
import { fechaValida, hoyEnEcuador } from '../domain/fechas.js';
import {
  evaluarIndependencia,
  procesosDelAlcance,
  validarExcepcion,
  type AuditoriaPrevia,
  type ProcesoDelAlcance,
  type ResultadoIndependencia,
} from '../domain/independencia.js';
import type { AlcanceDeAuditoriaEscribible, CapituloDeAlcance, FilaAuditoria, FilaPrograma, MiembroEquipo } from './auditoria.port.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { administradoresActivos, traducirDominio } from './documentos.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from './errores.js';
import { generarLista } from './lista.use-cases.js';
import { agrupadoresPorNorma } from './programas.use-cases.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

// Auditoría interna (ADR 040): planificar una auditoría, designar a su equipo con la comprobación de independencia y avanzar de estado.
// Permisos: `auditoria.ver` para consultar y `auditoria.planificar` para el resto. Orden de evaluación: 401 → 403 → 400 → 404 → 409.

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;
const NORMA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
export const PROCESOS_POR_AUDITORIA_MAX = 200;
export const CAPITULOS_POR_AUDITORIA_MAX = 100;
export const EQUIPO_MAX = 20;
/** Roles de la persona que puede ser designada: quien audita es administrador SIG o auditor interno. */
const ROLES_QUE_AUDITAN: readonly (string | null)[] = ['administrador_sig', 'auditor_interno'];

export interface MiembroDto {
  readonly personaId: string;
  readonly rol: 'lider' | 'auditor';
  readonly excepcion: boolean;
  readonly autoautorizada: boolean;
  readonly excepcionMotivo: string | null;
  readonly excepcionMedida: string | null;
  readonly excepcionAutorizadaPor: string | null;
}
export interface AuditoriaDto {
  readonly id: string;
  readonly programaId: string;
  readonly codigo: string;
  readonly anio: number;
  readonly objetivo: string;
  readonly estado: EstadoAuditoria;
  readonly inicio: string;
  readonly fin: string;
  readonly reunionApertura: string | null;
  readonly reunionCierre: string | null;
  readonly reprogramaciones: number;
  readonly cancelacionMotivo: MotivoCambioAuditoria | null;
  readonly informeEmitidoEn: string | null;
  readonly cerradaEn: string | null;
  readonly version: number;
  readonly normas: readonly string[];
  readonly combinada: boolean;
  readonly procesosIds: readonly string[];
  /** Los de arriba más «Gestión del SIG» cuando la auditoría cubre las cláusulas 4 a 10. */
  readonly procesosDelAlcance: readonly string[];
  readonly capitulos: readonly CapituloDeAlcance[];
  readonly equipo: readonly MiembroDto[];
}
export interface IndependenciaDto extends ResultadoIndependencia {
  readonly personaId: string;
  readonly procesosDelAlcance: readonly string[];
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** Los procesos que entran al alcance de la auditoría, con «Gestión del SIG» si cubre las cláusulas 4 a 10. */
export const alcanceDeProcesos = async (
  c: ContextoCertificacion,
  a: { normas: readonly string[]; procesosIds: readonly string[]; capitulos: readonly CapituloDeAlcance[] },
  porNorma: ReadonlyMap<string, readonly string[]>,
): Promise<readonly ProcesoDelAlcance[]> => {
  const procesos = await c.procesos.listar();
  const elegidos = procesos.filter((p) => a.procesosIds.includes(p.id)).map((p) => ({ id: p.id, transversal: p.transversal }));
  const t = await c.procesos.transversalVigente();
  return procesosDelAlcance(elegidos, t ? { id: t.id, transversal: true } : null, cubreClausulas4a10(a.normas, a.capitulos, porNorma));
};

const aDto = async (
  c: ContextoCertificacion,
  a: FilaAuditoria,
  porNorma: ReadonlyMap<string, readonly string[]>,
): Promise<AuditoriaDto> => ({
  id: a.id,
  programaId: a.programaId,
  codigo: a.codigo,
  anio: a.anio,
  objetivo: a.objetivo,
  estado: a.estado,
  inicio: a.inicio,
  fin: a.fin,
  reunionApertura: a.reunionApertura,
  reunionCierre: a.reunionCierre,
  reprogramaciones: a.reprogramaciones,
  cancelacionMotivo: a.cancelacionMotivo,
  informeEmitidoEn: iso(a.informeEmitidoEn),
  cerradaEn: iso(a.cerradaEn),
  version: a.version,
  normas: a.normas,
  combinada: esCombinada(a.normas),
  procesosIds: a.procesosIds,
  procesosDelAlcance: (await alcanceDeProcesos(c, a, porNorma)).map((p) => p.id),
  capitulos: a.capitulos,
  equipo: a.equipo.map((m) => ({
    personaId: m.usuarioId,
    rol: m.rol,
    excepcion: m.excepcion,
    autoautorizada: m.autoautorizada,
    excepcionMotivo: m.excepcionMotivo,
    excepcionMedida: m.excepcionMedida,
    excepcionAutorizadaPor: m.excepcionAutorizadaPor,
  })),
});

const exigirAuditoria = async (c: ContextoCertificacion, id: string): Promise<FilaAuditoria> => {
  const a = await c.auditorias.obtener(id);
  if (!a) throw new EntradaNoEncontradaError();
  return a;
};
const exigirPrograma = async (c: ContextoCertificacion, id: string): Promise<FilaPrograma> => {
  const p = await c.programas.obtener(id);
  if (!p) throw new EntradaNoEncontradaError();
  return p;
};

const entero = (v: unknown, campo: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ParametroInvalidoError(campo);
  return v;
};
const fechaOpcional = (v: unknown, campo: string): string | null => {
  if (v === undefined || v === null) return null;
  if (!fechaValida(v)) throw new ParametroInvalidoError(campo);
  return v;
};
const listaDeUuid = (v: unknown, campo: string, max: number): readonly string[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) throw new ParametroInvalidoError(campo);
  const ids = v.map((x) => validarUuid(x, campo));
  if (new Set(ids).size !== ids.length) throw new ParametroInvalidoError(campo);
  return ids;
};
const listaDeNormas = (v: unknown, campo: string): readonly string[] => {
  if (!Array.isArray(v) || v.length === 0 || v.length > 10) throw new ParametroInvalidoError(campo);
  if (v.some((n) => typeof n !== 'string' || !NORMA.test(n)) || new Set(v).size !== v.length) throw new ParametroInvalidoError(campo);
  return [...(v as string[])].sort();
};
const listaDeCapitulos = (v: unknown): readonly CapituloDeAlcance[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > CAPITULOS_POR_AUDITORIA_MAX) throw new ParametroInvalidoError('capitulos');
  const r = v.map((x): CapituloDeAlcance => {
    const o = x as { libreriaCodigo?: unknown; capitulo?: unknown };
    if (typeof o?.libreriaCodigo !== 'string' || !NORMA.test(o.libreriaCodigo)) throw new ParametroInvalidoError('capitulos');
    if (typeof o.capitulo !== 'string' || o.capitulo.trim() === '' || o.capitulo.trim().length > 60)
      throw new ParametroInvalidoError('capitulos');
    return { libreriaCodigo: o.libreriaCodigo, capitulo: o.capitulo.trim() };
  });
  if (new Set(r.map((x) => `${x.libreriaCodigo}\u0000${x.capitulo}`)).size !== r.length) throw new ParametroInvalidoError('capitulos');
  return r;
};

/** Normas dentro de las del programa, procesos vigentes y capítulos que existen en las normas elegidas. */
const validarAlcance = async (
  c: ContextoCertificacion,
  alcance: AlcanceDeAuditoriaEscribible,
  normasDelPrograma: readonly string[],
  porNorma: ReadonlyMap<string, readonly string[]>,
): Promise<void> => {
  if (alcance.normas.some((n) => !normasDelPrograma.includes(n))) throw new ParametroInvalidoError('normas');
  const procesos = await c.procesos.listar();
  if (alcance.procesosIds.some((id) => !procesos.some((p) => p.id === id && p.estado === 'vigente')))
    throw new ParametroInvalidoError('procesosIds');
  for (const k of alcance.capitulos)
    if (!alcance.normas.includes(k.libreriaCodigo) || !(porNorma.get(k.libreriaCodigo) ?? []).includes(k.capitulo))
      throw new ParametroInvalidoError('capitulos');
};

/** Auditorías anteriores (no canceladas) de esa persona sobre cada proceso, para el aviso de repetición. */
const previasDe = async (c: ContextoCertificacion, usuarioId: string, excluirId: string): Promise<readonly AuditoriaPrevia[]> =>
  (await c.auditorias.listar())
    .filter((x) => x.id !== excluirId && x.estado !== 'cancelada' && x.equipo.some((m) => m.usuarioId === usuarioId))
    .flatMap((x) => x.procesosIds.map((procesoId) => ({ usuarioId, procesoId, fecha: x.fin })));

const independenciaDe = async (
  c: ContextoCertificacion,
  a: FilaAuditoria,
  personaId: string,
  porNorma: ReadonlyMap<string, readonly string[]>,
  hoy: string,
): Promise<{ resultado: ResultadoIndependencia; alcance: readonly ProcesoDelAlcance[] }> => {
  const alcance = await alcanceDeProcesos(c, a, porNorma);
  const relaciones = (await c.relaciones.listar()).map((r) => ({ usuarioId: r.usuarioId, procesoId: r.procesoId, relacion: r.relacion }));
  return {
    alcance,
    resultado: evaluarIndependencia({
      usuarioId: personaId,
      procesos: alcance,
      relaciones,
      previas: await previasDe(c, personaId, a.id),
      hoy,
    }),
  };
};

export class CrearAuditoriaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    programaId: string;
    objetivo?: unknown;
    inicio?: unknown;
    fin?: unknown;
    reunionApertura?: unknown;
    reunionCierre?: unknown;
    normas?: unknown;
    procesosIds?: unknown;
    capitulos?: unknown;
    motivo?: unknown;
    nota?: unknown;
  }): Promise<AuditoriaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const programaId = validarUuid(e.programaId, 'id');
    const datos = traducirDominio(() => ({ objetivo: validarObjetivo(e.objetivo), ...validarFechas(e.inicio, e.fin) }));
    const reuniones = {
      reunionApertura: fechaOpcional(e.reunionApertura, 'reunionApertura'),
      reunionCierre: fechaOpcional(e.reunionCierre, 'reunionCierre'),
    };
    const alcance: AlcanceDeAuditoriaEscribible = {
      normas: listaDeNormas(e.normas, 'normas'),
      procesosIds: listaDeUuid(e.procesosIds, 'procesosIds', PROCESOS_POR_AUDITORIA_MAX),
      capitulos: listaDeCapitulos(e.capitulos),
    };
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const programa = await exigirPrograma(c, programaId);
      const anio = Number(datos.inicio.slice(0, 4));
      if (anio !== programa.anio) throw new ParametroInvalidoError('inicio');
      // En un programa aprobado, agregar una auditoría exige un motivo (lista cerrada y nota breve).
      if (programa.estado === 'aprobado') traducirDominio(() => validarMotivoCambio(e.motivo, e.nota));
      const normasDelPrograma = await c.programas.normas(programaId);
      const porNorma = agrupadoresPorNorma(entradas, normasDelPrograma);
      await validarAlcance(c, alcance, normasDelPrograma, porNorma);
      const id = this.nuevoId();
      let creada = false;
      for (let intento = 0; intento < 5 && !creada; intento += 1) {
        const numero = await c.auditorias.siguienteNumero(programa.anio);
        creada = await c.auditorias.crear({ id, programaId, anio: programa.anio, numero, ...datos, ...reuniones }, usuarioId, ahora);
      }
      if (!creada) throw new ConflictoError('codigo_repetido');
      await c.auditorias.fijarAlcance(id, alcance, usuarioId, ahora);
      const a = await exigirAuditoria(c, id);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'auditoria.planificada',
        resultado: 'ok',
        objeto: `auditoria:${a.codigo}`,
      });
      return aDto(c, a, porNorma);
    });
  }
}

export class ObtenerAuditoriaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<AuditoriaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      return aDto(c, a, agrupadoresPorNorma(entradas, a.normas));
    });
  }
}

export class CambiarAuditoriaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  /** Objetivo, fechas, reuniones y alcance: solo antes de pasar a «en ejecución». Si cambia el alcance, el equipo se vuelve a comprobar. */
  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    versionEsperada?: unknown;
    objetivo?: unknown;
    inicio?: unknown;
    fin?: unknown;
    reunionApertura?: unknown;
    reunionCierre?: unknown;
    normas?: unknown;
    procesosIds?: unknown;
    capitulos?: unknown;
  }): Promise<AuditoriaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = entero(e.versionEsperada, 'versionEsperada');
    const cambiaFechas = e.inicio !== undefined || e.fin !== undefined;
    const cambiaAlcance = e.normas !== undefined || e.procesosIds !== undefined || e.capitulos !== undefined;
    if (e.objetivo === undefined && !cambiaFechas && e.reunionApertura === undefined && e.reunionCierre === undefined && !cambiaAlcance)
      throw new ParametroInvalidoError('cambios');
    const objetivo = e.objetivo === undefined ? undefined : traducirDominio(() => validarObjetivo(e.objetivo));
    const reunionApertura = e.reunionApertura === undefined ? undefined : fechaOpcional(e.reunionApertura, 'reunionApertura');
    const reunionCierre = e.reunionCierre === undefined ? undefined : fechaOpcional(e.reunionCierre, 'reunionCierre');
    const escritos = {
      normas: e.normas === undefined ? undefined : listaDeNormas(e.normas, 'normas'),
      procesosIds: e.procesosIds === undefined ? undefined : listaDeUuid(e.procesosIds, 'procesosIds', PROCESOS_POR_AUDITORIA_MAX),
      capitulos: e.capitulos === undefined ? undefined : listaDeCapitulos(e.capitulos),
    };
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    const hoy = hoyEnEcuador(ahora);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const actual = await exigirAuditoria(c, id);
      if (!admiteCambioDeAlcance(actual.estado)) throw new ConflictoError('no_permitido_en_este_estado');
      const fechas = cambiaFechas ? traducirDominio(() => validarFechas(e.inicio ?? actual.inicio, e.fin ?? actual.fin)) : null;
      const programa = await exigirPrograma(c, actual.programaId);
      if (fechas && Number(fechas.inicio.slice(0, 4)) !== programa.anio) throw new ParametroInvalidoError('inicio');
      const alcance: AlcanceDeAuditoriaEscribible = {
        normas: escritos.normas ?? actual.normas,
        procesosIds: escritos.procesosIds ?? actual.procesosIds,
        capitulos: escritos.capitulos ?? actual.capitulos,
      };
      const normasDelPrograma = await c.programas.normas(actual.programaId);
      const porNorma = agrupadoresPorNorma(entradas, normasDelPrograma);
      if (cambiaAlcance) {
        await validarAlcance(c, alcance, normasDelPrograma, porNorma);
        // El equipo ya designado sigue siendo independiente con el nuevo alcance (o tiene su excepción).
        const nuevo: FilaAuditoria = { ...actual, ...alcance };
        for (const m of actual.equipo) {
          const { resultado } = await independenciaDe(c, nuevo, m.usuarioId, porNorma, hoy);
          if (!resultado.independiente && !m.excepcion) throw new ConflictoError('independencia');
        }
      }
      const cambios = {
        ...(objetivo !== undefined ? { objetivo } : {}),
        ...(fechas ?? {}),
        ...(reunionApertura !== undefined ? { reunionApertura } : {}),
        ...(reunionCierre !== undefined ? { reunionCierre } : {}),
      };
      if (!(await c.auditorias.actualizar(id, cambios, version, usuarioId, ahora))) throw new ConflictoDeVersionError();
      if (cambiaAlcance) await c.auditorias.fijarAlcance(id, alcance, usuarioId, ahora);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'auditoria.cambiada',
        resultado: 'ok',
        objeto: `auditoria:${actual.codigo}`,
      });
      return aDto(c, await exigirAuditoria(c, id), porNorma);
    });
  }
}

export class ReprogramarAuditoriaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  /** Cambia las fechas con un motivo (lista cerrada y nota breve); no crea otra auditoría. */
  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    versionEsperada?: unknown;
    inicio?: unknown;
    fin?: unknown;
    reunionApertura?: unknown;
    reunionCierre?: unknown;
    motivo?: unknown;
    nota?: unknown;
  }): Promise<AuditoriaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = entero(e.versionEsperada, 'versionEsperada');
    const fechas = traducirDominio(() => validarFechas(e.inicio, e.fin));
    const reuniones = {
      ...(e.reunionApertura !== undefined ? { reunionApertura: fechaOpcional(e.reunionApertura, 'reunionApertura') } : {}),
      ...(e.reunionCierre !== undefined ? { reunionCierre: fechaOpcional(e.reunionCierre, 'reunionCierre') } : {}),
    };
    const motivo = traducirDominio(() => validarMotivoCambio(e.motivo, e.nota));
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const actual = await exigirAuditoria(c, id);
      if (esAuditoriaInmutable(actual.estado)) throw new ConflictoError('no_permitido_en_este_estado');
      const programa = await exigirPrograma(c, actual.programaId);
      if (Number(fechas.inicio.slice(0, 4)) !== programa.anio) throw new ParametroInvalidoError('inicio');
      if (
        !(await c.auditorias.actualizar(
          id,
          { ...fechas, ...reuniones, reprogramaciones: actual.reprogramaciones + 1 },
          version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'auditoria.reprogramada',
        resultado: 'ok',
        objeto: `auditoria:${actual.codigo}`,
        despues: { motivo: motivo.motivo },
      });
      return aDto(c, await exigirAuditoria(c, id), agrupadoresPorNorma(entradas, actual.normas));
    });
  }
}

export class CancelarAuditoriaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  /** Una auditoría cancelada conserva todo lo registrado, no cuenta para la cobertura y no se reabre. */
  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    versionEsperada?: unknown;
    motivo?: unknown;
    nota?: unknown;
  }): Promise<AuditoriaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = entero(e.versionEsperada, 'versionEsperada');
    const motivo = traducirDominio(() => validarMotivoCambio(e.motivo, e.nota));
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const actual = await exigirAuditoria(c, id);
      if (!puedeTransitar(actual.estado, 'cancelada')) throw new ConflictoError('no_permitido_en_este_estado');
      if (
        !(await c.auditorias.actualizar(
          id,
          { estado: 'cancelada', cancelacionMotivo: motivo.motivo, cancelacionNota: motivo.nota },
          version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'auditoria.cancelada',
        resultado: 'ok',
        objeto: `auditoria:${actual.codigo}`,
        despues: { motivo: motivo.motivo },
      });
      return aDto(c, await exigirAuditoria(c, id), agrupadoresPorNorma(entradas, actual.normas));
    });
  }
}

/** Avanza a «en preparación» o «en ejecución». El informe y el cierre tienen sus propias operaciones. */
export class AvanzarAuditoriaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string = () => globalThis.crypto.randomUUID(),
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    versionEsperada?: unknown;
    estado?: unknown;
  }): Promise<AuditoriaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = entero(e.versionEsperada, 'versionEsperada');
    if (e.estado !== 'en_preparacion' && e.estado !== 'en_ejecucion') throw new ParametroInvalidoError('estado');
    const hasta = e.estado;
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const actual = await exigirAuditoria(c, id);
      const bloqueo = motivoDeBloqueoDeTransicion({
        desde: actual.estado,
        hasta,
        hoy: hoyEnEcuador(ahora),
        inicio: actual.inicio,
        reunionApertura: actual.reunionApertura,
        reunionCierre: actual.reunionCierre,
      });
      if (bloqueo) throw new ConflictoError('transicion_no_permitida');
      if (hasta === 'en_preparacion' && (actual.normas.length === 0 || !actual.equipo.some((m) => m.rol === 'lider')))
        throw new ConflictoError('falta_lider_o_criterios');
      // «En ejecución» exige la lista generada (se genera al pasar a «en preparación»).
      if (hasta === 'en_ejecucion' && (await c.items.listar(id)).length === 0) throw new ConflictoError('lista_no_generada');
      if (!(await c.auditorias.actualizar(id, { estado: hasta }, version, usuarioId, ahora))) throw new ConflictoDeVersionError();
      if (hasta === 'en_preparacion') {
        const filas = await generarLista(c, actual, entradas, usuarioId, ahora, this.nuevoId);
        await c.bitacora.registrar({
          empresaId,
          actor: { tipo: 'usuario', usuarioId },
          accion: 'lista.generada',
          resultado: 'ok',
          objeto: `lista:${actual.codigo}`,
          despues: { filas, agregadas: filas, quitadas: 0 },
        });
      }
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'auditoria.avanzada',
        resultado: 'ok',
        objeto: `auditoria:${actual.codigo}`,
        despues: { estado: hasta },
      });
      return aDto(c, await exigirAuditoria(c, id), agrupadoresPorNorma(entradas, actual.normas));
    });
  }
}

/** Antes de designar: por qué una persona sí o no puede auditar este alcance (relaciones y repetición). Solo consulta. */
export class ComprobarIndependenciaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; personaId?: unknown }): Promise<IndependenciaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    const personaId = validarUuid(e.personaId, 'personaId');
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const hoy = hoyEnEcuador(this.reloj());
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      if (!(await c.personas.listar()).some((p) => p.id === personaId && p.activa)) throw new ParametroInvalidoError('personaId');
      const { resultado, alcance } = await independenciaDe(c, a, personaId, agrupadoresPorNorma(entradas, a.normas), hoy);
      return { ...resultado, personaId, procesosDelAlcance: alcance.map((p) => p.id) };
    });
  }
}

export class DesignarMiembroUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  /** Con conflicto de independencia solo se designa con una excepción (motivo y medida compensatoria). */
  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    personaId?: unknown;
    rol?: unknown;
    excepcion?: unknown;
  }): Promise<MiembroDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const personaId = validarUuid(e.personaId, 'personaId');
    if (e.rol !== 'lider' && e.rol !== 'auditor') throw new ParametroInvalidoError('rol');
    const rol = e.rol;
    const ex = e.excepcion;
    if (ex !== undefined && (typeof ex !== 'object' || ex === null || Array.isArray(ex))) throw new ParametroInvalidoError('excepcion');
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      if (!admiteCambioDeAlcance(a.estado)) throw new ConflictoError('no_permitido_en_este_estado');
      const personas = await c.personas.listar();
      const persona = personas.find((p) => p.id === personaId && p.activa);
      if (!persona || !ROLES_QUE_AUDITAN.includes(persona.rol)) throw new ParametroInvalidoError('personaId');
      if (a.equipo.length >= EQUIPO_MAX) throw new ConflictoError('tope_del_equipo');
      if (a.equipo.some((m) => m.usuarioId === personaId)) throw new ConflictoError('ya_esta_en_el_equipo');
      if (rol === 'lider' && a.equipo.some((m) => m.rol === 'lider')) throw new ConflictoError('ya_hay_lider');
      const { resultado } = await independenciaDe(c, a, personaId, agrupadoresPorNorma(entradas, a.normas), hoyEnEcuador(ahora));
      let excepcion: { motivo: string; medida: string; autoautorizada: boolean } | null = null;
      if (!resultado.independiente) {
        // Un conflicto sin excepción no se designa; con excepción, la autoriza quien llama (motivo y medida compensatoria obligatorios).
        if (ex === undefined) throw new ConflictoError('independencia');
        const x = ex as { motivo?: unknown; medida?: unknown };
        excepcion = traducirDominio(() =>
          validarExcepcion({
            motivo: x.motivo as string,
            medida: x.medida as string,
            autorizadaPor: usuarioId,
            designada: personaId,
            unicoAdministradorActivo: administradoresActivos(personas) === 1,
          }),
        );
      } else if (ex !== undefined) throw new ParametroInvalidoError('excepcion'); // sin conflicto no hay excepción que registrar
      const miembro: MiembroEquipo = {
        usuarioId: personaId,
        rol,
        excepcion: excepcion !== null,
        excepcionMotivo: excepcion?.motivo ?? null,
        excepcionMedida: excepcion?.medida ?? null,
        excepcionAutorizadaPor: excepcion ? usuarioId : null,
        autoautorizada: excepcion?.autoautorizada ?? false,
      };
      if (!(await c.auditorias.agregarMiembro(id, miembro, usuarioId, ahora))) throw new ConflictoError('ya_hay_lider');
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'equipo.designado',
        resultado: 'ok',
        objeto: `equipo:${a.codigo}`,
        despues: { persona_id: personaId, rol, excepcion: miembro.excepcion, autoautorizada: miembro.autoautorizada },
      });
      return {
        personaId,
        rol,
        excepcion: miembro.excepcion,
        autoautorizada: miembro.autoautorizada,
        excepcionMotivo: miembro.excepcionMotivo,
        excepcionMedida: miembro.excepcionMedida,
        excepcionAutorizadaPor: miembro.excepcionAutorizadaPor,
      };
    });
  }
}

export class QuitarMiembroUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; personaId?: unknown }): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const personaId = validarUuid(e.personaId, 'personaId');
    await this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      if (!admiteCambioDeAlcance(a.estado)) throw new ConflictoError('no_permitido_en_este_estado');
      const m = a.equipo.find((x) => x.usuarioId === personaId);
      if (!m) throw new EntradaNoEncontradaError();
      // Ya en preparación, el líder no se quita sin reemplazo: la auditoría no puede quedar sin quien la dirige.
      if (m.rol === 'lider' && a.estado === 'en_preparacion') throw new ConflictoError('sin_lider');
      if (!(await c.auditorias.quitarMiembro(id, personaId))) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'equipo.retirado',
        resultado: 'ok',
        objeto: `equipo:${a.codigo}`,
        despues: { persona_id: personaId },
      });
    });
  }
}

