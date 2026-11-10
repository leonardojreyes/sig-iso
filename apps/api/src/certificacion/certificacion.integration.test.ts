import { ListarAlcancesUseCase, GuardarAlcanceUseCase, AprobarAlcanceUseCase, EvaluarEntradaUseCase, ListarDiagnosticoUseCase } from '@sig/certificacion';
import { A, ADMIN, B, COLAB, EstadoFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from '@sig/certificacion/prueba';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { CertificacionApiModule } from './certificacion-api.module.js';

// /alcances y /diagnostico sobre una aplicación Nest REAL con los casos de uso reales y fakes que separan los datos por empresa.
// Cada respuesta se valida contra los esquemas de openapi.yaml.
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const NORMA = 'ISO/IEC 27001';

describe('controladores de alcance y diagnóstico (MVP M2, paso 4)', () => {
  let arnes: Arnes;
  let estado: EstadoFalso;
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tAdmin = () => token(A, ADMIN);
  const tColab = () => token(A, COLAB);
  const tAdminB = () => token(B, ADMIN_B);

  beforeAll(async () => {
    estado = new EstadoFalso();
    const autorizacion = crearAutorizacionFalsa(estado);
    const catalogo = crearCatalogoFalso(estado);
    const unidad = crearUnidadFalsa(estado);
    const reloj = () => new Date('2026-11-10T12:00:00Z');
    arnes = await crearArnes({
      hechos: bitacora.hechos,
      modulos: [
        CertificacionApiModule.register({
          alcances: new ListarAlcancesUseCase(unidad, autorizacion, catalogo),
          guardarAlcance: new GuardarAlcanceUseCase(unidad, autorizacion, catalogo, reloj),
          aprobarAlcance: new AprobarAlcanceUseCase(unidad, autorizacion, catalogo, reloj),
          diagnostico: new ListarDiagnosticoUseCase(unidad, autorizacion, catalogo),
          evaluar: new EvaluarEntradaUseCase(unidad, autorizacion, catalogo, reloj),
        }),
      ],
    });
  });
  afterAll(async () => { await arnes.cerrar(); });
  beforeEach(() => {
    estado.evaluaciones.clear();
    estado.alcances.clear();
    estado.eventos = [];
    estado.permisos.clear();
    estado.carrera = false;
    estado.fallarBitacora = false;
    estado.catalogoPorEmpresa.clear();
    estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
    estado.catalogoPorEmpresa.set(B, [entradas.contexto]);
    estado.conceder(ADMIN, A, 'alcance.ver', 'alcance.gestionar', 'alcance.aprobar', 'diagnostico.ver', 'diagnostico.evaluar');
    estado.conceder(COLAB, A, 'alcance.ver', 'diagnostico.ver', 'diagnostico.evaluar');
    estado.conceder(ADMIN_B, B, 'alcance.ver', 'alcance.gestionar', 'alcance.aprobar', 'diagnostico.ver', 'diagnostico.evaluar');
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  const cuerpo = async (r: Response) => (await r.json()) as unknown;
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const c = (await cuerpo(r)) as Record<string, unknown>;
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
  };
  const evaluar = (t: string | undefined, c: unknown) => arnes.pedir('/diagnostico/evaluaciones', t, 'PUT', c);
  const eval1 = { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', estado: 'cumple' };

  describe('401 sin token', () => {
    it.each([
      ['GET', '/alcances'],
      ['PUT', '/alcances'],
      ['POST', '/alcances/aprobacion'],
      ['GET', '/diagnostico'],
      ['PUT', '/diagnostico/evaluaciones'],
    ])('%s %s', async (metodo, ruta) => {
      await problema(await arnes.pedir(ruta, undefined, metodo, metodo === 'GET' ? undefined : {}), 401, 'no_autenticado');
    });
  });

  describe('alcance', () => {
    it('lista una fila por norma adoptada, «sin definir» al principio, con la forma del contrato', async () => {
      const r = await arnes.pedir('/alcances', await tAdmin());
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = (await cuerpo(r)) as { norma: string; texto: string | null }[];
      expect(c.map((a) => [a.norma, a.texto])).toEqual([['ISO 9001', null], [NORMA, null]]);
      for (const a of c) expect(erroresDeEsquema('Alcance', a)).toEqual([]);
    });

    it('guarda, aprueba y un nuevo texto lo devuelve a «sin aprobar»', async () => {
      const t = await tAdmin();
      const g = await arnes.pedir('/alcances', t, 'PUT', { norma: NORMA, texto: 'Desarrollo de software en la sede de Quito.' });
      expect(g.status).toBe(200);
      expect(erroresDeEsquema('Alcance', await cuerpo(g))).toEqual([]);
      const ap = await arnes.pedir('/alcances/aprobacion', t, 'POST', { norma: NORMA });
      expect(ap.status).toBe(200);
      expect(await cuerpo(ap)).toMatchObject({ aprobado: true });
      await problema(await arnes.pedir('/alcances/aprobacion', t, 'POST', { norma: NORMA }), 409, 'conflicto');
      const otra = await arnes.pedir('/alcances', t, 'PUT', { norma: NORMA, texto: 'Texto nuevo del alcance.' });
      expect(await cuerpo(otra)).toMatchObject({ aprobado: false });
      expect(estado.eventos.map((e) => e.accion)).toEqual(['alcance.cambiado', 'alcance.aprobado', 'alcance.cambiado']);
    });

    it('el colaborador ve pero no gestiona ni aprueba (403, y 403 antes que 400)', async () => {
      const t = await tColab();
      expect((await arnes.pedir('/alcances', t)).status).toBe(200);
      await problema(await arnes.pedir('/alcances', t, 'PUT', { norma: NORMA, texto: 'x' }), 403, 'sin_permiso');
      await problema(await arnes.pedir('/alcances', t, 'PUT', [1]), 403, 'sin_permiso');
      await problema(await arnes.pedir('/alcances/aprobacion', t, 'POST', { norma: NORMA }), 403, 'sin_permiso');
      expect(estado.alcances.size).toBe(0);
    });

    it('400 por forma (sin repetir el valor) y 404 por una norma que la empresa no adoptó', async () => {
      const t = await tAdmin();
      await problema(await arnes.pedir('/alcances', t, 'PUT', { norma: 123, texto: 'x' }), 400, 'parametro_invalido');
      await problema(await arnes.pedir('/alcances', t, 'PUT', { norma: NORMA, texto: '' }), 400, 'parametro_invalido');
      await problema(await arnes.pedir('/alcances', t, 'PUT', { norma: 'ISO 42001', texto: 'x' }), 404, 'no_encontrado');
      await problema(await arnes.pedir('/alcances/aprobacion', t, 'POST', { norma: NORMA }), 404, 'no_encontrado'); // sin alcance definido
    });

    it('aislamiento: la empresa del token manda, aunque el cuerpo traiga otra', async () => {
      await arnes.pedir('/alcances', await tAdmin(), 'PUT', { norma: NORMA, texto: 'Alcance de A.', empresaId: B });
      const deB = (await cuerpo(await arnes.pedir('/alcances', await tAdminB()))) as { norma: string; texto: string | null }[];
      expect(deB.map((a) => a.texto)).toEqual([null, null]); // las dos normas de la entrada de B, sin el texto de A
      expect([...estado.alcances.keys()].every((k) => k.startsWith(`${A}|`))).toBe(true);
    });
  });

  describe('diagnóstico', () => {
    it('lista las entradas con su evaluación y la madurez, con la forma del contrato', async () => {
      await evaluar(await tAdmin(), eval1);
      const r = await arnes.pedir('/diagnostico', await tColab());
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = (await cuerpo(r)) as { filas: { idEstable: string; evaluacion: { estado: string } | null }[]; normas: string[] };
      expect(erroresDeEsquema('Diagnostico', c)).toEqual([]);
      expect(c.filas.find((f) => f.idEstable === 'a27-5-1')?.evaluacion?.estado).toBe('cumple');
      expect(c.filas.find((f) => f.idEstable === 'a27-5-2')?.evaluacion).toBeNull();
    });

    it('filtra por estado y por tipo; un filtro inválido o repetido responde 400', async () => {
      await evaluar(await tAdmin(), eval1);
      const t = await tColab();
      const sin = (await cuerpo(await arnes.pedir('/diagnostico?estado=sin_evaluar&tipo=control', t))) as { filas: { idEstable: string }[] };
      expect(sin.filas.map((f) => f.idEstable)).toEqual(['a27-5-2']);
      await problema(await arnes.pedir('/diagnostico?estado=quizas', t), 400, 'parametro_invalido');
      await problema(await arnes.pedir('/diagnostico?q=a&q=b', t), 400, 'parametro_invalido');
    });

    it('sin permiso responde 403', async () => {
      estado.permisos.clear();
      await problema(await arnes.pedir('/diagnostico', await tColab()), 403, 'sin_permiso');
    });

    it('aislamiento: B no ve las evaluaciones de A ni sus entradas', async () => {
      await evaluar(await tAdmin(), eval1);
      const deB = (await cuerpo(await arnes.pedir('/diagnostico', await tAdminB()))) as { filas: { idEstable: string; evaluacion: unknown }[] };
      expect(deB.filas.map((f) => f.idEstable)).toEqual(['ha-4.1']);
      expect(deB.filas.every((f) => f.evaluacion === null)).toBe(true);
    });
  });

  describe('PUT /diagnostico/evaluaciones', () => {
    it('evalúa por primera vez y vuelve a evaluar con la versión esperada; la bitácora recibe el cambio', async () => {
      const t = await tColab();
      const primera = await evaluar(t, eval1);
      expect(primera.status).toBe(200);
      const c1 = (await cuerpo(primera)) as { version: number };
      expect(erroresDeEsquema('Evaluacion', c1)).toEqual([]);
      expect(c1.version).toBe(1);
      const segunda = await evaluar(t, { ...eval1, estado: 'parcial', comentario: 'Falta aprobar el documento.', versionEsperada: 1 });
      expect(await cuerpo(segunda)).toMatchObject({ estado: 'parcial', version: 2 });
      expect(estado.eventos.map((e) => e.accion)).toEqual(['evaluacion.cambiada', 'evaluacion.cambiada']);
    });

    it('409 si otra persona la cambió antes (versión distinta), sin pisar su trabajo', async () => {
      await evaluar(await tAdmin(), eval1);
      await problema(await evaluar(await tColab(), { ...eval1, estado: 'no_cumple' }), 409, 'conflicto');
      expect([...estado.evaluaciones.values()].map((e) => e.estado)).toEqual(['cumple']);
    });

    it('403 antes que 400; 400 por forma y 404 por una entrada que no existe para la empresa', async () => {
      estado.permisos.clear();
      await problema(await evaluar(await tColab(), { estado: 7 }), 403, 'sin_permiso');
      estado.conceder(COLAB, A, 'diagnostico.evaluar');
      const t = await tColab();
      await problema(await evaluar(t, { ...eval1, estado: 'quizas' }), 400, 'parametro_invalido');
      await problema(await evaluar(t, { ...eval1, estado: 'no_aplica' }), 400, 'parametro_invalido'); // «no aplica» exige justificación
      await problema(await evaluar(t, { ...eval1, idEstable: 'no-existe' }), 404, 'no_encontrado');
      await problema(await evaluar(t, { ...eval1, versionEsperada: 'uno' }), 400, 'parametro_invalido');
    });

    it('aislamiento: una entrada que solo tiene A es 404 para B, igual que una inexistente', async () => {
      await problema(await evaluar(await tAdminB(), eval1), 404, 'no_encontrado');
      await problema(await evaluar(await tAdminB(), { ...eval1, idEstable: 'no-existe' }), 404, 'no_encontrado');
      expect(estado.evaluaciones.size).toBe(0);
    });

    it('si falla la bitácora, la acción se revierte y responde 500', async () => {
      estado.fallarBitacora = true;
      await problema(await evaluar(await tAdmin(), eval1), 500, 'error_interno');
      expect(estado.evaluaciones.size).toBe(0);
    });
  });
});
