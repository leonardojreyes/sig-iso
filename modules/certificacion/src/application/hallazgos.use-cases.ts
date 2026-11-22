import { admiteEjecucion } from '../domain/auditoria.js';
import { cubreClausulas4a10 } from '../domain/auditoria-programa.js';
import {
  exigeLider,
  HALLAZGOS_POR_AUDITORIA_MAX,
  validarDatosHallazgo,
  validarEnunciado,
  validarEvidenciaHallazgo,
  validarMotivoAnulacion,
  type MotivoAnulacion,
  type TipoHallazgoDominio,
} from '../domain/hallazgo.js';
import type { FilaAuditoria, FilaHallazgo } from './auditoria.port.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { traducirDominio } from './documentos.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { agrupadoresPorNorma } from './programas.use-cases.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

// Auditoría interna (ADR 040): hallazgos. Se registran con la auditoría en ejecución y solo el equipo designado; una NC lleva proceso,
// requisito y evidencia (la mayor, también la justificación de la gravedad, que solo el líder decide). Quedan abiertos: su tratamiento es
// de otro módulo. No se borran: se anulan con motivo. Orden de evaluación: 401 → 403 → 400 → 404 → 409.

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

export interface HallazgoDto {
  readonly id: string;
  readonly codigo: string;
  readonly itemId: string | null;
  readonly tipo: TipoHallazgoDominio;
  readonly procesoId: string | null;
  readonly libreriaCodigo: string | null;
  readonly idEstable: string | null;
  readonly enunciado: string;
  readonly evidencia: string;
  readonly justificacionGravedad: string | null;
  readonly estado: 'abierto' | 'anulado';
  readonly anulacionMotivo: MotivoAnulacion | null;
  readonly registradoPor: string;
  readonly version: number;
}
export interface ListaHallazgosDto {
  readonly hallazgos: readonly HallazgoDto[];
  /** Solo los abiertos, por tipo. */
  readonly abiertos: Readonly<Record<TipoHallazgoDominio, number>>;
}

const aDto = (h: FilaHallazgo): HallazgoDto => ({
  id: h.id,
  codigo: h.codigo,
  itemId: h.itemId,
  tipo: h.tipo,
  procesoId: h.procesoId,
  libreriaCodigo: h.libreriaCodigo,
  idEstable: h.idEstable,
  enunciado: h.enunciado,
  evidencia: h.evidencia,
  justificacionGravedad: h.justificacionGravedad,
  estado: h.estado,
  anulacionMotivo: h.anulacionMotivo,
  registradoPor: h.registradoPor,
  version: h.version,
});

const exigirAuditoria = async (c: ContextoCertificacion, id: string): Promise<FilaAuditoria> => {
  const a = await c.auditorias.obtener(id);
  if (!a) throw new EntradaNoEncontradaError();
  return a;
};
const exigirEquipo = (a: FilaAuditoria, usuarioId: string): void => {
  if (!a.equipo.some((m) => m.usuarioId === usuarioId)) throw new SinPermisoError('auditoria.ejecutar');
};
const esLider = (a: FilaAuditoria, usuarioId: string): boolean => a.equipo.some((m) => m.usuarioId === usuarioId && m.rol === 'lider');
const entero = (v: unknown, campo: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ParametroInvalidoError(campo);
  return v;
};
const opcional = (v: unknown, campo: string): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new ParametroInvalidoError(campo);
  return v;
};
const objetoDe = (a: FilaAuditoria, h: { codigo: string }): string => `hallazgo:${a.codigo}.${h.codigo}`;

/** El proceso debe ser del alcance de la auditoría (con «Gestión del SIG» si cubre las cláusulas 4 a 10). */
const procesosPermitidos = async (
  c: ContextoCertificacion,
  a: FilaAuditoria,
  porNorma: ReadonlyMap<string, readonly string[]>,
): Promise<ReadonlySet<string>> => {
  const ids = new Set(a.procesosIds);
  const t = await c.procesos.transversalVigente();
  if (t && cubreClausulas4a10(a.normas, a.capitulos, porNorma)) ids.add(t.id);
  return ids;
};

export class ListarHallazgosUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<ListaHallazgosDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    return this.unidad.ejecutar(empresaId, async (c) => {
      await exigirAuditoria(c, id);
      const lista = await c.hallazgos.listar(id);
      const abiertos = { nc_mayor: 0, nc_menor: 0, observacion: 0, oportunidad: 0 };
      for (const h of lista) if (h.estado === 'abierto') abiertos[h.tipo] += 1;
      return { hallazgos: lista.map(aDto), abiertos };
    });
  }
}

