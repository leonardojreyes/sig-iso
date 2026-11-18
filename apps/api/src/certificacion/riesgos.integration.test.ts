import { Evaluacion } from '@sig/certificacion';
import { A, ADMIN, AlmacenFalso, B, COLAB, EstadoFalso, entradas } from '@sig/certificacion/prueba';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { CertificacionApiModule } from './certificacion-api.module.js';
import { opcionesDePrueba } from './prueba/opciones.js';

// Riesgos, vínculos, motivos y referencias (ADR 037) sobre una aplicación Nest REAL con los casos de uso reales y fakes que separan los
// datos por empresa. Cada respuesta se valida contra los esquemas de openapi.yaml. Orden de evaluación: 401 → 403 → 400 → 404 → 409.
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const ID_FALSO = 'dddddddd-0000-4000-8000-000000000000';
const POL = { libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: entradas.politicas.idEstable };
const ROL = { libreriaCodigo: entradas.roles.libreriaCodigo, idEstable: entradas.roles.idEstable };
const CTX = { libreriaCodigo: entradas.contexto.libreriaCodigo, idEstable: entradas.contexto.idEstable };
const RIESGO = { titulo: 'TITULO-RIESGO Pérdida de portátiles', descripcion: 'DESCRIPCION-PRIVADA', probabilidad: 3, impacto: 4, decision: 'mitigar' };
const REF = { tipo: 'plan', titulo: 'TITULO-REF Plan 2026', versionDoc: '1.0', fecha: '2026-11-01', ubicacion: 'UBICACION-REF SIG-PL-004' };

const RUTAS: [string, string, unknown][] = [
  ['GET', '/riesgos', undefined],
  ['POST', '/riesgos', RIESGO],
  ['GET', `/riesgos/${ID_FALSO}`, undefined],
  ['PUT', `/riesgos/${ID_FALSO}`, { versionEsperada: 1 }],
  ['GET', `/riesgos/${ID_FALSO}/aviso-retiro`, undefined],
  ['POST', `/riesgos/${ID_FALSO}/retiro`, { versionEsperada: 1 }],
  ['POST', `/riesgos/${ID_FALSO}/controles`, { controlId: ID_FALSO }],
  ['POST', `/riesgos/${ID_FALSO}/controles/eliminacion`, { controlId: ID_FALSO }],
  ['POST', `/riesgos/${ID_FALSO}/tratamientos`, POL],
  ['POST', `/riesgos/${ID_FALSO}/tratamientos/eliminacion`, POL],
  ['GET', `/controles/${ID_FALSO}/riesgos`, undefined],
  ['GET', '/declaracion/motivos', undefined],
  ['PUT', '/declaracion/motivos', { ...POL, tipo: 'legal', nota: 'x' }],
  ['POST', '/declaracion/motivos/eliminacion', { ...POL, tipo: 'legal', versionEsperada: 1 }],
  ['GET', '/declaracion/referencias', undefined],
  ['PUT', '/declaracion/referencias', REF],
  ['POST', '/declaracion/referencias/eliminacion', { tipo: 'plan', versionEsperada: 1 }],
];

