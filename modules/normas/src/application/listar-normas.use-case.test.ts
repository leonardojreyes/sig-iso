import { describe, expect, it } from 'vitest';
import { Norma } from '../domain/norma.js';
import { ListarNormasUseCase } from './listar-normas.use-case.js';

describe('ListarNormasUseCase', () => {
  it('devuelve las normas ordenadas por código', async () => {
    const repo = {
      listar: async () => [
        Norma.crear({ codigo: 'ISO/IEC 42001', nombre: 'IA', edicion: '2023' }),
        Norma.crear({ codigo: 'ISO 9001', nombre: 'Calidad', edicion: '2015' }),
      ],
    };
    const res = await new ListarNormasUseCase(repo).ejecutar();
    expect(res.map((n) => n.codigo)).toEqual(['ISO 9001', 'ISO/IEC 42001']);
  });
});
