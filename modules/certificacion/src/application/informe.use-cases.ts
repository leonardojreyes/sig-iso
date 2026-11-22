import { esCombinada, motivoDeBloqueoDeTransicion, type EstadoAuditoria } from '../domain/auditoria.js';
import {
  calcularCoberturaAuditoria,
  evaluarPrerrequisito,
  filaCubierta,
  RESULTADOS_ITEM,
  type AuditoriaParaCobertura,
  type Prerrequisito,
  type ResultadoItem,
} from '../domain/auditoria-lista.js';
import { serializarCanonico } from '../domain/canonico.js';
import { hoyEnEcuador } from '../domain/fechas.js';
import { evaluarIndependencia } from '../domain/independencia.js';
import { ventanaMovil } from '../domain/auditoria-lista.js';
import type { FilaAuditoria, FilaHallazgo, FilaItem, FilaProceso } from './auditoria.port.js';
import { alcanceDeProcesos } from './auditorias.use-cases.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import { TIPO_DOCUMENTO_WORD, type GeneradorDocumentoPort } from './generador-documento.port.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { traducirDominio } from './documentos.use-cases.js';
import { ErrorCertificacion } from '../domain/errores.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { agrupadoresPorNorma } from './programas.use-cases.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

// Auditoría interna (ADR 040): emitir el informe (copia congelada e inmutable), cerrar la auditoría y el panel con el prerrequisito de la
// Etapa 2. Este módulo calcula y muestra el dato; NO decide la etapa. Orden de evaluación: 401 → 403 → 400 → 404 → 409.

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;
/** SHA-256 en hexadecimal de un texto: lo aporta la composición (la aplicación no importa módulos de Node). */
export type HashTexto = (texto: string) => string;

export const CONCLUSION_MAX = 1000;
export const LIMITACIONES_MAX = 1000;
const VERSION_INFORME = 1;

export interface InformeContenido {
  readonly version: number;
  readonly auditoria: {
    readonly codigo: string;
    readonly anio: number;
    readonly objetivo: string;
    readonly inicio: string;
    readonly fin: string;
    readonly reunionApertura: string | null;
    readonly reunionCierre: string | null;
    readonly combinada: boolean;
    readonly normas: readonly string[];
    readonly capitulos: readonly { readonly libreriaCodigo: string; readonly capitulo: string }[];
    readonly procesos: readonly { readonly codigo: string; readonly nombre: string; readonly transversal: boolean }[];
  };
  readonly programa: { readonly anio: number; readonly objetivo: string };
  readonly equipo: readonly {
    readonly personaId: string;
    readonly nombre: string;
    readonly rol: 'lider' | 'auditor';
    readonly excepcion: boolean;
    readonly autoautorizada: boolean;
    readonly excepcionMotivo: string | null;
    readonly excepcionMedida: string | null;
  }[];
  readonly conteos: Readonly<Record<ResultadoItem, number>> & { readonly total: number; readonly cubiertas: number };
  readonly filas: readonly {
    readonly libreriaCodigo: string;
    readonly idEstable: string;
    readonly titulo: string | null;
    readonly resultado: ResultadoItem;
    readonly nota: string | null;
  }[];
  readonly noVerificadas: readonly { readonly libreriaCodigo: string; readonly idEstable: string; readonly nota: string | null }[];
  readonly hallazgos: readonly {
    readonly codigo: string;
    readonly tipo: FilaHallazgo['tipo'];
    readonly proceso: string | null;
    readonly requisito: string | null;
    readonly enunciado: string;
    readonly evidencia: string;
    readonly justificacionGravedad: string | null;
    readonly estado: 'abierto' | 'anulado';
  }[];
  readonly conclusion: string;
  readonly limitaciones: string | null;
  readonly emitidoPor: { readonly personaId: string; readonly nombre: string };
  readonly emitidoEn: string;
}
export interface InformeDto {
  readonly auditoriaId: string;
  readonly codigo: string;
  readonly huella: string;
  readonly emitidoPor: string;
  readonly emitidoEn: string;
  readonly contenido: InformeContenido;
}

