import { A, ADMIN, B, COLAB, EstadoFalso, entradas } from '@sig/certificacion/prueba';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { CertificacionApiModule } from './certificacion-api.module.js';
import { opcionesDePrueba } from './prueba/opciones.js';
import { AlmacenArchivosLocal } from '@sig/certificacion';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Auditoría interna (ADR 040), procesos y relaciones, sobre una aplicación Nest REAL con los casos de uso reales y fakes que separan los
// datos por empresa. Cada respuesta se valida contra los esquemas de openapi.yaml. Orden: 401 → 403 → 400 → 404 → 409.
const ADMIN2 = '33333333-3333-4333-8333-3333333333e3';
const AUDITOR = '55555555-5555-4555-8555-5555555555a5';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const ID_FALSO = 'dddddddd-0000-4000-8000-000000000000';
const TODOS = ['auditoria.ver', 'auditoria.planificar', 'auditoria.ejecutar', 'auditoria.aprobar', 'auditoria.gestionar'] as const;

const RUTAS: [string, string, unknown][] = [
  ['GET', '/procesos', undefined],
  ['POST', '/procesos', { nombre: 'x', duenaId: ADMIN }],
  ['POST', '/procesos/gestion-sig', undefined],
  ['PUT', `/procesos/${ID_FALSO}`, { versionEsperada: 1, nombre: 'x' }],
  ['POST', `/procesos/${ID_FALSO}/retiro`, undefined],
  ['GET', `/procesos/${ID_FALSO}/relaciones`, undefined],
  ['POST', `/procesos/${ID_FALSO}/relaciones`, { personaId: ADMIN, relacion: 'participa' }],
  ['POST', `/procesos/${ID_FALSO}/relaciones/eliminacion`, { personaId: ADMIN, relacion: 'participa' }],
  ['GET', '/programas', undefined],
  ['POST', '/programas', { anio: 2027, objetivo: 'x', normas: ['ejemplo-ha'] }],
  ['GET', `/programas/${ID_FALSO}`, undefined],
  ['PUT', `/programas/${ID_FALSO}`, { versionEsperada: 1, objetivo: 'x' }],
  ['POST', `/programas/${ID_FALSO}/aprobacion`, { versionEsperada: 1 }],
  ['POST', `/programas/${ID_FALSO}/exclusiones`, { tipo: 'proceso', procesoId: ID_FALSO, motivo: 'x' }],
  ['POST', `/programas/${ID_FALSO}/exclusiones/eliminacion`, { exclusionId: ID_FALSO }],
  ['POST', `/programas/${ID_FALSO}/auditorias`, { objetivo: 'x', inicio: '2026-11-10', fin: '2026-11-25', normas: ['ejemplo-ha'] }],
  ['GET', `/auditorias/${ID_FALSO}`, undefined],
  ['PUT', `/auditorias/${ID_FALSO}`, { versionEsperada: 1, objetivo: 'x' }],
  ['POST', `/auditorias/${ID_FALSO}/reprogramacion`, { versionEsperada: 1, inicio: '2026-11-10', fin: '2026-11-25', motivo: 'reprogramada' }],
  ['POST', `/auditorias/${ID_FALSO}/cancelacion`, { versionEsperada: 1, motivo: 'sin_recursos' }],
  ['POST', `/auditorias/${ID_FALSO}/avance`, { versionEsperada: 1, estado: 'en_preparacion' }],
  ['GET', `/auditorias/${ID_FALSO}/independencia?personaId=${ID_FALSO}`, undefined],
  ['POST', `/auditorias/${ID_FALSO}/equipo`, { personaId: ID_FALSO, rol: 'lider' }],
  ['POST', `/auditorias/${ID_FALSO}/equipo/eliminacion`, { personaId: ID_FALSO }],
  ['GET', `/auditorias/${ID_FALSO}/lista`, undefined],
  ['POST', `/auditorias/${ID_FALSO}/lista/regeneracion`, undefined],
  ['PUT', `/auditorias/${ID_FALSO}/lista/resultado`, { filaId: ID_FALSO, versionEsperada: 1, resultado: 'conforme' }],
  ['POST', `/auditorias/${ID_FALSO}/lista/preguntas`, { filaId: ID_FALSO, texto: 'x' }],
  ['POST', `/auditorias/${ID_FALSO}/lista/preguntas/eliminacion`, { preguntaId: ID_FALSO }],
  ['GET', `/auditorias/${ID_FALSO}/hallazgos`, undefined],
  ['POST', `/auditorias/${ID_FALSO}/hallazgos`, { tipo: 'observacion', enunciado: 'x', evidencia: 'y' }],
  ['PUT', `/auditorias/${ID_FALSO}/hallazgos`, { hallazgoId: ID_FALSO, versionEsperada: 1, enunciado: 'x' }],
  ['POST', `/auditorias/${ID_FALSO}/hallazgos/anulacion`, { hallazgoId: ID_FALSO, versionEsperada: 1, motivo: 'duplicado' }],
  ['GET', `/auditorias/${ID_FALSO}/informe`, undefined],
  ['POST', `/auditorias/${ID_FALSO}/informe`, { versionEsperada: 1, conclusion: 'x' }],
  ['POST', `/auditorias/${ID_FALSO}/cierre`, { versionEsperada: 1 }],
  ['GET', '/auditoria/panel', undefined],
];

