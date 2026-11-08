import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { crearMarca, type MarcaEmpresa } from '../domain/marca-empresa.js';
import type { EmpresaRepositoryPort } from './empresa-repository.port.js';

/** No hay una empresa visible con ese identificador. No distingue «no existe» de «es de otra empresa» y no repite el valor. */
export class EmpresaNoEncontradaError extends Error {
  constructor() {
    super('Empresa no encontrada');
    this.name = 'EmpresaNoEncontradaError';
  }
}

/** Marca de la empresa de quien consulta. La empresa sale solo del token verificado (nunca de parámetros del cliente). */
export class ObtenerMarcaUseCase {
  constructor(private readonly repo: EmpresaRepositoryPort) {}

  async ejecutar(empresa: EmpresaId): Promise<MarcaEmpresa> {
    const empresaId = crearEmpresaId(empresa);
    const datos = await this.repo.obtenerPropia(empresaId);
    // Defensa en profundidad: aunque el repositorio fallara en aislar, jamás se construye la marca de otra empresa.
    if (datos === null || datos.id !== empresaId) throw new EmpresaNoEncontradaError();
    return crearMarca({ nombre: datos.nombre, colorPrimario: datos.colorPrimario, logoUrl: datos.logoUrl });
  }
}