const exigirAuditoria = async (c: ContextoCertificacion, id: string): Promise<FilaAuditoria> => {
  const a = await c.auditorias.obtener(id);
  if (!a) throw new EntradaNoEncontradaError();
  return a;
};
const entero = (v: unknown, campo: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ParametroInvalidoError(campo);
  return v;
};
const textoObligatorio = (v: unknown, campo: string, max: number): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new ErrorCertificacion(campo, ['obligatorio']);
  const t = v.trim();
  if (t.length > max) throw new ErrorCertificacion(campo, [`máximo ${max} caracteres`]);
  return t;
};
const textoOpcional = (v: unknown, campo: string, max: number): string | null =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : textoObligatorio(v, campo, max);

const arreglo = (items: readonly FilaItem[]): Record<ResultadoItem, number> => {
  const r = Object.fromEntries(RESULTADOS_ITEM.map((x) => [x, 0])) as Record<ResultadoItem, number>;
  for (const i of items) r[i.resultado] += 1;
  return r;
};

const aDto = (
  a: FilaAuditoria,
  i: { id: string; contenido: unknown; huella: string; emitidoPor: string; emitidoEn: Date },
): InformeDto => ({
  auditoriaId: a.id,
  codigo: a.codigo,
  huella: i.huella,
  emitidoPor: i.emitidoPor,
  emitidoEn: i.emitidoEn.toISOString(),
  contenido: i.contenido as InformeContenido,
});

