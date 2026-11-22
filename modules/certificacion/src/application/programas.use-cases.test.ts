import { describe, expect, it } from 'vitest';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/index.js';
import { CrearProcesoUseCase } from './procesos.use-cases.js';
import {
  AgregarExclusionUseCase,
  AprobarProgramaUseCase,
  CambiarProgramaUseCase,
  CrearProgramaUseCase,
  ListarProgramasUseCase,
  ObtenerProgramaUseCase,
  QuitarExclusionUseCase,
} from './programas.use-cases.js';

const ADMIN2 = '33333333-3333-4333-8333-3333333333e3';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const TODOS = ['auditoria.ver', 'auditoria.planificar', 'auditoria.ejecutar', 'auditoria.aprobar', 'auditoria.gestionar'] as const;
const NORMAS = ['ejemplo-ha', 'iso-27001-2022-anexo-a'];

const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  estado.conceder(ADMIN, A, ...TODOS);
  estado.conceder(ADMIN2, A, ...TODOS);
  estado.conceder(COLAB, A, 'auditoria.ver');
  estado.conceder(ADMIN_B, B, ...TODOS);
  estado.documentosEstado.personas.set(A, [
    { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
    { id: ADMIN2, nombre: 'Beto Admin', rol: 'administrador_sig', activa: true },
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
    listar: new ListarProgramasUseCase(u, aut),
    obtener: new ObtenerProgramaUseCase(u, aut, cat),
    crear: new CrearProgramaUseCase(u, aut, cat, reloj, nuevoId),
    cambiar: new CambiarProgramaUseCase(u, aut, cat, reloj),
    aprobar: new AprobarProgramaUseCase(u, aut, cat, reloj),
    agregarExclusion: new AgregarExclusionUseCase(u, aut, reloj, nuevoId),
    quitarExclusion: new QuitarExclusionUseCase(u, aut),
  };
};
const e = (usuarioId = ADMIN, empresaId: string = A) => ({ empresaId, usuarioId });
const acciones = (estado: EstadoFalso): string[] => estado.eventos.map((x) => x.accion);
const OBJ = 'Verificar el SGSI';

/** Una auditoría ya planificada (las auditorías se crean en otra tarea): se siembra directo en el fake. */
const sembrarAuditoria = (
  m: ReturnType<typeof montar>,
  programaId: string,
  datos: {
    estado?: string;
    normas: string[];
    procesosIds?: string[];
    capitulos?: { libreriaCodigo: string; capitulo: string }[];
    numero?: number;
  },
) => {
  const id = `aaaaaaaa-0000-4000-8000-${String(datos.numero ?? 1).padStart(12, '0')}`;
  m.estado.auditoriaEstado.auditorias.set(id, {
    empresaId: A,
    id,
    programaId,
    anio: 2027,
    numero: datos.numero ?? 1,
    codigo: 'AI-2027-01',
    objetivo: 'x',
    estado: (datos.estado ?? 'planificada') as never,
    inicio: '2027-03-01',
    fin: '2027-03-05',
    reunionApertura: null,
    reunionCierre: null,
    reprogramaciones: 0,
    cancelacionMotivo: null,
    informeEmitidoEn: null,
    cerradaEn: null,
    version: 1,
    creadoPor: ADMIN,
  });
  m.estado.auditoriaEstado.alcances.set(id, {
    normas: datos.normas,
    procesosIds: datos.procesosIds ?? [],
    capitulos: datos.capitulos ?? [],
  });
};

describe('crear el programa', () => {
  it('crea uno por año con sus normas adoptadas y lo registra sin texto libre', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), anio: 2027, objetivo: ` ${OBJ} `, normas: NORMAS });
    expect(p).toMatchObject({ anio: 2027, objetivo: OBJ, estado: 'sin_aprobar', aprobadoPor: null, version: 1, normas: NORMAS });
    expect(acciones(m.estado)).toEqual(['programa.creado']);
    expect(m.estado.eventos[0]).toMatchObject({ objeto: 'programa:2027' });
    expect(JSON.stringify(m.estado.eventos)).not.toContain(OBJ);
    await expect(m.crear.ejecutar({ ...e(ADMIN2), anio: 2027, objetivo: OBJ, normas: NORMAS })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('el permiso se decide antes de mirar el cuerpo', async () => {
    const m = montar();
    await expect(m.crear.ejecutar({ ...e(COLAB), anio: 1 })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.crear.ejecutar({ ...e(SIN_PERMISOS), anio: 2027, objetivo: OBJ, normas: NORMAS })).rejects.toBeInstanceOf(
      SinPermisoError,
    );
  });

  it('rechaza año, objetivo o normas mal formados o no adoptadas (400)', async () => {
    const m = montar();
    for (const mal of [
      { anio: 1999, objetivo: OBJ, normas: NORMAS },
      { anio: 2027, objetivo: '', normas: NORMAS },
      { anio: 2027, objetivo: OBJ, normas: [] },
      { anio: 2027, objetivo: OBJ, normas: 'ejemplo-ha' },
      { anio: 2027, objetivo: OBJ, normas: ['ejemplo-ha', 'ejemplo-ha'] },
      { anio: 2027, objetivo: OBJ, normas: ['no-adoptada'] },
      { anio: 2027, objetivo: OBJ, normas: ['../x'] },
    ])
      await expect(m.crear.ejecutar({ ...e(), ...mal }), JSON.stringify(mal)).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect((await m.listar.ejecutar(e())).programas).toEqual([]);
  });

  it('las normas de otra empresa no se pueden elegir (es como si no existieran)', async () => {
    const m = montar();
    await expect(m.crear.ejecutar({ ...e(ADMIN_B, B), anio: 2027, objetivo: OBJ, normas: ['ejemplo-ha'] })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
  });
});

describe('cambiar el programa', () => {
  it('cambia con concurrencia optimista; si estaba aprobado vuelve a «sin aprobar»', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), anio: 2027, objetivo: OBJ, normas: ['ejemplo-ha'] });
    // sin procesos ni capítulos pendientes (un solo capítulo, incluido por una auditoría) se puede aprobar
    sembrarAuditoria(m, p.id, { normas: ['ejemplo-ha'] });
    const ap = await m.aprobar.ejecutar({ ...e(), id: p.id, versionEsperada: 1 });
    expect(ap).toMatchObject({ estado: 'aprobado', aprobadoPor: ADMIN, version: 2 });
    const c = await m.cambiar.ejecutar({ ...e(), id: p.id, versionEsperada: 2, objetivo: 'Nuevo objetivo' });
    expect(c).toMatchObject({ estado: 'sin_aprobar', aprobadoPor: null, aprobadoEn: null, objetivo: 'Nuevo objetivo', version: 3 });
    await expect(m.cambiar.ejecutar({ ...e(), id: p.id, versionEsperada: 2, objetivo: 'otro' })).rejects.toBeInstanceOf(
      ConflictoDeVersionError,
    );
    expect(acciones(m.estado)).toEqual(['programa.creado', 'programa.aprobado', 'programa.cambiado']);
  });

  it('cambiar las normas también lo devuelve a «sin aprobar»; repetir lo mismo no', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), anio: 2027, objetivo: OBJ, normas: ['ejemplo-ha'] });
    sembrarAuditoria(m, p.id, { normas: ['ejemplo-ha'] });
    await m.aprobar.ejecutar({ ...e(), id: p.id, versionEsperada: 1 });
    const igual = await m.cambiar.ejecutar({ ...e(), id: p.id, versionEsperada: 2, objetivo: OBJ, normas: ['ejemplo-ha'] });
    expect(igual.estado).toBe('aprobado');
    const otras = await m.cambiar.ejecutar({ ...e(), id: p.id, versionEsperada: 3, normas: NORMAS });
    expect(otras).toMatchObject({ estado: 'sin_aprobar', normas: NORMAS });
  });

  it('exige versión y al menos un cambio; el 404 de otra empresa es indistinguible', async () => {
    const m = montar();
    const p = await m.crear.ejecutar({ ...e(), anio: 2027, objetivo: OBJ, normas: NORMAS });
    await expect(m.cambiar.ejecutar({ ...e(), id: p.id, objetivo: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.cambiar.ejecutar({ ...e(), id: p.id, versionEsperada: 1 })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.cambiar.ejecutar({ ...e(ADMIN_B, B), id: p.id, versionEsperada: 1, objetivo: 'intruso' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.cambiar.ejecutar({ ...e(COLAB), id: p.id, versionEsperada: 1, objetivo: 'x' })).rejects.toBeInstanceOf(SinPermisoError);
  });
});

describe('motivos de lo que no entra al año y aprobación', () => {
  const con = async () => {
    const m = montar();
    const p1 = await m.crearProceso.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
    const p2 = await m.crearProceso.ejecutar({ ...e(), nombre: 'Ventas', duenaId: ADMIN });
    const p = await m.crear.ejecutar({ ...e(), anio: 2027, objetivo: OBJ, normas: NORMAS });
    return { m, p, p1, p2 };
  };

  it('el detalle muestra lo pendiente de incluir o justificar y las ayudas para decidir', async () => {
    const { m, p, p1 } = await con();
    m.estado.auditoriaEstado.ayudas.set(A, [{ procesoId: p1.id, ultimaAuditoria: '2026-05-01', hallazgosAbiertos: 2 }]);
    const d = await m.obtener.ejecutar({ ...e(COLAB), id: p.id });
    expect(d.pendientes.procesos).toHaveLength(2);
    expect(d.pendientes.capitulos).toEqual([
      { libreriaCodigo: 'ejemplo-ha', capitulo: '4' },
      { libreriaCodigo: 'iso-27001-2022-anexo-a', capitulo: 'Organizacionales' },
    ]);
    expect(d.procesos.find((x) => x.procesoId === p1.id)).toMatchObject({
      ultimaAuditoria: '2026-05-01',
      hallazgosAbiertos: 2,
      incluido: false,
    });
    await expect(m.obtener.ejecutar({ ...e(SIN_PERMISOS), id: p.id })).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('no se aprueba mientras falte un motivo (409) y se aprueba cuando todo entra o se justifica', async () => {
    const { m, p, p1, p2 } = await con();
    await expect(m.aprobar.ejecutar({ ...e(), id: p.id, versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoError);
    sembrarAuditoria(m, p.id, { normas: ['ejemplo-ha'], procesosIds: [p1.id] }); // incluye el capítulo 4 y un proceso
    await m.agregarExclusion.ejecutar({
      ...e(),
      id: p.id,
      tipo: 'proceso',
      procesoId: p2.id,
      motivo: 'auditado el año pasado sin hallazgos',
    });
    await expect(m.aprobar.ejecutar({ ...e(), id: p.id, versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoError); // falta el tema del Anexo A
    await m.agregarExclusion.ejecutar({
      ...e(),
      id: p.id,
      tipo: 'capitulo',
      libreriaCodigo: 'iso-27001-2022-anexo-a',
      capitulo: 'Organizacionales',
      motivo: 'riesgo bajo',
    });
    const ap = await m.aprobar.ejecutar({ ...e(), id: p.id, versionEsperada: 1 });
    expect(ap.estado).toBe('aprobado');
    await expect(m.aprobar.ejecutar({ ...e(), id: p.id, versionEsperada: 2 })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('aprobar es solo del administrador SIG (permiso aparte de planificar)', async () => {
    const { m, p } = await con();
    m.estado.conceder(COLAB, A, 'auditoria.planificar');
    await expect(m.aprobar.ejecutar({ ...e(COLAB), id: p.id, versionEsperada: 1 })).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('una auditoría cancelada no cuenta para incluir', async () => {
    const { m, p, p1 } = await con();
    sembrarAuditoria(m, p.id, { estado: 'cancelada', normas: NORMAS, procesosIds: [p1.id] });
    const d = await m.obtener.ejecutar({ ...e(), id: p.id });
    expect(d.pendientes.procesos).toHaveLength(2);
    expect(d.pendientes.procesosIncluidos).toBe(0);
  });

  it('el motivo se registra sin texto y solo mientras el programa no está aprobado', async () => {
    const { m, p, p1 } = await con();
    const x = await m.agregarExclusion.ejecutar({ ...e(), id: p.id, tipo: 'proceso', procesoId: p1.id, motivo: 'MOTIVO-PRIVADO' });
    expect(x).toMatchObject({ tipo: 'proceso', procesoId: p1.id, motivo: 'MOTIVO-PRIVADO' });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'exclusion.creada', objeto: 'exclusion:2027.PR-001' });
    expect(JSON.stringify(m.estado.eventos)).not.toContain('MOTIVO-PRIVADO');
    await expect(
      m.agregarExclusion.ejecutar({ ...e(), id: p.id, tipo: 'proceso', procesoId: p1.id, motivo: 'otra vez' }),
    ).rejects.toBeInstanceOf(ConflictoError);
    await m.quitarExclusion.ejecutar({ ...e(), id: p.id, exclusionId: x.id });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'exclusion.eliminada' });
    await expect(m.quitarExclusion.ejecutar({ ...e(), id: p.id, exclusionId: x.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('aprobado, ya no se agregan ni se quitan motivos (hay que cambiar el programa antes)', async () => {
    const { m, p, p1, p2 } = await con();
    sembrarAuditoria(m, p.id, { normas: NORMAS, procesosIds: [p1.id] });
    const x = await m.agregarExclusion.ejecutar({ ...e(), id: p.id, tipo: 'proceso', procesoId: p2.id, motivo: 'riesgo bajo' });
    await m.aprobar.ejecutar({ ...e(), id: p.id, versionEsperada: 1 });
    await expect(m.agregarExclusion.ejecutar({ ...e(), id: p.id, tipo: 'proceso', procesoId: p1.id, motivo: 'otro' })).rejects.toBeInstanceOf(ConflictoError);
    await expect(m.quitarExclusion.ejecutar({ ...e(), id: p.id, exclusionId: x.id })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('rechaza motivos y destinos mal formados (400) y un proceso o norma ajenos', async () => {
    const { m, p, p1 } = await con();
    for (const mal of [
      { tipo: 'otro', motivo: 'x' },
      { tipo: 'proceso', procesoId: p1.id, motivo: '' },
      { tipo: 'proceso', procesoId: 'no-uuid', motivo: 'x' },
      { tipo: 'proceso', procesoId: '00000000-0000-4000-8000-000000000000', motivo: 'x' },
      { tipo: 'proceso', procesoId: p1.id, capitulo: '9', motivo: 'x' },
      { tipo: 'capitulo', libreriaCodigo: 'iso-27001-2022-anexo-a', motivo: 'x' },
      { tipo: 'capitulo', libreriaCodigo: 'no-esta-en-el-programa', capitulo: '9', motivo: 'x' },
      { tipo: 'capitulo', libreriaCodigo: 'ejemplo-ha', capitulo: '4', procesoId: p1.id, motivo: 'x' },
    ])
      await expect(m.agregarExclusion.ejecutar({ ...e(), id: p.id, ...mal }), JSON.stringify(mal)).rejects.toBeInstanceOf(
        ParametroInvalidoError,
      );
  });

  it('el programa y sus motivos de otra empresa no se ven ni se tocan', async () => {
    const { m, p, p1 } = await con();
    await expect(m.obtener.ejecutar({ ...e(ADMIN_B, B), id: p.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      m.agregarExclusion.ejecutar({ ...e(ADMIN_B, B), id: p.id, tipo: 'proceso', procesoId: p1.id, motivo: 'x' }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.aprobar.ejecutar({ ...e(ADMIN_B, B), id: p.id, versionEsperada: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect((await m.listar.ejecutar(e(ADMIN_B, B))).programas).toEqual([]);
  });

  it('si la bitácora falla no queda nada (misma transacción)', async () => {
    const { m, p, p1 } = await con();
    m.estado.fallarBitacora = true;
    await expect(m.agregarExclusion.ejecutar({ ...e(), id: p.id, tipo: 'proceso', procesoId: p1.id, motivo: 'x' })).rejects.toThrow();
    m.estado.fallarBitacora = false;
    expect([...m.estado.auditoriaEstado.exclusiones.values()]).toEqual([]);
  });
});
