import { Riesgo } from '@sig/certificacion';
import { A, ADMIN, AlmacenFalso, B, COLAB, EstadoFalso } from '@sig/certificacion/prueba';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { CertificacionApiModule } from './certificacion-api.module.js';
import { opcionesDePrueba } from './prueba/opciones.js';

// Activos de información (ADR 038) sobre una aplicación Nest REAL con los casos de uso reales y fakes que separan los datos por empresa.
// Cada respuesta se valida contra los esquemas de openapi.yaml. Orden: 401 → 403 → 400 → 404 → 409.
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const ID_FALSO = 'dddddddd-0000-4000-8000-000000000000';
const ACTIVO = { nombre: 'NOMBRE-PRIVADO Servidor de archivos', descripcion: 'DESCRIPCION-PRIVADA', tipo: 'infraestructura', clasificacion: 'confidencial', responsableId: ADMIN };

const RUTAS: [string, string, unknown][] = [
  ['GET', '/activos', undefined],
  ['POST', '/activos', ACTIVO],
  ['GET', `/activos/${ID_FALSO}`, undefined],
  ['PUT', `/activos/${ID_FALSO}`, { versionEsperada: 1 }],
  ['GET', `/activos/${ID_FALSO}/aviso-retiro`, undefined],
  ['POST', `/activos/${ID_FALSO}/retiro`, { versionEsperada: 1 }],
  ['GET', `/riesgos/${ID_FALSO}/activos`, undefined],
  ['POST', `/riesgos/${ID_FALSO}/activos`, { activoId: ID_FALSO }],
  ['POST', `/riesgos/${ID_FALSO}/activos/eliminacion`, { activoId: ID_FALSO }],
];

