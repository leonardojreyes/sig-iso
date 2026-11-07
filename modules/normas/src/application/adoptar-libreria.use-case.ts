import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { adoptar } from '../domain/adopcion-libreria.js';
import { exigirUuid } from '../domain/errores.js';
import type { AutorizacionPort, Permiso } from './autorizacion.port.js';
import type { ContextoAdopcion } from './contexto-adopcion.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

/** Quien intenta adoptar no tiene permiso. El registro de «acceso denegado» lo hace el filtro de la API, en su propia transacción. */
export class SinPermisoError extends Error {
  constructor(readonly permiso: Permiso) {
    super('Sin permiso para adoptar librerías');
    this.name = 'SinPermisoError';
  }
}

/** La librería no existe. No repite el identificador recibido. */
export class LibreriaNoEncontradaError extends Error {
  constructor() {
    super('Librería no encontrada');
    this.name = 'LibreriaNoEncontradaError';
  }
}

export interface AdoptarLibreriaEntrada {
  /** Siempre la del token verificado, nunca un dato del cliente. */
  readonly empresaId: EmpresaId;
  readonly usuarioId: string;
  readonly libreriaId: string;
  readonly traceId?: string;
}

/** Forma del contrato `Adopcion`. */
export interface AdopcionDto {
  readonly libreriaId: string;
  readonly entradas: number;
  readonly yaAdoptada: boolean;
  readonly adoptadaEn: string;
}

/**
 * Adopta una librería del catálogo para la empresa (H4.6–H4.10). Orden: entradas válidas → permiso → (unidad atómica)
 * librería → adopción → conteo → bitácora. El permiso va antes de mirar la librería para no revelar si existe.
 */
export class AdoptarLibreriaUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPort<ContextoAdopcion>,
    private readonly autorizacion: AutorizacionPort,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async ejecutar(entrada: AdoptarLibreriaEntrada): Promise<AdopcionDto> {
    const empresaId = crearEmpresaId(entrada.empresaId);
    const usuarioId = exigirUuid('usuarioId', entrada.usuarioId);
    const libreriaId = exigirUuid('libreriaId', entrada.libreriaId);

    if (!(await this.autorizacion.puede(usuarioId, 'librerias.adoptar', empresaId))) throw new SinPermisoError('librerias.adoptar');

    return this.unidad.ejecutar(empresaId, async ({ adopciones, catalogo, bitacora }) => {
      const libreria = await catalogo.obtenerLibreria(libreriaId);
      if (libreria === null) throw new LibreriaNoEncontradaError();

      let existente = await adopciones.obtener(libreriaId);
      let resultado = adoptar(existente, { empresaId, libreriaId, usuarioId, ahora: this.reloj() });
      if (!resultado.yaAdoptada && (await adopciones.crear(resultado.adopcion)) === 'ya_existia') {
        // Otra adopción simultánea ganó: no es un error, es «ya adoptada».
        existente = await adopciones.obtener(libreriaId);
        if (existente === null) throw new Error('La adopción existía y ya no se encuentra');
        resultado = adoptar(existente, { empresaId, libreriaId, usuarioId, ahora: this.reloj() });
      }

      const entradas = await catalogo.contarEntradas(libreriaId);
      await bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId },
        accion: 'libreria.adoptada',
        resultado: 'ok',
        ...(resultado.yaAdoptada ? { motivo: 'ya_adoptada' as const } : {}),
        objeto: `libreria:${libreria.codigo}`,
        objetoVersion: libreria.version,
        ...(entrada.traceId === undefined ? {} : { traceId: entrada.traceId }),
        antes: { adoptada: resultado.yaAdoptada },
        despues: { adoptada: true, entradas },
      });
      return { libreriaId, entradas, yaAdoptada: resultado.yaAdoptada, adoptadaEn: resultado.adopcion.adoptadaEn.toISOString() };
    });
  }
}