interface EntradaHallazgo {
  empresaId: string;
  usuarioId: string;
  id: string;
  itemId?: unknown;
  tipo?: unknown;
  procesoId?: unknown;
  libreriaCodigo?: unknown;
  idEstable?: unknown;
  enunciado?: unknown;
  evidencia?: unknown;
  justificacionGravedad?: unknown;
}

export class RegistrarHallazgoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(e: EntradaHallazgo): Promise<HallazgoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ejecutar', empresaId);
    const id = validarUuid(e.id, 'id');
    const itemId = e.itemId === undefined || e.itemId === null ? null : validarUuid(e.itemId, 'itemId');
    const procesoId = e.procesoId === undefined || e.procesoId === null ? null : validarUuid(e.procesoId, 'procesoId');
    const libreriaCodigo = opcional(e.libreriaCodigo, 'libreriaCodigo');
    const idEstable = opcional(e.idEstable, 'idEstable');
    const textos = traducirDominio(() => ({ enunciado: validarEnunciado(e.enunciado), evidencia: validarEvidenciaHallazgo(e.evidencia) }));
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      exigirEquipo(a, usuarioId);
      // El requisito se toma de la fila si se indicó (el hallazgo sale de ella); si no, se da completo.
      let requisito = { libreriaCodigo, idEstable };
      if (itemId !== null) {
        const fila = await c.items.obtener(itemId);
        if (!fila || fila.auditoriaId !== id) throw new ParametroInvalidoError('itemId');
        requisito = { libreriaCodigo: fila.libreriaCodigo, idEstable: fila.idEstable };
      }
      const datos = traducirDominio(() =>
        validarDatosHallazgo({ tipo: e.tipo, procesoId, ...requisito, justificacionGravedad: e.justificacionGravedad }),
      );
      if (exigeLider(datos.tipo) && !esLider(a, usuarioId)) throw new SinPermisoError('auditoria.ejecutar'); // la gravedad la decide el líder
      if (!admiteEjecucion(a.estado)) throw new ConflictoError('no_permitido_en_este_estado');
      if (datos.procesoId !== null && !(await procesosPermitidos(c, a, agrupadoresPorNorma(entradas, a.normas))).has(datos.procesoId))
        throw new ParametroInvalidoError('procesoId');
      if (
        datos.libreriaCodigo !== null &&
        !(await c.items.listar(id)).some((i) => i.libreriaCodigo === datos.libreriaCodigo && i.idEstable === datos.idEstable)
      )
        throw new ParametroInvalidoError('requisito');
      if ((await c.hallazgos.listar(id)).length >= HALLAZGOS_POR_AUDITORIA_MAX) throw new ConflictoError('tope_de_hallazgos');
      const hid = this.nuevoId();
      let creado = false;
      for (let intento = 0; intento < 5 && !creado; intento += 1) {
        const numero = await c.hallazgos.siguienteNumero(id);
        creado = await c.hallazgos.crear({ id: hid, auditoriaId: id, itemId, numero, ...datos, ...textos }, usuarioId, ahora);
      }
      if (!creado) throw new ConflictoError('codigo_repetido');
      const h = (await c.hallazgos.obtener(hid)) as FilaHallazgo;
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'hallazgo.registrado',
        resultado: 'ok',
        objeto: objetoDe(a, h),
        despues: { tipo: h.tipo },
      });
      return aDto(h);
    });
  }
}

