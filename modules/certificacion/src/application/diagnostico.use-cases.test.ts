import { describe, expect, it } from 'vitest';
import { EvaluarEntradaUseCase } from './evaluar-entrada.use-case.js';
import { ListarDiagnosticoUseCase } from './listar-diagnostico.use-case.js';
import { ConflictoDeVersionError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, LIB, LIB_V2, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/fakes.js';

const AHORA = new Date('2026-11-10T12:00:00Z');
const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [{ ...entradas.politicas, libreriaId: LIB_V2 }]);
  estado.conceder(ADMIN, A, 'diagnostico.ver', 'diagnostico.evaluar');
  estado.conceder(COLAB, A, 'diagnostico.ver', 'diagnostico.evaluar');
  estado.conceder(ADMIN, B, 'diagnostico.ver', 'diagnostico.evaluar');
  const args = [crearUnidadFalsa(estado), crearAutorizacionFalsa(estado), crearCatalogoFalso(estado)] as const;
  return { estado, listar: new ListarDiagnosticoUseCase(...args), evaluar: new EvaluarEntradaUseCase(...args, () => AHORA) };
};
const base = { empresaId: A, usuarioId: ADMIN, libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' };

describe('EvaluarEntrada', () => {
  it('evalúa por primera vez: versión 1, la librería queda fijada y se registra el hecho', async () => {
    const { evaluar, estado } = montar();
    const r = await evaluar.ejecutar({ ...base, estado: 'parcial', comentario: 'Hay una política sin aprobar', fechaObjetivo: '2026-12-31' });
    expect(r).toMatchObject({ estado: 'parcial', version: 1, comentario: 'Hay una política sin aprobar', fechaObjetivo: '2026-12-31' });
    expect([...estado.evaluaciones.values()][0]!.libreriaId).toBe(LIB);
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'evaluacion.cambiada', objeto: 'evaluacion:iso-27001-2022-anexo-a.a27-5-1', antes: { estado: 'sin_evaluar' }, despues: { estado: 'parcial' } })]);
  });

  it('el comentario NUNCA llega a la bitácora', async () => {
    const { evaluar, estado } = montar();
    await evaluar.ejecutar({ ...base, estado: 'no_aplica', comentario: 'SECRETO-DE-LA-EMPRESA no tenemos desarrollo propio' });
    expect(JSON.stringify(estado.eventos)).not.toContain('SECRETO');
  });

  it('volver a evaluar exige la versión vista, la sube y registra el estado anterior y el nuevo', async () => {
    const { evaluar, estado } = montar();
    await evaluar.ejecutar({ ...base, estado: 'parcial' });
    const r = await evaluar.ejecutar({ ...base, estado: 'cumple', versionEsperada: 1 });
    expect(r).toMatchObject({ estado: 'cumple', version: 2 });
    expect(estado.eventos.at(-1)).toMatchObject({ antes: { estado: 'parcial' }, despues: { estado: 'cumple' } });
  });

  it('dos personas a la vez: la segunda recibe un conflicto y no pisa a la primera (H4.6)', async () => {
    const { evaluar, estado } = montar();
    await evaluar.ejecutar({ ...base, estado: 'parcial' });
    await evaluar.ejecutar({ ...base, usuarioId: COLAB, estado: 'cumple', versionEsperada: 1 });
    await expect(evaluar.ejecutar({ ...base, estado: 'no_cumple', versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    expect([...estado.evaluaciones.values()][0]!.estado).toBe('cumple');
    expect(estado.eventos).toHaveLength(2);
  });

  it('sin versión sobre algo ya evaluado es un conflicto; con versión sobre algo nuevo también', async () => {
    const { evaluar } = montar();
    await evaluar.ejecutar({ ...base, estado: 'parcial' });
    await expect(evaluar.ejecutar({ ...base, estado: 'cumple' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(evaluar.ejecutar({ ...base, idEstable: 'a27-5-2', estado: 'cumple', versionEsperada: 3 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });

  it('una carrera detectada al escribir también es un conflicto, y no queda nada', async () => {
    const { evaluar, estado } = montar();
    estado.carrera = true;
    await expect(evaluar.ejecutar({ ...base, estado: 'cumple' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    expect(estado.evaluaciones.size).toBe(0);
    expect(estado.eventos).toEqual([]);
  });

  it('sin cambios no escribe, no sube la versión y no registra nada', async () => {
    const { evaluar, estado } = montar();
    await evaluar.ejecutar({ ...base, estado: 'parcial', comentario: 'igual' });
    const r = await evaluar.ejecutar({ ...base, estado: 'parcial', comentario: ' igual ', versionEsperada: 1 });
    expect(r.version).toBe(1);
    expect(estado.eventos).toHaveLength(1);
  });

  it('si la bitácora falla, la evaluación se revierte (acción y registro juntos)', async () => {
    const { evaluar, estado } = montar();
    estado.fallarBitacora = true;
    await expect(evaluar.ejecutar({ ...base, estado: 'cumple' })).rejects.toThrow('bitácora');
    expect(estado.evaluaciones.size).toBe(0);
  });

  it('«no aplica» sin justificación es un parámetro inválido', async () => {
    const { evaluar } = montar();
    await expect(evaluar.ejecutar({ ...base, estado: 'no_aplica' })).rejects.toMatchObject({ parametro: 'comentario' });
  });

  it('sin permiso: 403 y no se evalúa nada', async () => {
    const { evaluar, estado } = montar();
    estado.permisos.clear();
    await expect(evaluar.ejecutar({ ...base, estado: 'cumple' })).rejects.toBeInstanceOf(SinPermisoError);
    expect(estado.evaluaciones.size).toBe(0);
  });

  it('una entrada que la empresa no adoptó no existe (404), aunque exista en otra empresa', async () => {
    const { evaluar, estado } = montar();
    await expect(evaluar.ejecutar({ ...base, libreriaCodigo: 'otra', estado: 'cumple' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    estado.catalogoPorEmpresa.set(A, [entradas.contexto]);
    await expect(evaluar.ejecutar({ ...base, estado: 'cumple' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('valida la versión esperada', async () => {
    const { evaluar } = montar();
    for (const v of [-1, 1.5]) await expect(evaluar.ejecutar({ ...base, estado: 'cumple', versionEsperada: v })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('AISLAMIENTO: lo evaluado por A no aparece ni cuenta para B', async () => {
    const { evaluar, listar } = montar();
    await evaluar.ejecutar({ ...base, estado: 'cumple' });
    const deB = await listar.ejecutar({ empresaId: B, usuarioId: ADMIN });
    expect(deB.filas.every((f) => f.evaluacion === null)).toBe(true);
    await evaluar.ejecutar({ ...base, empresaId: B, estado: 'no_cumple' });
    const deA = await listar.ejecutar({ empresaId: A, usuarioId: ADMIN });
    expect(deA.filas.find((f) => f.idEstable === 'a27-5-1')!.evaluacion).toMatchObject({ estado: 'cumple', version: 1 });
  });
});

describe('ListarDiagnostico', () => {
  const evaluarTodo = async () => {
    const m = montar();
    await m.evaluar.ejecutar({ ...base, estado: 'cumple' });
    await m.evaluar.ejecutar({ ...base, idEstable: 'a27-5-2', estado: 'no_aplica', comentario: 'No aplica a nuestra operación' });
    return m;
  };

  it('devuelve todas las entradas adoptadas con su evaluación (o sin evaluar)', async () => {
    const { listar } = await evaluarTodo();
    const r = await listar.ejecutar({ empresaId: A, usuarioId: COLAB });
    expect(r.filas.map((f) => [f.idEstable, f.evaluacion?.estado ?? null])).toEqual([['ha-4.1', null], ['a27-5-1', 'cumple'], ['a27-5-2', 'no_aplica']]);
    expect(r.normas).toEqual(['ISO 9001', 'ISO/IEC 27001']);
  });

  it('filtra por norma, tipo, estado (incluido «sin evaluar») y texto', async () => {
    const { listar } = await evaluarTodo();
    const ids = async (f: object) => (await listar.ejecutar({ empresaId: A, usuarioId: ADMIN, ...f } as never)).filas.map((x) => x.idEstable);
    expect(await ids({ norma: 'ISO 9001' })).toEqual(['ha-4.1']);
    expect(await ids({ tipo: 'control' })).toEqual(['a27-5-1', 'a27-5-2']);
    expect(await ids({ estado: 'sin_evaluar' })).toEqual(['ha-4.1']);
    expect(await ids({ estado: 'cumple' })).toEqual(['a27-5-1']);
    expect(await ids({ q: 'organizacionales' })).toEqual(['a27-5-1', 'a27-5-2']);
    expect(await ids({ q: 'A.5.2' })).toEqual(['a27-5-2']);
  });

  it('la madurez se calcula sobre la norma elegida y no cambia con los demás filtros', async () => {
    const { listar } = await evaluarTodo();
    const completa = await listar.ejecutar({ empresaId: A, usuarioId: ADMIN, norma: 'ISO/IEC 27001' });
    const filtrada = await listar.ejecutar({ empresaId: A, usuarioId: ADMIN, norma: 'ISO/IEC 27001', tipo: 'control', estado: 'cumple' });
    expect(filtrada.madurez).toEqual(completa.madurez);
    expect(completa.madurez.porNorma['ISO/IEC 27001']).toMatchObject({ cumple: 1, noAplica: 1, sinEvaluar: 1, total: 3, porcentaje: 100 });
    expect(completa.madurez.clausulas).toMatchObject({ total: 1, sinEvaluar: 1, porcentaje: null });
  });

  it.each([['q', 'a%'], ['norma', 'ISO;DROP'], ['tipo', 'objetivo'], ['estado', 'quizas']])('rechaza el filtro %s inválido', async (campo, valor) => {
    const { listar } = montar();
    await expect(listar.ejecutar({ empresaId: A, usuarioId: ADMIN, [campo]: valor } as never)).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('sin permiso, 403', async () => {
    const { listar, estado } = montar();
    estado.permisos.clear();
    await expect(listar.ejecutar({ empresaId: A, usuarioId: ADMIN })).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('una empresa sin librerías adoptadas ve una lista vacía', async () => {
    const { listar, estado } = montar();
    estado.catalogoPorEmpresa.clear();
    expect(await listar.ejecutar({ empresaId: A, usuarioId: ADMIN })).toMatchObject({ filas: [], normas: [] });
  });

  it('la empresa y la persona se revalidan (un identificador malo no pasa)', async () => {
    const { listar } = montar();
    await expect(listar.ejecutar({ empresaId: 'x', usuarioId: ADMIN })).rejects.toThrow();
    await expect(listar.ejecutar({ empresaId: A, usuarioId: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});