/** Emite el informe: comprueba que todo esté evaluado y respaldado, vuelve a comprobar la independencia y congela una copia. */
export class EmitirInformeUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
    private readonly hash: HashTexto,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    versionEsperada?: unknown;
    conclusion?: unknown;
    limitaciones?: unknown;
  }): Promise<InformeDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    // Quien emite es el administrador SIG o el auditor líder: sin el primer permiso, hace falta al menos el de ejecutar (y ser líder).
    const esAdmin = await this.autorizacion.puede(usuarioId, 'auditoria.aprobar', empresaId);
    if (!esAdmin) await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ejecutar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = entero(e.versionEsperada, 'versionEsperada');
    const textos = traducirDominio(() => ({
      conclusion: textoObligatorio(e.conclusion, 'conclusion', CONCLUSION_MAX),
      limitaciones: textoOpcional(e.limitaciones, 'limitaciones', LIMITACIONES_MAX),
    }));
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      if (!esAdmin && !a.equipo.some((m) => m.usuarioId === usuarioId && m.rol === 'lider'))
        throw new SinPermisoError('auditoria.ejecutar');
      if (a.estado !== 'en_ejecucion') throw new ConflictoError('no_permitido_en_este_estado');
      const hoy = hoyEnEcuador(ahora);
      const bloqueo = motivoDeBloqueoDeTransicion({
        desde: a.estado,
        hasta: 'informe_emitido',
        hoy,
        inicio: a.inicio,
        reunionApertura: a.reunionApertura,
        reunionCierre: a.reunionCierre,
      });
      if (bloqueo) throw new ConflictoError('transicion_no_permitida');

      const [items, hallazgos, procesos, personas, programa] = await Promise.all([
        c.items.listar(id),
        c.hallazgos.listar(id),
        c.procesos.listar(),
        c.personas.listar(),
        c.programas.obtener(a.programaId),
      ]);
      if (!programa) throw new EntradaNoEncontradaError();
      // Todas las filas evaluadas; «no verificado» con su nota; cada hallazgo de una fila respaldado por uno activo.
      if (items.some((i) => i.resultado === 'por_evaluar')) throw new ConflictoError('filas_sin_evaluar');
      if (items.some((i) => i.resultado === 'no_verificado' && (i.nota === null || i.nota.trim() === '')))
        throw new ConflictoError('no_verificado_sin_nota');
      const activos = hallazgos.filter((h) => h.estado === 'abierto');
      const exigenHallazgo: readonly ResultadoItem[] = ['no_conforme', 'observacion', 'oportunidad'];
      if (items.some((i) => exigenHallazgo.includes(i.resultado) && !activos.some((h) => h.itemId === i.id)))
        throw new ConflictoError('fila_sin_hallazgo');
      if (a.equipo.length === 0 || !a.equipo.some((m) => m.rol === 'lider')) throw new ConflictoError('falta_lider_o_criterios');

      // La independencia se vuelve a comprobar (pudieron cambiar las relaciones): un conflicto sin excepción lo impide.
      const porNorma = agrupadoresPorNorma(entradas, a.normas);
      const alcance = await alcanceDeProcesos(c, a, porNorma);
      const relaciones = (await c.relaciones.listar()).map((r) => ({
        usuarioId: r.usuarioId,
        procesoId: r.procesoId,
        relacion: r.relacion,
      }));
      for (const m of a.equipo) {
        const r = evaluarIndependencia({ usuarioId: m.usuarioId, procesos: alcance, relaciones, previas: [], hoy });
        if (!r.independiente && !m.excepcion) throw new ConflictoError('independencia');
      }

      const nombre = (pid: string): string => personas.find((p) => p.id === pid)?.nombre ?? 'Persona dada de baja';
      const proceso = (pid: string | null): FilaProceso | undefined => (pid === null ? undefined : procesos.find((p) => p.id === pid));
      const catalogoPorClave = new Map(entradas.map((x: EntradaCatalogo) => [`${x.libreriaCodigo}\u0000${x.idEstable}`, x]));
      const porResultado = arreglo(items);
      const cubiertas = items.filter((i) =>
        filaCubierta({ libreriaCodigo: i.libreriaCodigo, idEstable: i.idEstable, resultado: i.resultado, nota: i.nota }),
      ).length;
      const contenido: InformeContenido = {
        version: VERSION_INFORME,
        auditoria: {
          codigo: a.codigo,
          anio: a.anio,
          objetivo: a.objetivo,
          inicio: a.inicio,
          fin: a.fin,
          reunionApertura: a.reunionApertura,
          reunionCierre: a.reunionCierre,
          combinada: esCombinada(a.normas),
          normas: a.normas,
          capitulos: a.capitulos,
          procesos: alcance.map((p) => ({
            codigo: proceso(p.id)?.codigo ?? '',
            nombre: proceso(p.id)?.nombre ?? '',
            transversal: p.transversal,
          })),
        },
        programa: { anio: programa.anio, objetivo: programa.objetivo },
        equipo: a.equipo.map((m) => ({
          personaId: m.usuarioId,
          nombre: nombre(m.usuarioId),
          rol: m.rol,
          excepcion: m.excepcion,
          autoautorizada: m.autoautorizada,
          excepcionMotivo: m.excepcionMotivo,
          excepcionMedida: m.excepcionMedida,
        })),
        conteos: { ...porResultado, total: items.length, cubiertas },
        filas: items.map((i) => ({
          libreriaCodigo: i.libreriaCodigo,
          idEstable: i.idEstable,
          titulo: catalogoPorClave.get(`${i.libreriaCodigo}\u0000${i.idEstable}`)?.titulo ?? null,
          resultado: i.resultado,
          nota: i.nota,
        })),
        noVerificadas: items
          .filter((i) => i.resultado === 'no_verificado')
          .map((i) => ({ libreriaCodigo: i.libreriaCodigo, idEstable: i.idEstable, nota: i.nota })),
        hallazgos: hallazgos.map((h) => ({
          codigo: h.codigo,
          tipo: h.tipo,
          proceso: proceso(h.procesoId)?.codigo ?? null,
          requisito: h.libreriaCodigo ? `${h.libreriaCodigo}:${h.idEstable}` : null,
          enunciado: h.enunciado,
          evidencia: h.evidencia,
          justificacionGravedad: h.justificacionGravedad,
          estado: h.estado,
        })),
        conclusion: textos.conclusion,
        limitaciones: textos.limitaciones,
        emitidoPor: { personaId: usuarioId, nombre: nombre(usuarioId) },
        emitidoEn: ahora.toISOString(),
      };
      // La huella es la del texto canónico (claves ordenadas): así se puede volver a verificar con la copia leída de la base.
      const huella = this.hash(serializarCanonico(contenido));
      if (
        !(await c.auditorias.actualizar(
          id,
          { estado: 'informe_emitido', informeEmitidoPor: usuarioId, informeEmitidoEn: ahora },
          version,
          usuarioId,
          ahora,
        ))
      )
        throw new ConflictoDeVersionError();
      if (!(await c.informes.crear({ id: this.nuevoId(), auditoriaId: id, contenido, huella }, usuarioId, ahora)))
        throw new ConflictoError('ya_tiene_informe');
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'informe.emitido',
        resultado: 'ok',
        objeto: `informe:${a.codigo}`,
        objetoVersion: huella,
      });
      const guardado = (await c.informes.obtener(id)) as NonNullable<Awaited<ReturnType<typeof c.informes.obtener>>>;
      return aDto(a, guardado);
    });
  }
}