describe('controladores de activos de información (ADR 038)', () => {
  let arnes: Arnes;
  let estado: EstadoFalso;
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tAdmin = () => token(A, ADMIN);
  const tColab = () => token(A, COLAB);
  const tSin = () => token(A, SIN_PERMISOS);
  const tAdminB = () => token(B, ADMIN_B);

  beforeAll(async () => {
    estado = new EstadoFalso();
    arnes = await crearArnes({ hechos: bitacora.hechos, modulos: [CertificacionApiModule.register(opcionesDePrueba({ estado, almacen: new AlmacenFalso(), reloj: () => new Date('2026-11-24T15:00:00Z') }))] });
  });
  afterAll(async () => {
    await arnes.cerrar();
  });
  beforeEach(() => {
    estado.riesgos.clear();
    estado.riesgosEstado.activos.clear();
    estado.riesgosEstado.ligasActivo.clear();
    estado.eventos = [];
    estado.permisos.clear();
    estado.carrera = false;
    estado.fallarBitacora = false;
    estado.conceder(ADMIN, A, 'activos.ver', 'activos.gestionar', 'riesgos.ver');
    estado.conceder(COLAB, A, 'activos.ver');
    estado.conceder(ADMIN_B, B, 'activos.ver', 'activos.gestionar');
    const persona = (id: string, nombre: string) => ({ id, nombre, rol: 'administrador_sig', activa: true });
    estado.documentosEstado.personas.set(A, [persona(ADMIN, 'Ana Admin'), { id: COLAB, nombre: 'Carla', rol: 'colaborador', activa: true }, { id: '88888888-8888-4888-8888-888888888888', nombre: 'Dario', rol: null, activa: false }]);
    estado.documentosEstado.personas.set(B, [persona(ADMIN_B, 'Admin B')]);
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
    const r = await pedir('/activos', t ?? (await tAdmin()), 'POST', { ...ACTIVO, ...extra });
    expect(r.status).toBe(201);
    return json(r);
  };
  const riesgo = (empresaId: typeof A, k: number) => {
    const r = Riesgo.crear({ id: `dddddddd-0000-4000-8000-${String(k).padStart(12, '0')}`, empresaId, codigo: `R-${String(k).padStart(3, '0')}`, titulo: `Riesgo ${k}`, probabilidad: 3, impacto: 4, decision: 'mitigar' });
    estado.riesgos.set(r.id, r);
    return r;
  };

  describe('401 sin token', () => {
    it.each(RUTAS)('%s %s', async (metodo, ruta, cuerpo) => {
      await problema(await pedir(ruta, undefined, metodo, cuerpo), 401, 'no_autenticado');
      expect(estado.riesgosEstado.activos.size).toBe(0);
    });
  });

  describe('403 sin permiso: se decide ANTES de mirar el cuerpo o el identificador', () => {
    it.each(RUTAS)('%s %s', async (metodo, ruta, cuerpo) => {
      await problema(await pedir(ruta, await tSin(), metodo, cuerpo), 403, 'sin_permiso');
    });
    it('el colaborador consulta pero no crea, cambia, retira ni liga', async () => {
      const a = await crear();
      expect((await pedir('/activos', await tColab())).status).toBe(200);
      for (const [metodo, ruta, cuerpo] of [
        ['POST', '/activos', ACTIVO],
        ['PUT', `/activos/${a.id}`, { versionEsperada: 1, nombre: 'x' }],
        ['GET', `/activos/${a.id}/aviso-retiro`, undefined],
        ['POST', `/activos/${a.id}/retiro`, { versionEsperada: 1 }],
        ['POST', `/riesgos/${ID_FALSO}/activos`, { activoId: a.id }],
      ] as [string, string, unknown][])
        await problema(await pedir(ruta, await tColab(), metodo, cuerpo), 403, 'sin_permiso');
    });
  });

  it('crear: 201 con código correlativo, esquema del contrato y bitácora sin texto', async () => {
    const a = await crear();
    valida('Activo', a);
    expect(a).toMatchObject({ codigo: 'A-001', estado: 'vigente', version: 1, tipo: 'infraestructura' });
    expect((await crear({ nombre: 'Otro' })).codigo).toBe('A-002');
    expect(estado.eventos[0]).toMatchObject({ accion: 'activo.creado', objeto: 'activo:A-001' });
    expect(JSON.stringify(estado.eventos)).not.toMatch(/NOMBRE-PRIVADO|DESCRIPCION-PRIVADA/);
  });

  it('crear valida datos (400), exige un responsable activo de la empresa y no cuela campos de más', async () => {
    for (const mal of [{ tipo: 'cosa' }, { clasificacion: 'secreta' }, { nombre: '' }, { responsableId: ADMIN_B }, { responsableId: '88888888-8888-4888-8888-888888888888' }, { responsableId: 'x' }])
      await problema(await pedir('/activos', await tAdmin(), 'POST', { ...ACTIVO, ...mal }), 400, 'parametro_invalido');
    const r = await pedir('/activos', await tAdmin(), 'POST', { ...ACTIVO, codigo: 'A-999', estado: 'retirado', empresaId: B });
    expect(r.status).toBe(201);
    expect(await json(r)).toMatchObject({ codigo: 'A-001', estado: 'vigente' });
  });

  it('listar y ver cumplen el contrato; señalan los activos sin riesgo y el nivel más alto', async () => {
    const a = await crear();
    await crear({ nombre: 'Sin riesgos' });
    const r = riesgo(A, 1);
    expect((await pedir(`/riesgos/${r.id}/activos`, await tAdmin(), 'POST', { activoId: a.id })).status).toBe(201);
    const lista = await json(await pedir('/activos', await tColab()));
    lista.forEach((x: unknown) => valida('ActivoListado', x));
    expect(lista.find((x: J) => x.id === a.id)).toMatchObject({ riesgos: 1, sinRiesgos: false });
    expect(lista.find((x: J) => x.id !== a.id)).toMatchObject({ riesgos: 0, sinRiesgos: true });
    const det = await json(await pedir(`/activos/${a.id}`, await tColab()));
    valida('ActivoDetalle', det);
    expect(det).toMatchObject({ nivelMasAlto: 'alto' });
    await problema(await pedir('/activos?tipo=cosa', await tAdmin()), 400, 'parametro_invalido');
    expect((await json(await pedir('/activos?tipo=persona', await tAdmin()))).length).toBe(0);
  });

  it('cambiar exige la versión que la persona vio (409 si otra cambió antes)', async () => {
    const a = await crear();
    const ok = await pedir(`/activos/${a.id}`, await tAdmin(), 'PUT', { versionEsperada: 1, nombre: 'Nuevo nombre' });
    expect(ok.status).toBe(200);
    expect(await json(ok)).toMatchObject({ nombre: 'Nuevo nombre', version: 2 });
    await problema(await pedir(`/activos/${a.id}`, await tAdmin(), 'PUT', { versionEsperada: 1, nombre: 'x' }), 409, 'conflicto');
    await problema(await pedir(`/activos/${a.id}`, await tAdmin(), 'PUT', { nombre: 'x' }), 400, 'parametro_invalido');
  });

  it('retirar: aviso previo de los riesgos que quedarían sin activo, y el activo retirado no se liga', async () => {
    const a = await crear();
    const r = riesgo(A, 1);
    await pedir(`/riesgos/${r.id}/activos`, await tAdmin(), 'POST', { activoId: a.id });
    const aviso = await json(await pedir(`/activos/${a.id}/aviso-retiro`, await tAdmin()));
    valida('AvisoRetiroActivo', aviso);
    expect(aviso.riesgosSinActivo.map((x: J) => x.codigo)).toEqual(['R-001']);
    const ret = await pedir(`/activos/${a.id}/retiro`, await tAdmin(), 'POST', { versionEsperada: 1 });
    expect(ret.status).toBe(200);
    expect(await json(ret)).toMatchObject({ estado: 'retirado' });
    const r2 = riesgo(A, 2);
    await problema(await pedir(`/riesgos/${r2.id}/activos`, await tAdmin(), 'POST', { activoId: a.id }), 409, 'conflicto');
    await problema(await pedir(`/activos/${a.id}/retiro`, await tAdmin(), 'POST', { versionEsperada: 2 }), 409, 'conflicto');
  });

  it('ligar: 201 la primera vez y 200 si ya existía; quitar la liga responde 204 y luego 404', async () => {
    const a = await crear();
    const r = riesgo(A, 1);
    const l1 = await pedir(`/riesgos/${r.id}/activos`, await tAdmin(), 'POST', { activoId: a.id });
    expect(l1.status).toBe(201);
    valida('LigaActivoResultado', await json(l1));
    expect((await pedir(`/riesgos/${r.id}/activos`, await tAdmin(), 'POST', { activoId: a.id })).status).toBe(200);
    const lista = await json(await pedir(`/riesgos/${r.id}/activos`, await tColab()));
    expect(lista).toHaveLength(1);
    lista.forEach((x: unknown) => valida('Activo', x));
    expect((await pedir(`/riesgos/${r.id}/activos/eliminacion`, await tAdmin(), 'POST', { activoId: a.id })).status).toBe(204);
    await problema(await pedir(`/riesgos/${r.id}/activos/eliminacion`, await tAdmin(), 'POST', { activoId: a.id }), 404, 'no_encontrado');
    expect(estado.eventos.map((e) => e.accion)).toEqual(['activo.creado', 'activo.ligado', 'activo.desligado']);
  });

  it('aislamiento: A y B no se ven en ninguna operación, ni se ligan activos de una con riesgos de la otra', async () => {
    const a = await crear();
    const rA = riesgo(A, 1);
    const rB = riesgo(B, 2);
    const tb = await tAdminB();
    for (const [metodo, ruta, cuerpo] of [
      ['GET', `/activos/${a.id}`, undefined],
      ['PUT', `/activos/${a.id}`, { versionEsperada: 1, nombre: 'x' }],
      ['GET', `/activos/${a.id}/aviso-retiro`, undefined],
      ['POST', `/activos/${a.id}/retiro`, { versionEsperada: 1 }],
      ['GET', `/riesgos/${rA.id}/activos`, undefined],
      ['POST', `/riesgos/${rA.id}/activos`, { activoId: a.id }],
      ['POST', `/riesgos/${rB.id}/activos`, { activoId: a.id }],
      ['POST', `/riesgos/${rA.id}/activos/eliminacion`, { activoId: a.id }],
    ] as [string, string, unknown][])
      await problema(await pedir(ruta, tb, metodo, cuerpo), 404, 'no_encontrado');
    expect(await json(await pedir('/activos', tb))).toEqual([]);
    expect((await json(await pedir('/activos', tb, 'POST', { ...ACTIVO, responsableId: ADMIN_B, empresaId: A }))).codigo).toBe('A-001');
  });

  it('si no se puede registrar en la bitácora, no se crea nada', async () => {
    estado.fallarBitacora = true;
    expect((await pedir('/activos', await tAdmin(), 'POST', ACTIVO)).status).toBe(500);
    estado.fallarBitacora = false;
    expect(estado.riesgosEstado.activos.size).toBe(0);
  });
});
