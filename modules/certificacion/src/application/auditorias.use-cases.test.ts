import { describe, expect, it } from 'vitest';
import {
  AvanzarAuditoriaUseCase,
  CambiarAuditoriaUseCase,
  CancelarAuditoriaUseCase,
  ComprobarIndependenciaUseCase,
  CrearAuditoriaUseCase,
  DesignarMiembroUseCase,
  ObtenerAuditoriaUseCase,
  QuitarMiembroUseCase,
  ReprogramarAuditoriaUseCase,
} from './auditorias.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { AgregarRelacionUseCase, CrearGestionSigUseCase, CrearProcesoUseCase } from './procesos.use-cases.js';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/index.js';
import { AprobarProgramaUseCase, CrearProgramaUseCase } from './programas.use-cases.js';

const ADMIN2 = '33333333-3333-4333-8333-3333333333e3';
const AUDITOR = '55555555-5555-4555-8555-5555555555a5';
const AUDITOR2 = '77777777-7777-4777-8777-7777777777a7';
const BAJA = '44444444-4444-4444-8444-4444444444f4';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const TODOS = ['auditoria.ver', 'auditoria.planificar', 'auditoria.ejecutar', 'auditoria.aprobar', 'auditoria.gestionar'] as const;
const NORMAS = ['ejemplo-ha', 'iso-27001-2022-anexo-a'];

const montar = (opciones: { unicoAdmin?: boolean } = {}) => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  for (const u of opciones.unicoAdmin ? [ADMIN] : [ADMIN, ADMIN2]) estado.conceder(u, A, ...TODOS);
  estado.conceder(AUDITOR, A, 'auditoria.ver', 'auditoria.ejecutar');
  estado.conceder(COLAB, A, 'auditoria.ver');
  estado.conceder(ADMIN_B, B, ...TODOS);
  estado.documentosEstado.personas.set(A, [
    { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
    ...(opciones.unicoAdmin ? [] : [{ id: ADMIN2, nombre: 'Beto Admin', rol: 'administrador_sig', activa: true }]),
    { id: AUDITOR, nombre: 'Dora Auditora', rol: 'auditor_interno', activa: true },
    { id: AUDITOR2, nombre: 'Eli Auditor', rol: 'auditor_interno', activa: true },
    { id: COLAB, nombre: 'Carla Colaboradora', rol: 'colaborador', activa: true },
    { id: BAJA, nombre: 'Dario Retirado', rol: null, activa: false },
  ]);
  estado.documentosEstado.personas.set(B, [{ id: ADMIN_B, nombre: 'Admin B', rol: 'administrador_sig', activa: true }]);
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 19, 15, 0, t++)); // 10:00 en Ecuador, hoy = 2026-11-19
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  return {
    estado,
    crearProceso: new CrearProcesoUseCase(u, aut, reloj, nuevoId),
    gestionSig: new CrearGestionSigUseCase(u, aut, reloj, nuevoId),
    relacion: new AgregarRelacionUseCase(u, aut, reloj),
    crearPrograma: new CrearProgramaUseCase(u, aut, cat, reloj, nuevoId),
    aprobarPrograma: new AprobarProgramaUseCase(u, aut, cat, reloj),
    crear: new CrearAuditoriaUseCase(u, aut, cat, reloj, nuevoId),
    obtener: new ObtenerAuditoriaUseCase(u, aut, cat),
    cambiar: new CambiarAuditoriaUseCase(u, aut, cat, reloj),
    reprogramar: new ReprogramarAuditoriaUseCase(u, aut, cat, reloj),
    cancelar: new CancelarAuditoriaUseCase(u, aut, cat, reloj),
    avanzar: new AvanzarAuditoriaUseCase(u, aut, cat, reloj),
    independencia: new ComprobarIndependenciaUseCase(u, aut, cat, reloj),
    designar: new DesignarMiembroUseCase(u, aut, cat, reloj),
    quitar: new QuitarMiembroUseCase(u, aut),
  };
};
const e = (usuarioId = ADMIN, empresaId: string = A) => ({ empresaId, usuarioId });
const acciones = (estado: EstadoFalso): string[] => estado.eventos.map((x) => x.accion);