export class ObtenerInformeUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<InformeDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      const i = await c.informes.obtener(id);
      if (!i) throw new EntradaNoEncontradaError();
      return aDto(a, i);
    });
  }
}

/** Cierra la auditoría (solo administrador SIG). Cerrar NO cierra los hallazgos: siguen abiertos hasta tratarse en su módulo. */
export class CerrarAuditoriaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    versionEsperada?: unknown;
  }): Promise<{ id: string; codigo: string; estado: EstadoAuditoria; cerradaEn: string; version: number }> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.aprobar', empresaId);
    const id = validarUuid(e.id, 'id');
    const version = entero(e.versionEsperada, 'versionEsperada');
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      const bloqueo = motivoDeBloqueoDeTransicion({
        desde: a.estado,
        hasta: 'cerrada',
        hoy: hoyEnEcuador(ahora),
        inicio: a.inicio,
        reunionApertura: a.reunionApertura,
        reunionCierre: a.reunionCierre,
      });
      if (bloqueo) throw new ConflictoError('transicion_no_permitida');
      if (!(await c.auditorias.actualizar(id, { estado: 'cerrada', cerradaPor: usuarioId, cerradaEn: ahora }, version, usuarioId, ahora)))
        throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'auditoria.cerrada',
        resultado: 'ok',
        objeto: `auditoria:${a.codigo}`,
      });
      return { id, codigo: a.codigo, estado: 'cerrada', cerradaEn: ahora.toISOString(), version: version + 1 };
    });
  }
}

/** El informe exportado a Word: siempre desde la copia congelada, nunca desde los datos de hoy. */
export interface ExportacionInforme {
  readonly nombre: string;
  readonly tipo: string;
  readonly bytes: Uint8Array;
  /** SHA-256 del documento: es lo que queda fijado en la bitácora al exportar. */
  readonly sha256: string;
}

export class ExportarInformeUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly generador: GeneradorDocumentoPort,
    private readonly reloj: Reloj,
    private readonly hash: HashTexto,
  ) {}

  /** Antes de entregar, la exportación queda en la bitácora con la huella del documento; si no se puede registrar, no se entrega. */
  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<ExportacionInforme> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    const { a, i } = await this.unidad.ejecutar(empresaId, async (c) => {
      const aud = await exigirAuditoria(c, id);
      const inf = await c.informes.obtener(id);
      if (!inf) throw new EntradaNoEncontradaError();
      return { a: aud, i: inf };
    });
    // La copia no pudo cambiar: se vuelve a calcular su huella antes de escribir nada. Si no coincide, no se entrega.
    if (this.hash(serializarCanonico(i.contenido)) !== i.huella) throw new Error('El informe no coincide con su huella');
    const generado = await this.generador.generarInformeAuditoria({ contenido: i.contenido as InformeContenido, huella: i.huella, generadaEl: hoyEnEcuador(this.reloj()) });
    await this.unidad.ejecutar(empresaId, (c) =>
      c.bitacora.registrar({ empresaId, actor: { tipo: 'usuario', usuarioId }, accion: 'informe.exportado', resultado: 'ok', objeto: `informe:${a.codigo}`, objetoVersion: generado.sha256 }),
    );
    return { nombre: `informe-auditoria-${a.codigo}.docx`, tipo: TIPO_DOCUMENTO_WORD, bytes: generado.bytes, sha256: generado.sha256 };
  }
}

// --- Panel: prerrequisito de la Etapa 2 -----------------------------------------------------------------------------------------------

export interface CoberturaResumenDto {
  readonly clausulas: { readonly total: number; readonly cubiertas: number };
  readonly controles: { readonly total: number; readonly cubiertos: number; readonly sinDeclaracion: boolean };
  readonly procesos: { readonly total: number; readonly cubiertos: number };
}
export interface PanelAuditoriaDto {
  /** Año del programa que sirve de referencia (el de hoy o, si no hay, el más reciente); nulo si no hay ninguno. */
  readonly programaAnio: number | null;
  readonly prerrequisito: Prerrequisito;
  /** Cobertura de las auditorías cerradas en los últimos 12 meses. */
  readonly cobertura12Meses: CoberturaResumenDto;
  readonly auditorias: { readonly total: number; readonly cerradas: number; readonly porEstado: Readonly<Record<EstadoAuditoria, number>> };
}

