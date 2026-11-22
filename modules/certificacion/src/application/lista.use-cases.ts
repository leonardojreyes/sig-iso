import {
  generarFilas,
  planificarRegeneracion,
  PREGUNTAS_POR_ITEM_MAX,
  RESULTADOS_ITEM,
  validarPregunta,
  validarResultado,
  type NormaParaLista,
  type ResultadoItem,
} from '../domain/auditoria-lista.js';
import { admiteEjecucion } from '../domain/auditoria.js';
import type { EstadoEvaluacion } from '../domain/estado-evaluacion.js';
import type { FilaAuditoria, FilaItem } from './auditoria.port.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from './catalogo-lectura.port.js';
import { exigirPermiso, identificar, validarUuid } from './comunes.js';
import type { ContextoCertificacion, Reloj } from './contexto.js';
import { traducirDominio } from './documentos.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

// Auditoría interna (ADR 040): la lista de verificación. Se genera con una fila por entrada de las normas adoptadas, fijada con la
// versión de la librería, y la evalúa SOLO el equipo designado. Orden de evaluación: 401 → 403 → 400 → 404 → 409.

type Unidad = UnidadDeTrabajoPort<ContextoCertificacion>;

export interface PreguntaDto {
  readonly id: string;
  readonly texto: string;
}
export interface FilaListaDto {
  readonly id: string;
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  /** Título breve y guía propia de la entrada; nulos si la entrada ya no está adoptada. */
  readonly titulo: string | null;
  readonly guia: string | null;
  readonly agrupador: string | null;
  readonly resultado: ResultadoItem;
  readonly nota: string | null;
  readonly version: number;
  readonly evaluadoPor: string | null;
  readonly evaluadoEn: string | null;
  /** Estado del diagnóstico de la entrada (solo orienta: no se copia como resultado). */
  readonly diagnostico: EstadoEvaluacion | null;
  readonly preguntas: readonly PreguntaDto[];
}
export interface ListaVerificacionDto {
  readonly auditoriaId: string;
  readonly filas: readonly FilaListaDto[];
  readonly avance: { readonly total: number; readonly evaluadas: number; readonly porResultado: Readonly<Record<ResultadoItem, number>> };
}
export interface ResultadoRegeneracionDto {
  readonly total: number;
  readonly agregadas: number;
  readonly quitadas: number;
  readonly conservadas: number;
  readonly conservadasFueraDeAlcance: number;
}

const agrupadorDe = (e: EntradaCatalogo): string | null =>
  e.tipo === 'clausula' ? (e.capitulo === null ? null : String(e.capitulo)) : e.grupo;

/** Las normas de la auditoría con sus entradas adoptadas (solo cláusulas y controles). La versión de la librería es la de la entrada. */
const normasParaLista = (a: Pick<FilaAuditoria, 'normas'>, entradas: readonly EntradaCatalogo[]): readonly NormaParaLista[] =>
  a.normas.map((codigo) => {
    const propias = entradas.filter((e) => e.libreriaCodigo === codigo && (e.tipo === 'clausula' || e.tipo === 'control'));
    return {
      libreriaCodigo: codigo,
      libreriaVersion: propias[0]?.libreriaId ?? 'sin-version',
      entradas: propias.map((e) => ({
        idEstable: e.idEstable,
        orden: e.orden,
        titulo: e.titulo,
        tipo: e.tipo as 'clausula' | 'control',
        capitulo: e.capitulo,
        grupo: e.grupo,
      })),
    };
  });

/** Genera la lista de una auditoría que todavía no la tiene (al pasar a «en preparación»). Devuelve cuántas filas creó. */
export const generarLista = async (
  c: ContextoCertificacion,
  a: FilaAuditoria,
  entradas: readonly EntradaCatalogo[],
  usuarioId: string,
  ahora: Date,
  nuevoId: () => string,
): Promise<number> => {
  const filas = generarFilas(normasParaLista(a, entradas), a.capitulos);
  await c.items.crearVarios(
    filas.map((f) => ({
      id: nuevoId(),
      auditoriaId: a.id,
      libreriaCodigo: f.libreriaCodigo,
      libreriaVersion: f.libreriaVersion,
      idEstable: f.idEstable,
    })),
    usuarioId,
    ahora,
  );
  return filas.length;
};

const objetoDeItem = (codigo: string, idEstable: string): string =>
  `item:${codigo}.${idEstable.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80)}`;

const exigirAuditoria = async (c: ContextoCertificacion, id: string): Promise<FilaAuditoria> => {
  const a = await c.auditorias.obtener(id);
  if (!a) throw new EntradaNoEncontradaError();
  return a;
};

