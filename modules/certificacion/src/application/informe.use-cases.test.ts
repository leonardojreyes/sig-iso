import { describe, expect, it } from 'vitest';
import { serializarCanonico } from '../domain/canonico.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import {
  A,
  ADMIN,
  ADMIN_B,
  AUDITOR,
  AUDITOR2,
  B,
  COLAB,
  SIN_PERMISOS,
  auditoriaEnEjecucion,
  evaluarTodo,
  quien,
  sha256Hex,
  type EscenarioAuditoria,
} from './prueba/index.js';

const e = quien;
const CONCLUSION = 'El sistema es conforme y eficaz frente a los criterios, con una no conformidad menor.';
const emitir = (m: EscenarioAuditoria, id: string, version: number, extra: Record<string, unknown> = {}, quienEmite = AUDITOR) =>
  m.emitirInforme.ejecutar({ ...e(quienEmite), id, versionEsperada: version, conclusion: CONCLUSION, ...extra });

/** Auditoría en ejecución con toda la lista evaluada y su hallazgo; lista para emitir el informe (versión 3). */
const lista = async () => {
  const c = await auditoriaEnEjecucion();
  const ev = await evaluarTodo(c.m, c.a, c.proceso);
  return { ...c, ...ev };
};

describe('emitir el informe', () => {
  it('congela una copia con equipo, conteos, filas, hallazgos y conclusión; la huella es el SHA-256 de esa copia', async () => {
    const { m, a } = await lista();
    const i = await emitir(m, a.id, a.version, { limitaciones: 'No se revisó el control a27-5-2.' });
    expect(i).toMatchObject({ auditoriaId: a.id, codigo: 'AI-2026-01', emitidoPor: AUDITOR });
    expect(i.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(i.huella).toBe(sha256Hex(new TextEncoder().encode(serializarCanonico(i.contenido))));
    expect(i.contenido).toMatchObject({
      version: 1,
      conclusion: CONCLUSION,
      limitaciones: 'No se revisó el control a27-5-2.',
      programa: { anio: 2026 },
      auditoria: { codigo: 'AI-2026-01', combinada: true, reunionCierre: '2026-11-25' },
      conteos: { total: 3, conforme: 1, no_conforme: 1, no_verificado: 1, por_evaluar: 0, cubiertas: 2 },
      emitidoPor: { personaId: AUDITOR, nombre: 'Dora Auditora' },
    });
    expect(i.contenido.equipo).toEqual([
      expect.objectContaining({ personaId: AUDITOR, nombre: 'Dora Auditora', rol: 'lider', excepcion: false }),
    ]);
    expect(i.contenido.noVerificadas).toHaveLength(1);
    expect(i.contenido.hallazgos).toEqual([
      expect.objectContaining({ codigo: 'H-001', tipo: 'nc_menor', proceso: 'PR-001', estado: 'abierto' }),
    ]);
    expect(i.contenido.filas).toHaveLength(3);
    // la bitácora lleva solo la huella, nunca textos
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'informe.emitido', objeto: 'informe:AI-2026-01', objetoVersion: i.huella });
    const todo = JSON.stringify(m.estado.eventos);
    for (const secreto of ['ENUNCIADO-PRIVADO', 'EVIDENCIA-PRIVADA', CONCLUSION, 'Dora']) expect(todo).not.toContain(secreto);
    // la auditoría queda con el informe emitido y es inmutable
    const act = await m.obtenerInforme.ejecutar({ ...e(COLAB), id: a.id });
    expect(act.huella).toBe(i.huella);
    await expect(m.cambiar.ejecutar({ ...e(), id: a.id, versionEsperada: a.version + 1, objetivo: 'x' })).rejects.toBeInstanceOf(
      ConflictoError,
    );
    await expect(
      m.registrarHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, tipo: 'oportunidad', enunciado: 'x', evidencia: 'y' }),
    ).rejects.toBeInstanceOf(ConflictoError);
    await expect(emitir(m, a.id, a.version + 1)).rejects.toBeInstanceOf(ConflictoError); // ya no está en ejecución
  });

  it('exige todas las filas evaluadas, «no verificado» con nota y un hallazgo por cada fila con resultado distinto de conforme', async () => {
    const c = await auditoriaEnEjecucion();
    const filas = (await c.m.listar.ejecutar({ ...e(), id: c.a.id })).filas;
    await expect(emitir(c.m, c.a.id, c.a.version)).rejects.toBeInstanceOf(ConflictoError); // sin evaluar
    await c.m.evaluar.ejecutar({ ...e(AUDITOR), id: c.a.id, filaId: filas[0]!.id, versionEsperada: 1, resultado: 'conforme' });
    await c.m.evaluar.ejecutar({ ...e(AUDITOR), id: c.a.id, filaId: filas[1]!.id, versionEsperada: 1, resultado: 'no_verificado' }); // sin nota
    await c.m.evaluar.ejecutar({
      ...e(AUDITOR),
      id: c.a.id,
      filaId: filas[2]!.id,
      versionEsperada: 1,
      resultado: 'observacion',
      nota: 'riesgo de caducidad',
    });
    await expect(emitir(c.m, c.a.id, c.a.version)).rejects.toBeInstanceOf(ConflictoError); // «no verificado» sin nota
    await c.m.evaluar.ejecutar({
      ...e(AUDITOR),
      id: c.a.id,
      filaId: filas[1]!.id,
      versionEsperada: 2,
      resultado: 'no_verificado',
      nota: 'sin tiempo',
    });
    await expect(emitir(c.m, c.a.id, c.a.version)).rejects.toBeInstanceOf(ConflictoError); // la observación no tiene hallazgo
    await c.m.registrarHallazgo.ejecutar({
      ...e(AUDITOR),
      id: c.a.id,
      itemId: filas[2]!.id,
      tipo: 'observacion',
      enunciado: 'x',
      evidencia: 'y',
    });
    expect((await emitir(c.m, c.a.id, c.a.version)).contenido.conteos.observacion).toBe(1);
  });

  it('un hallazgo anulado ya no respalda la fila', async () => {
    const { m, a, hallazgo } = await lista();
    await m.anularHallazgo.ejecutar({ ...e(AUDITOR), id: a.id, hallazgoId: hallazgo.id, versionEsperada: 1, motivo: 'duplicado' });
    await expect(emitir(m, a.id, a.version)).rejects.toBeInstanceOf(ConflictoError);
  });

  it('vuelve a comprobar la independencia: una relación nueva con el proceso lo impide, salvo excepción', async () => {
    const { m, a, proceso } = await lista();
    await m.relacion.ejecutar({ ...e(), id: proceso.id, personaId: AUDITOR, relacion: 'participa' });
    await expect(emitir(m, a.id, a.version)).rejects.toBeInstanceOf(ConflictoError);
  });

  it('exige la fecha de la reunión de cierre y la versión actual', async () => {
    const sin = await auditoriaEnEjecucion({ reunionCierre: undefined });
    await evaluarTodo(sin.m, sin.a, sin.proceso);
    await expect(emitir(sin.m, sin.a.id, sin.a.version)).rejects.toBeInstanceOf(ConflictoError);
    const { m, a } = await lista();
    await expect(emitir(m, a.id, a.version + 5)).rejects.toBeInstanceOf(ConflictoDeVersionError);
  });

  it('la conclusión es obligatoria y acotada (400); la versión también', async () => {
    const { m, a } = await lista();
    for (const mal of [{ conclusion: '' }, { conclusion: 'x'.repeat(1001) }, { limitaciones: 'x'.repeat(1001) }, { conclusion: undefined }])
      await expect(emitir(m, a.id, a.version, mal), JSON.stringify(mal)).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.emitirInforme.ejecutar({ ...e(AUDITOR), id: a.id, conclusion: CONCLUSION })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
  });

  it('lo emite el administrador SIG o el líder; ni un miembro que no es líder, ni quien no es del equipo', async () => {
    const { m, a } = await lista();
    await expect(emitir(m, a.id, a.version, {}, COLAB)).rejects.toBeInstanceOf(SinPermisoError);
    await expect(emitir(m, a.id, a.version, {}, SIN_PERMISOS)).rejects.toBeInstanceOf(SinPermisoError);
    await expect(emitir(m, a.id, a.version, {}, AUDITOR2)).rejects.toBeInstanceOf(SinPermisoError); // tiene «ejecutar» pero no es líder
    const i = await emitir(m, a.id, a.version, {}, ADMIN);
    expect(i.emitidoPor).toBe(ADMIN);
  });

  it('si la bitácora falla no queda informe ni cambia el estado', async () => {
    const { m, a } = await lista();
    m.estado.fallarBitacora = true;
    await expect(emitir(m, a.id, a.version)).rejects.toThrow();
    m.estado.fallarBitacora = false;
    await expect(m.obtenerInforme.ejecutar({ ...e(), id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect((await emitir(m, a.id, a.version)).codigo).toBe('AI-2026-01');
  });

  it('el informe de otra empresa no se ve ni se emite', async () => {
    const { m, a } = await lista();
    await expect(emitir(m, a.id, a.version, {}, ADMIN_B).catch((x) => Promise.reject(x))).rejects.toBeDefined();
    await expect(m.obtenerInforme.ejecutar({ ...e(ADMIN_B, B), id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('cerrar la auditoría', () => {
  it('solo el administrador SIG cierra, después del informe; los hallazgos siguen abiertos', async () => {
    const { m, a } = await lista();
    await expect(m.cerrar.ejecutar({ ...e(), id: a.id, versionEsperada: a.version })).rejects.toBeInstanceOf(ConflictoError); // sin informe
    const i = await emitir(m, a.id, a.version);
    await expect(m.cerrar.ejecutar({ ...e(AUDITOR), id: a.id, versionEsperada: a.version + 1 })).rejects.toBeInstanceOf(SinPermisoError);
    const c = await m.cerrar.ejecutar({ ...e(), id: a.id, versionEsperada: a.version + 1 });
    expect(c).toMatchObject({ estado: 'cerrada', codigo: 'AI-2026-01', version: a.version + 2 });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'auditoria.cerrada', objeto: 'auditoria:AI-2026-01' });
    expect((await m.listarHallazgos.ejecutar({ ...e(), id: a.id })).abiertos.nc_menor).toBe(1);
    expect((await m.obtenerInforme.ejecutar({ ...e(), id: a.id })).huella).toBe(i.huella);
    await expect(m.cerrar.ejecutar({ ...e(), id: a.id, versionEsperada: a.version + 2 })).rejects.toBeInstanceOf(ConflictoError); // ya cerrada
  });
});

describe('panel y prerrequisito de la Etapa 2', () => {
  const cerrada = async (opciones: { conDeclaracion?: boolean; todoConforme?: boolean } = {}) => {
    const c = await auditoriaEnEjecucion();
    const filas = (await c.m.listar.ejecutar({ ...e(), id: c.a.id })).filas;
    if (opciones.todoConforme)
      for (const f of filas)
        await c.m.evaluar.ejecutar({ ...e(AUDITOR), id: c.a.id, filaId: f.id, versionEsperada: 1, resultado: 'conforme' });
    else await evaluarTodo(c.m, c.a, c.proceso);
    if (opciones.conDeclaracion) {
      const fila = (id: string) => ({
        libreriaCodigo: 'iso-27001-2022-anexo-a',
        idEstable: id,
        orden: 1,
        titulo: id,
        grupo: 'Organizacionales',
        aplicabilidad: 'aplica',
        implementacion: 'implementado',
        justificacion: null,
        controles: [],
        cobertura: 'cubierta',
      });
      c.m.estado.declaraciones.set(`${A}|v1`, {
        empresaId: A,
        version: {
          id: 'v1',
          numero: 1,
          alcanceTexto: null,
          total: 2,
          aplican: 2,
          noAplican: 0,
          sinControl: 0,
          aprobadaPor: ADMIN,
          aprobadaEn: new Date('2026-11-01T12:00:00Z'),
        },
        filas: [fila('a27-5-1'), fila('a27-5-2')] as never,
        copia: null,
      });
    }
    await emitir(c.m, c.a.id, c.a.version);
    await c.m.cerrar.ejecutar({ ...e(), id: c.a.id, versionEsperada: c.a.version + 1 });
    return c;
  };

  it('sin auditorías cerradas no cumple y muestra todo lo que falta como brecha', async () => {
    const { m } = await auditoriaEnEjecucion();
    const p = await m.panel.ejecutar(e(COLAB));
    expect(p.programaAnio).toBe(2026);
    expect(p.prerrequisito).toMatchObject({ cumple: false, auditoriasCerradas: 0 });
    expect(p.prerrequisito.brechas.clausulas).toEqual(['ejemplo-ha:ha-4.1']);
    expect(p.auditorias).toMatchObject({ total: 1, cerradas: 0 });
    expect(p.auditorias.porEstado.en_ejecucion).toBe(1);
    await expect(m.panel.ejecutar(e(SIN_PERMISOS))).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('con una cerrada que cubre todo y una Declaración aprobada, cumple', async () => {
    const c = await cerrada({ conDeclaracion: true, todoConforme: true });
    const p = await c.m.panel.ejecutar(e(COLAB));
    expect(p.prerrequisito).toMatchObject({
      cumple: true,
      auditoriasCerradas: 1,
      brechas: { clausulas: [], procesos: [], controles: [], sinDeclaracion: false },
    });
    expect(p.cobertura12Meses).toMatchObject({
      clausulas: { total: 1, cubiertas: 1 },
      controles: { total: 2, cubiertos: 2 },
      procesos: { total: 1, cubiertos: 1 },
    });
    expect(p.auditorias.cerradas).toBe(1);
  });

  it('lo «no verificado» no cuenta: queda como brecha, y sin Declaración aprobada no se puede decir que cumple', async () => {
    const c = await cerrada({ conDeclaracion: false });
    const p = await c.m.panel.ejecutar(e());
    expect(p.prerrequisito.cumple).toBe(false);
    expect(p.prerrequisito.brechas.sinDeclaracion).toBe(true);
    expect(p.prerrequisito.auditoriasCerradas).toBe(1);
    const d = await cerrada({ conDeclaracion: true });
    const q = await d.m.panel.ejecutar(e());
    expect(q.prerrequisito.cumple).toBe(false); // una fila quedó «no verificado»: el control no cuenta
    expect(q.prerrequisito.brechas.controles.length).toBeGreaterThan(0);
  });

  it('el panel de otra empresa no ve lo de A', async () => {
    const { m } = await cerrada({ conDeclaracion: true, todoConforme: true });
    const p = await m.panel.ejecutar(e(ADMIN_B, B));
    expect(p).toMatchObject({ programaAnio: null, prerrequisito: { cumple: false, auditoriasCerradas: 0 }, auditorias: { total: 0 } });
  });
});
