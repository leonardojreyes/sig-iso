// Escenario compartido de las pruebas de la auditoría interna: una empresa con dos administradores, dos auditores internos y una
// auditoría con líder, ya en preparación o en ejecución, con todos los casos de uso armados sobre los fakes. Solo para pruebas.
import { AvanzarAuditoriaUseCase, CambiarAuditoriaUseCase, CrearAuditoriaUseCase, DesignarMiembroUseCase } from '../auditorias.use-cases.js';
import { CerrarAuditoriaUseCase, EmitirInformeUseCase, ExportarInformeUseCase, ObtenerInformeUseCase, ObtenerPanelAuditoriaUseCase } from '../informe.use-cases.js';
import { AnularHallazgoUseCase, CambiarHallazgoUseCase, ListarHallazgosUseCase, RegistrarHallazgoUseCase } from '../hallazgos.use-cases.js';
import { AgregarPreguntaUseCase, EvaluarFilaUseCase, ListarListaUseCase, QuitarPreguntaUseCase, RegenerarListaUseCase } from '../lista.use-cases.js';
import { AgregarRelacionUseCase, CrearGestionSigUseCase, CrearProcesoUseCase } from '../procesos.use-cases.js';
import { CrearProgramaUseCase } from '../programas.use-cases.js';
import { sha256Hex } from './archivos.js';
import { A, ADMIN, B, COLAB, EstadoFalso, GeneradorFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas } from './fakes.js';

export const AUDITOR = '55555555-5555-4555-8555-5555555555a5';
export const AUDITOR2 = '77777777-7777-4777-8777-7777777777a7';
export const ADMIN_B = '66666666-6666-4666-8666-666666666666';
export const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
export const PERMISOS_AUDITORIA = ['auditoria.ver', 'auditoria.planificar', 'auditoria.ejecutar', 'auditoria.aprobar', 'auditoria.gestionar'] as const;
export const NORMAS_AUDITORIA = ['ejemplo-ha', 'iso-27001-2022-anexo-a'];
export const DATOS_AUDITORIA = {
  objetivo: 'Verificar el SGSI',
  inicio: '2026-11-10',
  fin: '2026-11-25',
  reunionApertura: '2026-11-10',
  reunionCierre: '2026-11-25',
  normas: NORMAS_AUDITORIA,
};

export const montarAuditoria = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  estado.conceder(ADMIN, A, ...PERMISOS_AUDITORIA);
  for (const u of [AUDITOR, AUDITOR2]) estado.conceder(u, A, 'auditoria.ver', 'auditoria.ejecutar');
  estado.conceder(COLAB, A, 'auditoria.ver');
  estado.conceder(ADMIN_B, B, ...PERMISOS_AUDITORIA);
  estado.documentosEstado.personas.set(A, [
    { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
    { id: AUDITOR, nombre: 'Dora Auditora', rol: 'auditor_interno', activa: true },
    { id: AUDITOR2, nombre: 'Eli Auditor', rol: 'auditor_interno', activa: true },
    { id: COLAB, nombre: 'Carla Colaboradora', rol: 'colaborador', activa: true },
  ]);
  estado.documentosEstado.personas.set(B, [{ id: ADMIN_B, nombre: 'Admin B', rol: 'administrador_sig', activa: true }]);
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 19, 15, 0, t++)); // 10:00 en Ecuador, hoy = 2026-11-19
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  const generador = new GeneradorFalso();
  const hashTexto = (texto: string): string => sha256Hex(new TextEncoder().encode(texto));
  return {
    estado,
    reloj,
    nuevoId,
    unidad: u,
    autorizacion: aut,
    catalogo: cat,
    crearProceso: new CrearProcesoUseCase(u, aut, reloj, nuevoId),
    gestionSig: new CrearGestionSigUseCase(u, aut, reloj, nuevoId),
    relacion: new AgregarRelacionUseCase(u, aut, reloj),
    crearPrograma: new CrearProgramaUseCase(u, aut, cat, reloj, nuevoId),
    crear: new CrearAuditoriaUseCase(u, aut, cat, reloj, nuevoId),
    cambiar: new CambiarAuditoriaUseCase(u, aut, cat, reloj),
    designar: new DesignarMiembroUseCase(u, aut, cat, reloj),
    avanzar: new AvanzarAuditoriaUseCase(u, aut, cat, reloj, nuevoId),
    listar: new ListarListaUseCase(u, aut, cat),
    regenerar: new RegenerarListaUseCase(u, aut, cat, reloj, nuevoId),
    evaluar: new EvaluarFilaUseCase(u, aut, reloj),
    agregarPregunta: new AgregarPreguntaUseCase(u, aut, reloj, nuevoId),
    quitarPregunta: new QuitarPreguntaUseCase(u, aut),
    listarHallazgos: new ListarHallazgosUseCase(u, aut),
    registrarHallazgo: new RegistrarHallazgoUseCase(u, aut, cat, reloj, nuevoId),
    cambiarHallazgo: new CambiarHallazgoUseCase(u, aut, cat, reloj),
    anularHallazgo: new AnularHallazgoUseCase(u, aut, reloj),
    emitirInforme: new EmitirInformeUseCase(u, aut, cat, reloj, nuevoId, hashTexto),
    obtenerInforme: new ObtenerInformeUseCase(u, aut),
    cerrar: new CerrarAuditoriaUseCase(u, aut, reloj),
    generador,
    exportar: new ExportarInformeUseCase(u, aut, generador, reloj, hashTexto),
    panel: new ObtenerPanelAuditoriaUseCase(u, aut, cat, reloj),
  };
};
export type EscenarioAuditoria = ReturnType<typeof montarAuditoria>;

