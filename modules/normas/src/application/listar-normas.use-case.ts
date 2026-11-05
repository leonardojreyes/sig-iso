import type { NormasRepositoryPort } from './normas-repository.port.js';

export interface NormaDto {
  codigo: string;
  nombre: string;
  edicion: string;
}

export class ListarNormasUseCase {
  constructor(private readonly repo: NormasRepositoryPort) {}

  async ejecutar(): Promise<NormaDto[]> {
    const normas = await this.repo.listar();
    return normas
      .map((n) => ({ codigo: n.codigo, nombre: n.nombre, edicion: n.edicion }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }
}
