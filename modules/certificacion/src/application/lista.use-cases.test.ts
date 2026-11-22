import { describe, expect, it } from 'vitest';
import { AvanzarAuditoriaUseCase, CambiarAuditoriaUseCase, CrearAuditoriaUseCase, DesignarMiembroUseCase } from './auditorias.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import {
  AgregarPreguntaUseCase,
  EvaluarFilaUseCase,
  ListarListaUseCase,
  QuitarPreguntaUseCase,
  RegenerarListaUseCase,
} from './lista.use-cases.js';
import { CrearProcesoUseCase } from './procesos.use-cases.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/index.js';
import { CrearProgramaUseCase } from './programas.use-cases.js';

const AUDITOR = '55555555-5555-4555-8555-5555555555a5';
const AUDITOR2 = '77777777-7777-4777-8777-7777777777a7';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const TODOS = ['auditoria.ver', 'auditoria.planificar', 'auditoria.ejecutar', 'auditoria.aprobar', 'auditoria.gestionar'] as const;
const NORMAS = ['ejemplo-ha', 'iso-27001-2022-anexo-a'];
const base = {
  objetivo: 'Verificar el SGSI',
  inicio: '2026-11-10',
  fin: '2026-11-25',
  reunionApertura: '2026-11-10',
  reunionCierre: '2026-11-25',
  normas: NORMAS,
};

const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  estado.conceder(ADMIN, A, ...TODOS);
  for (const u of [AUDITOR, AUDITOR2]) estado.conceder(u, A, 'auditoria.ver', 'auditoria.ejecutar');
  estado.conceder(COLAB, A, 'auditoria.ver');
  estado.conceder(ADMIN_B, B, ...TODOS);
  estado.documentosEstado.personas.set(A, [
    { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
    { id: AUDITOR, nombre: 'Dora Auditora', rol: 'auditor_interno', activa: true },
    { id: AUDITOR2, nombre: 'Eli Auditor', rol: 'auditor_interno', activa: true },
    { id: COLAB, nombre: 'Carla Colaboradora', rol: 'colaborador', activa: true },
  ]);
  estado.documentosEstado.personas.set(B, [{ id: ADMIN_B, nombre: 'Admin B', rol: 'administrador_sig', activa: true }]);
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 19, 15, 0, t++));
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  return {
    estado,
    crearProceso: new CrearProcesoUseCase(u, aut, reloj, nuevoId),
    crearPrograma: new CrearProgramaUseCase(u, aut, cat, reloj, nuevoId),
    crear: new CrearAuditoriaUseCase(u, aut, cat, reloj, nuevoId),
    cambiar: new CambiarAuditoriaUseCase(u, aut, cat, reloj),
    designar: new DesignarMiembroUseCase(u, aut, cat, reloj),
    avanzar: new AvanzarAuditoriaUseCase(u, aut, cat, reloj, nuevoId),
    listar: new ListarListaUseCase(u, aut, cat),
    regenerar: new RegenerarListaUseCase(u, aut, cat, reloj, nuevoId),
    evaluar: new EvaluarFilaUseCase(u, aut, reloj),
    agregarPregunta: new AgregarPreguntaUseCase(u, aut, reloj, nuevoId),
    quitarPregunta: new QuitarPreguntaUseCase(u, aut),
  };
};
const e = (usuarioId = ADMIN, empresaId: string = A) => ({ empresaId, usuarioId });
const acciones = (estado: EstadoFalso): string[] => estado.eventos.map((x) => x.accion);

/** Una auditoría con líder, ya «en preparación» (la lista se generó al pasar a ese estado). */
const enPreparacion = async (extra: Record<string, unknown> = {}) => {
  const m = montar();
  const proceso = await m.crearProceso.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
  const programa = await m.crearPrograma.ejecutar({ ...e(), anio: 2026, objetivo: 'Programa 2026', normas: NORMAS });
  const a = await m.crear.ejecutar({ ...e(), programaId: programa.id, ...base, procesosIds: [proceso.id], ...extra });
  await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
  const p = await m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' });
  return { m, a: p };
};
const enEjecucion = async (extra: Record<string, unknown> = {}) => {
  const c = await enPreparacion(extra);
  const a = await c.m.avanzar.ejecutar({ ...e(), id: c.a.id, versionEsperada: 2, estado: 'en_ejecucion' });
  return { ...c, a };
};

