import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { exigirUuid } from '../domain/errores.js';
import type { ContextoConsulta } from './contexto-adopcion.js';
import { aDto, type EntradaDto } from './entrada-dto.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

/**
 * Única respuesta para «no existe», «es de otra empresa» y «su librería no está adoptada»: quien consulta no puede
 * distinguirlas. No repite el identificador recibido.
 */
export class RequisitoNoEncontradoError extends Error {
  constructor() {
    super('Requisito no encontrado');
    this.name = 'RequisitoNoEncontradoError';
  }
}

export interface ObtenerRequisitoEntrada {
  /** Siempre la del token verificado. */
  readonly empresaId: EmpresaId;
  readonly id: string;
}

export class ObtenerRequisitoUseCase {
  constructor(private readonly unidad: UnidadDeTrabajoPort<ContextoConsulta>) {}

  async ejecutar(entrada: ObtenerRequisitoEntrada): Promise<EntradaDto> {
    const empresaId = crearEmpresaId(entrada.empresaId);
    const id = exigirUuid('id', typeof entrada.id === 'string' ? entrada.id.toLowerCase() : entrada.id);

    return this.unidad.ejecutar(empresaId, async ({ catalogo, adopciones }) => {
      const [encontrada, adoptadas] = await Promise.all([catalogo.obtenerEntrada(id), adopciones.listarLibreriaIds()]);
      // Defensa en profundidad: aunque el repositorio no aislara, la librería debe estar adoptada por ESTA empresa.
      if (encontrada === null || !adoptadas.includes(encontrada.libreriaId)) throw new RequisitoNoEncontradoError();
      return aDto(encontrada);
    });
  }
}
