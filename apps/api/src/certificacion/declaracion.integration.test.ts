import { AlmacenArchivosLocal, Evaluacion } from '@sig/certificacion';
import { A, ADMIN, B, COLAB, EstadoFalso, entradas, sha256Hex } from '@sig/certificacion/prueba';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { CertificacionApiModule } from './certificacion-api.module.js';
import { opcionesDePrueba } from './prueba/opciones.js';

// Declaración de Aplicabilidad sobre una aplicación Nest REAL: casos de uso reales con fakes que separan los datos por empresa y el
// generador de Word real. Cada respuesta JSON se valida contra los esquemas de openapi.yaml.
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const ID_FALSO = 'dddddddd-0000-4000-8000-000000000000';
const POL = entradas.politicas;
const ROL = entradas.roles;
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const RUTAS: readonly (readonly [string, string])[] = [
  ['GET', '/declaracion'],
  ['POST', '/declaracion/aprobacion'],
  ['GET', '/declaracion/versiones'],
  ['GET', `/declaracion/versiones/${ID_FALSO}`],
  ['GET', '/declaracion/documento'],
  ['GET', `/declaracion/versiones/${ID_FALSO}/documento`],
];

describe('declaración de aplicabilidad (MVP M5, paso 4)', () => {
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
    raiz = await mkdtemp(join(tmpdir(), 'sigiso-api-decl-'));
    estado = new EstadoFalso();
    arnes = await crearArnes({ hechos: bitacora.hechos, modulos: [CertificacionApiModule.register(opcionesDePrueba({ estado, almacen: new AlmacenArchivosLocal(raiz), reloj: () => new Date('2026-11-12T15:00:00Z') }))] });
  });
  afterAll(async () => {
    await arnes.cerrar();
    await rm(raiz, { recursive: true, force: true });
  });
  beforeEach(() => {
    for (const m of [estado.controles, estado.mapeos, estado.evaluaciones, estado.alcances, estado.evidencias, estado.declaraciones]) m.clear();
    estado.eventos = [];
    estado.permisos.clear();
    estado.carrera = false;
    estado.fallarBitacora = false;
    estado.catalogoPorEmpresa.clear();
    estado.catalogoPorEmpresa.set(A, [entradas.contexto, POL, ROL]);
    estado.catalogoPorEmpresa.set(B, [POL]);
    estado.conceder(ADMIN, A, 'controles.ver', 'controles.gestionar', 'declaracion.ver', 'declaracion.exportar', 'declaracion.aprobar');
    estado.conceder(COLAB, A, 'declaracion.ver', 'declaracion.exportar');
    estado.conceder(ADMIN_B, B, 'declaracion.ver', 'declaracion.exportar', 'declaracion.aprobar');
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  interface Fila { idEstable: string; aplicabilidad: string; implementacion: string | null; justificacion: string | null }
  interface Cuerpo { [clave: string]: unknown; norma: string; hoy: string; resumen: unknown; filas: Fila[]; ultimaVersion: unknown; alcance: unknown; id: string; numero: number }
  const cuerpo = async (r: Response) => (await r.json()) as Cuerpo;
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const c = await cuerpo(r);
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
  };
  const evaluar = (e: typeof POL, est: 'cumple' | 'parcial' | 'no_cumple' | 'no_aplica', comentario: string | null = null, empresa = A) =>
    estado.evaluaciones.set(`${empresa}|${e.libreriaCodigo}|${e.idEstable}`, Evaluacion.crear({ empresaId: empresa, libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, libreriaId: e.libreriaId, estado: est, comentario, version: 1 }));
  const completa = () => {
    evaluar(POL, 'cumple', 'COMENTARIO-PRIVADO');
    evaluar(ROL, 'no_aplica', 'No hay personal propio');
  };
  const aprobar = async (t?: string) => arnes.pedir('/declaracion/aprobacion', t ?? (await tAdmin()), 'POST');
  const bytesDe = async (r: Response) => new Uint8Array(await r.arrayBuffer());

  describe('401 sin token', () => {
    it.each(RUTAS)('%s %s', async (metodo, ruta) => {
      await problema(await arnes.pedir(ruta, undefined, metodo), 401, 'no_autenticado');
      expect(estado.declaraciones.size).toBe(0);
    });
  });

  describe('403 sin permiso: se decide antes de mirar el identificador', () => {
    it.each(RUTAS)('%s %s', async (metodo, ruta) => {
      const r = await arnes.pedir(ruta.replace(ID_FALSO, 'no-es-uuid'), await tSin(), metodo);
      await problema(r, 403, 'sin_permiso');
      expect(estado.declaraciones.size).toBe(0);
    });
    it('el colaborador no puede aprobar', async () => {
      completa();
      await problema(await aprobar(await tColab()), 403, 'sin_permiso');
      expect(estado.declaraciones.size).toBe(0);
    });
  });

  describe('el borrador', () => {
    it('200 con la declaración derivada, sin caché, y validada contra el contrato', async () => {
      completa();
      const r = await arnes.pedir('/declaracion', await tColab());
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const d = await cuerpo(r);
      expect(erroresDeEsquema('Declaracion', d)).toEqual([]);
      expect(d.norma).toBe('ISO/IEC 27001');
      expect(d.hoy).toBe('2026-11-12');
      expect(d.resumen).toEqual({ total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 1, aprobable: true });
      expect(d.filas.map((f) => [f.idEstable, f.aplicabilidad, f.implementacion, f.justificacion])).toEqual([
        [POL.idEstable, 'aplica', 'implementado', null],
        [ROL.idEstable, 'no_aplica', null, 'No hay personal propio'],
      ]);
      expect(d.ultimaVersion).toBeNull();
      expect(d.alcance).toBeNull();
      expect(JSON.stringify(d)).not.toContain('COMENTARIO-PRIVADO');
    });
    it('sin evaluar todo queda por decidir y no es aprobable', async () => {
      const d = await cuerpo(await arnes.pedir('/declaracion', await tAdmin()));
      expect(erroresDeEsquema('Declaracion', d)).toEqual([]);
      expect(d.resumen).toMatchObject({ porDecidir: 2, aprobable: false });
    });
    it('la empresa sale solo del token: un ?empresa= no cambia nada', async () => {
      completa();
      const d = await cuerpo(await arnes.pedir(`/declaracion?empresa=${A}`, await tAdminB()));
      expect(d.filas).toHaveLength(1);
      expect(d.filas[0].aplicabilidad).toBe('por_decidir'); // B no evaluó nada; lo de A no se mezcla
    });
  });

  describe('aprobar', () => {
    it('409 si queda algo por decidir y no deja nada guardado ni en la bitácora', async () => {
      evaluar(POL, 'cumple');
      await problema(await aprobar(), 409, 'conflicto');
      expect(estado.declaraciones.size).toBe(0);
      expect(estado.eventos).toEqual([]);
    });
    it('201 con la versión 1, validada contra el contrato y con el hecho sin texto', async () => {
      completa();
      const r = await aprobar();
      expect(r.status).toBe(201);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const v = await cuerpo(r);
      expect(erroresDeEsquema('VersionDeclaracion', v)).toEqual([]);
      expect(v).toMatchObject({ numero: 1, total: 2, aplican: 1, noAplican: 1, sinControl: 1, aprobadaPor: ADMIN });
      expect(estado.eventos).toHaveLength(1);
      expect(estado.eventos[0]).toMatchObject({ accion: 'declaracion.aprobada', objeto: 'declaracion:v1', despues: { total: 2, aplican: 1, no_aplican: 1, sin_control: 1 } });
      expect(JSON.stringify(estado.eventos)).not.toMatch(/COMENTARIO-PRIVADO|No hay personal/);
    });
    it('una segunda aprobación crea la versión 2 y el borrador apunta a ella', async () => {
      completa();
      await aprobar();
      expect((await cuerpo(await aprobar())).numero).toBe(2);
      const d = await cuerpo(await arnes.pedir('/declaracion', await tAdmin()));
      expect(erroresDeEsquema('Declaracion', d)).toEqual([]);
      expect(d.ultimaVersion).toMatchObject({ numero: 2 });
    });
    it('409 si otra persona aprobó en medio, sin dejar versión', async () => {
      completa();
      estado.carrera = true;
      await problema(await aprobar(), 409, 'conflicto');
      expect(estado.declaraciones.size).toBe(0);
    });
    it('si la bitácora falla, responde 500 y no queda versión', async () => {
      completa();
      estado.fallarBitacora = true;
      expect((await aprobar()).status).toBe(500);
      expect(estado.declaraciones.size).toBe(0);
    });
  });

  describe('versiones', () => {
    it('lista de la más nueva a la más antigua y lee una con sus filas congeladas', async () => {
      completa();
      const v1 = await cuerpo(await aprobar());
      evaluar(ROL, 'parcial'); // el diagnóstico cambia después
      await aprobar();
      const lista = (await (await arnes.pedir('/declaracion/versiones', await tColab())).json()) as Cuerpo[];
      expect(lista.map((v) => v.numero)).toEqual([2, 1]);
      for (const v of lista) expect(erroresDeEsquema('VersionDeclaracion', v)).toEqual([]);
      const r = await arnes.pedir(`/declaracion/versiones/${v1.id}`, await tColab());
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const completa1 = await cuerpo(r);
      expect(erroresDeEsquema('VersionDeclaracionConFilas', completa1)).toEqual([]);
      expect(completa1.filas[1]).toMatchObject({ aplicabilidad: 'no_aplica', justificacion: 'No hay personal propio' });
    });
    it('400 con un identificador mal formado; 404 si no existe', async () => {
      await problema(await arnes.pedir('/declaracion/versiones/no-es-uuid', await tAdmin()), 400, 'parametro_invalido');
      await problema(await arnes.pedir(`/declaracion/versiones/${ID_FALSO}`, await tAdmin()), 404, 'no_encontrado');
    });
    it('AISLAMIENTO: B no ve las versiones de A; la de A es 404 indistinguible de una inexistente', async () => {
      completa();
      const v = await cuerpo(await aprobar());
      expect(await (await arnes.pedir('/declaracion/versiones', await tAdminB())).json()).toEqual([]);
      const cruzada = await arnes.pedir(`/declaracion/versiones/${v.id}`, await tAdminB());
      const inexistente = await arnes.pedir(`/declaracion/versiones/${ID_FALSO}`, await tAdminB());
      await problema(cruzada, 404, 'no_encontrado');
      expect(await cuerpo(inexistente)).toMatchObject({ status: 404, codigo: 'no_encontrado' });
      await problema(await arnes.pedir(`/declaracion/versiones/${v.id}/documento`, await tAdminB()), 404, 'no_encontrado');
    });
  });

  describe('exportar a Word', () => {
    const cabecerasSeguras = (r: Response, nombre: string) => {
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toContain(DOCX);
      expect(r.headers.get('content-disposition')).toContain(`attachment; filename="${nombre}"`);
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
    };
    it('el borrador sale como adjunto, es un .docx (ZIP) y la bitácora lleva la huella EXACTA de lo entregado', async () => {
      completa();
      const r = await arnes.pedir('/declaracion/documento', await tColab());
      cabecerasSeguras(r, 'declaracion-iso-iec-27001-borrador.docx');
      const bytes = await bytesDe(r);
      expect(Buffer.from(bytes.subarray(0, 4)).toString('hex')).toBe('504b0304');
      expect(estado.eventos).toHaveLength(1);
      expect(estado.eventos[0]).toMatchObject({ accion: 'declaracion.exportada', objeto: 'declaracion:borrador', objetoVersion: sha256Hex(bytes), actor: { usuarioId: COLAB } });
    });
    it('una versión aprobada se exporta desde su copia congelada y registra su propia huella', async () => {
      completa();
      const v = await cuerpo(await aprobar());
      estado.eventos = [];
      evaluar(ROL, 'no_cumple'); // hoy es otra cosa: la versión no cambia
      const r = await arnes.pedir(`/declaracion/versiones/${v.id}/documento`, await tAdmin());
      cabecerasSeguras(r, 'declaracion-iso-iec-27001-v1.docx');
      const bytes = await bytesDe(r);
      expect(estado.eventos[0]).toMatchObject({ accion: 'declaracion.exportada', objeto: 'declaracion:v1', objetoVersion: sha256Hex(bytes) });
    });
    it('si no se puede registrar en la bitácora, no se entrega ningún byte (500)', async () => {
      completa();
      estado.fallarBitacora = true;
      const r = await arnes.pedir('/declaracion/documento', await tAdmin());
      expect(r.status).toBe(500);
      expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    });
    it('400 con un identificador mal formado; 404 si no existe', async () => {
      await problema(await arnes.pedir('/declaracion/versiones/no-es-uuid/documento', await tAdmin()), 400, 'parametro_invalido');
      await problema(await arnes.pedir(`/declaracion/versiones/${ID_FALSO}/documento`, await tAdmin()), 404, 'no_encontrado');
      expect(estado.eventos).toEqual([]);
    });
  });
});
