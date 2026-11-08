import { EmpresaIdInvalidoError } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { ListarLibreriasUseCase } from './listar-librerias.use-case.js';
import { A, B, LIB1, LIB2, libreria1, libreria2, USUARIO } from './prueba/datos.js';
import { crearUnidadDeTrabajoFalsa, EstadoFalso } from './prueba/fakes.js';
import { AdopcionLibreria } from '../domain/adopcion-libreria.js';
import { Libreria } from '../domain/libreria.js';

const montar = (librerias = [libreria2, libreria1]) => {
  const estado = new EstadoFalso(null, 0);
  estado.librerias = librerias;
  return { estado, caso: new ListarLibreriasUseCase(crearUnidadDeTrabajoFalsa(estado)) };
};
const adoptar = (estado: EstadoFalso, empresaId: typeof A, libreriaId: string) =>
  estado.adopciones.set(`${empresaId}|${libreriaId}`, AdopcionLibreria.crear({ empresaId, libreriaId, usuarioId: USUARIO, ahora: new Date('2026-11-06T00:00:00Z') }));

describe('ListarLibrerias', () => {
  it('lista todo el catálogo con la forma del contrato y adoptada=false si no adoptó ninguna', async () => {
    const { caso } = montar();
    expect(await caso.ejecutar(A)).toEqual([
      { id: LIB2, codigo: 'ejemplo-dos', nombre: 'Ejemplo dos', version: '2.1.0', esEjemplo: false, fuente: 'propia', adoptada: false },
      { id: LIB1, codigo: 'ejemplo-uno', nombre: 'Ejemplo uno', version: '1.0.0', esEjemplo: true, fuente: 'propia', adoptada: false },
    ]);
  });

  it('el orden es estable: por código y, dentro del código, por versión numérica (1.2.0 antes que 1.10.0)', async () => {
    const v = (id: string, codigo: string, version: string) => Libreria.crear({ id, codigo, nombre: 'N', version, esEjemplo: false, fuente: 'f' });
    const { caso } = montar([
      v('33333333-3333-4333-8333-333333333333', 'zeta', '1.0.0'),
      v('44444444-4444-4444-8444-444444444441', 'alfa', '1.10.0'),
      v('44444444-4444-4444-8444-444444444442', 'alfa', '1.2.0'),
    ]);
    expect((await caso.ejecutar(A)).map((l) => `${l.codigo}@${l.version}`)).toEqual(['alfa@1.2.0', 'alfa@1.10.0', 'zeta@1.0.0']);
  });

  it('marca adoptada solo las que adoptó LA empresa (H4.8): A adopta, B no', async () => {
    const { caso, estado } = montar();
    adoptar(estado, A, LIB1);
    expect((await caso.ejecutar(A)).map((l) => [l.codigo, l.adoptada])).toEqual([['ejemplo-dos', false], ['ejemplo-uno', true]]);
    expect((await caso.ejecutar(B)).every((l) => !l.adoptada)).toBe(true);
  });

  it('no expone campos fuera del contrato (hash, orden, etc.)', async () => {
    const { caso } = montar();
    const [primera] = await caso.ejecutar(A);
    expect(Object.keys(primera!).sort()).toEqual(['adoptada', 'codigo', 'esEjemplo', 'fuente', 'id', 'nombre', 'version']);
  });

  it('un catálogo vacío da lista vacía', async () => {
    expect(await montar([]).caso.ejecutar(A)).toEqual([]);
  });

  it('más librerías que el tope del contrato (200) es un error, no un truncado silencioso', async () => {
    const muchas = Array.from({ length: 201 }, (_, i) => Libreria.crear({ id: `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`, codigo: `l-${i}`, nombre: 'N', version: '1.0.0', esEjemplo: false, fuente: 'f' }));
    await expect(montar(muchas).caso.ejecutar(A)).rejects.toThrow(/tope/);
  });

  it.each(['no-uuid', undefined, '00000000-0000-0000-0000-000000000000'])('rechaza la empresa %j sin consultar', async (id) => {
    const { caso, estado } = montar();
    await expect(caso.ejecutar(id as never)).rejects.toBeInstanceOf(EmpresaIdInvalidoError);
    expect(estado.unidades).toEqual([]);
  });

  it('usa una sola unidad de trabajo, la de la empresa pedida', async () => {
    const { caso, estado } = montar();
    await caso.ejecutar(B);
    expect(estado.unidades).toEqual([B]);
  });

  it('los errores del repositorio se propagan', async () => {
    const { caso, estado } = montar();
    estado.fallos.set('listarLibrerias', new Error('base caída'));
    await expect(caso.ejecutar(A)).rejects.toThrow('base caída');
  });
});