const contarResultados = (items: readonly FilaItem[]): Record<ResultadoItem, number> => {
  const r = Object.fromEntries(RESULTADOS_ITEM.map((x) => [x, 0])) as Record<ResultadoItem, number>;
  for (const i of items) r[i.resultado] += 1;
  return r;
};

export class ListarListaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<ListaVerificacionDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ver', empresaId);
    const id = validarUuid(e.id, 'id');
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      const [items, preguntas, evaluaciones] = await Promise.all([c.items.listar(id), c.items.preguntas(id), c.evaluaciones.listar()]);
      const clave = (k: string, i: string): string => `${k}\u0000${i}`;
      const catalogoPorClave = new Map(entradas.map((x) => [clave(x.libreriaCodigo, x.idEstable), x]));
      const diag = new Map(evaluaciones.map((x) => [clave(x.libreriaCodigo, x.idEstable), x.estado]));
      const filas = items
        .map((i) => ({ i, ent: catalogoPorClave.get(clave(i.libreriaCodigo, i.idEstable)) }))
        .sort(
          (x, y) =>
            x.i.libreriaCodigo.localeCompare(y.i.libreriaCodigo) ||
            (x.ent?.orden ?? 1e9) - (y.ent?.orden ?? 1e9) ||
            x.i.idEstable.localeCompare(y.i.idEstable),
        )
        .map(({ i, ent }): FilaListaDto => ({
          id: i.id,
          libreriaCodigo: i.libreriaCodigo,
          idEstable: i.idEstable,
          titulo: ent?.titulo ?? null,
          guia: ent?.guia ?? null,
          agrupador: ent ? agrupadorDe(ent) : null,
          resultado: i.resultado,
          nota: i.nota,
          version: i.version,
          evaluadoPor: i.evaluadoPor,
          evaluadoEn: i.evaluadoEn ? i.evaluadoEn.toISOString() : null,
          diagnostico: diag.get(clave(i.libreriaCodigo, i.idEstable)) ?? null,
          preguntas: preguntas.filter((p) => p.itemId === i.id).map((p) => ({ id: p.id, texto: p.texto })),
        }));
      const porResultado = contarResultados(items);
      return {
        auditoriaId: a.id,
        filas,
        avance: { total: items.length, evaluadas: items.length - porResultado.por_evaluar, porResultado },
      };
    });
  }
}

/** Regenerar la lista a propósito (solo en preparación): agrega lo que falta, quita lo «por evaluar» que ya no corresponde y conserva lo evaluado. */
export class RegenerarListaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string }): Promise<ResultadoRegeneracionDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.planificar', empresaId);
    const id = validarUuid(e.id, 'id');
    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      if (a.estado !== 'en_preparacion') throw new ConflictoError('no_permitido_en_este_estado');
      const actuales = await c.items.listar(id);
      const nuevas = generarFilas(normasParaLista(a, entradas), a.capitulos);
      const plan = planificarRegeneracion(actuales, nuevas);
      await c.items.crearVarios(
        plan.agregar.map((f) => ({
          id: this.nuevoId(),
          auditoriaId: id,
          libreriaCodigo: f.libreriaCodigo,
          libreriaVersion: f.libreriaVersion,
          idEstable: f.idEstable,
        })),
        usuarioId,
        ahora,
      );
      const quitadas = await c.items.quitarPorEvaluar(id, plan.quitar);
      const total = (await c.items.listar(id)).length;
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'lista.generada',
        resultado: 'ok',
        objeto: `lista:${a.codigo}`,
        despues: { filas: total, agregadas: plan.agregar.length, quitadas },
      });
      return {
        total,
        agregadas: plan.agregar.length,
        quitadas,
        conservadas: plan.conservadas,
        conservadasFueraDeAlcance: plan.conservadasFueraDeAlcance.length,
      };
    });
  }
}

/** ¿Es de quien está en el equipo designado? Solo el equipo evalúa; quien no lo está recibe 403 como si no tuviera el permiso. */
const exigirEquipo = (a: FilaAuditoria, usuarioId: string): void => {
  if (!a.equipo.some((m) => m.usuarioId === usuarioId)) throw new SinPermisoError('auditoria.ejecutar');
};

