import { describe, expect, it } from 'vitest';
import { AprobarAlcanceUseCase, GuardarAlcanceUseCase, ListarAlcancesUseCase } from './alcance.use-cases.js';
import { ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, LIB, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/fakes.js';

const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas]);
  estado.catalogoPorEmpresa.set(B, [{ ...entradas.politicas, libreriaId: LIB }]);
  estado.conceder(ADMIN, A, 'alcance.ver', 'alcance.gestionar', 'alcance.aprobar');
  estado.conceder(COLAB, A, 'alcance.ver');
  estado.conceder(ADMIN, B, 'alcance.ver', 'alcance.gestionar', 'alcance.aprobar');
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 10, 12, 0, t++));
  const args = [crearUnidadFalsa(estado), crearAutorizacionFalsa(estado), crearCatalogoFalso(estado)] as const;
  return { estado, listar: new ListarAlcancesUseCase(...args), guardar: new GuardarAlcanceUseCase(...args, reloj), aprobar: new AprobarAlcanceUseCase(...args, reloj) };
};
const N = 'ISO/IEC 27001';
const yo = { empresaId: A, usuarioId: ADMIN };

describe('alcance', () => {
  it('lista cada norma adoptada, «sin definir» hasta que se escribe', async () => {
    const { listar } = montar();
    expect(await listar.ejecutar({ ...yo, usuarioId: COLAB })).toEqual([
      { norma: 'ISO 9001', texto: null, aprobado: false, aprobadoEn: null, actualizadoEn: null },
      { norma: N, texto: null, aprobado: false, aprobadoEn: null, actualizadoEn: null },
    ]);
  });

  it('guardar crea el alcance sin aprobar y registra el hecho sin el texto', async () => {
    const { guardar, estado } = montar();
    const r = await guardar.ejecutar({ ...yo, norma: N, texto: 'SECRETO: los sistemas de la oficina de Quito.' });
    expect(r).toMatchObject({ norma: N, aprobado: false });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'alcance.cambiado', objeto: 'alcance:iso-iec-27001', antes: { aprobado: false }, despues: { aprobado: false } })]);
    expect(JSON.stringify(estado.eventos)).not.toContain('SECRETO');
  });

  it('aprobar fija quién y cuándo y queda registrado', async () => {
    const { guardar, aprobar, estado } = montar();
    await guardar.ejecutar({ ...yo, norma: N, texto: 'Alcance de prueba' });
    const r = await aprobar.ejecutar({ ...yo, norma: N });
    expect(r.aprobado).toBe(true);
    expect(r.aprobadoEn).not.toBeNull();
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'alcance.aprobado', objeto: 'alcance:iso-iec-27001' });
  });

  it('cambiar el texto de un alcance aprobado lo devuelve a «sin aprobar» y lo registra', async () => {
    const { guardar, aprobar, estado } = montar();
    await guardar.ejecutar({ ...yo, norma: N, texto: 'Primero' });
    await aprobar.ejecutar({ ...yo, norma: N });
    const r = await guardar.ejecutar({ ...yo, norma: N, texto: 'Distinto' });
    expect(r.aprobado).toBe(false);
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'alcance.cambiado', antes: { aprobado: true }, despues: { aprobado: false } });
  });

  it('guardar el mismo texto no cambia nada ni registra, y conserva la aprobación', async () => {
    const { guardar, aprobar, estado } = montar();
    await guardar.ejecutar({ ...yo, norma: N, texto: 'Igual' });
    await aprobar.ejecutar({ ...yo, norma: N });
    const antes = estado.eventos.length;
    const r = await guardar.ejecutar({ ...yo, norma: N, texto: ' Igual ' });
    expect(r.aprobado).toBe(true);
    expect(estado.eventos).toHaveLength(antes);
  });

  it('no se puede aprobar dos veces ni aprobar algo sin definir', async () => {
    const { guardar, aprobar } = montar();
    await expect(aprobar.ejecutar({ ...yo, norma: N })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await guardar.ejecutar({ ...yo, norma: N, texto: 'Texto' });
    await aprobar.ejecutar({ ...yo, norma: N });
    await expect(aprobar.ejecutar({ ...yo, norma: N })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('el colaborador consulta pero no define ni aprueba', async () => {
    const { guardar, aprobar, estado } = montar();
    await expect(guardar.ejecutar({ ...yo, usuarioId: COLAB, norma: N, texto: 'x' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(aprobar.ejecutar({ ...yo, usuarioId: COLAB, norma: N })).rejects.toBeInstanceOf(SinPermisoError);
    expect(estado.alcances.size).toBe(0);
  });

  it('solo hay alcance de las normas que la empresa adoptó (404 si no)', async () => {
    const { guardar, aprobar } = montar();
    await expect(guardar.ejecutar({ ...yo, norma: 'ISO/IEC 42001', texto: 'x' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(aprobar.ejecutar({ ...yo, norma: 'ISO/IEC 42001' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('un texto vacío o demasiado largo es un parámetro inválido', async () => {
    const { guardar } = montar();
    for (const texto of ['   ', 'x'.repeat(4001)]) await expect(guardar.ejecutar({ ...yo, norma: N, texto })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('si la bitácora falla, el alcance se revierte', async () => {
    const { guardar, estado } = montar();
    estado.fallarBitacora = true;
    await expect(guardar.ejecutar({ ...yo, norma: N, texto: 'Texto' })).rejects.toThrow('bitácora');
    expect(estado.alcances.size).toBe(0);
  });

  it('AISLAMIENTO: el alcance de A no lo ve B ni se mezcla con el de B', async () => {
    const { guardar, listar } = montar();
    await guardar.ejecutar({ ...yo, norma: N, texto: 'Alcance de A' });
    const deB = await listar.ejecutar({ empresaId: B, usuarioId: ADMIN });
    expect(deB).toEqual([{ norma: N, texto: null, aprobado: false, aprobadoEn: null, actualizadoEn: null }]);
    await guardar.ejecutar({ empresaId: B, usuarioId: ADMIN, norma: N, texto: 'Alcance de B' });
    expect((await listar.ejecutar(yo)).find((a) => a.norma === N)!.texto).toBe('Alcance de A');
  });
});