describe('controladores de riesgos y justificación de la Declaración (ADR 037)', () => {
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
    arnes = await crearArnes({ hechos: bitacora.hechos, modulos: [CertificacionApiModule.register(opcionesDePrueba({ estado, almacen: new AlmacenFalso(), reloj: () => new Date('2026-11-17T15:00:00Z') }))] });
  });
  afterAll(async () => {
    await arnes.cerrar();
  });
  beforeEach(() => {
    for (const m of [estado.controles, estado.mapeos, estado.evaluaciones, estado.alcances, estado.declaraciones, estado.riesgos, estado.vinculosControl, estado.vinculosEntrada, estado.motivos, estado.referencias]) m.clear();
    estado.eventos = [];
    estado.permisos.clear();
    estado.carrera = false;
    estado.fallarBitacora = false;
    estado.catalogoPorEmpresa.clear();
    estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
    estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
    estado.conceder(ADMIN, A, 'controles.ver', 'controles.gestionar', 'riesgos.ver', 'riesgos.gestionar', 'declaracion.ver', 'declaracion.aprobar', 'declaracion.justificar');
    estado.conceder(COLAB, A, 'controles.ver', 'riesgos.ver', 'declaracion.ver');
    estado.conceder(ADMIN_B, B, 'controles.ver', 'controles.gestionar', 'riesgos.ver', 'riesgos.gestionar', 'declaracion.ver', 'declaracion.aprobar', 'declaracion.justificar');
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const json = async (r: Response) => (await r.json()) as J;
  const pedir = async (ruta: string, t: string, metodo = 'GET', cuerpo?: unknown) => arnes.pedir(ruta, t, metodo, cuerpo);
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const c = await json(r);
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
  };
  const valida = (nombre: string, c: unknown) => expect(erroresDeEsquema(nombre, c), nombre).toEqual([]);
  /** Las listas del contrato son esquemas en línea: se valida cada elemento contra el esquema nombrado. */
  const validaLista = (nombre: string, lista: unknown) => (lista as unknown[]).forEach((x) => valida(nombre, x));
  const crearRiesgo = async (extra: Record<string, unknown> = {}, t?: string) => {
    const r = await pedir('/riesgos', t ?? (await tAdmin()), 'POST', { ...RIESGO, ...extra });
    expect(r.status).toBe(201);
    return json(r);
  };
  const crearControl = async (codigo = 'C-001', t?: string) => {
    const r = await pedir('/controles', t ?? (await tAdmin()), 'POST', { codigo, nombre: 'Cifrado de discos' });
    expect(r.status).toBe(201);
    return json(r);
  };

  describe('401 sin token', () => {
    it.each(RUTAS)('%s %s', async (metodo, ruta, cuerpo) => {
      await problema(await arnes.pedir(ruta, undefined, metodo, cuerpo), 401, 'no_autenticado');
      expect(estado.riesgos.size + estado.motivos.size + estado.referencias.size).toBe(0);
    });
  });

  describe('403 sin permiso: se decide antes de mirar el identificador o el cuerpo', () => {
    it.each(RUTAS)('%s %s', async (metodo, ruta, cuerpo) => {
      const r = await pedir(ruta.replace(ID_FALSO, 'no-es-uuid'), await tSin(), metodo, metodo === 'GET' ? undefined : { basura: true, ...(cuerpo as object) });
      await problema(r, 403, 'sin_permiso');
    });
    it('el colaborador consulta pero no cambia nada', async () => {
      const r = await crearRiesgo();
      const t = await tColab();
      expect((await pedir('/riesgos', t)).status).toBe(200);
      expect((await pedir(`/riesgos/${r.id}`, t)).status).toBe(200);
      expect((await pedir('/declaracion/motivos', t)).status).toBe(200);
      expect((await pedir('/declaracion/referencias', t)).status).toBe(200);
      for (const [metodo, ruta, cuerpo] of RUTAS.filter(([m]) => m !== 'GET')) await problema(await pedir(ruta, t, metodo, cuerpo), 403, 'sin_permiso');
      expect((await pedir(`/riesgos/${r.id}/aviso-retiro`, t)).status).toBe(403); // el aviso es de quien puede retirar
      expect(estado.riesgos.size).toBe(1);
    });
  });

  describe('riesgos', () => {
    it('201 con el riesgo (código correlativo y nivel calculado), validado contra el contrato; la bitácora lleva solo el hecho', async () => {
      const r = await pedir('/riesgos', await tAdmin(), 'POST', RIESGO);
      expect(r.status).toBe(201);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = await json(r);
      valida('Riesgo', c);
      expect(c).toMatchObject({ codigo: 'R-001', puntaje: 12, nivel: 'alto', estado: 'vigente', version: 1, responsableId: null });
      expect((await crearRiesgo()).codigo).toBe('R-002');
      expect(estado.eventos[0]).toMatchObject({ accion: 'riesgo.creado', objeto: 'riesgo:R-001' });
      expect(JSON.stringify(estado.eventos)).not.toMatch(/TITULO-RIESGO|DESCRIPCION-PRIVADA/);
    });

    it('400 con datos inválidos: no escribe nada ni repite el valor; «aceptar» exige responsable', async () => {
      const t = await tAdmin();
      for (const malo of [{ titulo: '' }, { probabilidad: 9 }, { impacto: 0 }, { decision: 'ignorar' }, { decision: 'aceptar' }, { descripcion: 'x'.repeat(1001) }, { responsableId: 'x' }, { probabilidad: '3' }]) {
        const r = await pedir('/riesgos', t, 'POST', { ...RIESGO, ...malo });
        await problema(r, 400, 'parametro_invalido');
      }
      expect(estado.riesgos.size).toBe(0);
      expect(estado.eventos).toEqual([]);
    });

    it('la empresa sale del token: un empresaId en el cuerpo o en la consulta no cambia nada', async () => {
      const r = await pedir(`/riesgos?empresa=${B}`, await tAdmin(), 'POST', { ...RIESGO, empresaId: B, empresa_id: B });
      expect(r.status).toBe(201);
      expect([...estado.riesgos.values()].map((x) => x.empresaId)).toEqual([A]);
      expect(await json(await pedir(`/riesgos?empresa=${B}`, await tAdminB()))).toEqual([]);
    });

    it('lista con el tratamiento de cada uno; los retirados solo si se piden; incluirRetirados mal formado es 400', async () => {
      const t = await tAdmin();
      const r1 = await crearRiesgo();
      const r2 = await crearRiesgo({ titulo: 'Fuga' });
      expect((await pedir(`/riesgos/${r1.id}/retiro`, t, 'POST', { versionEsperada: 1 })).status).toBe(200);
      const lista = await json(await pedir('/riesgos', await tColab()));
      validaLista('RiesgoListado', lista);
      expect(lista.map((x: J) => [x.codigo, x.sinTratamiento])).toEqual([['R-002', true]]);
      expect((await json(await pedir('/riesgos?incluirRetirados=true', t))).map((x: J) => x.codigo)).toEqual(['R-001', 'R-002']);
      await problema(await pedir('/riesgos?incluirRetirados=quizas', t), 400, 'parametro_invalido');
      expect(r2.estado).toBe('vigente');
    });

    it('detalle con controles (marcando los retirados) y tratamientos previstos; 404 indistinguible entre empresas; 400 con id mal formado', async () => {
      const t = await tAdmin();
      const r = await crearRiesgo();
      const c = await crearControl();
      await pedir(`/riesgos/${r.id}/controles`, t, 'POST', { controlId: c.id });
      await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', POL);
      const d = await json(await pedir(`/riesgos/${r.id}`, await tColab()));
      valida('RiesgoDetalle', d);
      expect(d.controles).toEqual([{ id: c.id, codigo: 'C-001', nombre: 'Cifrado de discos', estado: 'vigente' }]);
      expect(d.tratamientosPrevistos).toEqual([{ ...POL, titulo: 'Políticas de seguridad' }]);
      const ajeno = await pedir(`/riesgos/${r.id}`, await tAdminB());
      const inexistente = await pedir(`/riesgos/${ID_FALSO}`, await tAdminB());
      await problema(ajeno.clone(), 404, 'no_encontrado');
      expect(await json(ajeno)).toEqual(await json(inexistente));
      await problema(await pedir('/riesgos/no-es-uuid', t), 400, 'parametro_invalido');
    });

    it('cambia con la versión que se vio (200), sin cambios no sube la versión, y una versión vieja es 409', async () => {
      const t = await tAdmin();
      const r = await crearRiesgo();
      const c = await json(await pedir(`/riesgos/${r.id}`, t, 'PUT', { versionEsperada: 1, probabilidad: 5, impacto: 5 }));
      valida('Riesgo', c);
      expect(c).toMatchObject({ puntaje: 25, nivel: 'critico', version: 2 });
      expect((await json(await pedir(`/riesgos/${r.id}`, t, 'PUT', { versionEsperada: 2, probabilidad: 5 }))).version).toBe(2);
      await problema(await pedir(`/riesgos/${r.id}`, t, 'PUT', { versionEsperada: 1, impacto: 1 }), 409, 'conflicto');
      await problema(await pedir(`/riesgos/${r.id}`, t, 'PUT', { impacto: 1 }), 400, 'parametro_invalido'); // sin versión
      await problema(await pedir(`/riesgos/${ID_FALSO}`, t, 'PUT', { versionEsperada: 1 }), 404, 'no_encontrado');
      await problema(await pedir(`/riesgos/${r.id}`, await tAdminB(), 'PUT', { versionEsperada: 2, impacto: 1 }), 404, 'no_encontrado');
    });

    it('aviso previo y retiro: el aviso lista los controles que quedarían sin motivo; retirar es 200 y repetir es 409', async () => {
      const t = await tAdmin();
      estado.evaluaciones.set(`${A}|${POL.libreriaCodigo}|${POL.idEstable}`, Evaluacion.crear({ empresaId: A, libreriaCodigo: POL.libreriaCodigo, idEstable: POL.idEstable, libreriaId: entradas.politicas.libreriaId, estado: 'cumple', comentario: null, version: 1 }));
      const r = await crearRiesgo();
      await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', POL);
      const a = await pedir(`/riesgos/${r.id}/aviso-retiro`, t);
      expect(a.status).toBe(200);
      const aviso = await json(a);
      valida('AvisoRetiroRiesgo', aviso);
      expect(aviso).toMatchObject({ riesgoId: r.id, codigo: 'R-001', controlesSinMotivo: [{ ...POL, titulo: 'Políticas de seguridad' }] });
      expect([...estado.riesgos.values()][0]?.estado).toBe('vigente'); // avisar no cambia nada
      const retiro = await pedir(`/riesgos/${r.id}/retiro`, t, 'POST', { versionEsperada: 1 });
      expect(retiro.status).toBe(200);
      expect(await json(retiro)).toMatchObject({ estado: 'retirado', version: 2 });
      await problema(await pedir(`/riesgos/${r.id}/retiro`, t, 'POST', { versionEsperada: 2 }), 409, 'conflicto');
      await problema(await pedir(`/riesgos/${ID_FALSO}/aviso-retiro`, t), 404, 'no_encontrado');
      expect(estado.eventos.map((e) => e.accion)).toEqual(['riesgo.creado', 'vinculo.creado', 'riesgo.retirado']);
    });

    it('si falla la bitácora responde 500 y no queda el riesgo', async () => {
      estado.fallarBitacora = true;
      await problema(await pedir('/riesgos', await tAdmin(), 'POST', RIESGO), 500, 'error_interno');
      expect(estado.riesgos.size).toBe(0);
    });
  });

  describe('vínculos', () => {
    it('vincula con un control de la empresa: 201 y luego 200; quitar es 204 y repetir 404; los riesgos del control salen del otro lado', async () => {
      const t = await tAdmin();
      const r = await crearRiesgo();
      const c = await crearControl();
      const v1 = await pedir(`/riesgos/${r.id}/controles`, t, 'POST', { controlId: c.id });
      expect(v1.status).toBe(201);
      valida('VinculoResultado', await json(v1));
      expect((await pedir(`/riesgos/${r.id}/controles`, t, 'POST', { controlId: c.id })).status).toBe(200);
      const lista = await json(await pedir(`/controles/${c.id}/riesgos`, await tColab()));
      validaLista('Riesgo', lista);
      expect(lista.map((x: J) => x.id)).toEqual([r.id]);
      const q = await pedir(`/riesgos/${r.id}/controles/eliminacion`, t, 'POST', { controlId: c.id });
      expect(q.status).toBe(204);
      expect(q.headers.get('cache-control')).toBe('no-store');
      await problema(await pedir(`/riesgos/${r.id}/controles/eliminacion`, t, 'POST', { controlId: c.id }), 404, 'no_encontrado');
      expect(estado.eventos.map((e) => [e.accion, e.objeto])).toEqual([['riesgo.creado', 'riesgo:R-001'], ['control.creado', 'control:C-001'], ['vinculo.creado', 'vinculo:R-001.C-001'], ['vinculo.eliminado', 'vinculo:R-001.C-001']]);
    });

    it('un riesgo o un control de otra empresa es 404 indistinguible; uno retirado es 409; un id mal formado, 400', async () => {
      const t = await tAdmin();
      const r = await crearRiesgo();
      const c = await crearControl();
      const rB = await crearRiesgo({}, await tAdminB());
      const cB = await crearControl('C-001', await tAdminB());
      await problema(await pedir(`/riesgos/${rB.id}/controles`, t, 'POST', { controlId: c.id }), 404, 'no_encontrado');
      await problema(await pedir(`/riesgos/${r.id}/controles`, t, 'POST', { controlId: cB.id }), 404, 'no_encontrado');
      await problema(await pedir(`/riesgos/${r.id}/controles`, t, 'POST', { controlId: 'x' }), 400, 'parametro_invalido');
      await problema(await pedir(`/controles/${cB.id}/riesgos`, t), 404, 'no_encontrado');
      await pedir(`/controles/${c.id}/retiro`, t, 'POST', { versionEsperada: 1 });
      await problema(await pedir(`/riesgos/${r.id}/controles`, t, 'POST', { controlId: c.id }), 409, 'conflicto');
      expect(estado.vinculosControl.size).toBe(0);
    });

    it('tratamiento previsto: 201 y luego 200; solo controles del Anexo A adoptados (si no, 404); se quita con 204', async () => {
      const t = await tAdmin();
      const r = await crearRiesgo();
      const a = await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', POL);
      expect(a.status).toBe(201);
      expect(await json(a)).toEqual({ ...POL, creado: true });
      expect((await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', POL)).status).toBe(200);
      await problema(await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', CTX), 404, 'no_encontrado'); // una cláusula no es un control
      await problema(await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', { libreriaCodigo: 'otra', idEstable: 'zz-1' }), 404, 'no_encontrado');
      await problema(await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', { libreriaCodigo: 'MAL CODIGO', idEstable: POL.idEstable }), 400, 'parametro_invalido');
      const rB = await crearRiesgo({}, await tAdminB());
      await problema(await pedir(`/riesgos/${rB.id}/tratamientos`, t, 'POST', ROL), 404, 'no_encontrado');
      expect((await pedir(`/riesgos/${r.id}/tratamientos/eliminacion`, t, 'POST', POL)).status).toBe(204);
      await problema(await pedir(`/riesgos/${r.id}/tratamientos/eliminacion`, t, 'POST', POL), 404, 'no_encontrado');
    });
  });

  describe('motivos y referencias de la Declaración', () => {
    it('registra un motivo (200), lo cambia con la versión vista, lo lista y lo quita (204); la bitácora no lleva la nota', async () => {
      const t = await tAdmin();
      const crear = await pedir('/declaracion/motivos', t, 'PUT', { ...POL, tipo: 'legal', nota: 'NOTA-PRIVADA Ley de datos' });
      expect(crear.status).toBe(200);
      expect(crear.headers.get('cache-control')).toBe('no-store');
      const m = await json(crear);
      valida('MotivoDeclaracion', m);
      expect(m).toMatchObject({ tipo: 'legal', version: 1 });
      expect((await json(await pedir('/declaracion/motivos', t, 'PUT', { ...POL, tipo: 'legal', nota: 'Otra nota', versionEsperada: 1 }))).version).toBe(2);
      await problema(await pedir('/declaracion/motivos', t, 'PUT', { ...POL, tipo: 'legal', nota: 'Vieja', versionEsperada: 1 }), 409, 'conflicto');
      await problema(await pedir('/declaracion/motivos', t, 'PUT', { ...POL, tipo: 'legal', nota: 'Sin versión' }), 409, 'conflicto');
      const lista = await json(await pedir('/declaracion/motivos', await tColab()));
      validaLista('MotivoDeclaracion', lista);
      expect(lista).toEqual([{ ...POL, tipo: 'legal', nota: 'Otra nota', version: 2 }]);
      await problema(await pedir('/declaracion/motivos/eliminacion', t, 'POST', { ...POL, tipo: 'legal', versionEsperada: 1 }), 409, 'conflicto');
      expect((await pedir('/declaracion/motivos/eliminacion', t, 'POST', { ...POL, tipo: 'legal', versionEsperada: 2 })).status).toBe(204);
      await problema(await pedir('/declaracion/motivos/eliminacion', t, 'POST', { ...POL, tipo: 'legal', versionEsperada: 2 }), 404, 'no_encontrado');
      expect(estado.eventos.map((e) => [e.accion, e.objeto])).toEqual([['motivo.creado', `motivo:${POL.idEstable}.legal`], ['motivo.cambiado', `motivo:${POL.idEstable}.legal`], ['motivo.eliminado', `motivo:${POL.idEstable}.legal`]]);
      expect(JSON.stringify(estado.eventos)).not.toMatch(/NOTA|Ley de datos/);
    });

    it('AISLAMIENTO: B no ve los motivos que A registró ni puede cambiarlos o quitarlos', async () => {
      await pedir('/declaracion/motivos', await tAdmin(), 'PUT', { ...POL, tipo: 'legal', nota: 'Motivo de A' });
      expect(await json(await pedir('/declaracion/motivos', await tAdminB()))).toEqual([]);
      await problema(await pedir('/declaracion/motivos/eliminacion', await tAdminB(), 'POST', { ...POL, tipo: 'legal', versionEsperada: 1 }), 404, 'no_encontrado');
      expect(estado.motivos.size).toBe(1);
    });

    it('el motivo exige nota, un tipo registrable (no «riesgo») y un control del Anexo A adoptado', async () => {
      const t = await tAdmin();
      for (const malo of [{ nota: '' }, { nota: '   ' }, { nota: 'x'.repeat(501) }, { tipo: 'riesgo' }, { idEstable: 'MAL ID' }, { versionEsperada: 0 }]) {
        await problema(await pedir('/declaracion/motivos', t, 'PUT', { ...POL, tipo: 'legal', nota: 'ok', ...malo }), 400, 'parametro_invalido');
      }
      await problema(await pedir('/declaracion/motivos', t, 'PUT', { ...CTX, tipo: 'legal', nota: 'ok' }), 404, 'no_encontrado');
      await problema(await pedir('/declaracion/motivos', await tAdminB(), 'PUT', { ...ROL, tipo: 'legal', nota: 'ok' }), 404, 'no_encontrado');
      await problema(await pedir('/declaracion/motivos/eliminacion', t, 'POST', { ...POL, tipo: 'legal' }), 400, 'parametro_invalido'); // sin versión
      expect(estado.motivos.size).toBe(0);
    });

    it('la referencia al plan: se crea, se cambia con la versión, se lista y se quita; la fecha debe existir', async () => {
      const t = await tAdmin();
      const c = await pedir('/declaracion/referencias', t, 'PUT', REF);
      expect(c.status).toBe(200);
      const ref = await json(c);
      valida('ReferenciaDeclaracion', ref);
      expect(ref).toMatchObject({ tipo: 'plan', fecha: '2026-11-01', version: 1 });
      expect((await json(await pedir('/declaracion/referencias', t, 'PUT', { ...REF, versionDoc: '2.0', versionEsperada: 1 }))).version).toBe(2);
      await problema(await pedir('/declaracion/referencias', t, 'PUT', { ...REF, versionEsperada: 1 }), 409, 'conflicto');
      for (const malo of [{ fecha: '2026-02-31' }, { tipo: 'otro' }, { titulo: '' }, { ubicacion: 'x'.repeat(201) }]) await problema(await pedir('/declaracion/referencias', t, 'PUT', { ...REF, versionEsperada: 2, ...malo }), 400, 'parametro_invalido');
      const lista = await json(await pedir('/declaracion/referencias', await tColab()));
      validaLista('ReferenciaDeclaracion', lista);
      expect(lista).toHaveLength(1);
      expect((await json(await pedir('/declaracion/referencias', await tAdminB()))).length).toBe(0);
      expect((await pedir('/declaracion/referencias/eliminacion', t, 'POST', { tipo: 'plan', versionEsperada: 2 })).status).toBe(204);
      await problema(await pedir('/declaracion/referencias/eliminacion', t, 'POST', { tipo: 'plan', versionEsperada: 2 }), 404, 'no_encontrado');
      expect(JSON.stringify(estado.eventos)).not.toMatch(/TITULO-REF|SIG-PL-004|2026-11/);
    });
  });

  describe('la Declaración con justificación', () => {
    const evaluarTodo = () => {
      estado.evaluaciones.set(`${A}|${POL.libreriaCodigo}|${POL.idEstable}`, Evaluacion.crear({ empresaId: A, libreriaCodigo: POL.libreriaCodigo, idEstable: POL.idEstable, libreriaId: entradas.politicas.libreriaId, estado: 'cumple', comentario: null, version: 1 }));
      estado.evaluaciones.set(`${A}|${ROL.libreriaCodigo}|${ROL.idEstable}`, Evaluacion.crear({ empresaId: A, libreriaCodigo: ROL.libreriaCodigo, idEstable: ROL.idEstable, libreriaId: entradas.roles.libreriaId, estado: 'no_aplica', comentario: 'No hay personal propio', version: 1 }));
    };

    it('el borrador trae la justificación: sin motivo bloquea, con un motivo o un tratamiento previsto se puede aprobar', async () => {
      const t = await tAdmin();
      evaluarTodo();
      const sin = await json(await pedir('/declaracion', await tColab()));
      valida('Declaracion', sin);
      expect(sin.resumen.aprobable).toBe(false);
      expect(sin.justificacion).toMatchObject({ sinMotivo: 1, conMotivo: 0, bloqueos: ['sin_motivo'], faltaPlanTratamiento: false, escala: { escalaMax: 5, corteMedio: 5, corteAlto: 10, corteCritico: 16 } });
      expect(sin.justificacion.filas[0]).toMatchObject({ idEstable: POL.idEstable, sinMotivo: true, motivos: [], riesgos: [] });
      await problema(await pedir('/declaracion/aprobacion', t, 'POST'), 409, 'conflicto');
      const r = await crearRiesgo();
      await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', POL);
      const con = await json(await pedir('/declaracion', t));
      valida('Declaracion', con);
      expect(con.resumen.aprobable).toBe(true);
      expect(con.justificacion).toMatchObject({ sinMotivo: 0, conMotivo: 1, riesgosVigentes: 1, faltaPlanTratamiento: true, bloqueos: [] });
      expect(con.justificacion.filas[0].riesgos).toEqual([{ codigo: 'R-001', titulo: RIESGO.titulo, nivel: 'alto', via: 'previsto' }]);
    });

    it('aprobar congela la justificación y la versión la devuelve igual aunque después cambie un riesgo o un motivo', async () => {
      const t = await tAdmin();
      evaluarTodo();
      const r = await crearRiesgo();
      await pedir(`/riesgos/${r.id}/tratamientos`, t, 'POST', POL);
      await pedir('/declaracion/motivos', t, 'PUT', { ...POL, tipo: 'contractual', nota: 'Cláusula 7 del contrato' });
      await pedir('/declaracion/referencias', t, 'PUT', REF);
      const a = await pedir('/declaracion/aprobacion', t, 'POST');
      expect(a.status).toBe(201);
      const v = await json(a);
      valida('VersionDeclaracion', v);
      expect(estado.eventos.at(-1)).toMatchObject({ accion: 'declaracion.aprobada', despues: { con_motivo: 1, riesgos: 1 } });
      const congelada = await json(await pedir(`/declaracion/versiones/${v.id}`, await tColab()));
      valida('VersionDeclaracionConFilas', congelada);
      expect(congelada.justificacion).toMatchObject({
        escala: { escalaMax: 5 },
        conMotivo: 1,
        riesgosVigentes: 1,
        motivos: [{ ...POL, tipo: 'contractual', nota: 'Cláusula 7 del contrato' }],
        riesgos: [{ codigo: 'R-001', titulo: RIESGO.titulo, nivel: 'alto', decision: 'mitigar', controles: [] }],
        riesgosPorFila: [{ ...POL, riesgoCodigo: 'R-001', via: 'previsto' }],
        referencias: [{ tipo: 'plan', titulo: REF.titulo, fecha: '2026-11-01' }],
      });
      const antes = JSON.stringify(congelada);
      await pedir(`/riesgos/${r.id}`, t, 'PUT', { versionEsperada: 1, titulo: 'OTRO-TITULO', probabilidad: 1, impacto: 1 });
      await pedir('/declaracion/motivos', t, 'PUT', { ...POL, tipo: 'contractual', nota: 'NOTA-CAMBIADA', versionEsperada: 1 });
      expect(JSON.stringify(await json(await pedir(`/declaracion/versiones/${v.id}`, t)))).toBe(antes);
      // Una versión de otra empresa responde igual que una inexistente.
      await problema(await pedir(`/declaracion/versiones/${v.id}`, await tAdminB()), 404, 'no_encontrado');
    });

    it('una versión aprobada antes de la Declaración justificada se lee con justificación nula', async () => {
      const t = await tAdmin();
      evaluarTodo();
      await pedir('/declaracion/motivos', t, 'PUT', { ...POL, tipo: 'negocio', nota: 'Necesidad del negocio' });
      const v = await json(await pedir('/declaracion/aprobacion', t, 'POST'));
      const guardada = estado.declaraciones.get(`${A}|${v.id}`);
      if (!guardada) throw new Error('la versión debía existir');
      estado.declaraciones.set(`${A}|${v.id}`, { ...guardada, version: { ...guardada.version, justificacion: null }, copia: null });
      const vieja = await json(await pedir(`/declaracion/versiones/${v.id}`, t));
      valida('VersionDeclaracionConFilas', vieja);
      expect(vieja.justificacion).toBeNull();
    });
  });
});
