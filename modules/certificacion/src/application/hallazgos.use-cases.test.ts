import { describe, expect, it } from 'vitest';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import {
  ADMIN_B,
  AUDITOR,
  AUDITOR2,
  A,
  B,
  COLAB,
  SIN_PERMISOS,
  auditoriaEnEjecucion,
  auditoriaEnPreparacion,
  quien,
} from './prueba/index.js';

const e = quien;
const NC = (proceso: string, extra: Record<string, unknown> = {}) => ({
  tipo: 'nc_menor',
  procesoId: proceso,
  libreriaCodigo: 'iso-27001-2022-anexo-a',
  idEstable: 'a27-5-1',
  enunciado: 'ENUNCIADO-PRIVADO falta la política firmada',
  evidencia: 'EVIDENCIA-PRIVADA se revisó la carpeta y no está',
  ...extra,
});

describe('registrar un hallazgo', () => {
  it('una NC lleva proceso, requisito y evidencia; queda abierta y se registra sin ningún texto', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    const h = await m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(proceso.id) });
    expect(h).toMatchObject({
      codigo: 'H-001',
      tipo: 'nc_menor',
      estado: 'abierto',
      procesoId: proceso.id,
      itemId: null,
      registradoPor: AUDITOR,
      version: 1,
      justificacionGravedad: null,
    });
    expect(m.estado.eventos.at(-1)).toMatchObject({
      accion: 'hallazgo.registrado',
      objeto: 'hallazgo:AI-2026-01.H-001',
      despues: { tipo: 'nc_menor' },
    });
    const todo = JSON.stringify(m.estado.eventos);
    for (const secreto of ['ENUNCIADO-PRIVADO', 'EVIDENCIA-PRIVADA']) expect(todo).not.toContain(secreto);
    expect((await m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(proceso.id) })).codigo).toBe('H-002');
  });

  it('la NC mayor exige la justificación de la gravedad y solo la registra el líder', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR2, rol: 'auditor' }).catch(() => undefined); // ya en ejecución: no se puede
    await expect(m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(proceso.id, { tipo: 'nc_mayor' }) })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
    const h = await m.registrarHallazgo.ejecutar({
      ...e(AUDITOR),
      id: a.id,
      ...NC(proceso.id, { tipo: 'nc_mayor', justificacionGravedad: 'falla el requisito completo' }),
    });
    expect(h).toMatchObject({ tipo: 'nc_mayor', justificacionGravedad: 'falla el requisito completo' });
  });

  it('un miembro que no es líder no registra una NC mayor (la gravedad la decide el líder)', async () => {
    const m = (await auditoriaEnPreparacion()).m;
    void m;
    const base = await auditoriaEnPreparacion();
    // el segundo auditor se designa antes de ejecutar
    await base.m.designar.ejecutar({ ...e(), id: base.a.id, personaId: AUDITOR2, rol: 'auditor' });
    const a = await base.m.avanzar.ejecutar({ ...e(), id: base.a.id, versionEsperada: base.a.version, estado: 'en_ejecucion' });
    await expect(
      base.m.registrarHallazgo.ejecutar({
        ...e(AUDITOR2),
        id: a.id,
        ...NC(base.proceso.id, { tipo: 'nc_mayor', justificacionGravedad: 'x' }),
      }),
    ).rejects.toBeInstanceOf(SinPermisoError);
    expect((await base.m.registrarHallazgo.ejecutar({ ...e(AUDITOR2), id: a.id, ...NC(base.proceso.id) })).tipo).toBe('nc_menor');
  });

  it('una observación o una oportunidad no exigen proceso ni requisito y no son incumplimientos', async () => {
    const { m, a } = await auditoriaEnEjecucion();
    const h = await m.registrarHallazgo.ejecutar({
      ...e(AUDITOR),
      id: a.id,
      tipo: 'observacion',
      enunciado: 'Riesgo de que caduque',
      evidencia: 'La fecha vence pronto',
    });
    expect(h).toMatchObject({ tipo: 'observacion', procesoId: null, libreriaCodigo: null });
    await expect(
      m.registrarHallazgo.ejecutar({
        ...e(AUDITOR),
        id: a.id,
        tipo: 'oportunidad',
        enunciado: 'x',
        evidencia: 'y',
        justificacionGravedad: 'no aplica',
      }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('sale de una fila de la lista: toma de ella el requisito', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    const fila = (await m.listar.ejecutar({ ...e(), id: a.id })).filas[1]!;
    const h = await m.registrarHallazgo.ejecutar({
      ...e(AUDITOR),
      id: a.id,
      itemId: fila.id,
      tipo: 'nc_menor',
      procesoId: proceso.id,
      enunciado: 'x',
      evidencia: 'y',
    });
    expect(h).toMatchObject({ itemId: fila.id, libreriaCodigo: fila.libreriaCodigo, idEstable: fila.idEstable });
    await expect(
      m.registrarHallazgo.ejecutar({
        ...e(AUDITOR),
        id: a.id,
        itemId: '00000000-0000-4000-8000-000000000000',
        tipo: 'nc_menor',
        procesoId: proceso.id,
        enunciado: 'x',
        evidencia: 'y',
      }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('rechaza datos mal formados, un proceso fuera del alcance y un requisito que no está en la lista (400)', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    const otro = await m.crearProceso.ejecutar({ ...e(), nombre: 'Ventas', duenaId: AUDITOR });
    for (const mal of [
      { tipo: 'grave' },
      { enunciado: '' },
      { evidencia: '' },
      { enunciado: 'x'.repeat(501) },
      { procesoId: 'no-uuid' },
      { procesoId: otro.id }, // no está en el alcance de esta auditoría
      { procesoId: null },
      { libreriaCodigo: 'otra-norma', idEstable: 'zz' },
      { idEstable: null },
    ])
      await expect(
        m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(proceso.id), ...mal }),
        JSON.stringify(mal),
      ).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect((await m.listarHallazgos.ejecutar({ ...e(), id: a.id })).hallazgos).toEqual([]);
  });

  it('el proceso transversal «Gestión del SIG» está en el alcance cuando se cubren las cláusulas 4 a 10', async () => {
    const { m, a } = await auditoriaEnEjecucion();
    const sig = await m.gestionSig.ejecutar({ ...e(AUDITOR2, A) }).catch(async () => m.gestionSig.ejecutar(e()));
    const h = await m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(sig.id) });
    expect(h.procesoId).toBe(sig.id);
  });

  it('solo el equipo y solo con la auditoría en ejecución', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    await expect(m.registrarHallazgo.ejecutar({ ...e(AUDITOR2), id: a.id, ...NC(proceso.id) })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.registrarHallazgo.ejecutar({ ...e(COLAB), id: a.id, ...NC(proceso.id) })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.registrarHallazgo.ejecutar({ ...e(SIN_PERMISOS), id: a.id, ...NC(proceso.id) })).rejects.toBeInstanceOf(SinPermisoError);
    const prep = await auditoriaEnPreparacion();
    await expect(prep.m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: prep.a.id, ...NC(prep.proceso.id) })).rejects.toBeInstanceOf(
      ConflictoError,
    );
  });

  it('si la bitácora falla no queda el hallazgo', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    m.estado.fallarBitacora = true;
    await expect(m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(proceso.id) })).rejects.toThrow();
    m.estado.fallarBitacora = false;
    expect((await m.listarHallazgos.ejecutar({ ...e(), id: a.id })).hallazgos).toEqual([]);
  });
});

