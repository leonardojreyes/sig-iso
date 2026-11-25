import { Riesgo } from '@sig/certificacion';
import { A, ADMIN, AlmacenFalso, B, COLAB, EstadoFalso } from '@sig/certificacion/prueba';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { CertificacionApiModule } from './certificacion-api.module.js';
import { opcionesDePrueba } from './prueba/opciones.js';

// Criterios de evaluación y matriz (ADR 038) sobre una aplicación Nest REAL con los casos de uso reales y fakes que separan los datos por
// empresa. Cada respuesta se valida contra los esquemas de openapi.yaml. Orden: 401 → 403 → 400 → 409.
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const cinco = (p: string) => [`${p}1`, `${p}2`, `${p}3`, `${p}4`, `${p}5`];
const CUERPO = { probabilidad: cinco('PROB-PRIVADA'), impacto: cinco('IMP-PRIVADO'), nivelAceptacion: 'medio', versionEsperada: 0 };
const RUTAS: [string, unknown][] = [['GET', undefined], ['PUT', CUERPO]];

describe('controladores de criterios de evaluación (ADR 038)', () => {
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
    arnes = await crearArnes({ hechos: bitacora.hechos, modulos: [CertificacionApiModule.register(opcionesDePrueba({ estado, almacen: new AlmacenFalso(), reloj: () => new Date('2026-11-25T15:00:00Z') }))] });
  });
  afterAll(async () => {
    await arnes.cerrar();
  });
  beforeEach(() => {
    estado.riesgos.clear();
    estado.riesgosEstado.criterios.clear();
    estado.eventos = [];
    estado.permisos.clear();
    estado.carrera = false;
    estado.riesgosEstado.carrera = false;
    estado.fallarBitacora = false;
    estado.conceder(ADMIN, A, 'criterios.ver', 'criterios.gestionar');
    estado.conceder(COLAB, A, 'criterios.ver');
    estado.conceder(ADMIN_B, B, 'criterios.ver', 'criterios.gestionar');
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const json = async (r: Response) => (await r.json()) as J;
  const pedir = (t: string | undefined, metodo = 'GET', cuerpo?: unknown) => arnes.pedir('/criterios', t, metodo, cuerpo);
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const c = await json(r);
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
  };
  const valida = (nombre: string, c: unknown) => expect(erroresDeEsquema(nombre, c), nombre).toEqual([]);
  const riesgo = (empresaId: typeof A, k: number, p: number, i: number) => {
    const r = Riesgo.crear({ id: `dddddddd-0000-4000-8000-${String(k).padStart(12, '0')}`, empresaId, codigo: `R-${String(k).padStart(3, '0')}`, titulo: `Riesgo ${k}`, probabilidad: p, impacto: i, decision: 'mitigar' });
    estado.riesgos.set(r.id, r);
  };

  describe('401 sin token', () => {
    it.each(RUTAS)('%s', async (metodo, cuerpo) => {
      await problema(await pedir(undefined, metodo, cuerpo), 401, 'no_autenticado');
      expect(estado.riesgosEstado.criterios.size).toBe(0);
    });
  });

  describe('403 sin permiso: se decide ANTES de mirar el cuerpo', () => {
    it.each(RUTAS)('%s', async (metodo, cuerpo) => {
      await problema(await pedir(await tSin(), metodo, cuerpo), 403, 'sin_permiso');
    });
    it('el colaborador consulta pero no guarda', async () => {
      expect((await pedir(await tColab())).status).toBe(200);
      await problema(await pedir(await tColab(), 'PUT', CUERPO), 403, 'sin_permiso');
    });
  });

  it('sin criterios propios: la escala por omisión, rotulada, sin nivel de aceptación y con la matriz de 25 celdas', async () => {
    const r = await pedir(await tAdmin());
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    const c = await json(r);
    valida('Criterios', c);
    expect(c).toMatchObject({ origen: 'omision', version: 0, nivelAceptacion: null, creadoEn: null });
    expect(c.matriz).toHaveLength(25);
  });

  it('guardar crea la versión 1, la matriz cuenta los riesgos vigentes de la empresa y la bitácora no lleva texto', async () => {
    riesgo(A, 1, 3, 4);
    riesgo(A, 2, 3, 4);
    riesgo(B, 3, 3, 4);
    const r = await pedir(await tAdmin(), 'PUT', CUERPO);
    expect(r.status).toBe(200);
    const c = await json(r);
    valida('Criterios', c);
    expect(c).toMatchObject({ origen: 'empresa', version: 1, nivelAceptacion: 'medio', riesgosVigentes: 2 });
    expect(c.matriz.find((x: J) => x.probabilidad === 3 && x.impacto === 4)).toMatchObject({ cantidad: 2, nivel: 'alto' });
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'criterios.cambiados', objeto: 'criterios:v1' })]);
    expect(JSON.stringify(estado.eventos)).not.toMatch(/PROB-PRIVADA|IMP-PRIVADO/);
  });

  it('cada cambio es una versión nueva; lo mismo no crea nada; una versión vieja responde 409', async () => {
    await pedir(await tAdmin(), 'PUT', CUERPO);
    expect((await json(await pedir(await tAdmin(), 'PUT', { ...CUERPO, nivelAceptacion: 'alto', versionEsperada: 1 }))).version).toBe(2);
    expect((await json(await pedir(await tAdmin(), 'PUT', { ...CUERPO, nivelAceptacion: 'alto', versionEsperada: 2 }))).version).toBe(2);
    await problema(await pedir(await tAdmin(), 'PUT', { ...CUERPO, nivelAceptacion: 'bajo', versionEsperada: 1 }), 409, 'conflicto');
    expect(estado.riesgosEstado.criterios.size).toBe(2);
  });

  it('valida los datos (400): cinco descripciones por eje, largos, nivel de la lista y versión esperada; no cuela campos de más', async () => {
    for (const mal of [{ probabilidad: cinco('a').slice(1) }, { impacto: [...cinco('a'), 'x'] }, { impacto: ['a', 'b', ' ', 'd', 'e'] }, { probabilidad: ['a', 'b', 'x'.repeat(201), 'd', 'e'] }, { nivelAceptacion: 'enorme' }, { nivelAceptacion: undefined }, { versionEsperada: -1 }, { versionEsperada: undefined }, { probabilidad: 'no es lista' }])
      await problema(await pedir(await tAdmin(), 'PUT', { ...CUERPO, ...mal }), 400, 'parametro_invalido');
    const ok = await pedir(await tAdmin(), 'PUT', { ...CUERPO, empresaId: B, version: 99, origen: 'omision', creadoEn: '2000-01-01' });
    expect(ok.status).toBe(200);
    expect(await json(ok)).toMatchObject({ origen: 'empresa', version: 1 });
  });

  it('aislamiento: B no ve los criterios de A y tiene su propia secuencia', async () => {
    await pedir(await tAdmin(), 'PUT', CUERPO);
    const deB = await json(await pedir(await tAdminB()));
    expect(deB).toMatchObject({ origen: 'omision', version: 0 });
    const b = await pedir(await tAdminB(), 'PUT', { ...CUERPO, nivelAceptacion: 'bajo' });
    expect(b.status).toBe(200);
    expect(await json(b)).toMatchObject({ version: 1, nivelAceptacion: 'bajo' });
    expect((await json(await pedir(await tAdmin()))).nivelAceptacion).toBe('medio');
  });

  it('si no se puede registrar en la bitácora, no se guarda nada', async () => {
    estado.fallarBitacora = true;
    expect((await pedir(await tAdmin(), 'PUT', CUERPO)).status).toBe(500);
    estado.fallarBitacora = false;
    expect(estado.riesgosEstado.criterios.size).toBe(0);
  });
});
