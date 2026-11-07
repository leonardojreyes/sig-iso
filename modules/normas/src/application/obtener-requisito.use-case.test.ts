import { EmpresaIdInvalidoError } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { AdopcionLibreria } from '../domain/adopcion-libreria.js';
import { ParametroInvalidoError } from './parametro-invalido.error.js';
import { ObtenerRequisitoUseCase, RequisitoNoEncontradoError } from './obtener-requisito.use-case.js';
import { A, B, E, LIB1, LIB2, libreria1, libreria2, USUARIO } from './prueba/datos.js';
import { crearUnidadDeTrabajoFalsa, EstadoFalso } from './prueba/fakes.js';

const montar = () => {
  const estado = new EstadoFalso(null, 0);
  estado.librerias = [libreria1, libreria2];
  estado.entradasCatalogo = [E.contexto, E.otra];
  return { estado, caso: new ObtenerRequisitoUseCase(crearUnidadDeTrabajoFalsa(estado)) };
};
const adoptar = (estado: EstadoFalso, empresaId: typeof A, libreriaId: string) =>
  estado.adopciones.set(`${empresaId}|${libreriaId}`, AdopcionLibreria.crear({ empresaId, libreriaId, usuarioId: USUARIO, ahora: new Date('2026-11-06T00:00:00Z') }));
const errorDe = async (p: Promise<unknown>): Promise<Error> => {
  try { await p; } catch (e) { return e as Error; }
  throw new Error('Se esperaba un error');
};
const INEXISTENTE = 'f0000000-0000-4000-8000-000000000999';

describe('ObtenerRequisito', () => {
  it('devuelve la entrada de una librería adoptada, con la forma del contrato', async () => {
    const { caso, estado } = montar();
    adoptar(estado, A, LIB1);
    const r = await caso.ejecutar({ empresaId: A, id: E.contexto.id });
    expect(r).toMatchObject({ id: E.contexto.id, idEstable: 'ha-contexto', libreriaId: LIB1, capitulo: 4, nivel: 1, alcanceComun: 'comun', esEjemplo: true });
    expect(Object.keys(r).sort()).toEqual(['alcanceComun', 'aplicaA', 'capitulo', 'esEjemplo', 'guia', 'id', 'idEstable', 'libreriaId', 'nivel', 'titulo']);
  });

  describe('404 indistinguible (spec, contrato)', () => {
    it('«no existe», «es de otra empresa» y «su librería no está adoptada» dan el MISMO error y mensaje', async () => {
      const { caso, estado } = montar();
      adoptar(estado, A, LIB1); // A adoptó LIB1; B no adoptó nada; LIB2 no la adoptó nadie
      const noExiste = await errorDe(caso.ejecutar({ empresaId: A, id: INEXISTENTE }));
      const deOtraEmpresa = await errorDe(caso.ejecutar({ empresaId: B, id: E.contexto.id }));
      const noAdoptada = await errorDe(caso.ejecutar({ empresaId: A, id: E.otra.id }));
      for (const e of [noExiste, deOtraEmpresa, noAdoptada]) expect(e).toBeInstanceOf(RequisitoNoEncontradoError);
      expect(new Set([noExiste.message, deOtraEmpresa.message, noAdoptada.message]).size).toBe(1);
      expect(noExiste.message).not.toContain(INEXISTENTE);
      expect(deOtraEmpresa.message).not.toContain(E.contexto.id);
    });

    it('aunque el repositorio no aislara, el caso de uso no entrega una entrada de librería no adoptada', async () => {
      const { caso, estado } = montar();
      estado.sinAislamiento = true;
      await expect(caso.ejecutar({ empresaId: B, id: E.contexto.id })).rejects.toBeInstanceOf(RequisitoNoEncontradoError);
      adoptar(estado, B, LIB2);
      await expect(caso.ejecutar({ empresaId: B, id: E.contexto.id })).rejects.toBeInstanceOf(RequisitoNoEncontradoError);
      expect((await caso.ejecutar({ empresaId: B, id: E.otra.id })).idEstable).toBe('ha-otra');
    });

    it('al adoptar B la librería, B ya la ve; A sigue viendo la suya', async () => {
      const { caso, estado } = montar();
      adoptar(estado, A, LIB1);
      adoptar(estado, B, LIB1);
      expect((await caso.ejecutar({ empresaId: B, id: E.contexto.id })).id).toBe(E.contexto.id);
      expect((await caso.ejecutar({ empresaId: A, id: E.contexto.id })).id).toBe(E.contexto.id);
    });
  });

  describe('identificador mal formado (400)', () => {
    it.each([
      'no-es-uuid', '', '{e0000000-0000-4000-8000-000000000001}', 'e0000000000040008000000000000001',
      "' or 1=1 --", undefined, 7,
    ])('rechaza %j con ParametroInvalidoError sin consultar', async (id) => {
      const { caso, estado } = montar();
      adoptar(estado, A, LIB1);
      await expect(caso.ejecutar({ empresaId: A, id: id as never })).rejects.toBeInstanceOf(ParametroInvalidoError);
      expect(estado.unidades).toEqual([]);
    });

    it('el UUID nulo está bien formado: se busca y no existe (404, no 400)', async () => {
      const { caso } = montar();
      await expect(caso.ejecutar({ empresaId: A, id: '00000000-0000-0000-0000-000000000000' })).rejects.toBeInstanceOf(RequisitoNoEncontradoError);
    });

    it('acepta un UUID en mayúsculas normalizándolo', async () => {
      const { caso, estado } = montar();
      adoptar(estado, A, LIB1);
      expect((await caso.ejecutar({ empresaId: A, id: E.contexto.id.toUpperCase() })).id).toBe(E.contexto.id);
    });
  });

  it('empresa inválida: error de identificador y nada consultado', async () => {
    const { caso, estado } = montar();
    await expect(caso.ejecutar({ empresaId: 'x' as never, id: E.contexto.id })).rejects.toBeInstanceOf(EmpresaIdInvalidoError);
    expect(estado.unidades).toEqual([]);
  });

  it('los errores del repositorio se propagan (no se convierten en 404)', async () => {
    const { caso, estado } = montar();
    adoptar(estado, A, LIB1);
    estado.fallos.set('obtenerEntrada', new Error('base caída'));
    await expect(caso.ejecutar({ empresaId: A, id: E.contexto.id })).rejects.toThrow('base caída');
  });
});
