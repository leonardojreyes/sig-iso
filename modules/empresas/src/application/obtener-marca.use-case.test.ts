import { crearEmpresaId, EmpresaIdInvalidoError, type EmpresaId } from '@sig/tenancy';
import { describe, expect, it, vi } from 'vitest';
import { ErrorMarca } from '../domain/marca-empresa.js';
import { EmpresaNoEncontradaError, ObtenerMarcaUseCase } from './obtener-marca.use-case.js';
import type { DatosEmpresa, EmpresaRepositoryPort } from './empresa-repository.port.js';

const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const C = crearEmpresaId('cccccccc-cccc-4ccc-8ccc-cccccccccccc');

const datos: Record<string, DatosEmpresa> = {
  [A]: { id: A, nombre: 'Alfa', colorPrimario: '#0b5fff', logoUrl: 'https://cdn.alfa.ec/logo.png' },
  [B]: { id: B, nombre: 'Beta', colorPrimario: '#ffe066', logoUrl: '/logos/beta.png' },
};

/** Fake que imita la RLS: solo ve la fila de la empresa del contexto, aunque guarde las de todas. */
const fakeConAislamiento = () => {
  const llamadas: EmpresaId[] = [];
  const repo: EmpresaRepositoryPort = {
    obtenerPropia: async (empresaId) => {
      llamadas.push(empresaId);
      return datos[empresaId] ?? null;
    },
  };
  return { repo, llamadas };
};

describe('ObtenerMarcaUseCase', () => {
  it('devuelve la marca de la empresa del contexto', async () => {
    const { repo } = fakeConAislamiento();
    const m = await new ObtenerMarcaUseCase(repo).ejecutar(A);
    expect(m).toMatchObject({ nombre: 'Alfa', colorPrimario: '#0b5fff', logoUrl: 'https://cdn.alfa.ec/logo.png', ajustadoPorContraste: false });
  });

  it('aplica las reglas de dominio: ajusta el color y descarta el logo no permitido', async () => {
    const repo: EmpresaRepositoryPort = {
      obtenerPropia: async (id) => ({ id, nombre: 'Gama Sur', colorPrimario: '#ffe066', logoUrl: 'http://inseguro.ec/l.png' }),
    };
    const m = await new ObtenerMarcaUseCase(repo).ejecutar(A);
    expect(m.ajustadoPorContraste).toBe(true);
    expect(m.colorOriginal).toBe('#ffe066');
    expect(m.logoUrl).toBeNull();
    expect(m.monograma).toBe('GS');
  });

  describe('aislamiento entre empresas (H3.1)', () => {
    it('A obtiene solo la marca de A y B solo la de B; ninguna contiene datos de la otra', async () => {
      const { repo } = fakeConAislamiento();
      const caso = new ObtenerMarcaUseCase(repo);
      const deA = JSON.stringify(await caso.ejecutar(A));
      const deB = JSON.stringify(await caso.ejecutar(B));
      expect(deA).not.toMatch(/Beta|beta\.png|ffe066/i);
      expect(deB).not.toMatch(/Alfa|alfa\.ec|0b5fff/i);
    });

    it('el caso de uso pide al repositorio únicamente la empresa recibida, sin otro parámetro', async () => {
      const { repo, llamadas } = fakeConAislamiento();
      const espia = vi.spyOn(repo, 'obtenerPropia');
      await new ObtenerMarcaUseCase(repo).ejecutar(A);
      expect(llamadas).toEqual([A]);
      expect(espia.mock.calls[0]).toEqual([A]);
    });

    it('una empresa sin fila visible (inexistente o de otra empresa) da EmpresaNoEncontradaError sin revelar nada', async () => {
      const { repo } = fakeConAislamiento();
      const error = await new ObtenerMarcaUseCase(repo).ejecutar(C).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(EmpresaNoEncontradaError);
      expect((error as Error).message).not.toContain(C);
    });

    it('si el repositorio devolviera la fila de otra empresa, el caso de uso lo rechaza (defensa en profundidad)', async () => {
      const cruzado: EmpresaRepositoryPort = { obtenerPropia: async () => datos[B]! };
      await expect(new ObtenerMarcaUseCase(cruzado).ejecutar(A)).rejects.toBeInstanceOf(EmpresaNoEncontradaError);
    });
  });

  describe('entradas inválidas', () => {
    it.each(['', 'no-es-uuid', '00000000-0000-0000-0000-000000000000', undefined, null, 42])('rechaza el identificador %j sin consultar', async (id) => {
      const obtenerPropia = vi.fn();
      await expect(new ObtenerMarcaUseCase({ obtenerPropia }).ejecutar(id as never)).rejects.toBeInstanceOf(EmpresaIdInvalidoError);
      expect(obtenerPropia).not.toHaveBeenCalled();
    });

    it('un dato corrupto en la base (color inválido) falla con ErrorMarca, no se devuelve algo a medias', async () => {
      const repo: EmpresaRepositoryPort = { obtenerPropia: async (id) => ({ id, nombre: 'X', colorPrimario: 'rojo', logoUrl: null }) };
      await expect(new ObtenerMarcaUseCase(repo).ejecutar(A)).rejects.toBeInstanceOf(ErrorMarca);
    });

    it('los errores del repositorio se propagan (no se tragan)', async () => {
      const repo: EmpresaRepositoryPort = { obtenerPropia: async () => { throw new Error('base caída'); } };
      await expect(new ObtenerMarcaUseCase(repo).ejecutar(A)).rejects.toThrow('base caída');
    });
  });
});