describe('generar la lista de verificación', () => {
  it('al pasar a «en preparación» genera una fila por entrada de las normas adoptadas, con título y guía propios, y lo registra', async () => {
    const { m, a } = await enPreparacion();
    const l = await m.listar.ejecutar({ ...e(COLAB), id: a.id });
    expect(l.filas.map((f) => `${f.libreriaCodigo}:${f.idEstable}`)).toEqual([
      'ejemplo-ha:ha-4.1',
      'iso-27001-2022-anexo-a:a27-5-1',
      'iso-27001-2022-anexo-a:a27-5-2',
    ]);
    expect(l.filas[0]).toMatchObject({
      titulo: 'Contexto',
      agrupador: '4',
      resultado: 'por_evaluar',
      nota: null,
      preguntas: [],
      diagnostico: null,
    });
    expect(l.avance).toMatchObject({ total: 3, evaluadas: 0 });
    expect(l.avance.porResultado.por_evaluar).toBe(3);
    expect(m.estado.eventos.find((x) => x.accion === 'lista.generada')).toMatchObject({
      objeto: 'lista:AI-2026-01',
      despues: { filas: 3, agregadas: 3, quitadas: 0 },
    });
    const todo = JSON.stringify(m.estado.eventos);
    expect(todo).not.toContain('Contexto');
    expect(todo).not.toContain('Describe el entorno');
  });

  it('con capítulos indicados solo trae esos, y muestra el estado del diagnóstico como contexto', async () => {
    const { m, a } = await enPreparacion({
      capitulos: [
        { libreriaCodigo: 'ejemplo-ha', capitulo: '4' },
        { libreriaCodigo: 'iso-27001-2022-anexo-a', capitulo: 'Organizacionales' },
      ],
    });
    expect((await m.listar.ejecutar({ ...e(), id: a.id })).filas).toHaveLength(3);
    const solo = montar();
    const proceso = await solo.crearProceso.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    const programa = await solo.crearPrograma.ejecutar({ ...e(), anio: 2026, objetivo: 'P', normas: NORMAS });
    const b = await solo.crear.ejecutar({ ...e(), programaId: programa.id, ...base, procesosIds: [proceso.id], normas: ['ejemplo-ha'] });
    await solo.designar.ejecutar({ ...e(), id: b.id, personaId: AUDITOR, rol: 'lider' });
    await solo.avanzar.ejecutar({ ...e(), id: b.id, versionEsperada: 1, estado: 'en_preparacion' });
    expect((await solo.listar.ejecutar({ ...e(), id: b.id })).filas.map((f) => f.idEstable)).toEqual(['ha-4.1']);
  });

  it('«en ejecución» exige la lista generada', async () => {
    const m = montar();
    const programa = await m.crearPrograma.ejecutar({ ...e(), anio: 2026, objetivo: 'P', normas: NORMAS });
    const a = await m.crear.ejecutar({ ...e(), programaId: programa.id, ...base });
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
    const p = await m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' });
    m.estado.auditoriaEstado.items.clear(); // una lista vacía (no se generó nada)
    await expect(m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: p.version, estado: 'en_ejecucion' })).rejects.toBeInstanceOf(
      ConflictoError,
    );
  });

  it('el permiso de ver la lista es «auditoria.ver»; una auditoría de otra empresa es un 404', async () => {
    const { m, a } = await enPreparacion();
    await expect(m.listar.ejecutar({ ...e(SIN_PERMISOS), id: a.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.listar.ejecutar({ ...e(ADMIN_B, B), id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.listar.ejecutar({ ...e(), id: 'no-uuid' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});

describe('regenerar la lista', () => {
  it('amplía el alcance, regenera y conserva lo ya evaluado', async () => {
    const m = montar();
    const proceso = await m.crearProceso.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    const programa = await m.crearPrograma.ejecutar({ ...e(), anio: 2026, objetivo: 'P', normas: NORMAS });
    const a = await m.crear.ejecutar({ ...e(), programaId: programa.id, ...base, normas: ['ejemplo-ha'], procesosIds: [proceso.id] });
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
    const prep = await m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' });
    expect((await m.listar.ejecutar({ ...e(), id: a.id })).filas).toHaveLength(1);
    // se amplía a las dos normas y se regenera a propósito
    await m.cambiar.ejecutar({ ...e(), id: a.id, versionEsperada: prep.version, normas: NORMAS });
    const r = await m.regenerar.ejecutar({ ...e(), id: a.id });
    expect(r).toEqual({ total: 3, agregadas: 2, quitadas: 0, conservadas: 1, conservadasFueraDeAlcance: 0 });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'lista.generada', despues: { filas: 3, agregadas: 2, quitadas: 0 } });
  });

  it('solo en preparación y solo quien planifica', async () => {
    const { m, a } = await enEjecucion();
    await expect(m.regenerar.ejecutar({ ...e(), id: a.id })).rejects.toBeInstanceOf(ConflictoError);
    const prep = await enPreparacion();
    await expect(prep.m.regenerar.ejecutar({ ...e(AUDITOR), id: prep.a.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(prep.m.regenerar.ejecutar({ ...e(ADMIN_B, B), id: prep.a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('evaluar la lista', () => {
  it('solo el equipo designado evalúa y solo con la auditoría en ejecución; el resultado se registra sin la nota', async () => {
    const { m, a } = await enEjecucion();
    const fila = (await m.listar.ejecutar({ ...e(), id: a.id })).filas[0]!;
    const r = await m.evaluar.ejecutar({
      ...e(AUDITOR),
      id: a.id,
      filaId: fila.id,
      versionEsperada: 1,
      resultado: 'no_conforme',
      nota: 'NOTA-PRIVADA no se encontró el registro',
    });
    expect(r).toMatchObject({ resultado: 'no_conforme', version: 2, evaluadoPor: AUDITOR });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'item.evaluado', despues: { resultado: 'no_conforme' } });
    expect(m.estado.eventos.at(-1)?.objeto).toMatch(/^item:AI-2026-01\./);
    expect(JSON.stringify(m.estado.eventos)).not.toContain('NOTA-PRIVADA');
    // el administrador que no está en el equipo no evalúa, aunque tenga el permiso; tampoco quien no es del equipo
    m.estado.conceder(ADMIN, A, 'auditoria.ejecutar');
    await expect(
      m.evaluar.ejecutar({ ...e(ADMIN), id: a.id, filaId: fila.id, versionEsperada: 2, resultado: 'conforme' }),
    ).rejects.toBeInstanceOf(SinPermisoError);
    await expect(
      m.evaluar.ejecutar({ ...e(AUDITOR2), id: a.id, filaId: fila.id, versionEsperada: 2, resultado: 'conforme' }),
    ).rejects.toBeInstanceOf(SinPermisoError);
    await expect(
      m.evaluar.ejecutar({ ...e(COLAB), id: a.id, filaId: fila.id, versionEsperada: 2, resultado: 'conforme' }),
    ).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('exige nota con los resultados que la piden, versión y una fila de esa auditoría (400 y 404)', async () => {
    const { m, a } = await enEjecucion();
    const fila = (await m.listar.ejecutar({ ...e(), id: a.id })).filas[0]!;
    const ok = { ...e(AUDITOR), id: a.id, filaId: fila.id, versionEsperada: 1 };
    for (const mal of [
      { resultado: 'no_conforme' },
      { resultado: 'observacion', nota: ' ' },
      { resultado: 'no_aplica', nota: 'no' },
      { resultado: 'por_evaluar' },
      { resultado: 'inventado' },
      {},
    ])
      await expect(m.evaluar.ejecutar({ ...ok, ...mal }), JSON.stringify(mal)).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.evaluar.ejecutar({ ...ok, versionEsperada: undefined, resultado: 'conforme' })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
    await expect(
      m.evaluar.ejecutar({ ...ok, filaId: '00000000-0000-4000-8000-000000000000', resultado: 'conforme' }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.evaluar.ejecutar({ ...ok, filaId: 'no-uuid', resultado: 'conforme' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('con una versión vieja es conflicto y no se pisa lo de otra persona; en preparación todavía no se evalúa', async () => {
    const { m, a } = await enEjecucion();
    const fila = (await m.listar.ejecutar({ ...e(), id: a.id })).filas[0]!;
    await m.evaluar.ejecutar({ ...e(AUDITOR), id: a.id, filaId: fila.id, versionEsperada: 1, resultado: 'conforme' });
    await expect(
      m.evaluar.ejecutar({ ...e(AUDITOR), id: a.id, filaId: fila.id, versionEsperada: 1, resultado: 'no_verificado' }),
    ).rejects.toBeInstanceOf(ConflictoDeVersionError);
    const prep = await enPreparacion();
    const f2 = (await prep.m.listar.ejecutar({ ...e(), id: prep.a.id })).filas[0]!;
    await expect(
      prep.m.evaluar.ejecutar({ ...e(AUDITOR), id: prep.a.id, filaId: f2.id, versionEsperada: 1, resultado: 'conforme' }),
    ).rejects.toBeInstanceOf(ConflictoError);
  });

  it('el avance cuenta lo evaluado por resultado', async () => {
    const { m, a } = await enEjecucion();
    const filas = (await m.listar.ejecutar({ ...e(), id: a.id })).filas;
    await m.evaluar.ejecutar({ ...e(AUDITOR), id: a.id, filaId: filas[0]!.id, versionEsperada: 1, resultado: 'conforme' });
    await m.evaluar.ejecutar({
      ...e(AUDITOR),
      id: a.id,
      filaId: filas[1]!.id,
      versionEsperada: 1,
      resultado: 'no_aplica',
      nota: 'no se usa en la empresa',
    });
    const l = await m.listar.ejecutar({ ...e(COLAB), id: a.id });
    expect(l.avance).toMatchObject({ total: 3, evaluadas: 2, porResultado: { conforme: 1, no_aplica: 1, por_evaluar: 1 } });
  });

  it('si la bitácora falla no cambia nada', async () => {
    const { m, a } = await enEjecucion();
    const fila = (await m.listar.ejecutar({ ...e(), id: a.id })).filas[0]!;
    m.estado.fallarBitacora = true;
    await expect(
      m.evaluar.ejecutar({ ...e(AUDITOR), id: a.id, filaId: fila.id, versionEsperada: 1, resultado: 'conforme' }),
    ).rejects.toThrow();
    m.estado.fallarBitacora = false;
    expect((await m.listar.ejecutar({ ...e(), id: a.id })).filas[0]?.resultado).toBe('por_evaluar');
  });
});

describe('preguntas propias del equipo', () => {
  it('hasta 5 por fila, con rastro, en preparación o en ejecución y solo el equipo', async () => {
    const { m, a } = await enPreparacion();
    const fila = (await m.listar.ejecutar({ ...e(), id: a.id })).filas[0]!;
    for (let i = 1; i <= 5; i += 1) await m.agregarPregunta.ejecutar({ ...e(AUDITOR), id: a.id, filaId: fila.id, texto: `Pregunta ${i}` });
    await expect(m.agregarPregunta.ejecutar({ ...e(AUDITOR), id: a.id, filaId: fila.id, texto: 'una más' })).rejects.toBeInstanceOf(
      ConflictoError,
    );
    const l = await m.listar.ejecutar({ ...e(COLAB), id: a.id });
    expect(l.filas[0]?.preguntas).toHaveLength(5);
    expect(m.estado.eventos.filter((x) => x.accion === 'pregunta.creada')).toHaveLength(5);
    expect(JSON.stringify(m.estado.eventos)).not.toContain('Pregunta 1');
    await m.quitarPregunta.ejecutar({ ...e(AUDITOR), id: a.id, preguntaId: l.filas[0]!.preguntas[0]!.id });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'pregunta.eliminada' });
    await expect(m.agregarPregunta.ejecutar({ ...e(AUDITOR2), id: a.id, filaId: fila.id, texto: 'ajena' })).rejects.toBeInstanceOf(
      SinPermisoError,
    );
    await expect(m.agregarPregunta.ejecutar({ ...e(AUDITOR), id: a.id, filaId: fila.id, texto: '' })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
    await expect(
      m.quitarPregunta.ejecutar({ ...e(AUDITOR), id: a.id, preguntaId: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('una pregunta de otra empresa no se ve ni se toca', async () => {
    const { m, a } = await enPreparacion();
    const fila = (await m.listar.ejecutar({ ...e(), id: a.id })).filas[0]!;
    await expect(m.agregarPregunta.ejecutar({ ...e(ADMIN_B, B), id: a.id, filaId: fila.id, texto: 'x' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    expect(acciones(m.estado)).not.toContain('pregunta.creada');
  });
});
