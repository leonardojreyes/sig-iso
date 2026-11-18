import { describe, expect, it } from 'vitest';
import { Alcance } from '../domain/alcance.js';
import { Evaluacion } from '../domain/evaluacion.js';
import { MotivoInclusion } from '../domain/motivo-inclusion.js';
import { ReferenciaTratamiento } from '../domain/referencia-tratamiento.js';
import { Riesgo } from '../domain/riesgo.js';
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
/** Un motivo registrado (como lo dejaría el caso de uso de motivos) para un control del Anexo A. */
const motivar = (m: Montaje, e: typeof POL, tipo: 'legal' | 'contractual' | 'negocio' | 'otro' = 'negocio', nota = 'Necesidad del negocio', empresaId = A) =>
  m.estado.motivos.set(`${empresaId}|${e.libreriaCodigo}|${e.idEstable}|${tipo}`, MotivoInclusion.crear({ empresaId, libreriaCodigo: e.libreriaCodigo, idEstable: e.idEstable, tipo, nota }));
/** Las dos entradas evaluadas: una cumple y otra no aplica (con su justificación). */
const completa = (m: Montaje) => {
  evaluar(m, POL, 'cumple', 'COMENTARIO-PRIVADO que no va a la declaración');
  evaluar(m, ROL, 'no_aplica', 'No hay personal propio');
  motivar(m, POL); // todo control que aplica necesita un motivo para poder aprobar (ADR 037)
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
    motivar(m, ROL); // y ahora ROL aplica: necesita su motivo
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
    motivar(m, POL, 'negocio', 'Necesidad del negocio de B', B);
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

// ---- Declaración justificada (ADR 037): motivos derivados y registrados, bloqueo por falta de motivo y copia congelada.
const RIESGO_ID = 'eeeeeeee-0000-4000-8000-000000000001';
const sembrarRiesgo = (m: Montaje, extra: Partial<Parameters<typeof Riesgo.crear>[0]> = {}, empresaId = A) => {
  const r = Riesgo.crear({ id: RIESGO_ID, empresaId, codigo: 'R-001', titulo: 'TITULO-RIESGO Pérdida de portátiles', probabilidad: 3, impacto: 4, decision: 'mitigar', ...extra } as never);
  m.estado.riesgos.set(r.id, r);
  return r;
};
/** Tratamiento previsto: el riesgo se vincula directo a un control del Anexo A. */
const preverEn = (m: Montaje, e: typeof POL, riesgoId = RIESGO_ID, empresaId = A) => m.estado.vinculosEntrada.set(`${empresaId}|${riesgoId}|${e.libreriaCodigo}|${e.idEstable}`, ADMIN);
const referenciar = (m: Montaje, tipo: 'analisis' | 'plan') =>
  m.estado.referencias.set(`${A}|ISO/IEC 27001|${tipo}`, ReferenciaTratamiento.crear({ empresaId: A, norma: 'ISO/IEC 27001', tipo, titulo: `TITULO-REF ${tipo}`, versionDoc: '1.0', fecha: '2026-11-01', ubicacion: 'UBICACION-REF Carpeta SIG' }));
/** POL aplica y ROL no aplica; sin ningún motivo todavía. */
const sinMotivos = (m: Montaje) => {
  evaluar(m, POL, 'cumple');
  evaluar(m, ROL, 'no_aplica', 'No hay personal propio');
};

describe('el borrador justificado', () => {
  it('muestra por fila los motivos registrados y los riesgos que la tratan, y los conteos del resumen', async () => {
    const m = montar();
    sinMotivos(m);
    sembrarRiesgo(m);
    preverEn(m, POL);
    motivar(m, POL, 'legal', 'Ley de protección de datos');
    const d = await m.borrador.ejecutar(yo);
    expect(d.justificacion.filas[0]).toMatchObject({ idEstable: POL.idEstable, sinMotivo: false, motivos: [{ tipo: 'legal', nota: 'Ley de protección de datos' }], riesgos: [{ codigo: 'R-001', nivel: 'alto', via: 'previsto' }] });
    expect(d.justificacion.filas[1]).toMatchObject({ idEstable: ROL.idEstable, sinMotivo: false, motivos: [], riesgos: [] }); // no aplica: no se pide motivo
    expect(d.justificacion.resumen).toMatchObject({ aplican: 1, conMotivo: 1, sinMotivo: 0, riesgosVigentes: 1, riesgosSinTratamiento: 0, aprobable: true });
    expect(d.justificacion.escala).toEqual({ escalaMax: 5, corteMedio: 5, corteAlto: 10, corteCritico: 16 });
  });

  it('un control que aplica sin motivo bloquea: el resumen saliente ya no es aprobable', async () => {
    const m = montar();
    sinMotivos(m);
    const d = await m.borrador.ejecutar(yo);
    expect(d.resumen.aprobable).toBe(false);
    expect(d.justificacion.resumen).toMatchObject({ sinMotivo: 1, bloqueos: ['sin_motivo'] });
    expect(d.justificacion.filas[0]?.sinMotivo).toBe(true);
  });

  it('advierte (sin bloquear) si hay riesgos «mitigar» y falta la referencia al plan de tratamiento', async () => {
    const m = montar();
    sinMotivos(m);
    motivar(m, POL);
    sembrarRiesgo(m);
    expect((await m.borrador.ejecutar(yo)).justificacion).toMatchObject({ faltaPlanTratamiento: true, resumen: { riesgosSinTratamiento: 1, aprobable: true } });
    referenciar(m, 'analisis');
    expect((await m.borrador.ejecutar(yo)).justificacion.faltaPlanTratamiento).toBe(true); // el análisis no reemplaza al plan
    referenciar(m, 'plan');
    const d = await m.borrador.ejecutar(yo);
    expect(d.justificacion.faltaPlanTratamiento).toBe(false);
    expect(d.justificacion.referencias.map((r) => [r.tipo, r.titulo])).toEqual([['analisis', 'TITULO-REF analisis'], ['plan', 'TITULO-REF plan']]);
  });

  it('no usa riesgos, motivos ni referencias de otra empresa', async () => {
    const m = montar();
    sinMotivos(m);
    sembrarRiesgo(m, {}, B);
    preverEn(m, POL, RIESGO_ID, B);
    motivar(m, POL, 'legal', 'Del B', B);
    const d = await m.borrador.ejecutar(yo);
    expect(d.justificacion.resumen).toMatchObject({ riesgosVigentes: 0, conMotivo: 0, sinMotivo: 1 });
    expect(d.justificacion.filas[0]).toMatchObject({ motivos: [], riesgos: [] });
  });
});

describe('aprobar con motivos', () => {
  it('rechaza con «sin_motivo» si un control que aplica no tiene motivo, sin dejar versión ni hecho', async () => {
    const m = montar();
    sinMotivos(m);
    await expect(m.aprobar.ejecutar(yo)).rejects.toMatchObject({ motivo: 'sin_motivo' });
    expect(m.estado.declaraciones.size).toBe(0);
    expect(m.estado.eventos).toEqual([]);
    motivar(m, POL);
    await expect(m.aprobar.ejecutar(yo)).resolves.toMatchObject({ numero: 1 });
  });

  it('«incompleta» (algo por decidir) se informa antes que la falta de motivo', async () => {
    const m = montar();
    evaluar(m, POL, 'cumple'); // ROL queda sin evaluar y POL sin motivo
    await expect(m.aprobar.ejecutar(yo)).rejects.toMatchObject({ motivo: 'incompleta' });
  });

  it('un tratamiento previsto cuenta como motivo: se aprueba sin motivos registrados', async () => {
    const m = montar();
    sinMotivos(m);
    sembrarRiesgo(m);
    preverEn(m, POL);
    await expect(m.aprobar.ejecutar(yo)).resolves.toMatchObject({ numero: 1 });
  });

  it('un riesgo retirado ya no sostiene el motivo', async () => {
    const m = montar();
    sinMotivos(m);
    m.estado.riesgos.set(RIESGO_ID, sembrarRiesgo(m).retirar());
    preverEn(m, POL);
    await expect(m.aprobar.ejecutar(yo)).rejects.toMatchObject({ motivo: 'sin_motivo' });
  });

  it('congela motivos con su nota, riesgos tal como estaban, qué riesgos justifican cada fila, referencias y la escala', async () => {
    const m = montar();
    sinMotivos(m);
    const c = await m.crearControl.ejecutar({ ...yo, codigo: 'C-001', nombre: 'Cifrado de discos' });
    await m.agregarMapeo.ejecutar({ ...yo, controlId: c.id, libreriaCodigo: POL.libreriaCodigo, idEstable: POL.idEstable });
    sembrarRiesgo(m, { responsableId: ADMIN });
    m.estado.vinculosControl.set(`${A}|${RIESGO_ID}|${c.id}`, ADMIN);
    motivar(m, POL, 'contractual', 'Cláusula 7 del contrato con el cliente');
    referenciar(m, 'plan');
    const v = await m.aprobar.ejecutar(yo);
    const x = await m.version.ejecutar({ ...yo, id: v.id });
    expect(x.justificacion).toMatchObject({
      escala: { escalaMax: 5, corteMedio: 5, corteAlto: 10, corteCritico: 16 },
      conMotivo: 1,
      riesgosVigentes: 1,
      motivos: [{ idEstable: POL.idEstable, tipo: 'contractual', nota: 'Cláusula 7 del contrato con el cliente' }],
      riesgos: [{ codigo: 'R-001', titulo: 'TITULO-RIESGO Pérdida de portátiles', probabilidad: 3, impacto: 4, nivel: 'alto', decision: 'mitigar', responsableId: ADMIN, controles: ['C-001'] }],
      riesgosPorFila: [{ idEstable: POL.idEstable, riesgoCodigo: 'R-001', via: 'control' }],
      referencias: [{ tipo: 'plan', titulo: 'TITULO-REF plan', versionDoc: '1.0', fecha: '2026-11-01', ubicacion: 'UBICACION-REF Carpeta SIG' }],
    });
  });

  it('cambiar o retirar un riesgo, un motivo o una referencia después NO altera la versión aprobada', async () => {
    const m = montar();
    sinMotivos(m);
    const r = sembrarRiesgo(m);
    preverEn(m, POL);
    motivar(m, POL, 'legal', 'NOTA-ORIGINAL');
    referenciar(m, 'plan');
    const v = await m.aprobar.ejecutar(yo);
    const antes = JSON.stringify((await m.version.ejecutar({ ...yo, id: v.id })).justificacion);
    m.estado.riesgos.set(r.id, r.conCambios({ titulo: 'OTRO-TITULO', probabilidad: 1, impacto: 1 }).retirar());
    motivar(m, POL, 'legal', 'NOTA-CAMBIADA');
    m.estado.referencias.clear();
    m.estado.vinculosEntrada.clear();
    expect(JSON.stringify((await m.version.ejecutar({ ...yo, id: v.id })).justificacion)).toBe(antes);
    expect(antes).toContain('NOTA-ORIGINAL');
    expect(antes).not.toContain('OTRO-TITULO');
  });

  it('la bitácora lleva los conteos (con motivo y riesgos) y nunca textos', async () => {
    const m = montar();
    sinMotivos(m);
    sembrarRiesgo(m);
    preverEn(m, POL);
    motivar(m, POL, 'legal', 'NOTA-PRIVADA-LEGAL');
    referenciar(m, 'plan');
    await m.aprobar.ejecutar(yo);
    expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'declaracion.aprobada', objeto: 'declaracion:v1', despues: { total: 2, aplican: 1, no_aplican: 1, sin_control: 1, con_motivo: 1, riesgos: 1 } })]);
    expect(JSON.stringify(m.estado.eventos)).not.toMatch(/NOTA-PRIVADA|TITULO-RIESGO|TITULO-REF|UBICACION-REF/);
  });

  it('una versión aprobada antes de la Declaración justificada se sigue leyendo, sin justificación', async () => {
    const m = montar();
    completa(m);
    const v = await m.aprobar.ejecutar(yo);
    const guardada = m.estado.declaraciones.get(`${A}|${v.id}`);
    // Como quedó en la base antes de la 0019: sin escala, sin conteos y sin copia.
    if (!guardada) throw new Error('la versión debía existir');
    m.estado.declaraciones.set(`${A}|${v.id}`, { empresaId: A, version: { ...guardada.version, justificacion: null }, filas: guardada.filas, copia: null });
    const x = await m.version.ejecutar({ ...yo, id: v.id });
    expect(x.justificacion).toBeNull();
    expect(x.filas).toHaveLength(2);
  });

  it('aislamiento: no ve ni lee la justificación de una versión de otra empresa', async () => {
    const m = montar();
    completa(m);
    const v = await m.aprobar.ejecutar(yo);
    await expect(m.version.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});
