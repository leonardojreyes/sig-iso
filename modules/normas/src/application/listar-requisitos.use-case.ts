import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { ContextoConsulta } from './contexto-adopcion.js';
import { aDto, type EntradaDto } from './entrada-dto.js';
import { ParametroInvalidoError } from './parametro-invalido.error.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

export interface ListarRequisitosEntrada {
  /** Siempre la del token verificado. */
  readonly empresaId: EmpresaId;
  readonly q?: string;
  readonly capitulo?: number;
  readonly norma?: string;
  /** Cláusulas o controles del Anexo A. */
  readonly tipo?: 'clausula' | 'control';
}

/** Tope del contrato (`maxItems`). */
export const TOPE_REQUISITOS = 500;

// Mismos patrones que el contrato: sin comodines ni caracteres de control; los filtros se aplican como texto literal.
const PATRON_Q = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ .:-]+$/;
const PATRON_NORMA = /^[A-Za-z0-9 :./-]+$/;

/** Sin mayúsculas ni tildes, para comparar. */
const plano = (texto: string): string => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const validar = (e: ListarRequisitosEntrada): { q: string | null; capitulo: number | null; norma: string | null; tipo: 'clausula' | 'control' | null } => {
  let q: string | null = null;
  if (e.q !== undefined) {
    const t = typeof e.q === 'string' ? e.q.trim() : '';
    if (t.length < 1 || t.length > 80 || !PATRON_Q.test(t)) throw new ParametroInvalidoError('q');
    q = plano(t);
  }
  let capitulo: number | null = null;
  if (e.capitulo !== undefined) {
    if (typeof e.capitulo !== 'number' || !Number.isInteger(e.capitulo) || e.capitulo < 4 || e.capitulo > 10) throw new ParametroInvalidoError('capitulo');
    capitulo = e.capitulo;
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
  return { q, capitulo, norma, tipo };
};

/**
 * Entradas de las librerías que la empresa adoptó (H5.1–H5.3). Orden: por librería (código) y por el orden de la librería.
 * Buscar por `q` mira el identificador, el título y la cláusula de cada norma.
 */
export class ListarRequisitosUseCase {
  constructor(private readonly unidad: UnidadDeTrabajoPort<ContextoConsulta>) {}

  async ejecutar(entrada: ListarRequisitosEntrada): Promise<EntradaDto[]> {
    const empresaId = crearEmpresaId(entrada.empresaId);
    const { q, capitulo, norma, tipo } = validar(entrada);

    return this.unidad.ejecutar(empresaId, async ({ catalogo, adopciones }) => {
      const [librerias, adoptadas, entradas] = await Promise.all([catalogo.listarLibrerias(), adopciones.listarLibreriaIds(), catalogo.listarEntradas()]);
      const propias = new Set(adoptadas);
      const codigo = new Map(librerias.map((l) => [l.id, l.codigo]));
      // Defensa en profundidad: aunque el repositorio no aislara, solo cuentan las librerías que ESTA empresa adoptó.
      const visibles = entradas
        .filter((e) => propias.has(e.libreriaId))
        .filter((e) => capitulo === null || e.capitulo === capitulo)
        .filter((e) => tipo === null || e.tipo === tipo)
        .filter((e) => norma === null || e.aplicaA.some((a) => a.norma === norma))
        .filter((e) => q === null || [e.idEstable, e.titulo, e.grupo ?? '', ...e.aplicaA.map((a) => a.clausula)].some((campo) => plano(campo).includes(q)))
        .sort((a, b) => (codigo.get(a.libreriaId) ?? '').localeCompare(codigo.get(b.libreriaId) ?? '') || a.orden - b.orden);
      if (visibles.length > TOPE_REQUISITOS) throw new Error(`El resultado supera el tope de ${TOPE_REQUISITOS} entradas del contrato`);
      return visibles.map(aDto);
    });
  }
}
