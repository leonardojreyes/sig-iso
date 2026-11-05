import type { NormasRepositoryPort } from '../application/normas-repository.port.js';
import { Norma } from '../domain/norma.js';

/** Datos de ejemplo del esqueleto; se reemplaza por PostgreSQL + librerías YAML en el paso 0.6. */
export class NormasEnMemoriaRepository implements NormasRepositoryPort {
  private readonly normas = [
    Norma.crear({ codigo: 'ISO 9001', nombre: 'Gestión de la calidad', edicion: '2015' }),
    Norma.crear({ codigo: 'ISO/IEC 27001', nombre: 'Seguridad de la información', edicion: '2022' }),
    Norma.crear({ codigo: 'ISO/IEC 42001', nombre: 'Sistemas de gestión de IA', edicion: '2023' }),
  ];

  async listar(): Promise<Norma[]> {
    return [...this.normas];
  }
}