describe('cambiar y anular', () => {
  it('cambia con concurrencia optimista, conserva lo no tocado y revalida las reglas completas', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    const h = await m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(proceso.id) });
    const c = await m.cambiarHallazgo.ejecutar({
      ...e(AUDITOR),
      id: a.id,
      hallazgoId: h.id,
      versionEsperada: 1,
      enunciado: 'Otro enunciado',
    });
    expect(c).toMatchObject({ enunciado: 'Otro enunciado', evidencia: h.evidencia, tipo: 'nc_menor', version: 2 });
    await expect(
      m.cambiarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: h.id, versionEsperada: 1, enunciado: 'viejo' }),
    ).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(m.cambiarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: h.id, versionEsperada: 2 })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
    // pasar a NC mayor sin justificación no vale; con ella, sí (es el líder)
    await expect(
      m.cambiarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: h.id, versionEsperada: 2, tipo: 'nc_mayor' }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
    const mayor = await m.cambiarHallazgo.ejecutar({
      ...e(AUDITOR),
      id: a.id,
      hallazgoId: h.id,
      versionEsperada: 2,
      tipo: 'nc_mayor',
      justificacionGravedad: 'falla el sistema',
    });
    expect(mayor).toMatchObject({ tipo: 'nc_mayor', justificacionGravedad: 'falla el sistema' });
    // volver a menor quita la justificación
    expect(
      (await m.cambiarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: h.id, versionEsperada: 3, tipo: 'nc_menor' }))
        .justificacionGravedad,
    ).toBeNull();
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'hallazgo.cambiado', despues: { tipo: 'nc_menor' } });
    expect(JSON.stringify(m.estado.eventos)).not.toContain('Otro enunciado');
  });

  it('anula con un motivo cerrado, no se borra, y un hallazgo anulado ya no se cambia', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    const h = await m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(proceso.id) });
    for (const mal of [{}, { motivo: 'porque sí' }])
      await expect(
        m.anularHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: h.id, versionEsperada: 1, ...mal }),
      ).rejects.toBeInstanceOf(ParametroInvalidoError);
    const x = await m.anularHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: h.id, versionEsperada: 1, motivo: 'duplicado' });
    expect(x).toMatchObject({ estado: 'anulado', anulacionMotivo: 'duplicado', version: 2 });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'hallazgo.anulado', despues: { motivo: 'duplicado' } });
    await expect(
      m.anularHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: h.id, versionEsperada: 2, motivo: 'duplicado' }),
    ).rejects.toBeInstanceOf(ConflictoError);
    await expect(
      m.cambiarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: h.id, versionEsperada: 2, enunciado: 'x' }),
    ).rejects.toBeInstanceOf(ConflictoError);
    const l = await m.listarHallazgos.ejecutar({ ...e(COLAB), id: a.id });
    expect(l.hallazgos).toHaveLength(1);
    expect(l.abiertos).toEqual({ nc_mayor: 0, nc_menor: 0, observacion: 0, oportunidad: 0 });
  });

  it('la lista cuenta los abiertos por tipo y un hallazgo de otra auditoría o empresa es un 404', async () => {
    const { m, a, proceso } = await auditoriaEnEjecucion();
    await m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, ...NC(proceso.id) });
    await m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, tipo: 'oportunidad', enunciado: 'x', evidencia: 'y' });
    const l = await m.listarHallazgos.ejecutar({ ...e(COLAB), id: a.id });
    expect(l.abiertos).toEqual({ nc_mayor: 0, nc_menor: 1, observacion: 0, oportunidad: 1 });
    await expect(m.listarHallazgos.ejecutar({ ...e(ADMIN_B, B), id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      m.cambiarHallazgo.ejecutar({
        ...e(AUDITOR),
        id: a.id,
        hallazgoId: '00000000-0000-4000-8000-000000000000',
        versionEsperada: 1,
        enunciado: 'x',
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      m.anularHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: 'no-uuid', versionEsperada: 1, motivo: 'duplicado' }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});
