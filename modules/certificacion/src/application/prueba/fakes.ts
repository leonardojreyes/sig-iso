import { validarEvento, type EventoBitacora } from '@sig/auditoria';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { Alcance } from '../../domain/alcance.js';
import type { Evaluacion } from '../../domain/evaluacion.js';
import type { AutorizacionPort, Permiso } from '../autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../catalogo-lectura.port.js';
import type { ContextoCertificacion } from '../contexto.js';
import type { AlcanceRepositoryPort, EvaluacionRepositoryPort } from '../repositorios.port.js';
import type { UnidadDeTrabajoPort } from '../unidad-de-trabajo.port.js';

export const A: EmpresaId = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000f1');
export const B: EmpresaId = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000f2');
export const ADMIN = '11111111-1111-4111-8111-1111111111a1';
export const COLAB = '22222222-2222-4222-8222-2222222222b2';
export const LIB = '33333333-3333-4333-8333-3333333333c3';
export const LIB_V2 = '44444444-4444-4444-8444-4444444444d4';

/** Entradas de prueba: una cláusula común y dos controles del Anexo A. */
export const entradas = {
  contexto: { libreriaCodigo: 'ejemplo-ha', libreriaId: LIB, idEstable: 'ha-4.1', tipo: 'clausula', capitulo: 4, grupo: null, titulo: 'Contexto', guia: 'Describe el entorno de la organización.', aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1' }, { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '4.1' }], orden: 1 },
  politicas: { libreriaCodigo: 'iso-27001-2022-anexo-a', libreriaId: LIB, idEstable: 'a27-5-1', tipo: 'control', capitulo: null, grupo: 'Organizacionales', titulo: 'Políticas de seguridad', guia: 'Redacta las reglas generales.', aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }], orden: 1 },
  roles: { libreriaCodigo: 'iso-27001-2022-anexo-a', libreriaId: LIB, idEstable: 'a27-5-2', tipo: 'control', capitulo: null, grupo: 'Organizacionales', titulo: 'Roles y responsabilidades', guia: 'Reparte quién cuida qué.', aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.2' }], orden: 2 },
} satisfies Record<string, EntradaCatalogo>;

export class EstadoFalso {
  evaluaciones = new Map<string, Evaluacion & { _por?: string }>();
  alcances = new Map<string, Alcance>();
  eventos: EventoBitacora[] = [];
  /** Entradas adoptadas por empresa. */
  catalogoPorEmpresa = new Map<EmpresaId, readonly EntradaCatalogo[]>();
  permisos = new Set<string>();
  /** Si se pone, la próxima escritura de bitácora falla (para probar que la acción se revierte). */
  fallarBitacora = false;
  /** Si se pone, la próxima escritura de evaluación devuelve «falso» (otra persona escribió en medio). */
  carrera = false;

  conceder(usuarioId: string, empresaId: EmpresaId, ...permisos: Permiso[]): void {
    for (const p of permisos) this.permisos.add(`${usuarioId}|${p}|${empresaId}`);
  }
}

export const crearAutorizacionFalsa = (estado: EstadoFalso): AutorizacionPort => ({
  puede: async (usuarioId, permiso, empresaId) => estado.permisos.has(`${usuarioId}|${permiso}|${empresaId}`),
});

export const crearCatalogoFalso = (estado: EstadoFalso): CatalogoLecturaPort => ({
  listarEntradasVigentes: async (empresaId) => estado.catalogoPorEmpresa.get(empresaId) ?? [],
});

/** Unidad de trabajo en memoria: los datos de cada empresa están separados y, si `fn` falla, todo se revierte. */
export const crearUnidadFalsa = (estado: EstadoFalso): UnidadDeTrabajoPort<ContextoCertificacion> => ({
  ejecutar: async (empresaId, fn) => {
    const clave = (c: string) => `${empresaId}|${c}`;
    const copia = { ev: new Map(estado.evaluaciones), al: new Map(estado.alcances), ex: [...estado.eventos] };
    const evaluaciones: EvaluacionRepositoryPort = {
      listar: async () => [...estado.evaluaciones.entries()].filter(([k]) => k.startsWith(`${empresaId}|`)).map(([, v]) => v),
      obtener: async (codigo, id) => estado.evaluaciones.get(clave(`${codigo}|${id}`)) ?? null,
      crear: async (e) => {
        if (estado.carrera || estado.evaluaciones.has(clave(e.clave))) return false;
        estado.evaluaciones.set(clave(e.clave), e);
        return true;
      },
      actualizar: async (e, _u, _a, esperada) => {
        const actual = estado.evaluaciones.get(clave(e.clave));
        if (estado.carrera || !actual || actual.version !== esperada) return false;
        estado.evaluaciones.set(clave(e.clave), e);
        return true;
      },
    };
    const alcances: AlcanceRepositoryPort = {
      listar: async () => [...estado.alcances.entries()].filter(([k]) => k.startsWith(`${empresaId}|`)).map(([, v]) => v),
      obtener: async (norma) => estado.alcances.get(clave(norma)) ?? null,
      guardar: async (a) => void estado.alcances.set(clave(a.norma), a),
    };
    const contexto: ContextoCertificacion = {
      evaluaciones,
      alcances,
      bitacora: {
        registrar: async (evento) => {
          if (estado.fallarBitacora) throw new Error('bitácora no disponible');
          validarEvento(evento); // un evento mal formado haría fallar la acción real: aquí también
          estado.eventos.push(evento);
        },
      },
    };
    try {
      return await fn(contexto);
    } catch (e) {
      estado.evaluaciones = copia.ev;
      estado.alcances = copia.al;
      estado.eventos = copia.ex;
      throw e;
    }
  },
});