export class CambiarHallazgoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: EntradaHallazgo & { hallazgoId?: unknown; versionEsperada?: unknown }): Promise<HallazgoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ejecutar', empresaId);
    const id = validarUuid(e.id, 'id');
    const hallazgoId = validarUuid(e.hallazgoId, 'hallazgoId');
    const version = entero(e.versionEsperada, 'versionEsperada');
    const quiere = (k: keyof EntradaHallazgo): boolean => e[k] !== undefined;
    if (
      !['tipo', 'procesoId', 'libreriaCodigo', 'idEstable', 'enunciado', 'evidencia', 'justificacionGravedad'].some((k) =>
        quiere(k as keyof EntradaHallazgo),
      )
    )
      throw new ParametroInvalidoError('cambios');
    const enunciado = quiere('enunciado') ? traducirDominio(() => validarEnunciado(e.enunciado)) : undefined;
    const evidencia = quiere('evidencia') ? traducirDominio(() => validarEvidenciaHallazgo(e.evidencia)) : undefined;
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      exigirEquipo(a, usuarioId);
      const actual = await c.hallazgos.obtener(hallazgoId);
      if (!actual || actual.auditoriaId !== id) throw new EntradaNoEncontradaError();
      if (!admiteEjecucion(a.estado) || actual.estado === 'anulado') throw new ConflictoError('no_permitido_en_este_estado');
      // Lo que no se cambia se conserva; el resultado final tiene que cumplir las reglas completas.
      const procesoId = quiere('procesoId') ? (e.procesoId === null ? null : validarUuid(e.procesoId, 'procesoId')) : actual.procesoId;
      const libreriaCodigo = quiere('libreriaCodigo') ? opcional(e.libreriaCodigo, 'libreriaCodigo') : actual.libreriaCodigo;
      const idEstable = quiere('idEstable') ? opcional(e.idEstable, 'idEstable') : actual.idEstable;
      const tipoNuevo = quiere('tipo') ? e.tipo : actual.tipo;
      const justificacion = quiere('justificacionGravedad')
        ? e.justificacionGravedad
        : tipoNuevo === 'nc_mayor'
          ? actual.justificacionGravedad
          : null;
      const datos = traducirDominio(() =>
        validarDatosHallazgo({ tipo: tipoNuevo, procesoId, libreriaCodigo, idEstable, justificacionGravedad: justificacion }),
      );
      // La gravedad la decide el líder: pasar a NC mayor, dejar de serlo o cambiar su justificación es de él.
      if ((exigeLider(datos.tipo) || exigeLider(actual.tipo)) && !esLider(a, usuarioId)) throw new SinPermisoError('auditoria.ejecutar');
      if (datos.procesoId !== null && !(await procesosPermitidos(c, a, agrupadoresPorNorma(entradas, a.normas))).has(datos.procesoId))
        throw new ParametroInvalidoError('procesoId');
      if (
        datos.libreriaCodigo !== null &&
        !(await c.items.listar(id)).some((i) => i.libreriaCodigo === datos.libreriaCodigo && i.idEstable === datos.idEstable)
      )
        throw new ParametroInvalidoError('requisito');
      const cambios = { ...datos, ...(enunciado !== undefined ? { enunciado } : {}), ...(evidencia !== undefined ? { evidencia } : {}) };
      if (!(await c.hallazgos.actualizar(hallazgoId, cambios, version, usuarioId, ahora))) throw new ConflictoDeVersionError();
      const h = (await c.hallazgos.obtener(hallazgoId)) as FilaHallazgo;
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'hallazgo.cambiado',
        resultado: 'ok',
        objeto: objetoDe(a, h),
        despues: { tipo: h.tipo },
      });
      return aDto(h);
    });
  }
}

export class AnularHallazgoUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  /** Un hallazgo no se borra: se anula con un motivo cerrado mientras la auditoría está en ejecución. */
  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    hallazgoId?: unknown;
    versionEsperada?: unknown;
    motivo?: unknown;
  }): Promise<HallazgoDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ejecutar', empresaId);
    const id = validarUuid(e.id, 'id');
    const hallazgoId = validarUuid(e.hallazgoId, 'hallazgoId');
    const version = entero(e.versionEsperada, 'versionEsperada');
    const motivo = traducirDominio(() => validarMotivoAnulacion(e.motivo));
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      exigirEquipo(a, usuarioId);
      const actual = await c.hallazgos.obtener(hallazgoId);
      if (!actual || actual.auditoriaId !== id) throw new EntradaNoEncontradaError();
      if (!admiteEjecucion(a.estado) || actual.estado === 'anulado') throw new ConflictoError('no_permitido_en_este_estado');
      if (exigeLider(actual.tipo) && !esLider(a, usuarioId)) throw new SinPermisoError('auditoria.ejecutar');
      if (
        !(await c.hallazgos.actualizar(
          hallazgoId,
          { estado: 'anulado', anulacionMotivo: motivo, anuladoPor: usuarioId, anuladoEn: ahora },
          version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      const h = (await c.hallazgos.obtener(hallazgoId)) as FilaHallazgo;
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'hallazgo.anulado',
        resultado: 'ok',
        objeto: objetoDe(a, h),
        despues: { motivo },
      });
      return aDto(h);
    });
  }
}