export class EvaluarFilaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
  ) {}

  /** Asigna un resultado a una fila, con concurrencia optimista. Solo con la auditoría en ejecución y solo el equipo designado. */
  async ejecutar(e: {
    empresaId: string;
    usuarioId: string;
    id: string;
    filaId?: unknown;
    versionEsperada?: unknown;
    resultado?: unknown;
    nota?: unknown;
  }): Promise<FilaListaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ejecutar', empresaId);
    const id = validarUuid(e.id, 'id');
    const filaId = validarUuid(e.filaId, 'filaId');
    const version = e.versionEsperada;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new ParametroInvalidoError('versionEsperada');
    const r = traducirDominio(() => validarResultado(e.resultado, e.nota));
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      exigirEquipo(a, usuarioId);
      const fila = await c.items.obtener(filaId);
      if (!fila || fila.auditoriaId !== id) throw new EntradaNoEncontradaError();
      if (!admiteEjecucion(a.estado)) throw new ConflictoError('no_permitido_en_este_estado');
      if (!(await c.items.evaluar(filaId, r, version, usuarioId, ahora))) throw new ConflictoDeVersionError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'item.evaluado',
        resultado: 'ok',
        objeto: objetoDeItem(a.codigo, fila.idEstable),
        despues: { resultado: r.resultado as Exclude<ResultadoItem, 'por_evaluar'> },
      });
      const nueva = (await c.items.obtener(filaId)) as FilaItem;
      return {
        id: nueva.id,
        libreriaCodigo: nueva.libreriaCodigo,
        idEstable: nueva.idEstable,
        titulo: null,
        guia: null,
        agrupador: null,
        resultado: nueva.resultado,
        nota: nueva.nota,
        version: nueva.version,
        evaluadoPor: nueva.evaluadoPor,
        evaluadoEn: nueva.evaluadoEn ? nueva.evaluadoEn.toISOString() : null,
        diagnostico: null,
        preguntas: (await c.items.preguntas(id)).filter((p) => p.itemId === filaId).map((p) => ({ id: p.id, texto: p.texto })),
      };
    });
  }
}

export class AgregarPreguntaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  /** Preguntas propias del equipo (hasta 5 por fila), mientras la auditoría está en preparación o en ejecución. */
  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; filaId?: unknown; texto?: unknown }): Promise<PreguntaDto> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ejecutar', empresaId);
    const id = validarUuid(e.id, 'id');
    const filaId = validarUuid(e.filaId, 'filaId');
    const texto = traducirDominio(() => validarPregunta(e.texto));
    const ahora = this.reloj();
    return this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      exigirEquipo(a, usuarioId);
      const fila = await c.items.obtener(filaId);
      if (!fila || fila.auditoriaId !== id) throw new EntradaNoEncontradaError();
      if (a.estado !== 'en_preparacion' && a.estado !== 'en_ejecucion') throw new ConflictoError('no_permitido_en_este_estado');
      if ((await c.items.preguntas(id)).filter((p) => p.itemId === filaId).length >= PREGUNTAS_POR_ITEM_MAX)
        throw new ConflictoError('tope_de_preguntas');
      const p = { id: this.nuevoId(), itemId: filaId, texto };
      await c.items.agregarPregunta(p, usuarioId, ahora);
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'pregunta.creada',
        resultado: 'ok',
        objeto: objetoDeItem(a.codigo, fila.idEstable).replace(/^item:/, 'pregunta:'),
      });
      return { id: p.id, texto: p.texto };
    });
  }
}

export class QuitarPreguntaUseCase {
  constructor(
    private readonly unidad: Unidad,
    private readonly autorizacion: AutorizacionPort,
  ) {}

  async ejecutar(e: { empresaId: string; usuarioId: string; id: string; preguntaId?: unknown }): Promise<void> {
    const { empresaId, usuarioId } = identificar(e.empresaId, e.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'auditoria.ejecutar', empresaId);
    const id = validarUuid(e.id, 'id');
    const preguntaId = validarUuid(e.preguntaId, 'preguntaId');
    await this.unidad.ejecutar(empresaId, async (c) => {
      const a = await exigirAuditoria(c, id);
      exigirEquipo(a, usuarioId);
      if (a.estado !== 'en_preparacion' && a.estado !== 'en_ejecucion') throw new ConflictoError('no_permitido_en_este_estado');
      const p = (await c.items.preguntas(id)).find((x) => x.id === preguntaId);
      const fila = p ? await c.items.obtener(p.itemId) : null;
      if (!p || !fila || !(await c.items.quitarPregunta(id, preguntaId))) throw new EntradaNoEncontradaError();
      await c.bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'pregunta.eliminada',
        resultado: 'ok',
        objeto: objetoDeItem(a.codigo, fila.idEstable).replace(/^item:/, 'pregunta:'),
      });
    });
  }
}
