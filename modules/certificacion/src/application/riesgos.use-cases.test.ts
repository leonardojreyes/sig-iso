import { describe, expect, it } from 'vitest';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearUnidadFalsa } from './prueba/fakes.js';
import { CambiarRiesgoUseCase, CrearRiesgoUseCase, ListarRiesgosUseCase, ObtenerRiesgoUseCase, RetirarRiesgoUseCase } from './riesgos.use-cases.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const OTRO = '77777777-7777-4777-8777-777777777777';
const montar = () => {
  const estado = new EstadoFalso();
  estado.conceder(ADMIN, A, 'riesgos.ver', 'riesgos.gestionar');
  estado.conceder(COLAB, A, 'riesgos.ver');
  estado.conceder(ADMIN_B, B, 'riesgos.ver', 'riesgos.gestionar');
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 17, 12, 0, t++));
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  return {
    estado,
    crear: new CrearRiesgoUseCase(u, aut, reloj, nuevoId),
    cambiar: new CambiarRiesgoUseCase(u, aut, reloj),
    retirar: new RetirarRiesgoUseCase(u, aut, reloj),
    listar: new ListarRiesgosUseCase(u, aut),
    obtener: new ObtenerRiesgoUseCase(u, aut),
  };
};
const yo = { empresaId: A, usuarioId: ADMIN };
const nuevo = { titulo: 'Pérdida de portátiles', descripcion: 'DESCRIPCION-PRIVADA', probabilidad: 3, impacto: 4, decision: 'mitigar' as const };

describe('crear un riesgo', () => {
  it('lo crea con código correlativo, nivel calculado y registra el hecho SIN texto ni valores', async () => {
    const { crear, estado } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    expect(r).toMatchObject({ codigo: 'R-001', puntaje: 12, nivel: 'alto', estado: 'vigente', version: 1, responsableId: null });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'riesgo.creado', objeto: 'riesgo:R-001', resultado: 'ok' })]);
    expect(JSON.stringify(estado.eventos)).not.toMatch(/DESCRIPCION-PRIVADA|portátiles/);
  });

  it('el código sigue la secuencia y no se reutiliza al retirar', async () => {
    const { crear, retirar } = montar();
    const r1 = await crear.ejecutar({ ...yo, ...nuevo });
    await retirar.ejecutar({ ...yo, id: r1.id, versionEsperada: 1 });
    expect((await crear.ejecutar({ ...yo, ...nuevo })).codigo).toBe('R-002');
    expect((await crear.ejecutar({ ...yo, ...nuevo })).codigo).toBe('R-003');
  });

  it('cada empresa lleva su propia secuencia', async () => {
    const { crear } = montar();
    await crear.ejecutar({ ...yo, ...nuevo });
    expect((await crear.ejecutar({ empresaId: B, usuarioId: ADMIN_B, ...nuevo })).codigo).toBe('R-001');
  });

  it('solo quien gestiona: el colaborador recibe 403, y el permiso se decide antes que la forma', async () => {
    const { crear, estado } = montar();
    await expect(crear.ejecutar({ ...yo, usuarioId: COLAB, ...nuevo })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(crear.ejecutar({ ...yo, usuarioId: COLAB, titulo: 7 as never, probabilidad: 99, impacto: 0, decision: 'x' as never })).rejects.toBeInstanceOf(SinPermisoError);
    expect(estado.riesgos.size).toBe(0);
  });

  it('un dato inválido es parámetro inválido y no escribe nada', async () => {
    const { crear, estado } = montar();
    for (const malo of [{ titulo: '   ' }, { descripcion: 'x'.repeat(1001) }, { probabilidad: 6 }, { impacto: 0 }, { decision: 'ignorar' as never }, { responsableId: 'x' }]) {
      await expect(crear.ejecutar({ ...yo, ...nuevo, ...malo })).rejects.toBeInstanceOf(ParametroInvalidoError);
    }
    expect(estado.riesgos.size).toBe(0);
    expect(estado.eventos).toEqual([]);
  });

  it('aceptar exige responsable', async () => {
    const { crear } = montar();
    await expect(crear.ejecutar({ ...yo, ...nuevo, decision: 'aceptar' })).rejects.toMatchObject({ parametro: 'responsableId' });
    await expect(crear.ejecutar({ ...yo, ...nuevo, decision: 'aceptar', responsableId: OTRO })).resolves.toMatchObject({ decision: 'aceptar', responsableId: OTRO });
  });

  it('si el número siguiente se pierde siempre en una carrera, termina en conflicto y no deja nada', async () => {
    const { crear, estado } = montar();
    estado.carrera = true;
    await expect(crear.ejecutar({ ...yo, ...nuevo })).rejects.toMatchObject({ motivo: 'codigo_repetido' });
    expect(estado.riesgos.size).toBe(0);
    expect(estado.eventos).toEqual([]);
  });

  it('si falla la bitácora, no queda el riesgo', async () => {
    const { crear, estado } = montar();
    estado.fallarBitacora = true;
    await expect(crear.ejecutar({ ...yo, ...nuevo })).rejects.toThrow();
    expect(estado.riesgos.size).toBe(0);
  });
});

