// Fakes para probar los casos de uso sin base de datos. La unidad de trabajo REVIERTE de verdad (copia del estado) y la
// adopción respeta el aislamiento por empresa como lo haría la RLS: cada empresa ve solo lo suyo.
import { validarEvento, type EventoBitacora, type RegistroBitacora } from '@sig/auditoria';
import type { EmpresaId } from '@sig/tenancy';
import type { AdopcionLibreria } from '../../domain/adopcion-libreria.js';
import type { Libreria } from '../../domain/libreria.js';
import type { AdopcionRepositoryPort } from '../adopcion-repository.port.js';
import type { CatalogoRepositoryPort } from '../catalogo-repository.port.js';
import type { ContextoAdopcion } from '../contexto-adopcion.js';
import type { UnidadDeTrabajoPort } from '../unidad-de-trabajo.port.js';

export class EstadoFalso {
  /** Clave `empresa|libreria`. */
  adopciones = new Map<string, AdopcionLibreria>();
  bitacora: RegistroBitacora[] = [];
  /** Cuántas veces se abrió una unidad y para qué empresas. */
  unidades: EmpresaId[] = [];
  /** Fallos a provocar: nombre de la operación → error. */
  fallos = new Map<string, Error>();
  /** Carrera entre dos adopciones: al `crear`, otra adopción simultánea ya se guardó (esta) y `crear` responde `ya_existia`. */
  ganadora: AdopcionLibreria | null = null;

  constructor(
    readonly libreria: Libreria | null,
    readonly entradas: number,
  ) {}

  falla(operacion: string): void {
    const e = this.fallos.get(operacion);
    if (e) throw e;
  }
}

const clave = (e: EmpresaId, l: string) => `${e}|${l}`;

export const crearUnidadDeTrabajoFalsa = (estado: EstadoFalso): UnidadDeTrabajoPort<ContextoAdopcion> => ({
  ejecutar: async (empresaId, fn) => {
    estado.unidades.push(empresaId);
    const copiaAdopciones = new Map(estado.adopciones);
    const copiaBitacora = [...estado.bitacora];
    const adopciones: AdopcionRepositoryPort = {
      obtener: async (libreriaId) => {
        estado.falla('obtener');
        return estado.adopciones.get(clave(empresaId, libreriaId)) ?? null;
      },
      crear: async (adopcion) => {
        estado.falla('crear');
        const k = clave(empresaId, adopcion.libreriaId);
        if (adopcion.empresaId !== empresaId) throw new Error('RLS: la adopción no es de la empresa del contexto');
        if (estado.ganadora) {
          estado.adopciones.set(k, estado.ganadora);
          return 'ya_existia';
        }
        if (estado.adopciones.has(k)) return 'ya_existia';
        estado.adopciones.set(k, adopcion);
        return 'creada';
      },
    };
    const catalogo: CatalogoRepositoryPort = {
      obtenerLibreria: async (id) => {
        estado.falla('obtenerLibreria');
        return estado.libreria?.id === id ? estado.libreria : null;
      },
      // Como la RLS: las entradas solo se ven si la empresa adoptó la librería.
      contarEntradas: async (libreriaId) => {
        estado.falla('contarEntradas');
        return estado.adopciones.has(clave(empresaId, libreriaId)) ? estado.entradas : 0;
      },
    };
    const bitacora = {
      registrar: async (evento: EventoBitacora) => {
        estado.falla('bitacora');
        if (evento.empresaId !== empresaId) throw new Error('RLS: el registro no es de la empresa del contexto');
        estado.bitacora.push(validarEvento(evento));
      },
    };
    try {
      return await fn({ adopciones, catalogo, bitacora });
    } catch (error) {
      estado.adopciones = copiaAdopciones;
      estado.bitacora = copiaBitacora;
      throw error;
    }
  },
});