const base = {
  objetivo: 'Verificar el SGSI',
  inicio: '2026-11-10',
  fin: '2026-11-25',
  reunionApertura: '2026-11-10',
  reunionCierre: '2026-11-25',
  normas: NORMAS,
};

const conPrograma = async (opciones: { unicoAdmin?: boolean } = {}) => {
  const m = montar(opciones);
  const compras = await m.crearProceso.ejecutar({ ...e(), nombre: 'Compras', duenaId: ADMIN });
  const ventas = await m.crearProceso.ejecutar({ ...e(), nombre: 'Ventas', duenaId: ADMIN });
  const programa = await m.crearPrograma.ejecutar({ ...e(), anio: 2026, objetivo: 'Programa 2026', normas: NORMAS });
  return { m, compras, ventas, programa };
};
const conAuditoria = async (extra: Record<string, unknown> = {}, opciones: { unicoAdmin?: boolean } = {}) => {
  const c = await conPrograma(opciones);
  const a = await c.m.crear.ejecutar({ ...e(), programaId: c.programa.id, ...base, procesosIds: [c.compras.id], ...extra });
  return { ...c, a };
};

describe('planificar una auditoría', () => {
  it('crea con código correlativo, criterios, alcance y fechas, y lo registra sin texto libre', async () => {
    const { m, compras, a } = await conAuditoria();
    expect(a).toMatchObject({
      codigo: 'AI-2026-01',
      estado: 'planificada',
      anio: 2026,
      combinada: true,
      procesosIds: [compras.id],
      reprogramaciones: 0,
      equipo: [],
      version: 1,
    });
    expect(a.normas).toEqual([...NORMAS].sort());
    const b = await m.crear.ejecutar({
      ...e(),
      programaId: a.programaId,
      ...base,
      normas: ['ejemplo-ha'],
      inicio: '2026-12-01',
      fin: '2026-12-03',
    });
    expect(b).toMatchObject({ codigo: 'AI-2026-02', combinada: false });
    expect(acciones(m.estado)).toEqual(expect.arrayContaining(['auditoria.planificada']));
    expect(m.estado.eventos.find((x) => x.accion === 'auditoria.planificada')).toMatchObject({ objeto: 'auditoria:AI-2026-01' });
    expect(JSON.stringify(m.estado.eventos)).not.toContain('Verificar el SGSI');
  });

  it('el permiso se decide antes de mirar el cuerpo y el programa ajeno es un 404', async () => {
    const { m, programa } = await conPrograma();
    await expect(m.crear.ejecutar({ ...e(COLAB), programaId: programa.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.crear.ejecutar({ ...e(AUDITOR), programaId: programa.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.crear.ejecutar({ ...e(ADMIN_B, B), programaId: programa.id, ...base, normas: ['ejemplo-ha'] })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.crear.ejecutar({ ...e(), programaId: '00000000-0000-4000-8000-000000000000', ...base })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
  });

  it('rechaza datos mal formados, alcance fuera del programa y fechas de otro año (400)', async () => {
    const { m, programa, compras } = await conPrograma();
    const ok = { ...e(), programaId: programa.id, ...base, procesosIds: [compras.id] };
    for (const mal of [
      { objetivo: '' },
      { inicio: '2026-11-30', fin: '2026-11-01' },
      { inicio: '2027-01-10', fin: '2027-01-12' }, // otro año
      { reunionApertura: '2026-02-30' },
      { normas: [] },
      { normas: ['no-esta-en-el-programa'] },
      { procesosIds: ['no-uuid'] },
      { procesosIds: ['00000000-0000-4000-8000-000000000000'] },
      { capitulos: [{ libreriaCodigo: 'ejemplo-ha', capitulo: '99' }] },
      { capitulos: [{ libreriaCodigo: 'iso-27001-2022-anexo-a', capitulo: 'Tecnológicos' }] },
      { capitulos: 'cap' },
    ])
      await expect(m.crear.ejecutar({ ...ok, ...mal }), JSON.stringify(mal)).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect(await m.estado.auditoriaEstado.auditorias.size).toBe(0);
  });

  it('un proceso retirado no se puede incluir', async () => {
    const { m, programa, compras } = await conPrograma();
    m.estado.auditoriaEstado.procesos.set(compras.id, { ...m.estado.auditoriaEstado.procesos.get(compras.id)!, estado: 'retirado' });
    await expect(m.crear.ejecutar({ ...e(), programaId: programa.id, ...base, procesosIds: [compras.id] })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
  });

  it('en un programa aprobado, agregar una auditoría exige un motivo', async () => {
    const { m, programa, compras, ventas } = await conPrograma();
    await m.crear.ejecutar({ ...e(), programaId: programa.id, ...base, procesosIds: [compras.id, ventas.id] });
    await m.aprobarPrograma.ejecutar({ ...e(), id: programa.id, versionEsperada: 1 });
    const datos = { ...e(), programaId: programa.id, ...base, normas: ['ejemplo-ha'], inicio: '2026-12-01', fin: '2026-12-03' };
    await expect(m.crear.ejecutar(datos)).rejects.toBeInstanceOf(ParametroInvalidoError);
    const b = await m.crear.ejecutar({ ...datos, motivo: 'cambio_de_alcance', nota: 'se agrega una auditoría' });
    expect(b.codigo).toBe('AI-2026-02');
  });

  it('el detalle suma «Gestión del SIG» al alcance cuando cubre las cláusulas 4 a 10', async () => {
    const { m, compras, a } = await conAuditoria();
    const sig = await m.gestionSig.ejecutar(e());
    const d = await m.obtener.ejecutar({ ...e(COLAB), id: a.id });
    expect([...d.procesosDelAlcance].sort()).toEqual([compras.id, sig.id].sort());
    // solo el Anexo A: no cubre cláusulas de gestión
    const solo = await m.crear.ejecutar({
      ...e(),
      programaId: a.programaId,
      ...base,
      normas: ['iso-27001-2022-anexo-a'],
      inicio: '2026-12-01',
      fin: '2026-12-03',
      procesosIds: [compras.id],
    });
    expect((await m.obtener.ejecutar({ ...e(), id: solo.id })).procesosDelAlcance).toEqual([compras.id]);
    await expect(m.obtener.ejecutar({ ...e(SIN_PERMISOS), id: a.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.obtener.ejecutar({ ...e(ADMIN_B, B), id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('cambiar, reprogramar y cancelar', () => {
  it('cambia con concurrencia optimista y solo antes de la ejecución', async () => {
    const { m, a } = await conAuditoria();
    const c = await m.cambiar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, objetivo: 'Otro objetivo', fin: '2026-11-30' });
    expect(c).toMatchObject({ objetivo: 'Otro objetivo', fin: '2026-11-30', version: 2 });
    await expect(m.cambiar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, objetivo: 'viejo' })).rejects.toBeInstanceOf(
      ConflictoDeVersionError,
    );
    await expect(m.cambiar.ejecutar({ ...e(), id: a.id, versionEsperada: 2 })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.cambiar.ejecutar({ ...e(), id: a.id, objetivo: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect(acciones(m.estado).at(-1)).toBe('auditoria.cambiada');
    expect(JSON.stringify(m.estado.eventos)).not.toContain('Otro objetivo');
  });

  it('cambiar el alcance se rechaza (409) si el equipo ya designado dejaría de ser independiente', async () => {
    const { m, ventas, a } = await conAuditoria();
    await m.relacion.ejecutar({ ...e(), id: ventas.id, personaId: AUDITOR, relacion: 'participa' });
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
    await expect(m.cambiar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, procesosIds: [ventas.id] })).rejects.toBeInstanceOf(
      ConflictoError,
    );
  });

  it('reprogramar exige un motivo cerrado, cuenta las reprogramaciones y no crea otra auditoría', async () => {
    const { m, a } = await conAuditoria();
    const r = await m.reprogramar.ejecutar({
      ...e(),
      id: a.id,
      versionEsperada: 1,
      inicio: '2026-12-01',
      fin: '2026-12-04',
      motivo: 'reprogramada',
      nota: 'vacaciones',
    });
    expect(r).toMatchObject({ inicio: '2026-12-01', fin: '2026-12-04', reprogramaciones: 1, codigo: 'AI-2026-01', version: 2 });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'auditoria.reprogramada', despues: { motivo: 'reprogramada' } });
    expect(JSON.stringify(m.estado.eventos)).not.toContain('vacaciones');
    for (const mal of [{ motivo: 'inventado' }, { motivo: 'otro' }, {}])
      await expect(
        m.reprogramar.ejecutar({ ...e(), id: a.id, versionEsperada: 2, inicio: '2026-12-01', fin: '2026-12-04', ...mal }),
      ).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(
      m.reprogramar.ejecutar({ ...e(), id: a.id, versionEsperada: 2, inicio: '2027-01-01', fin: '2027-01-04', motivo: 'reprogramada' }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('cancelar conserva todo, no se reabre y no admite más cambios', async () => {
    const { m, a } = await conAuditoria();
    const c = await m.cancelar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, motivo: 'sin_recursos' });
    expect(c).toMatchObject({ estado: 'cancelada', cancelacionMotivo: 'sin_recursos', version: 2 });
    await expect(m.cancelar.ejecutar({ ...e(), id: a.id, versionEsperada: 2, motivo: 'sin_recursos' })).rejects.toBeInstanceOf(
      ConflictoError,
    );
    await expect(m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 2, estado: 'en_preparacion' })).rejects.toBeInstanceOf(
      ConflictoError,
    );
    await expect(m.cambiar.ejecutar({ ...e(), id: a.id, versionEsperada: 2, objetivo: 'x' })).rejects.toBeInstanceOf(ConflictoError);
    await expect(
      m.reprogramar.ejecutar({ ...e(), id: a.id, versionEsperada: 2, inicio: '2026-12-01', fin: '2026-12-04', motivo: 'reprogramada' }),
    ).rejects.toBeInstanceOf(ConflictoError);
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'auditoria.cancelada', despues: { motivo: 'sin_recursos' } });
  });
});

describe('equipo e independencia', () => {
  it('designa a un auditor interno o a un administrador, con un solo líder, y lo registra solo con identificadores', async () => {
    const { m, a } = await conAuditoria();
    const lider = await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
    expect(lider).toMatchObject({ personaId: AUDITOR, rol: 'lider', excepcion: false, autoautorizada: false });
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: ADMIN2, rol: 'auditor' });
    await expect(m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR2, rol: 'lider' })).rejects.toBeInstanceOf(ConflictoError);
    await expect(m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'auditor' })).rejects.toBeInstanceOf(ConflictoError);
    const ev = m.estado.eventos.filter((x) => x.accion === 'equipo.designado');
    expect(ev[0]).toMatchObject({
      objeto: 'equipo:AI-2026-01',
      despues: { persona_id: AUDITOR, rol: 'lider', excepcion: false, autoautorizada: false },
    });
    expect(JSON.stringify(ev)).not.toContain('Dora');
  });

  it('no designa a un colaborador, a quien se dio de baja ni a una persona de otra empresa (400)', async () => {
    const { m, a } = await conAuditoria();
    for (const personaId of [COLAB, BAJA, ADMIN_B, 'no-uuid'])
      await expect(m.designar.ejecutar({ ...e(), id: a.id, personaId, rol: 'auditor' }), personaId).rejects.toBeInstanceOf(
        ParametroInvalidoError,
      );
    await expect(m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'jefe' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.designar.ejecutar({ ...e(COLAB), id: a.id, personaId: AUDITOR, rol: 'auditor' })).rejects.toBeInstanceOf(
      SinPermisoError,
    );
  });

  it('una relación con un proceso del alcance impide designar (409) y la comprobación dice por qué', async () => {
    const { m, compras, a } = await conAuditoria();
    await m.relacion.ejecutar({ ...e(), id: compras.id, personaId: AUDITOR, relacion: 'supervisa' });
    await expect(m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'auditor' })).rejects.toBeInstanceOf(ConflictoError);
    const r = await m.independencia.ejecutar({ ...e(COLAB), id: a.id, personaId: AUDITOR });
    expect(r).toMatchObject({ independiente: false, conflictos: [{ procesoId: compras.id, relaciones: ['supervisa'] }] });
    expect((await m.independencia.ejecutar({ ...e(), id: a.id, personaId: AUDITOR2 })).independiente).toBe(true);
    await expect(m.independencia.ejecutar({ ...e(), id: a.id, personaId: BAJA })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('el administrador que diseñó el sistema no puede auditar las cláusulas de gestión (proceso «Gestión del SIG»)', async () => {
    const { m, a } = await conAuditoria();
    const sig = await m.gestionSig.ejecutar(e()); // quien llama (ADMIN) queda como dueña
    const r = await m.independencia.ejecutar({ ...e(), id: a.id, personaId: ADMIN });
    expect(r.independiente).toBe(false);
    expect(r.conflictos.map((c) => c.procesoId)).toContain(sig.id);
    await expect(m.designar.ejecutar({ ...e(), id: a.id, personaId: ADMIN, rol: 'lider' })).rejects.toBeInstanceOf(ConflictoError);
    expect((await m.designar.ejecutar({ ...e(), id: a.id, personaId: ADMIN2, rol: 'lider' })).rol).toBe('lider');
  });

  it('la repetición del mismo proceso es solo un aviso, no un bloqueo', async () => {
    const { m, compras, programa, a } = await conAuditoria({ inicio: '2026-03-02', fin: '2026-03-06', reunionApertura: '2026-03-02', reunionCierre: '2026-03-06' }); // ya realizada
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR2, rol: 'lider' }); // primera auditoría
    const b = await m.crear.ejecutar({
      ...e(),
      programaId: programa.id,
      ...base,
      inicio: '2026-12-01',
      fin: '2026-12-03',
      procesosIds: [compras.id],
    });
    const r = await m.independencia.ejecutar({ ...e(), id: b.id, personaId: AUDITOR2 });
    expect(r.independiente).toBe(true);
    expect(r.avisos).toEqual([{ procesoId: compras.id, ultimaFecha: '2026-03-06' }]);
    expect((await m.designar.ejecutar({ ...e(), id: b.id, personaId: AUDITOR2, rol: 'lider' })).excepcion).toBe(false);
  });

  it('la excepción exige motivo y medida compensatoria, queda marcada y no se registra con texto', async () => {
    const { m, compras, a } = await conAuditoria();
    await m.relacion.ejecutar({ ...e(), id: compras.id, personaId: AUDITOR, relacion: 'participa' });
    for (const mal of [{}, { motivo: 'no hay otra persona' }, { medida: 'otra persona revisa' }, { motivo: '', medida: 'x' }])
      await expect(m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider', excepcion: mal })).rejects.toBeInstanceOf(
        ParametroInvalidoError,
      );
    const x = await m.designar.ejecutar({
      ...e(),
      id: a.id,
      personaId: AUDITOR,
      rol: 'lider',
      excepcion: { motivo: 'MOTIVO-PRIVADO no hay otra persona', medida: 'MEDIDA-PRIVADA otra persona revisa el informe' },
    });
    expect(x).toMatchObject({ excepcion: true, autoautorizada: false, excepcionAutorizadaPor: ADMIN });
    const ev = m.estado.eventos.find((y) => y.accion === 'equipo.designado');
    expect(ev).toMatchObject({ despues: { excepcion: true, autoautorizada: false } });
    expect(JSON.stringify(m.estado.eventos)).not.toMatch(/PRIVAD/);
  });

  it('nadie autoriza su propia excepción, salvo el único administrador activo (queda marcada)', async () => {
    const { m, a } = await conAuditoria({}, { unicoAdmin: true });
    const sig = await m.gestionSig.ejecutar(e()); // ADMIN diseña el sistema
    void sig;
    const x = { motivo: 'es el único administrador', medida: 'revisión por una persona externa' };
    const r = await m.designar.ejecutar({ ...e(), id: a.id, personaId: ADMIN, rol: 'lider', excepcion: x });
    expect(r).toMatchObject({ excepcion: true, autoautorizada: true });
    // con dos administradores, el que tiene el conflicto no la autoriza para sí
    const c2 = await conAuditoria();
    await c2.m.gestionSig.ejecutar(e());
    await expect(c2.m.designar.ejecutar({ ...e(), id: c2.a.id, personaId: ADMIN, rol: 'lider', excepcion: x })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
  });

  it('una excepción sin conflicto no tiene sentido (400)', async () => {
    const { m, a } = await conAuditoria();
    await expect(
      m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR2, rol: 'auditor', excepcion: { motivo: 'x', medida: 'y' } }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('quita con rastro; el líder no se quita ya en preparación', async () => {
    const { m, a } = await conAuditoria();
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR2, rol: 'auditor' });
    await m.quitar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR2 });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'equipo.retirado', objeto: 'equipo:AI-2026-01' });
    await expect(m.quitar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR2 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' });
    await expect(m.quitar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('el equipo y las relaciones de otra empresa no se tocan', async () => {
    const { m, a } = await conAuditoria();
    await expect(m.designar.ejecutar({ ...e(ADMIN_B, B), id: a.id, personaId: ADMIN_B, rol: 'lider' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.independencia.ejecutar({ ...e(ADMIN_B, B), id: a.id, personaId: ADMIN_B })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.quitar.ejecutar({ ...e(ADMIN_B, B), id: a.id, personaId: AUDITOR })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('avanzar de estado', () => {
  it('«en preparación» exige un líder y criterios; «en ejecución», la fecha de inicio y la reunión de apertura', async () => {
    const { m, a } = await conAuditoria();
    await expect(m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' })).rejects.toBeInstanceOf(
      ConflictoError,
    ); // sin líder
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
    const p = await m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' });
    expect(p).toMatchObject({ estado: 'en_preparacion', version: 2 });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'auditoria.avanzada', despues: { estado: 'en_preparacion' } });
    const en = await m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 2, estado: 'en_ejecucion' });
    expect(en.estado).toBe('en_ejecucion');
    await expect(m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 3, estado: 'en_preparacion' })).rejects.toBeInstanceOf(
      ConflictoError,
    ); // no retrocede
    await expect(m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 3, estado: 'cerrada' })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
  });

  it('no pasa a «en ejecución» antes de la fecha de inicio ni sin la reunión de apertura', async () => {
    const futura = await conAuditoria({ inicio: '2026-12-01', fin: '2026-12-05' });
    await futura.m.designar.ejecutar({ ...e(), id: futura.a.id, personaId: AUDITOR, rol: 'lider' });
    await futura.m.avanzar.ejecutar({ ...e(), id: futura.a.id, versionEsperada: 1, estado: 'en_preparacion' });
    await expect(futura.m.avanzar.ejecutar({ ...e(), id: futura.a.id, versionEsperada: 2, estado: 'en_ejecucion' })).rejects.toBeInstanceOf(
      ConflictoError,
    );
    const sinApertura = await conAuditoria({ reunionApertura: undefined });
    await sinApertura.m.designar.ejecutar({ ...e(), id: sinApertura.a.id, personaId: AUDITOR, rol: 'lider' });
    await sinApertura.m.avanzar.ejecutar({ ...e(), id: sinApertura.a.id, versionEsperada: 1, estado: 'en_preparacion' });
    await expect(
      sinApertura.m.avanzar.ejecutar({ ...e(), id: sinApertura.a.id, versionEsperada: 2, estado: 'en_ejecucion' }),
    ).rejects.toBeInstanceOf(ConflictoError);
  });

  it('si la bitácora falla no cambia nada (misma transacción)', async () => {
    const { m, a } = await conAuditoria();
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
    m.estado.fallarBitacora = true;
    await expect(m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' })).rejects.toThrow();
    m.estado.fallarBitacora = false;
    expect((await m.obtener.ejecutar({ ...e(), id: a.id })).estado).toBe('planificada');
  });

  it('con dos cambios a la vez con la misma versión, uno es conflicto', async () => {
    const { m, a } = await conAuditoria();
    await m.designar.ejecutar({ ...e(), id: a.id, personaId: AUDITOR, rol: 'lider' });
    await m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' });
    await expect(m.avanzar.ejecutar({ ...e(), id: a.id, versionEsperada: 1, estado: 'en_ejecucion' })).rejects.toBeInstanceOf(
      ConflictoDeVersionError,
    );
  });
});