describe('cambiar un riesgo', () => {
  it('cambia, recalcula el nivel, sube la versión y registra el hecho sin valores', async () => {
    const { crear, cambiar, estado } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    const c = await cambiar.ejecutar({ ...yo, id: r.id, versionEsperada: 1, probabilidad: 1, impacto: 2, titulo: 'TITULO-NUEVO' });
    expect(c).toMatchObject({ puntaje: 2, nivel: 'bajo', version: 2, titulo: 'TITULO-NUEVO' });
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'riesgo.cambiado', objeto: 'riesgo:R-001' });
    expect(JSON.stringify(estado.eventos)).not.toMatch(/TITULO-NUEVO/);
  });

  it('sin cambios no escribe, no sube versión ni registra hecho', async () => {
    const { crear, cambiar, estado } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    const antes = estado.eventos.length;
    expect(await cambiar.ejecutar({ ...yo, id: r.id, versionEsperada: 1, probabilidad: 3 })).toMatchObject({ version: 1 });
    expect(estado.eventos).toHaveLength(antes);
  });

  it('si otra persona lo cambió antes (versión vieja) recibe conflicto y no pisa el cambio', async () => {
    const { crear, cambiar } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    await cambiar.ejecutar({ ...yo, id: r.id, versionEsperada: 1, impacto: 5 });
    await expect(cambiar.ejecutar({ ...yo, id: r.id, versionEsperada: 1, impacto: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });

  it('exige la versión, el permiso y un identificador válido, en ese orden de decisión', async () => {
    const { crear, cambiar } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    await expect(cambiar.ejecutar({ ...yo, usuarioId: COLAB, id: 'x', impacto: 1 })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(cambiar.ejecutar({ ...yo, id: 'x', versionEsperada: 1 })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(cambiar.ejecutar({ ...yo, id: r.id })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(cambiar.ejecutar({ ...yo, id: r.id, versionEsperada: 1, probabilidad: 9 })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('un riesgo inexistente o de otra empresa es 404 indistinguible', async () => {
    const { crear, cambiar } = montar();
    const deB = await crear.ejecutar({ empresaId: B, usuarioId: ADMIN_B, ...nuevo });
    await expect(cambiar.ejecutar({ ...yo, id: deB.id, versionEsperada: 1, impacto: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(cambiar.ejecutar({ ...yo, id: 'eeeeeeee-9999-4999-8999-999999999999', versionEsperada: 1, impacto: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('un riesgo retirado no se cambia (conflicto) y aceptar sin responsable es parámetro inválido', async () => {
    const { crear, cambiar, retirar } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    await expect(cambiar.ejecutar({ ...yo, id: r.id, versionEsperada: 1, decision: 'aceptar' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await retirar.ejecutar({ ...yo, id: r.id, versionEsperada: 1 });
    await expect(cambiar.ejecutar({ ...yo, id: r.id, versionEsperada: 2, impacto: 1 })).rejects.toBeInstanceOf(ConflictoError);
  });
});

describe('retirar un riesgo', () => {
  it('lo deja retirado (no se borra), sube la versión y registra el hecho', async () => {
    const { crear, retirar, estado } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    expect(await retirar.ejecutar({ ...yo, id: r.id, versionEsperada: 1 })).toMatchObject({ estado: 'retirado', version: 2, codigo: 'R-001' });
    expect(estado.riesgos.size).toBe(1);
    expect(estado.eventos.at(-1)).toMatchObject({ accion: 'riesgo.retirado', objeto: 'riesgo:R-001' });
  });

  it('no se retira dos veces, ni con versión vieja, ni sin permiso, ni uno ajeno', async () => {
    const { crear, retirar } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    await expect(retirar.ejecutar({ ...yo, id: r.id, versionEsperada: 7 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(retirar.ejecutar({ ...yo, usuarioId: COLAB, id: r.id, versionEsperada: 1 })).rejects.toBeInstanceOf(SinPermisoError);
    await retirar.ejecutar({ ...yo, id: r.id, versionEsperada: 1 });
    await expect(retirar.ejecutar({ ...yo, id: r.id, versionEsperada: 2 })).rejects.toMatchObject({ motivo: 'ya_retirado' });
    const deB = await crear.ejecutar({ empresaId: B, usuarioId: ADMIN_B, ...nuevo });
    await expect(retirar.ejecutar({ ...yo, id: deB.id, versionEsperada: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('si falla la bitácora, el riesgo sigue vigente', async () => {
    const { crear, retirar, estado } = montar();
    const r = await crear.ejecutar({ ...yo, ...nuevo });
    estado.fallarBitacora = true;
    await expect(retirar.ejecutar({ ...yo, id: r.id, versionEsperada: 1 })).rejects.toThrow();
    expect([...estado.riesgos.values()][0]?.estado).toBe('vigente');
  });
});

describe('listar y ver riesgos', () => {
  it('el colaborador consulta; por omisión solo los vigentes y con retirados si se pide', async () => {
    const { crear, retirar, listar } = montar();
    const r1 = await crear.ejecutar({ ...yo, ...nuevo });
    await crear.ejecutar({ ...yo, ...nuevo, titulo: 'Fuga de información' });
    await retirar.ejecutar({ ...yo, id: r1.id, versionEsperada: 1 });
    expect((await listar.ejecutar({ ...yo, usuarioId: COLAB })).map((r) => r.codigo)).toEqual(['R-002']);
    expect((await listar.ejecutar({ ...yo, usuarioId: COLAB, incluirRetirados: true })).map((r) => r.codigo)).toEqual(['R-001', 'R-002']);
    await expect(listar.ejecutar({ ...yo, incluirRetirados: 'si' as never })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('cada empresa ve solo lo suyo, y quien no tiene permiso recibe 403', async () => {
    const { crear, listar, obtener } = montar();
    const a = await crear.ejecutar({ ...yo, ...nuevo });
    const b = await crear.ejecutar({ empresaId: B, usuarioId: ADMIN_B, ...nuevo, titulo: 'Riesgo de B' });
    expect((await listar.ejecutar(yo)).map((r) => r.id)).toEqual([a.id]);
    expect((await listar.ejecutar({ empresaId: B, usuarioId: ADMIN_B })).map((r) => r.id)).toEqual([b.id]);
    await expect(listar.ejecutar({ ...yo, usuarioId: OTRO })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(obtener.ejecutar({ ...yo, usuarioId: OTRO, id: a.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(obtener.ejecutar({ ...yo, id: b.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(obtener.ejecutar({ ...yo, id: a.id })).resolves.toMatchObject({ codigo: 'R-001' });
    await expect(obtener.ejecutar({ ...yo, id: 'no-es-uuid' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});