describe('controladores de procesos de la auditoría interna (ADR 040)', () => {
  let arnes: Arnes;
  let estado: EstadoFalso;
  let raiz: string;
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tAdmin = () => token(A, ADMIN);
  const tColab = () => token(A, COLAB);
  const tSin = () => token(A, SIN_PERMISOS);
  const tAdminB = () => token(B, ADMIN_B);

  beforeAll(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'sigiso-api-aud-'));
    estado = new EstadoFalso();
    arnes = await crearArnes({
      hechos: bitacora.hechos,
      modulos: [
        CertificacionApiModule.register(
          opcionesDePrueba({ estado, almacen: new AlmacenArchivosLocal(raiz), reloj: () => new Date('2026-11-19T15:00:00Z') }),
        ),
      ],
    });
  });
  afterAll(async () => {
    await arnes.cerrar();
    await rm(raiz, { recursive: true, force: true });
  });
  beforeEach(() => {
    estado.auditoriaEstado.limpiar();
    estado.catalogoPorEmpresa.clear();
    estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
    estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
    estado.eventos = [];
    estado.permisos.clear();
    estado.fallarBitacora = false;
    for (const u of [ADMIN, ADMIN2]) estado.conceder(u, A, ...TODOS);
    estado.conceder(COLAB, A, 'auditoria.ver');
    estado.conceder(AUDITOR, A, 'auditoria.ver', 'auditoria.ejecutar');
    estado.conceder(ADMIN_B, B, ...TODOS);
    estado.documentosEstado.personas.set(A, [
      { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
      { id: ADMIN2, nombre: 'Beto Admin', rol: 'administrador_sig', activa: true },
      { id: COLAB, nombre: 'Carla Colaboradora', rol: 'colaborador', activa: true },
      { id: AUDITOR, nombre: 'Dora Auditora', rol: 'auditor_interno', activa: true },
    ]);
    estado.documentosEstado.personas.set(B, [{ id: ADMIN_B, nombre: 'Admin B', rol: 'administrador_sig', activa: true }]);
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const json = async (r: Response) => (await r.json()) as J;
  const pedir = (ruta: string, t: string | undefined, metodo = 'GET', cuerpo?: unknown) => arnes.pedir(ruta, t, metodo, cuerpo);
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const c = await json(r);
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
  };
  const valida = (nombre: string, c: unknown) => expect(erroresDeEsquema(nombre, c), nombre).toEqual([]);
  const crear = async (extra: Record<string, unknown> = {}, t?: string) => {
    const r = await pedir('/procesos', t ?? (await tAdmin()), 'POST', { nombre: 'NOMBRE-PRIVADO Compras', duenaId: ADMIN, ...extra });
    expect(r.status).toBe(201);
    return json(r);
  };

  it('sin token todas las rutas responden 401, y sin permiso 403 antes de mirar el cuerpo', async () => {
    for (const [m, ruta, cuerpo] of RUTAS) {
      await problema(await pedir(ruta, undefined, m, cuerpo), 401, 'no_autenticado');
      await problema(await pedir(ruta, await tSin(), m, m === 'GET' ? undefined : {}), 403, 'sin_permiso');
    }
    for (const [m, ruta] of RUTAS.filter(([m]) => m !== 'GET'))
      await problema(await pedir(ruta, await tColab(), m, {}), 403, 'sin_permiso');
    expect(estado.auditoriaEstado.procesos.size).toBe(0);
  });

  it('crea, lista, cambia y retira; cada respuesta cumple el contrato y la bitácora no lleva textos', async () => {
    const p = await crear({ descripcion: 'DESCRIPCION-PRIVADA', importancia: 'alta' });
    valida('Proceso', p);
    expect(p).toMatchObject({ codigo: 'PR-001', importancia: 'alta', frecuencia: 'anual', estado: 'vigente', personasRelacionadas: 1 });

    const lista = await json(await pedir('/procesos', await tColab()));
    valida('ListaProcesos', lista);
    expect(lista.procesos).toHaveLength(1);
    expect(lista.gestionSigVigente).toBe(false);

    const rc = await pedir(`/procesos/${p.id}`, await tAdmin(), 'PUT', {
      versionEsperada: 1,
      nombre: 'Compras y logística',
      cambioRelevante: 'cambio',
    });
    expect(rc.status).toBe(200);
    const cambiado = await json(rc);
    valida('Proceso', cambiado);
    expect(cambiado).toMatchObject({ version: 2, cambioRelevante: 'cambio' });
    await problema(await pedir(`/procesos/${p.id}`, await tAdmin(), 'PUT', { versionEsperada: 1, nombre: 'otra' }), 409, 'conflicto');

    expect((await pedir(`/procesos/${p.id}/retiro`, await tAdmin(), 'POST')).status).toBe(204);
    await problema(await pedir(`/procesos/${p.id}/retiro`, await tAdmin(), 'POST'), 409, 'conflicto');
    expect(estado.eventos.map((e) => e.accion)).toEqual(['proceso.creado', 'relacion.creada', 'proceso.cambiado', 'proceso.retirado']);
    const todo = JSON.stringify(estado.eventos);
    for (const secreto of ['NOMBRE-PRIVADO', 'DESCRIPCION-PRIVADA', 'logística', 'Ana Admin']) expect(todo).not.toContain(secreto);
  });

  it('«Gestión del SIG»: 201 y un segundo intento es 409', async () => {
    const r = await pedir('/procesos/gestion-sig', await tAdmin(), 'POST');
    expect(r.status).toBe(201);
    const p = await json(r);
    valida('Proceso', p);
    expect(p).toMatchObject({ nombre: 'Gestión del SIG', transversal: true, duenaId: ADMIN });
    await problema(await pedir('/procesos/gestion-sig', await token(A, ADMIN2), 'POST'), 409, 'conflicto');
    expect((await json(await pedir('/procesos', await tAdmin()))).gestionSigVigente).toBe(true);
  });

  it('datos mal formados son 400 y no dejan nada; los campos de más se ignoran (la empresa no se envía)', async () => {
    for (const cuerpo of [
      {},
      { nombre: '', duenaId: ADMIN },
      { nombre: 'x', duenaId: 'no-uuid' },
      { nombre: 'x', duenaId: ADMIN, importancia: 'enorme' },
    ])
      await problema(await pedir('/procesos', await tAdmin(), 'POST', cuerpo), 400, 'parametro_invalido');
    const r = await pedir('/procesos', await tAdmin(), 'POST', {
      nombre: 'ok',
      duenaId: ADMIN,
      empresaId: B,
      codigo: 'PR-999',
      transversal: true,
    });
    expect(r.status).toBe(201);
    expect(await json(r)).toMatchObject({ codigo: 'PR-001', transversal: false });
    expect(estado.auditoriaEstado.procesos.size).toBe(1);
  });

  it('relaciones: 201 la primera vez, 200 si ya existía, 204 al quitar y la dueña vigente no se quita', async () => {
    const p = await crear();
    const url = `/procesos/${p.id}/relaciones`;
    const r1 = await pedir(url, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'participa' });
    expect(r1.status).toBe(201);
    valida('RelacionProceso', await json(r1));
    expect((await pedir(url, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'participa' })).status).toBe(200);
    const lista = await json(await pedir(url, await tColab()));
    valida('ListaRelaciones', lista);
    expect(lista.relaciones).toHaveLength(2);
    await problema(await pedir(`${url}/eliminacion`, await tAdmin(), 'POST', { personaId: ADMIN, relacion: 'duena' }), 409, 'conflicto');
    expect((await pedir(`${url}/eliminacion`, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'participa' })).status).toBe(204);
    await problema(
      await pedir(`${url}/eliminacion`, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'participa' }),
      404,
      'no_encontrado',
    );
    await problema(await pedir(url, await tAdmin(), 'POST', { personaId: 'no-uuid', relacion: 'participa' }), 400, 'parametro_invalido');
    await problema(await pedir(url, await tAdmin(), 'POST', { personaId: COLAB, relacion: 'jefa' }), 400, 'parametro_invalido');
  });

  it('un proceso de otra empresa es un 404 indistinguible del inexistente, y la empresa del token manda', async () => {
    const p = await crear();
    for (const [m, ruta, cuerpo] of RUTAS.filter(([, r]) => r.includes('/procesos/dddd'))) {
      const propio = ruta.replace(ID_FALSO, p.id);
      const cruzada = await pedir(propio, await tAdminB(), m, cuerpo);
      const inexistente = await pedir(ruta, await tAdminB(), m, cuerpo);
      expect([cruzada.status, inexistente.status]).toEqual([404, 404]);
      expect(await json(cruzada)).toEqual(await json(inexistente));
    }
    expect((await json(await pedir('/procesos', await tAdminB()))).procesos).toEqual([]);
    expect(estado.auditoriaEstado.procesos.get(p.id)).toMatchObject({ nombre: 'NOMBRE-PRIVADO Compras', version: 1 });
  });

  it('si la bitácora falla, la acción falla (500) y no queda nada', async () => {
    estado.fallarBitacora = true;
    const r = await pedir('/procesos', await tAdmin(), 'POST', { nombre: 'x', duenaId: ADMIN });
    expect(r.status).toBe(500);
    estado.fallarBitacora = false;
    expect(estado.auditoriaEstado.procesos.size).toBe(0);
  });

  describe('programa anual', () => {
    const programa = async (extra: Record<string, unknown> = {}) => {
      const r = await pedir('/programas', await tAdmin(), 'POST', { anio: 2027, objetivo: 'OBJETIVO-PRIVADO Verificar el SGSI', normas: ['ejemplo-ha', 'iso-27001-2022-anexo-a'], ...extra });
      expect(r.status).toBe(201);
      return json(r);
    };

    it('crea, lista y muestra el detalle con lo pendiente; cada respuesta cumple el contrato', async () => {
      const proceso = await crear();
      const p = await programa();
      valida('Programa', p);
      expect(p).toMatchObject({ anio: 2027, estado: 'sin_aprobar', aprobadoPor: null, version: 1, normas: ['ejemplo-ha', 'iso-27001-2022-anexo-a'] });
      const lista = await json(await pedir('/programas', await tColab()));
      valida('ListaProgramas', lista);
      expect(lista.programas).toHaveLength(1);
      const d = await json(await pedir(`/programas/${p.id}`, await tColab()));
      valida('DetallePrograma', d);
      expect(d.pendientes.procesos).toEqual([proceso.id]);
      expect(d.pendientes.capitulos).toHaveLength(2);
      await problema(await pedir('/programas', await tAdmin(), 'POST', { anio: 2027, objetivo: 'x', normas: ['ejemplo-ha'] }), 409, 'conflicto');
      for (const mal of [{}, { anio: 1999, objetivo: 'x', normas: ['ejemplo-ha'] }, { anio: 2028, objetivo: 'x', normas: ['no-adoptada'] }, { anio: 2028, objetivo: 'x', normas: [] }])
        await problema(await pedir('/programas', await tAdmin(), 'POST', mal), 400, 'parametro_invalido');
    });

    it('motivos, aprobación y cambio: 409 hasta justificar, 200 al aprobar y vuelve a «sin aprobar» al cambiar', async () => {
      const proceso = await crear();
      const p = await programa();
      await problema(await pedir(`/programas/${p.id}/aprobacion`, await tAdmin(), 'POST', { versionEsperada: 1 }), 409, 'conflicto');
      const base = `/programas/${p.id}/exclusiones`;
      const x1 = await pedir(base, await tAdmin(), 'POST', { tipo: 'proceso', procesoId: proceso.id, motivo: 'MOTIVO-PRIVADO auditado el año pasado' });
      expect(x1.status).toBe(201);
      const x = await json(x1);
      valida('ExclusionPrograma', x);
      await problema(await pedir(base, await tAdmin(), 'POST', { tipo: 'proceso', procesoId: proceso.id, motivo: 'otra vez' }), 409, 'conflicto');
      for (const [libreriaCodigo, capitulo] of [['ejemplo-ha', '4'], ['iso-27001-2022-anexo-a', 'Organizacionales']])
        expect((await pedir(base, await tAdmin(), 'POST', { tipo: 'capitulo', libreriaCodigo, capitulo, motivo: 'riesgo bajo' })).status).toBe(201);
      const ap = await pedir(`/programas/${p.id}/aprobacion`, await tAdmin(), 'POST', { versionEsperada: 1 });
      expect(ap.status).toBe(200);
      const aprobado = await json(ap);
      valida('Programa', aprobado);
      expect(aprobado).toMatchObject({ estado: 'aprobado', aprobadoPor: ADMIN, version: 2 });
      await problema(await pedir(`${base}/eliminacion`, await tAdmin(), 'POST', { exclusionId: x.id }), 409, 'conflicto');
      const cambio = await pedir(`/programas/${p.id}`, await tAdmin(), 'PUT', { versionEsperada: 2, objetivo: 'Otro objetivo' });
      expect(cambio.status).toBe(200);
      expect(await json(cambio)).toMatchObject({ estado: 'sin_aprobar', aprobadoPor: null, version: 3 });
      await problema(await pedir(`/programas/${p.id}`, await tAdmin(), 'PUT', { versionEsperada: 2, objetivo: 'viejo' }), 409, 'conflicto');
      expect((await pedir(`${base}/eliminacion`, await tAdmin(), 'POST', { exclusionId: x.id })).status).toBe(204);
      await problema(await pedir(`${base}/eliminacion`, await tAdmin(), 'POST', { exclusionId: x.id }), 404, 'no_encontrado');
      const hechos = JSON.stringify(estado.eventos);
      for (const secreto of ['OBJETIVO-PRIVADO', 'MOTIVO-PRIVADO', 'Otro objetivo', 'riesgo bajo']) expect(hechos).not.toContain(secreto);
      expect(estado.eventos.map((e) => e.accion)).toEqual(expect.arrayContaining(['programa.creado', 'exclusion.creada', 'programa.aprobado', 'programa.cambiado', 'exclusion.eliminada']));
    });

    it('un programa de otra empresa es un 404 indistinguible del inexistente', async () => {
      const p = await programa();
      for (const [m, ruta, cuerpo] of RUTAS.filter(([, r]) => r.includes('/programas/dddd'))) {
        const cruzada = await pedir(ruta.replace(ID_FALSO, p.id), await tAdminB(), m, cuerpo);
        const inexistente = await pedir(ruta, await tAdminB(), m, cuerpo);
        expect([cruzada.status, inexistente.status], `${m} ${ruta}`).toEqual([404, 404]);
        expect(await json(cruzada)).toEqual(await json(inexistente));
      }
      expect((await json(await pedir('/programas', await tAdminB()))).programas).toEqual([]);
      expect(estado.auditoriaEstado.programas.get(p.id)).toMatchObject({ version: 1, estado: 'sin_aprobar' });
    });
  });

  describe('auditorías, equipo e independencia', () => {
    const tAuditor = () => token(A, AUDITOR);
    const montar = async () => {
      const proceso = await crear();
      const pr = await json(await pedir('/programas', await tAdmin(), 'POST', { anio: 2026, objetivo: 'Programa 2026', normas: ['ejemplo-ha', 'iso-27001-2022-anexo-a'] }));
      const r = await pedir(`/programas/${pr.id}/auditorias`, await tAdmin(), 'POST', {
        objetivo: 'OBJETIVO-PRIVADO Verificar el SGSI',
        inicio: '2026-11-10',
        fin: '2026-11-25',
        reunionApertura: '2026-11-10',
        reunionCierre: '2026-11-25',
        normas: ['ejemplo-ha', 'iso-27001-2022-anexo-a'],
        procesosIds: [proceso.id],
      });
      expect(r.status).toBe(201);
      return { proceso, programa: pr, a: await json(r) };
    };

    it('planifica, consulta y cambia; cada respuesta cumple el contrato', async () => {
      const { proceso, a } = await montar();
      valida('Auditoria', a);
      expect(a).toMatchObject({ codigo: 'AI-2026-01', estado: 'planificada', combinada: true, procesosIds: [proceso.id], equipo: [], version: 1 });
      const d = await json(await pedir(`/auditorias/${a.id}`, await tColab()));
      valida('Auditoria', d);
      const c = await pedir(`/auditorias/${a.id}`, await tAdmin(), 'PUT', { versionEsperada: 1, objetivo: 'Otro objetivo', fin: '2026-11-30' });
      expect(c.status).toBe(200);
      expect(await json(c)).toMatchObject({ objetivo: 'Otro objetivo', fin: '2026-11-30', version: 2 });
      await problema(await pedir(`/auditorias/${a.id}`, await tAdmin(), 'PUT', { versionEsperada: 1, objetivo: 'viejo' }), 409, 'conflicto');
      for (const mal of [{}, { versionEsperada: 2 }, { versionEsperada: 2, inicio: '2026-02-30' }, { versionEsperada: 2, normas: ['no-adoptada'] }])
        await problema(await pedir(`/auditorias/${a.id}`, await tAdmin(), 'PUT', mal), 400, 'parametro_invalido');
    });

    it('independencia: la comprobación dice por qué, el 409 no, y la excepción exige motivo y medida', async () => {
      const { proceso, a } = await montar();
      await pedir(`/procesos/${proceso.id}/relaciones`, await tAdmin(), 'POST', { personaId: AUDITOR, relacion: 'supervisa' });
      const ver = await pedir(`/auditorias/${a.id}/independencia?personaId=${AUDITOR}`, await tColab());
      expect(ver.status).toBe(200);
      const r = await json(ver);
      valida('Independencia', r);
      expect(r).toMatchObject({ independiente: false, conflictos: [{ procesoId: proceso.id, relaciones: ['supervisa'] }] });
      await problema(await pedir(`/auditorias/${a.id}/independencia`, await tColab()), 400, 'parametro_invalido');
      await problema(await pedir(`/auditorias/${a.id}/equipo`, await tAdmin(), 'POST', { personaId: AUDITOR, rol: 'lider' }), 409, 'conflicto');
      await problema(await pedir(`/auditorias/${a.id}/equipo`, await tAdmin(), 'POST', { personaId: AUDITOR, rol: 'lider', excepcion: { motivo: 'no hay otra persona' } }), 400, 'parametro_invalido');
      const ok = await pedir(`/auditorias/${a.id}/equipo`, await tAdmin(), 'POST', {
        personaId: AUDITOR,
        rol: 'lider',
        excepcion: { motivo: 'MOTIVO-PRIVADO no hay otra persona', medida: 'MEDIDA-PRIVADA otra persona revisa el informe' },
      });
      expect(ok.status).toBe(201);
      const m = await json(ok);
      valida('MiembroEquipo', m);
      expect(m).toMatchObject({ excepcion: true, autoautorizada: false, excepcionAutorizadaPor: ADMIN });
      expect((await json(await pedir(`/auditorias/${a.id}`, await tColab()))).equipo[0]).toMatchObject({ personaId: AUDITOR, excepcion: true });
      expect(JSON.stringify(estado.eventos)).not.toMatch(/PRIVAD|Dora/);
      await problema(await pedir(`/auditorias/${a.id}/equipo`, await tAdmin(), 'POST', { personaId: COLAB, rol: 'auditor' }), 400, 'parametro_invalido');
    });

    it('avanza de estado, reprograma y cancela; la bitácora solo guarda estados y motivos cerrados', async () => {
      const { a } = await montar();
      await problema(await pedir(`/auditorias/${a.id}/avance`, await tAdmin(), 'POST', { versionEsperada: 1, estado: 'en_preparacion' }), 409, 'conflicto'); // sin líder
      const lider = await pedir(`/auditorias/${a.id}/equipo`, await tAdmin(), 'POST', { personaId: AUDITOR, rol: 'lider' });
      expect(lider.status).toBe(201);
      const prep = await pedir(`/auditorias/${a.id}/avance`, await tAdmin(), 'POST', { versionEsperada: 1, estado: 'en_preparacion' });
      expect(prep.status).toBe(200);
      expect(await json(prep)).toMatchObject({ estado: 'en_preparacion', version: 2 });
      await problema(await pedir(`/auditorias/${a.id}/avance`, await tAdmin(), 'POST', { versionEsperada: 2, estado: 'cerrada' }), 400, 'parametro_invalido');
      const rep = await pedir(`/auditorias/${a.id}/reprogramacion`, await tAdmin(), 'POST', { versionEsperada: 2, inicio: '2026-12-01', fin: '2026-12-04', motivo: 'reprogramada', nota: 'NOTA-PRIVADA vacaciones' });
      expect(rep.status).toBe(200);
      expect(await json(rep)).toMatchObject({ inicio: '2026-12-01', reprogramaciones: 1, version: 3 });
      const can = await pedir(`/auditorias/${a.id}/cancelacion`, await tAdmin(), 'POST', { versionEsperada: 3, motivo: 'sin_recursos' });
      expect(can.status).toBe(200);
      valida('Auditoria', await json(can));
      await problema(await pedir(`/auditorias/${a.id}/cancelacion`, await tAdmin(), 'POST', { versionEsperada: 4, motivo: 'sin_recursos' }), 409, 'conflicto');
      expect((await pedir(`/auditorias/${a.id}/equipo/eliminacion`, await tAdmin(), 'POST', { personaId: AUDITOR })).status).toBe(409);
      expect(JSON.stringify(estado.eventos)).not.toMatch(/PRIVAD|OBJETIVO/);
      expect(estado.eventos.map((e) => e.accion)).toEqual(expect.arrayContaining(['auditoria.planificada', 'equipo.designado', 'auditoria.avanzada', 'auditoria.reprogramada', 'auditoria.cancelada']));
    });

    it('el auditor interno consulta pero no planifica; planificar y aprobar son permisos distintos', async () => {
      const { a, programa } = await montar();
      expect((await pedir(`/auditorias/${a.id}`, await tAuditor())).status).toBe(200);
      for (const [m, ruta, cuerpo] of [
        ['POST', `/programas/${programa.id}/auditorias`, {}],
        ['PUT', `/auditorias/${a.id}`, {}],
        ['POST', `/auditorias/${a.id}/equipo`, {}],
      ] as const)
        await problema(await pedir(ruta, await tAuditor(), m, cuerpo), 403, 'sin_permiso');
    });

    it('una auditoría de otra empresa es un 404 indistinguible del inexistente', async () => {
      const { a } = await montar();
      for (const [m, ruta, cuerpo] of RUTAS.filter(([, r]) => r.includes('/auditorias/dddd'))) {
        const cruzada = await pedir(ruta.replace(ID_FALSO, a.id), await tAdminB(), m, cuerpo);
        const inexistente = await pedir(ruta, await tAdminB(), m, cuerpo);
        expect([cruzada.status, inexistente.status], `${m} ${ruta}`).toEqual([404, 404]);
        expect(await json(cruzada)).toEqual(await json(inexistente));
      }
      expect(estado.auditoriaEstado.auditorias.get(a.id)).toMatchObject({ version: 1, estado: 'planificada' });
    });
  });

  describe('lista de verificación, hallazgos, informe y panel', () => {
    const tAuditor = () => token(A, AUDITOR);
    /** Auditoría con líder, en ejecución: la lista se generó al pasar a preparación (tres filas del catálogo de prueba). */
    const enEjecucion = async () => {
      const proceso = await crear();
      const pr = await json(await pedir('/programas', await tAdmin(), 'POST', { anio: 2026, objetivo: 'Programa 2026', normas: ['ejemplo-ha', 'iso-27001-2022-anexo-a'] }));
      const a0 = await json(
        await pedir(`/programas/${pr.id}/auditorias`, await tAdmin(), 'POST', {
          objetivo: 'Verificar el SGSI',
          inicio: '2026-11-10',
          fin: '2026-11-25',
          reunionApertura: '2026-11-10',
          reunionCierre: '2026-11-25',
          normas: ['ejemplo-ha', 'iso-27001-2022-anexo-a'],
          procesosIds: [proceso.id],
        }),
      );
      expect((await pedir(`/auditorias/${a0.id}/equipo`, await tAdmin(), 'POST', { personaId: AUDITOR, rol: 'lider' })).status).toBe(201);
      const prep = await json(await pedir(`/auditorias/${a0.id}/avance`, await tAdmin(), 'POST', { versionEsperada: 1, estado: 'en_preparacion' }));
      const ejec = await json(await pedir(`/auditorias/${a0.id}/avance`, await tAdmin(), 'POST', { versionEsperada: prep.version, estado: 'en_ejecucion' }));
      return { proceso, a: ejec };
    };

    it('la lista se genera al pasar a preparación, se evalúa solo por el equipo y cumple el contrato', async () => {
      const { a } = await enEjecucion();
      const lista = await json(await pedir(`/auditorias/${a.id}/lista`, await tColab()));
      valida('ListaVerificacion', lista);
      expect(lista.filas).toHaveLength(3);
      expect(lista.avance).toMatchObject({ total: 3, evaluadas: 0 });
      const fila = lista.filas[0];
      const r = await pedir(`/auditorias/${a.id}/lista/resultado`, await tAuditor(), 'PUT', { filaId: fila.id, versionEsperada: 1, resultado: 'no_conforme', nota: 'NOTA-PRIVADA no hay registro' });
      expect(r.status).toBe(200);
      valida('FilaLista', await json(r));
      for (const mal of [{ filaId: fila.id, versionEsperada: 2, resultado: 'no_conforme' }, { filaId: fila.id, versionEsperada: 2, resultado: 'por_evaluar' }, { filaId: 'no-uuid', versionEsperada: 1, resultado: 'conforme' }])
        await problema(await pedir(`/auditorias/${a.id}/lista/resultado`, await tAuditor(), 'PUT', mal), 400, 'parametro_invalido');
      await problema(await pedir(`/auditorias/${a.id}/lista/resultado`, await tAuditor(), 'PUT', { filaId: fila.id, versionEsperada: 1, resultado: 'conforme' }), 409, 'conflicto');
      // el administrador que no está en el equipo no evalúa, aunque pueda planificar
      estado.conceder(ADMIN, A, 'auditoria.ejecutar');
      await problema(await pedir(`/auditorias/${a.id}/lista/resultado`, await tAdmin(), 'PUT', { filaId: lista.filas[1].id, versionEsperada: 1, resultado: 'conforme' }), 403, 'sin_permiso');
      expect(JSON.stringify(estado.eventos)).not.toContain('NOTA-PRIVADA');
    });

    it('preguntas propias: 201, 204, tope de 5 y 404', async () => {
      const { a } = await enEjecucion();
      const fila = (await json(await pedir(`/auditorias/${a.id}/lista`, await tColab()))).filas[0];
      let ultima: Record<string, unknown> = {};
      for (let i = 1; i <= 5; i += 1) {
        const r = await pedir(`/auditorias/${a.id}/lista/preguntas`, await tAuditor(), 'POST', { filaId: fila.id, texto: `Pregunta ${i}` });
        expect(r.status).toBe(201);
        ultima = await json(r);
        valida('PreguntaLista', ultima);
      }
      await problema(await pedir(`/auditorias/${a.id}/lista/preguntas`, await tAuditor(), 'POST', { filaId: fila.id, texto: 'una más' }), 409, 'conflicto');
      expect((await pedir(`/auditorias/${a.id}/lista/preguntas/eliminacion`, await tAuditor(), 'POST', { preguntaId: ultima.id })).status).toBe(204);
      await problema(await pedir(`/auditorias/${a.id}/lista/preguntas/eliminacion`, await tAuditor(), 'POST', { preguntaId: ultima.id }), 404, 'no_encontrado');
    });

    it('hallazgos: una NC lleva proceso y requisito; la mayor, la justificación del líder; se anulan, no se borran', async () => {
      const { a, proceso } = await enEjecucion();
      const nc = { tipo: 'nc_menor', procesoId: proceso.id, libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', enunciado: 'ENUNCIADO-PRIVADO falta la política', evidencia: 'EVIDENCIA-PRIVADA carpeta vacía' };
      const r = await pedir(`/auditorias/${a.id}/hallazgos`, await tAuditor(), 'POST', nc);
      expect(r.status).toBe(201);
      const h = await json(r);
      valida('Hallazgo', h);
      expect(h).toMatchObject({ codigo: 'H-001', estado: 'abierto', tipo: 'nc_menor' });
      for (const mal of [{ ...nc, procesoId: undefined }, { ...nc, tipo: 'nc_mayor' }, { ...nc, libreriaCodigo: 'otra', idEstable: 'zz' }, { tipo: 'observacion', enunciado: '', evidencia: 'y' }])
        await problema(await pedir(`/auditorias/${a.id}/hallazgos`, await tAuditor(), 'POST', mal), 400, 'parametro_invalido');
      const c = await pedir(`/auditorias/${a.id}/hallazgos`, await tAuditor(), 'PUT', { hallazgoId: h.id, versionEsperada: 1, tipo: 'nc_mayor', justificacionGravedad: 'falla el sistema' });
      expect(c.status).toBe(200);
      expect(await json(c)).toMatchObject({ tipo: 'nc_mayor', version: 2 });
      await problema(await pedir(`/auditorias/${a.id}/hallazgos`, await tAuditor(), 'PUT', { hallazgoId: h.id, versionEsperada: 1, enunciado: 'viejo' }), 409, 'conflicto');
      const x = await pedir(`/auditorias/${a.id}/hallazgos/anulacion`, await tAuditor(), 'POST', { hallazgoId: h.id, versionEsperada: 2, motivo: 'duplicado' });
      expect(x.status).toBe(200);
      expect(await json(x)).toMatchObject({ estado: 'anulado', anulacionMotivo: 'duplicado' });
      const lista = await json(await pedir(`/auditorias/${a.id}/hallazgos`, await tColab()));
      valida('ListaHallazgos', lista);
      expect(lista.hallazgos).toHaveLength(1);
      const hechos = JSON.stringify(estado.eventos);
      for (const secreto of ['ENUNCIADO-PRIVADO', 'EVIDENCIA-PRIVADA', 'falla el sistema']) expect(hechos).not.toContain(secreto);
    });

    it('informe y cierre: 409 hasta evaluar todo, 201 al emitir, inmutable, y solo el administrador cierra; el panel lo refleja', async () => {
      const { a, proceso } = await enEjecucion();
      const filas = (await json(await pedir(`/auditorias/${a.id}/lista`, await tColab()))).filas;
      await problema(await pedir(`/auditorias/${a.id}/informe`, await tAuditor(), 'POST', { versionEsperada: a.version, conclusion: 'Conforme' }), 409, 'conflicto');
      await problema(await pedir(`/auditorias/${a.id}/informe`, await tAuditor()), 404, 'no_encontrado');
      for (const f of filas) expect((await pedir(`/auditorias/${a.id}/lista/resultado`, await tAuditor(), 'PUT', { filaId: f.id, versionEsperada: 1, resultado: 'conforme' })).status).toBe(200);
      await problema(await pedir(`/auditorias/${a.id}/informe`, await tAuditor(), 'POST', { versionEsperada: a.version, conclusion: '' }), 400, 'parametro_invalido');
      void proceso;
      const r = await pedir(`/auditorias/${a.id}/informe`, await tAuditor(), 'POST', { versionEsperada: a.version, conclusion: 'CONCLUSION-PRIVADA el sistema es conforme', limitaciones: 'No hubo' });
      expect(r.status).toBe(201);
      const informe = await json(r);
      valida('InformeAuditoria', informe);
      expect(informe.huella).toMatch(/^[0-9a-f]{64}$/);
      expect(informe.contenido.conteos).toMatchObject({ total: 3, conforme: 3 });
      expect(estado.eventos.at(-1)).toMatchObject({ accion: 'informe.emitido', objetoVersion: informe.huella });
      expect(JSON.stringify(estado.eventos)).not.toContain('CONCLUSION-PRIVADA');
      const otra = await json(await pedir(`/auditorias/${a.id}/informe`, await tColab()));
      expect(otra.huella).toBe(informe.huella);
      await problema(await pedir(`/auditorias/${a.id}/informe`, await tAuditor(), 'POST', { versionEsperada: a.version + 1, conclusion: 'otra' }), 409, 'conflicto');
      await problema(await pedir(`/auditorias/${a.id}/cierre`, await tAuditor(), 'POST', { versionEsperada: a.version + 1 }), 403, 'sin_permiso');
      const c = await pedir(`/auditorias/${a.id}/cierre`, await tAdmin(), 'POST', { versionEsperada: a.version + 1 });
      expect(c.status).toBe(200);
      valida('CierreAuditoria', await json(c));
      await problema(await pedir(`/auditorias/${a.id}/cierre`, await tAdmin(), 'POST', { versionEsperada: a.version + 2 }), 409, 'conflicto');
      const panel = await json(await pedir('/auditoria/panel', await tColab()));
      valida('PanelAuditoria', panel);
      expect(panel).toMatchObject({ programaAnio: 2026, auditorias: { total: 1, cerradas: 1 }, prerrequisito: { auditoriasCerradas: 1, cumple: false } });
      expect(panel.prerrequisito.brechas.sinDeclaracion).toBe(true); // todavía no hay Declaración aprobada
    });
  });
});