const aCoberturaParaCalculo = (a: FilaAuditoria, items: readonly FilaItem[], procesosIds: readonly string[]): AuditoriaParaCobertura => ({
  estado: a.estado,
  cerradaEn: a.cerradaEn ? hoyEnEcuador(a.cerradaEn) : null,
  tieneInforme: a.estado === 'cerrada',
  filas: items
    .filter((i) => i.auditoriaId === a.id)
    .map((i) => ({ libreriaCodigo: i.libreriaCodigo, idEstable: i.idEstable, resultado: i.resultado, nota: i.nota })),
  procesosIds,
});

export class ObtenerPanelAuditoriaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
  ) {}

  /** Calcula y muestra si se cumple el prerrequisito de la Etapa 2 y qué falta; no decide la etapa. */
  async ejecutar(e: { empresaId: string; usuarioId: string }): Promise<PanelAuditoriaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    const hoy = hoyEnEcuador(ahora);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const [programas, auditorias, procesos, itemsCerradas, versiones] = await Promise.all([
        c.programas.listar(),
        c.auditorias.listar(),
        c.procesos.listar(),
        c.items.listarDeCerradas(),
        c.declaraciones.listarVersiones(),
      ]);
      const programa = programas.find((p) => p.anio === Number(hoy.slice(0, 4))) ?? programas[programas.length - 1] ?? null;
      const normas = programa ? await c.programas.normas(programa.id) : [];
      const delPrograma = auditorias.filter((a) => programa !== null && a.programaId === programa.id);

      // Controles aplicables según la última Declaración de Aplicabilidad aprobada.
      let controlesAplicables: { libreriaCodigo: string; idEstable: string }[] | null = null;
      const ultima = versiones[0];
      if (ultima) {
        const v = await c.declaraciones.obtener(ultima.id);
        controlesAplicables = (v?.filas ?? [])
          .filter((f) => f.aplicabilidad === 'aplica')
          .map((f) => ({ libreriaCodigo: f.libreriaCodigo, idEstable: f.idEstable }));
      }
      const entradasReferencia = entradas
        .filter((x) => normas.includes(x.libreriaCodigo) && (x.tipo === 'clausula' || x.tipo === 'control'))
        .map((x) => ({
          libreriaCodigo: x.libreriaCodigo,
          idEstable: x.idEstable,
          tipo: x.tipo as 'clausula' | 'control',
          capitulo: x.capitulo,
        }));
      // La Declaración solo se exige si alguna norma del programa tiene controles (27001); una empresa solo 9001 o 42001 no la necesita.
      if (controlesAplicables === null && !entradasReferencia.some((x) => x.tipo === 'control')) controlesAplicables = [];
      const referencia = {
        entradas: entradasReferencia,
        procesosIds: procesos.filter((p) => p.estado === 'vigente').map((p) => p.id),
        controlesAplicables,
      };
      const paraCalculo = async (lista: readonly FilaAuditoria[]): Promise<AuditoriaParaCobertura[]> => {
        const r: AuditoriaParaCobertura[] = [];
        for (const a of lista.filter((x) => x.estado === 'cerrada'))
          r.push(
            aCoberturaParaCalculo(
              a,
              itemsCerradas,
              (await alcanceDeProcesos(c, a, agrupadoresPorNorma(entradas, a.normas))).map((p) => p.id),
            ),
          );
        return r;
      };
      const prerrequisito = evaluarPrerrequisito(await paraCalculo(delPrograma), referencia);
      const cob = calcularCoberturaAuditoria(await paraCalculo(auditorias), referencia, ventanaMovil(hoy));
      const porEstado = Object.fromEntries(
        (['planificada', 'en_preparacion', 'en_ejecucion', 'informe_emitido', 'cerrada', 'cancelada'] as const).map((s) => [s, 0]),
      ) as Record<EstadoAuditoria, number>;
      for (const a of auditorias) porEstado[a.estado] += 1;
      return {
        programaAnio: programa?.anio ?? null,
        prerrequisito,
        cobertura12Meses: {
          clausulas: { total: cob.clausulas.total, cubiertas: cob.clausulas.cubiertas },
          controles: { total: cob.controles.total, cubiertos: cob.controles.cubiertos, sinDeclaracion: cob.controles.sinDeclaracion },
          procesos: { total: cob.procesos.total, cubiertos: cob.procesos.cubiertos },
        },
        auditorias: { total: auditorias.length, cerradas: porEstado.cerrada, porEstado },
      };
    });
  }
}