export const quien = (usuarioId: string = ADMIN, empresaId: string = A) => ({ empresaId, usuarioId });

/** Una auditoría (combinada, un proceso) con `AUDITOR` como líder, ya «en preparación»: la lista se generó (tres filas). */
export const auditoriaEnPreparacion = async (extra: Record<string, unknown> = {}) => {
  const m = montarAuditoria();
  const proceso = await m.crearProceso.ejecutar({ ...quien(), nombre: 'Compras', duenaId: ADMIN });
  const programa = await m.crearPrograma.ejecutar({ ...quien(), anio: 2026, objetivo: 'Programa 2026', normas: NORMAS_AUDITORIA });
  const a = await m.crear.ejecutar({ ...quien(), programaId: programa.id, ...DATOS_AUDITORIA, procesosIds: [proceso.id], ...extra });
  await m.designar.ejecutar({ ...quien(), id: a.id, personaId: AUDITOR, rol: 'lider' });
  const prep = await m.avanzar.ejecutar({ ...quien(), id: a.id, versionEsperada: 1, estado: 'en_preparacion' });
  return { m, a: prep, proceso, programa };
};

/** La misma auditoría, ya «en ejecución»: se evalúa la lista y se registran hallazgos. */
export const auditoriaEnEjecucion = async (extra: Record<string, unknown> = {}) => {
  const c = await auditoriaEnPreparacion(extra);
  const a = await c.m.avanzar.ejecutar({ ...quien(), id: c.a.id, versionEsperada: c.a.version, estado: 'en_ejecucion' });
  return { ...c, a };
};

/** Evalúa toda la lista: la primera «conforme», la segunda «no conforme» con su hallazgo y la tercera «no verificado» con su nota. */
export const evaluarTodo = async (m: EscenarioAuditoria, a: { id: string }, proceso: { id: string }) => {
  const filas = (await m.listar.ejecutar({ ...quien(), id: a.id })).filas;
  await m.evaluar.ejecutar({ ...quien(AUDITOR), id: a.id, filaId: filas[0]!.id, versionEsperada: 1, resultado: 'conforme' });
  await m.evaluar.ejecutar({ ...quien(AUDITOR), id: a.id, filaId: filas[1]!.id, versionEsperada: 1, resultado: 'no_conforme', nota: 'falta la política firmada' });
  await m.evaluar.ejecutar({ ...quien(AUDITOR), id: a.id, filaId: filas[2]!.id, versionEsperada: 1, resultado: 'no_verificado', nota: 'sin tiempo para revisar' });
  const h = await m.registrarHallazgo.ejecutar({
    ...quien(AUDITOR),
    id: a.id,
    itemId: filas[1]!.id,
    tipo: 'nc_menor',
    procesoId: proceso.id,
    enunciado: 'ENUNCIADO-PRIVADO falta la política firmada',
    evidencia: 'EVIDENCIA-PRIVADA se revisó la carpeta',
  });
  return { filas, hallazgo: h };
};
