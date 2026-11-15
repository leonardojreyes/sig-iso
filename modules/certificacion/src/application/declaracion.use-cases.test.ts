import { describe, expect, it } from 'vitest';
import { Alcance } from '../domain/alcance.js';
import { Evaluacion } from '../domain/evaluacion.js';
import type { EstadoEvaluacion } from '../domain/estado-evaluacion.js';
import { AgregarMapeoUseCase, CrearControlUseCase } from './controles.use-cases.js';
import { AprobarDeclaracionUseCase, ExportarDeclaracionUseCase, ListarVersionesDeclaracionUseCase, ObtenerDeclaracionUseCase, ObtenerVersionDeclaracionUseCase } from './declaracion.use-cases.js';
import { ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import { A, ADMIN, B, COLAB, EstadoFalso, GeneradorFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './prueba/index.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const yo = { empresaId: A, usuarioId: ADMIN };
const POL = entradas.politicas;
const ROL = entradas.roles;

const montar = () => {
  const estado = new EstadoFalso();
  // El catálogo trae una cláusula (no entra a la declaración) y dos controles del Anexo A.
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, POL, ROL]);
  estado.catalogoPorEmpresa.set(B, [POL]);
  estado.conceder(ADMIN, A, 'controles.ver', 'controles.gestionar', 'declaracion.ver', 'declaracion.exportar', 'declaracion.aprobar');
  estado.conceder(COLAB, A, 'declaracion.ver', 'declaracion.exportar');
  estado.conceder(ADMIN_B, B, 'declaracion.ver', 'declaracion.exportar', 'declaracion.aprobar');
  let ahora = new Date('2026-11-12T15:00:00Z'); // hoy en Ecuador: 2026-11-12
  let n = 0;
  const reloj = () => ahora;
  const nuevoId = () => `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  const generador = new GeneradorFalso();
  return {
    estado,
    generador,
    ponerAhora: (d: Date) => { ahora = d; },
    crearControl: new CrearControlUseCase(u, aut, reloj, nuevoId),
    agregarMapeo: new AgregarMapeoUseCase(u, aut, cat, reloj),
    borrador: new ObtenerDeclaracionUseCase(u, aut, cat, reloj),
    aprobar: new AprobarDeclaracionUseCase(u, aut, cat, reloj, nuevoId),
    versiones: new ListarVersionesDeclaracionUseCase(u, aut),
    version: new ObtenerVersionDeclaracionUseCase(u, aut),
    exportar: new ExportarDeclaracionUseCase(u, aut, cat, generador, reloj),
  };
};
type Montaje = ReturnType<typeof montar>;

const evaluar = (m: Montaje, e: typeof POL, estado: EstadoEvaluacion, comentario: string | null = null, empresaId = A) =>
  m.estado.evaluaciones.set(`${empresaId}|${e.libreriaCodigo}|${e.idEstable}`, Evaluacion.crear({ empresaId, libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, libreriaId: e.libreriaId, estado, comentario, version: 1 }));
/** Las dos entradas evaluadas: una cumple y otra no aplica (con su justificación). */
const completa = (m: Montaje) => {
  evaluar(m, POL, 'cumple', 'COMENTARIO-PRIVADO que no va a la declaración');
  evaluar(m, ROL, 'no_aplica', 'No hay personal propio');
};

describe('permisos y orden de evaluación', () => {
  it.each([
    ['ver el borrador', (m: Montaje, u: string) => m.borrador.ejecutar({ empresaId: A, usuarioId: u })],
    ['aprobar', (m: Montaje, u: string) => m.aprobar.ejecutar({ empresaId: A, usuarioId: u })],
    ['listar versiones', (m: Montaje, u: string) => m.versiones.ejecutar({ empresaId: A, usuarioId: u })],
    ['leer una versión', (m: Montaje, u: string) => m.version.ejecutar({ empresaId: A, usuarioId: u, id: 'no-es-uuid' })],
    ['exportar', (m: Montaje, u: string) => m.exportar.ejecutar({ empresaId: A, usuarioId: u, versionId: 'no-es-uuid' })],
  ])('sin permiso no se puede %s (y el permiso se decide antes de validar el id)', async (_n, accion) => {
    const m = montar();
    await expect(accion(m, SIN_PERMISOS)).rejects.toBeInstanceOf(SinPermisoError);
  });
  it('el colaborador consulta y exporta, pero no aprueba', async () => {
    const m = montar();
    completa(m);
    await expect(m.borrador.ejecutar({ ...yo, usuarioId: COLAB })).resolves.toBeDefined();
    await expect(m.exportar.ejecutar({ ...yo, usuarioId: COLAB })).resolves.toBeDefined();
    await expect(m.aprobar.ejecutar({ ...yo, usuarioId: COLAB })).rejects.toBeInstanceOf(SinPermisoError);
    expect(m.estado.declaraciones.size).toBe(0);
  });
});

describe('el borrador', () => {
  it('trae una fila por control del Anexo A (sin las cláusulas) y todo «por decidir» si nada está evaluado', async () => {
    const m = montar();
    const d = await m.borrador.ejecutar(yo);
    expect(d.norma).toBe('ISO/IEC 27001');
    expect(d.filas.map((f) => f.idEstable)).toEqual([POL.idEstable, ROL.idEstable]);
    expect(d.resumen).toEqual({ total: 2, aplican: 0, noAplican: 0, porDecidir: 2, sinControl: 0, aprobable: false });
    expect(d.ultimaVersion).toBeNull();
    expect(d.alcance).toBeNull();
    expect(d.hoy).toBe('2026-11-12');
  });
  it('deriva aplicabilidad, justificación, controles y cobertura de lo que hay', async () => {
    const m = montar();
    completa(m);
    const c = await m.crearControl.ejecutar({ ...yo, codigo: 'C-001', nombre: 'Política' });
    await m.agregarMapeo.ejecutar({ ...yo, controlId: c.id, libreriaCodigo: POL.libreriaCodigo, idEstable: POL.idEstable });
    const d = await m.borrador.ejecutar(yo);
    expect(d.filas[0]).toMatchObject({ aplicabilidad: 'aplica', implementacion: 'implementado', justificacion: null, controles: ['C-001'], cobertura: 'sin_evidencia' });
    expect(d.filas[1]).toMatchObject({ aplicabilidad: 'no_aplica', implementacion: null, justificacion: 'No hay personal propio', controles: [], cobertura: 'no_aplica' });
    expect(d.resumen).toEqual({ total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 0, aprobable: true });
  });
  it('no mezcla ediciones: un control del Anexo A de la edición 2013 (de una librería adoptada) NO entra a la declaración', async () => {
    const m = montar();
    const de2013 = { ...ROL, idEstable: 'a27-2013-6-1', aplicaA: ROL.aplicaA.map((a) => ({ ...a, edicion: '2013' })) };
    m.estado.catalogoPorEmpresa.set(A, [entradas.contexto, POL, ROL, de2013]);
    const d = await m.borrador.ejecutar(yo);
    expect(d.filas.map((f) => f.idEstable)).toEqual([POL.idEstable, ROL.idEstable]);
    expect(d.resumen.total).toBe(2);
  });

  it('nunca copia el comentario de una evaluación que aplica', async () => {
    const m = montar();
    completa(m);
    expect(JSON.stringify(await m.borrador.ejecutar(yo))).not.toContain('COMENTARIO-PRIVADO');
  });
  it('incluye el alcance de 27001 y si está aprobado', async () => {
    const m = montar();
    const al = Alcance.crear({ empresaId: A, norma: 'ISO/IEC 27001', texto: 'Desarrollo de software', actualizadoPor: ADMIN, actualizadoEn: new Date('2026-11-01T00:00:00Z') });
    m.estado.alcances.set(`${A}|ISO/IEC 27001`, al);
    expect((await m.borrador.ejecutar(yo)).alcance).toEqual({ texto: 'Desarrollo de software', aprobado: false });
    m.estado.alcances.set(`${A}|ISO/IEC 27001`, al.aprobar(ADMIN, new Date('2026-11-02T00:00:00Z')));
    expect((await m.borrador.ejecutar(yo)).alcance?.aprobado).toBe(true);
  });
  it('no es del otro lado: B solo ve sus entradas y nada de A', async () => {
    const m = montar();
    completa(m);
    const d = await m.borrador.ejecutar({ empresaId: B, usuarioId: ADMIN_B });
    expect(d.filas).toHaveLength(1);
    expect(d.filas[0]).toMatchObject({ aplicabilidad: 'por_decidir' });
  });
});

describe('aprobar', () => {
  it('rechaza con «incompleta» si alguna fila está por decidir, sin dejar versión ni hecho', async () => {
    const m = montar();
    evaluar(m, POL, 'cumple');
    await expect(m.aprobar.ejecutar(yo)).rejects.toMatchObject({ motivo: 'incompleta' });
    await expect(m.aprobar.ejecutar(yo)).rejects.toBeInstanceOf(ConflictoError);
    expect(m.estado.declaraciones.size).toBe(0);
    expect(m.estado.eventos).toEqual([]);
  });
  it('rechaza con «incompleta» si la empresa no adoptó ningún control de 27001', async () => {
    const m = montar();
    m.estado.catalogoPorEmpresa.set(A, [entradas.contexto]);
    await expect(m.aprobar.ejecutar(yo)).rejects.toMatchObject({ motivo: 'incompleta' });
  });
  it('congela la versión 1 con sus filas, el alcance y los conteos, y deja el hecho sin texto', async () => {
    const m = montar();
    completa(m);
    m.estado.alcances.set(`${A}|ISO/IEC 27001`, Alcance.crear({ empresaId: A, norma: 'ISO/IEC 27001', texto: 'ALCANCE-PRIVADO', actualizadoPor: ADMIN, actualizadoEn: new Date('2026-11-01T00:00:00Z') }));
    const v = await m.aprobar.ejecutar(yo);
    expect(v).toMatchObject({ numero: 1, total: 2, aplican: 1, noAplican: 1, sinControl: 1, aprobadaPor: ADMIN });
    const guardada = await m.version.ejecutar({ ...yo, id: v.id });
    expect(guardada.alcance).toBe('ALCANCE-PRIVADO');
    expect(guardada.filas.map((f) => [f.idEstable, f.aplicabilidad])).toEqual([[POL.idEstable, 'aplica'], [ROL.idEstable, 'no_aplica']]);
    expect(m.estado.eventos).toHaveLength(1);
    expect(m.estado.eventos[0]).toMatchObject({ accion: 'declaracion.aprobada', objeto: 'declaracion:v1', despues: { total: 2, aplican: 1, no_aplican: 1, sin_control: 1 } });
    expect(JSON.stringify(m.estado.eventos)).not.toMatch(/ALCANCE-PRIVADO|COMENTARIO-PRIVADO|No hay personal/);
  });
  it('una aprobación nueva crea la versión siguiente y la anterior no cambia', async () => {
    const m = montar();
    completa(m);
    const v1 = await m.aprobar.ejecutar(yo);
    evaluar(m, ROL, 'parcial'); // el diagnóstico cambia después de aprobar
    const v2 = await m.aprobar.ejecutar(yo);
    expect(v2.numero).toBe(2);
    expect((await m.version.ejecutar({ ...yo, id: v1.id })).filas[1]).toMatchObject({ aplicabilidad: 'no_aplica', justificacion: 'No hay personal propio' });
    expect((await m.version.ejecutar({ ...yo, id: v2.id })).filas[1]).toMatchObject({ aplicabilidad: 'aplica', implementacion: 'parcial' });
    expect((await m.versiones.ejecutar(yo)).map((x) => x.numero)).toEqual([2, 1]);
    expect((await m.borrador.ejecutar(yo)).ultimaVersion?.numero).toBe(2);
  });
  it('si otra persona aprobó en medio, responde conflicto y no deja hecho', async () => {
    const m = montar();
    completa(m);
    m.estado.carrera = true;
    await expect(m.aprobar.ejecutar(yo)).rejects.toMatchObject({ motivo: 'version_distinta' });
    expect(m.estado.declaraciones.size).toBe(0);
    expect(m.estado.eventos).toEqual([]);
  });
  it('si la bitácora falla, la versión se revierte', async () => {
    const m = montar();
    completa(m);
    m.estado.fallarBitacora = true;
    await expect(m.aprobar.ejecutar(yo)).rejects.toThrow('bitácora no disponible');
    expect(m.estado.declaraciones.size).toBe(0);
  });
  it('cada empresa lleva su propia numeración', async () => {
    const m = montar();
    completa(m);
    evaluar(m, POL, 'cumple', null, B);
    await m.aprobar.ejecutar(yo);
    const vb = await m.aprobar.ejecutar({ empresaId: B, usuarioId: ADMIN_B });
    expect(vb.numero).toBe(1);
  });
});

describe('leer versiones', () => {
  it('una versión de otra empresa no se ve: es «no encontrada», igual que una inexistente', async () => {
    const m = montar();
    completa(m);
    const v = await m.aprobar.ejecutar(yo);
    await expect(m.version.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.version.ejecutar({ ...yo, id: 'dddddddd-0000-4000-8000-00000000ffff' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(await m.versiones.ejecutar({ empresaId: B, usuarioId: ADMIN_B })).toEqual([]);
  });
  it('un id mal formado es 400', async () => {
    const m = montar();
    await expect(m.version.ejecutar({ ...yo, id: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});

describe('exportar', () => {
  it('el borrador sale como preliminar y queda en la bitácora con la huella del documento', async () => {
    const m = montar();
    completa(m);
    const x = await m.exportar.ejecutar(yo);
    expect(m.generador.llamadas).toHaveLength(1);
    expect(m.generador.llamadas[0]).toMatchObject({ preliminar: true, version: null, aprobadaEl: null, generadaEl: '2026-11-12', norma: 'ISO/IEC 27001' });
    expect(x.nombre).toBe('declaracion-iso-iec-27001-borrador.docx');
    expect(x.tipo).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(m.estado.eventos).toHaveLength(1);
    expect(m.estado.eventos[0]).toMatchObject({ accion: 'declaracion.exportada', objeto: 'declaracion:borrador', objetoVersion: x.sha256 });
  });
  it('una versión aprobada sale de su copia congelada, no de los datos de hoy', async () => {
    const m = montar();
    completa(m);
    const v = await m.aprobar.ejecutar(yo);
    m.estado.eventos = [];
    evaluar(m, ROL, 'no_cumple'); // hoy es otra cosa
    m.ponerAhora(new Date('2026-12-01T15:00:00Z'));
    const x = await m.exportar.ejecutar({ ...yo, versionId: v.id });
    const doc = m.generador.llamadas[0];
    expect(doc).toMatchObject({ preliminar: false, version: 1, aprobadaEl: '2026-11-12', generadaEl: '2026-12-01' });
    expect(doc?.filas[1]).toMatchObject({ aplicabilidad: 'no_aplica' });
    expect(doc?.resumen).toEqual({ total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 1 });
    expect(x.nombre).toBe('declaracion-iso-iec-27001-v1.docx');
    expect(m.estado.eventos[0]).toMatchObject({ objeto: 'declaracion:v1', objetoVersion: x.sha256 });
  });
  it('una versión de otra empresa o inexistente es 404 y no se genera nada', async () => {
    const m = montar();
    completa(m);
    const v = await m.aprobar.ejecutar(yo);
    await expect(m.exportar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, versionId: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(m.generador.llamadas).toEqual([]);
  });
  it('si no se puede registrar en la bitácora, no se entrega nada', async () => {
    const m = montar();
    completa(m);
    m.estado.fallarBitacora = true;
    await expect(m.exportar.ejecutar(yo)).rejects.toThrow('bitácora no disponible');
  });
  it('si el generador falla, no queda ningún hecho de exportación', async () => {
    const m = montar();
    completa(m);
    m.generador.fallar = true;
    await expect(m.exportar.ejecutar(yo)).rejects.toThrow('generador no disponible');
    expect(m.estado.eventos).toEqual([]);
  });
});
