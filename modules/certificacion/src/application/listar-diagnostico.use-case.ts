import type { EmpresaId } from '@sig/tenancy';
import { esEstadoEvaluacion, type EstadoEvaluacion } from '../domain/estado-evaluacion.js';
import { calcularMadurez, type Madurez } from '../domain/madurez.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from './catalogo-lectura.port.js';
import { identificar, exigirPermiso } from './comunes.js';
import type { ContextoCertificacion } from './contexto.js';
import { ParametroInvalidoError } from './errores.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

/** Tope de filas por respuesta (el contrato lo declara con `maxItems`). */
export const TOPE_DIAGNOSTICO = 500;
const PATRON_Q = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .:-]+$/;
const PATRON_NORMA = /^[A-Za-z0-9 :./-]+$/;
const plano = (t: string): string => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export interface ListarDiagnosticoEntrada {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly norma?: string;
  readonly tipo?: 'clausula' | 'control';
  /** Un estado o `sin_evaluar`. */
  readonly estado?: EstadoEvaluacion | 'sin_evaluar';
  readonly q?: string;
}

export interface FilaDiagnostico {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: 'clausula' | 'control';
  readonly capitulo: number | null;
  readonly grupo: string | null;
  readonly titulo: string;
  readonly guia: string;
  readonly aplicaA: EntradaCatalogo['aplicaA'];
  /** Nulo = sin evaluar. */
  readonly evaluacion: { readonly estado: EstadoEvaluacion; readonly comentario: string | null; readonly fechaObjetivo: string | null; readonly version: number } | null;
}

export interface Diagnostico {
  readonly filas: readonly FilaDiagnostico[];
  /** Madurez sobre TODAS las entradas de la norma elegida (o de todas), sin importar los demás filtros. */
  readonly madurez: Madurez;
  /** Normas de las librerías adoptadas, para el selector. */
  readonly normas: readonly string[];
}

/** Diagnóstico de la empresa: las entradas de sus librerías adoptadas con su evaluación, y la madurez (H4.2, H4.4). */
export class ListarDiagnosticoUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPort<ContextoCertificacion>,
    private readonly autorizacion: AutorizacionPort,
    private readonly catalogo: CatalogoLecturaPort,
  ) {}

  async ejecutar(entrada: ListarDiagnosticoEntrada): Promise<Diagnostico> {
    const { empresaId, usuarioId } = identificar(entrada.empresaId, entrada.usuarioId);
    await exigirPermiso(this.autorizacion, usuarioId, 'diagnostico.ver', empresaId);
    const { q, norma, tipo, estado } = this.validar(entrada);

    const entradas = await this.catalogo.listarEntradasVigentes(empresaId);
    const evaluaciones = await this.unidad.ejecutar(empresaId, (c) => c.evaluaciones.listar());
    const porClave = new Map(evaluaciones.map((e) => [e.clave, e]));
    const estadoDe = (e: EntradaCatalogo): EstadoEvaluacion | null => porClave.get(`${e.libreriaCodigo}|${e.idEstable}`)?.estado ?? null;

    const normas = [...new Set(entradas.flatMap((e) => e.aplicaA.map((a) => a.norma)))].sort((a, b) => a.localeCompare(b, 'es'));
    const deLaNorma = norma === null ? entradas : entradas.filter((e) => e.aplicaA.some((a) => a.norma === norma));
    const madurez = calcularMadurez(
      deLaNorma.map((e) => ({ tipo: e.tipo, capitulo: e.capitulo, grupo: e.grupo, normas: e.aplicaA.map((a) => a.norma), estado: estadoDe(e) })),
    );

    const visibles = deLaNorma
      .filter((e) => tipo === null || e.tipo === tipo)
      .filter((e) => estado === null || (estado === 'sin_evaluar' ? estadoDe(e) === null : estadoDe(e) === estado))
      .filter((e) => q === null || [e.idEstable, e.titulo, e.grupo ?? '', ...e.aplicaA.map((a) => a.clausula)].some((c) => plano(c).includes(q)));
    if (visibles.length > TOPE_DIAGNOSTICO) throw new Error(`El resultado supera el tope de ${TOPE_DIAGNOSTICO} filas del contrato`);

    const filas = visibles.map((e): FilaDiagnostico => {
      const ev = porClave.get(`${e.libreriaCodigo}|${e.idEstable}`);
      return {
        libreriaCodigo: e.libreriaCodigo,
        idEstable: e.idEstable,
        tipo: e.tipo,
        capitulo: e.capitulo,
        grupo: e.grupo,
        titulo: e.titulo,
        guia: e.guia,
        aplicaA: e.aplicaA,
        evaluacion: ev ? { estado: ev.estado, comentario: ev.comentario, fechaObjetivo: ev.fechaObjetivo, version: ev.version } : null,
      };
    });
    return { filas, madurez, normas };
  }

  private validar(e: ListarDiagnosticoEntrada): { q: string | null; norma: string | null; tipo: 'clausula' | 'control' | null; estado: EstadoEvaluacion | 'sin_evaluar' | null } {
    let q: string | null = null;
    if (e.q !== undefined) {
      const t = typeof e.q === 'string' ? e.q.trim() : '';
      if (t.length < 1 || t.length > 80 || !PATRON_Q.test(t)) throw new ParametroInvalidoError('q');
      q = plano(t);
    }
    let norma: string | null = null;
    if (e.norma !== undefined) {
      if (typeof e.norma !== 'string' || e.norma.length < 1 || e.norma.length > 60 || !PATRON_NORMA.test(e.norma)) throw new ParametroInvalidoError('norma');
      norma = e.norma;
    }
    let tipo: 'clausula' | 'control' | null = null;
    if (e.tipo !== undefined) {
      if (e.tipo !== 'clausula' && e.tipo !== 'control') throw new ParametroInvalidoError('tipo');
      tipo = e.tipo;
    }
    let estado: EstadoEvaluacion | 'sin_evaluar' | null = null;
    if (e.estado !== undefined) {
      if (e.estado !== 'sin_evaluar' && !esEstadoEvaluacion(e.estado)) throw new ParametroInvalidoError('estado');
      estado = e.estado;
    }
    return { q, norma, tipo, estado };
  }
}

export type { EmpresaId };
