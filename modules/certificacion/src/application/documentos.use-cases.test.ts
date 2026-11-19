import { describe, expect, it } from 'vitest';
import { CrearControlUseCase } from './controles.use-cases.js';
import {
  CambiarDistribucionUseCase,
  CambiarDocumentoUseCase,
  CrearDocumentoUseCase,
  DesvincularDocumentoUseCase,
  GuardarRetencionUseCase,
  ListarCoberturaDocumentalUseCase,
  ListarDirectorioUseCase,
  ListarDocumentosUseCase,
  ListarRetencionUseCase,
  ObtenerDocumentoUseCase,
  RetirarDocumentoUseCase,
  RevisarDocumentoUseCase,
  VincularDocumentoUseCase,
} from './documentos.use-cases.js';
import {
  ArchivoRechazadoError,
  ConflictoDeVersionError,
  ConflictoError,
  EntradaNoEncontradaError,
  ParametroInvalidoError,
  SinPermisoError,
} from './errores.js';
import {
  A,
  ADMIN,
  AlmacenFalso,
  B,
  COLAB,
  EstadoFalso,
  crearAutorizacionFalsa,
  crearCatalogoFalso,
  crearUnidadFalsa,
  enTrozos,
  ejecutable,
  entradas,
  flujoProhibido,
  pdf,
} from './prueba/index.js';
import {
  AprobarVersionUseCase,
  ConfirmarLecturaUseCase,
  DescargarVersionUseCase,
  DescartarVersionUseCase,
  DevolverVersionUseCase,
  EnviarARevisionUseCase,
  MisLecturasPendientesUseCase,
  SubirVersionUseCase,
} from './versiones.use-cases.js';

const ADMIN2 = '33333333-3333-4333-8333-3333333333e3';
const RETIRADO = '44444444-4444-4444-8444-4444444444f4';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const TODOS = [
  'documentos.ver',
  'documentos.redactar',
  'documentos.aprobar',
  'documentos.gestionar',
  'documentos.leer',
  'controles.ver',
  'controles.gestionar',
] as const;

const montar = (opciones: { dosAdmins?: boolean } = {}) => {
  const dosAdmins = opciones.dosAdmins ?? true;
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  estado.conceder(ADMIN, A, ...TODOS);
  estado.conceder(ADMIN2, A, ...TODOS);
  estado.conceder(COLAB, A, 'documentos.ver', 'documentos.redactar', 'documentos.leer');
  estado.conceder(ADMIN_B, B, ...TODOS);
  estado.documentosEstado.personas.set(A, [
    { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
    ...(dosAdmins ? [{ id: ADMIN2, nombre: 'Beto Admin', rol: 'administrador_sig', activa: true }] : []),
    { id: COLAB, nombre: 'Carla Colaboradora', rol: 'colaborador', activa: true },
    { id: RETIRADO, nombre: 'Dario Retirado', rol: null, activa: false },
  ]);
  estado.documentosEstado.personas.set(B, [{ id: ADMIN_B, nombre: 'Admin B', rol: 'administrador_sig', activa: true }]);
  const almacen = new AlmacenFalso();
  let t = 0;
  let n = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 18, 15, 0, t++)); // 10:00 en Ecuador, hoy = 2026-11-18
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  return {
    estado,
    almacen,
    crearControl: new CrearControlUseCase(u, aut, reloj, nuevoId),
    crear: new CrearDocumentoUseCase(u, aut, reloj, nuevoId),
    cambiar: new CambiarDocumentoUseCase(u, aut, reloj),
    retirar: new RetirarDocumentoUseCase(u, aut, reloj),
    revisar: new RevisarDocumentoUseCase(u, aut, reloj),
    listar: new ListarDocumentosUseCase(u, aut, cat, reloj),
    obtener: new ObtenerDocumentoUseCase(u, aut, reloj),
    distribuir: new CambiarDistribucionUseCase(u, aut),
    vincular: new VincularDocumentoUseCase(u, aut, cat),
    desvincular: new DesvincularDocumentoUseCase(u, aut),
    cobertura: new ListarCoberturaDocumentalUseCase(u, aut, cat),
    guardarRetencion: new GuardarRetencionUseCase(u, aut, reloj),
    listarRetencion: new ListarRetencionUseCase(u, aut),
    directorio: new ListarDirectorioUseCase(u, aut),
    subir: new SubirVersionUseCase(u, aut, almacen, reloj, nuevoId),
    enviar: new EnviarARevisionUseCase(u, aut, reloj),
    devolver: new DevolverVersionUseCase(u, aut, reloj),
    aprobar: new AprobarVersionUseCase(u, aut, reloj),
    descartar: new DescartarVersionUseCase(u, aut, reloj),
    descargar: new DescargarVersionUseCase(u, aut, almacen),
    confirmar: new ConfirmarLecturaUseCase(u, aut, reloj),
    pendientes: new MisLecturasPendientesUseCase(u, aut),
  };
};
type Montaje = ReturnType<typeof montar>;
const yo = { empresaId: A, usuarioId: ADMIN };
const colab = { empresaId: A, usuarioId: COLAB };
const nuevo = { tipo: 'politica', titulo: 'TITULO-PRIVADO Política de acceso', clasificacion: 'interna', responsableId: ADMIN };

const conDocumento = async (m: Montaje = montar(), extra: Record<string, unknown> = {}) => {
  const d = await m.crear.ejecutar({ ...yo, ...nuevo, ...extra });
  m.estado.eventos = [];
  return { m, d };
};
const subida = (m: Montaje, documentoId: string, quien = colab, nota: unknown = 'NOTA-PRIVADA versión inicial') =>
  m.subir.ejecutar({ ...quien, documentoId, nota, nombreOriginal: 'politica.pdf', flujo: enTrozos(pdf()) });
/** Sube, envía a ADMIN2 y aprueba con ADMIN2: la versión queda vigente. */
const vigente = async (m: Montaje, documentoId: string, extra: Record<string, unknown> = {}) => {
  const v = await subida(m, documentoId);
  await m.enviar.ejecutar({ ...colab, id: v.id, aprobadorId: ADMIN2 });
  return m.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id, ...extra });
};

describe('crear un documento', () => {
  it('lo crea con código por tipo, sin versión vigente, y la bitácora no lleva texto', async () => {
    const m = montar();
    const d = await m.crear.ejecutar({ ...colab, ...nuevo });
    expect(d).toMatchObject({ codigo: 'POL-001', estado: 'activo', sinVigente: true, vigente: null, revision: null, version: 1 });
    expect((await m.crear.ejecutar({ ...yo, ...nuevo, tipo: 'procedimiento' })).codigo).toBe('PRO-001');
    expect((await m.crear.ejecutar({ ...yo, ...nuevo })).codigo).toBe('POL-002');
    expect(m.estado.eventos[0]).toMatchObject({ accion: 'documento.creado', objeto: 'documento:POL-001', resultado: 'ok' });
    expect(JSON.stringify(m.estado.eventos)).not.toMatch(/TITULO-PRIVADO|Ana/);
  });
  it('un documento externo lleva emisor y edición; los demás no', async () => {
    const m = montar();
    expect(await m.crear.ejecutar({ ...yo, ...nuevo, tipo: 'externo', emisor: 'Un organismo', edicionFuente: '2024' })).toMatchObject({
      codigo: 'EXT-001',
      emisor: 'Un organismo',
      edicionFuente: '2024',
    });
    await expect(m.crear.ejecutar({ ...yo, ...nuevo, emisor: 'Un organismo' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
  it('el responsable debe ser una persona activa de la empresa', async () => {
    const m = montar();
    for (const responsableId of [RETIRADO, ADMIN_B, 'no-es-uuid', undefined])
      await expect(m.crear.ejecutar({ ...yo, ...nuevo, responsableId })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
  it('responde 403 sin permiso (antes de validar) y no crea nada', async () => {
    const m = montar();
    await expect(m.crear.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, tipo: 'x' })).rejects.toBeInstanceOf(SinPermisoError);
    expect(m.estado.documentosEstado.documentos.size).toBe(0);
  });
  it('si falla la bitácora, no queda el documento', async () => {
    const m = montar();
    m.estado.fallarBitacora = true;
    await expect(m.crear.ejecutar({ ...yo, ...nuevo })).rejects.toThrow('bitácora');
    expect(m.estado.documentosEstado.documentos.size).toBe(0);
  });
});

describe('cambiar y retirar', () => {
  it('lo cambia el responsable o quien gestiona; otra persona no', async () => {
    const { m, d } = await conDocumento(montar(), { responsableId: COLAB });
    expect(await m.cambiar.ejecutar({ ...colab, id: d.id, titulo: 'Nuevo título', versionEsperada: 1 })).toMatchObject({
      titulo: 'Nuevo título',
      version: 2,
    });
    const ajeno = montar();
    const a = await ajeno.crear.ejecutar({ ...yo, ...nuevo });
    await expect(ajeno.cambiar.ejecutar({ ...colab, id: a.id, titulo: 'x', versionEsperada: 1 })).rejects.toBeInstanceOf(SinPermisoError);
    expect(
      await ajeno.cambiar.ejecutar({ ...yo, id: a.id, clasificacion: 'restringida', responsableId: COLAB, versionEsperada: 1 }),
    ).toMatchObject({ clasificacion: 'restringida', responsableId: COLAB });
  });
  it('rechaza una versión vieja y un cambio de tipo', async () => {
    const { m, d } = await conDocumento();
    await expect(m.cambiar.ejecutar({ ...yo, id: d.id, titulo: 'a', versionEsperada: 5 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    await expect(m.cambiar.ejecutar({ ...yo, id: d.id, titulo: 'a', versionEsperada: 0 })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
  it('retirar deja el documento sin versión vigente y conserva su historia', async () => {
    const { m, d } = await conDocumento();
    const v = await vigente(m, d.id);
    m.estado.eventos = [];
    await m.retirar.ejecutar({ ...yo, id: d.id });
    const det = await m.obtener.ejecutar({ ...yo, id: d.id });
    expect(det).toMatchObject({ estado: 'retirado', vigente: null });
    expect(det.versiones.map((x) => [x.id, x.estado])).toEqual([[v.id, 'obsoleta']]);
    expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'documento.retirado', objeto: 'documento:POL-001' })]);
    await expect(m.retirar.ejecutar({ ...yo, id: d.id })).rejects.toBeInstanceOf(ConflictoError);
    await expect(m.retirar.ejecutar({ ...colab, id: d.id })).rejects.toBeInstanceOf(SinPermisoError);
  });
});

describe('versiones: del borrador a la versión vigente', () => {
  it('sube, envía y aprueba; queda UNA vigente con su próxima revisión y la bitácora sin texto', async () => {
    const { m, d } = await conDocumento();
    const borrador = await subida(m, d.id);
    expect(borrador).toMatchObject({ numero: 1, estado: 'borrador', vigente: false, autorId: COLAB });
    expect(m.estado.eventos[0]).toMatchObject({
      accion: 'version.creada',
      objeto: 'version:POL-001.v1',
      objetoVersion: borrador.archivo.sha256,
    });
    const enviada = await m.enviar.ejecutar({ ...colab, id: borrador.id, aprobadorId: ADMIN2 });
    expect(enviada).toMatchObject({ estado: 'en_revision', aprobadorId: ADMIN2 });
    const aprobada = await m.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: borrador.id });
    expect(aprobada).toMatchObject({ estado: 'aprobada', vigente: true, porSuAutor: false, aprobadaPor: ADMIN2 });
    const det = await m.obtener.ejecutar({ ...yo, id: d.id });
    expect(det).toMatchObject({ sinVigente: false, proximaRevision: '2027-11-18', revision: 'al_dia', vigente: { numero: 1 } });
    expect(m.estado.eventos.map((e) => e.accion)).toEqual(['version.creada', 'version.enviada', 'version.aprobada']);
    expect(JSON.stringify(m.estado.eventos)).not.toMatch(/NOTA-PRIVADA|politica\.pdf|Ana|Beto/);
  });
  it('aprobar otra versión deja la anterior obsoleta en el mismo acto: siempre una sola vigente', async () => {
    const { m, d } = await conDocumento();
    const v1 = await vigente(m, d.id);
    const v2 = await subida(m, d.id, colab, 'cambia el alcance');
    await m.enviar.ejecutar({ ...colab, id: v2.id, aprobadorId: ADMIN2 });
    await m.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v2.id });
    const det = await m.obtener.ejecutar({ ...yo, id: d.id });
    expect(det.versiones.map((v) => [v.numero, v.estado])).toEqual([
      [2, 'aprobada'],
      [1, 'obsoleta'],
    ]);
    expect(det.versiones.filter((v) => v.vigente)).toHaveLength(1);
    expect(v1.numero).toBe(1);
  });
  it('solo una versión abierta a la vez (borrador o en revisión)', async () => {
    const { m, d } = await conDocumento();
    await subida(m, d.id);
    await expect(subida(m, d.id)).rejects.toBeInstanceOf(ConflictoError);
  });
  it('un borrador se descarta y entonces se puede subir otro; el descarte queda registrado', async () => {
    const { m, d } = await conDocumento();
    const v = await subida(m, d.id);
    await m.descartar.ejecutar({ ...colab, id: v.id });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'version.descartada', objeto: 'version:POL-001.v1' });
    expect((await subida(m, d.id)).numero).toBe(2);
    await expect(m.descartar.ejecutar({ ...colab, id: v.id })).rejects.toBeInstanceOf(ConflictoError);
  });
  it('quien no es el autor ni gestiona no maneja el borrador ajeno', async () => {
    const { m, d } = await conDocumento();
    const v = await subida(m, d.id, yo);
    await expect(m.descartar.ejecutar({ ...colab, id: v.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.enviar.ejecutar({ ...colab, id: v.id, aprobadorId: ADMIN2 })).rejects.toBeInstanceOf(SinPermisoError);
  });
  it('decide permiso, datos y documento ANTES de leer un solo byte, y rechaza lo que no es un tipo permitido', async () => {
    const { m, d } = await conDocumento();
    const flujo = flujoProhibido(); // si se intentara leer, lanzaría un error genérico y estas pruebas fallarían
    await expect(m.subir.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, documentoId: d.id, nota: 'x', flujo })).rejects.toBeInstanceOf(
      SinPermisoError,
    );
    await expect(m.subir.ejecutar({ ...colab, documentoId: d.id, nota: '', flujo })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(
      m.subir.ejecutar({ ...colab, documentoId: '00000000-0000-4000-8000-000000000999', nota: 'x', flujo }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      m.subir.ejecutar({ ...colab, documentoId: d.id, nota: 'x', nombreOriginal: 'politica.pdf', flujo: enTrozos(ejecutable()) }),
    ).rejects.toBeInstanceOf(ArchivoRechazadoError);
    expect(m.estado.eventos.at(-1)).toMatchObject({
      accion: 'version.subida_rechazada',
      resultado: 'rechazado',
      motivo: 'tipo_no_permitido',
      objeto: 'documento:POL-001',
    });
    expect(m.almacen.temporales.size).toBe(0);
    expect(m.estado.documentosEstado.versiones.size).toBe(0);
  });
  it('no se sube a un documento retirado', async () => {
    const { m, d } = await conDocumento();
    await m.retirar.ejecutar({ ...yo, id: d.id });
    await expect(subida(m, d.id)).rejects.toBeInstanceOf(ConflictoError);
  });
});

describe('aprobar: separación de funciones', () => {
  it('solo el aprobador nombrado puede aprobar o devolver; el autor no se nombra a sí mismo con dos administradores', async () => {
    const { m, d } = await conDocumento();
    const v = await subida(m, d.id, yo);
    await expect(m.enviar.ejecutar({ ...yo, id: v.id, aprobadorId: ADMIN })).rejects.toBeInstanceOf(ParametroInvalidoError); // el autor es administrador y hay otro
    await expect(m.enviar.ejecutar({ ...yo, id: v.id, aprobadorId: COLAB })).rejects.toBeInstanceOf(ParametroInvalidoError); // sin permiso de aprobar
    await expect(m.enviar.ejecutar({ ...yo, id: v.id, aprobadorId: RETIRADO })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await m.enviar.ejecutar({ ...yo, id: v.id, aprobadorId: ADMIN2 });
    await expect(m.aprobar.ejecutar({ ...yo, id: v.id })).rejects.toBeInstanceOf(ConflictoError); // no es el aprobador
    await expect(m.devolver.ejecutar({ ...yo, id: v.id, motivo: 'incompleta' })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.aprobar.ejecutar({ ...colab, id: v.id })).rejects.toBeInstanceOf(SinPermisoError);
  });
  it('devolver deja un borrador con el motivo cerrado; se puede reenviar', async () => {
    const { m, d } = await conDocumento();
    const v = await subida(m, d.id);
    await m.enviar.ejecutar({ ...colab, id: v.id, aprobadorId: ADMIN2 });
    await expect(m.devolver.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id, motivo: 'no me gusta' })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
    const r = await m.devolver.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id, motivo: 'incompleta', nota: 'NOTA-DEVOLUCION' });
    expect(r).toMatchObject({ estado: 'borrador', devueltaMotivo: 'incompleta', devueltaNota: 'NOTA-DEVOLUCION', aprobadorId: null });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'version.devuelta', despues: { motivo: 'incompleta' } });
    expect(JSON.stringify(m.estado.eventos)).not.toContain('NOTA-DEVOLUCION');
    expect((await m.enviar.ejecutar({ ...colab, id: v.id, aprobadorId: ADMIN2 })).estado).toBe('en_revision');
  });
  it('con un solo administrador puede aprobar la suya, con motivo obligatorio y marcada; el motivo no va a la bitácora', async () => {
    const m = montar({ dosAdmins: false });
    const d = await m.crear.ejecutar({ ...yo, ...nuevo });
    const v = await subida(m, d.id, yo);
    await m.enviar.ejecutar({ ...yo, id: v.id, aprobadorId: ADMIN });
    await expect(m.aprobar.ejecutar({ ...yo, id: v.id })).rejects.toBeInstanceOf(ParametroInvalidoError);
    const a = await m.aprobar.ejecutar({ ...yo, id: v.id, motivoExcepcion: 'MOTIVO-UNICO soy el único administrador' });
    expect(a).toMatchObject({ estado: 'aprobada', porSuAutor: true, motivoExcepcion: 'MOTIVO-UNICO soy el único administrador' });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'version.aprobada', despues: { por_su_autor: true } });
    expect(JSON.stringify(m.estado.eventos)).not.toContain('MOTIVO-UNICO');
    expect((await m.obtener.ejecutar({ ...yo, id: d.id })).unicoAdministrador).toBe(true);
  });
  it('si falla la bitácora al aprobar, la anterior sigue vigente y nada cambia', async () => {
    const { m, d } = await conDocumento();
    await vigente(m, d.id);
    const v2 = await subida(m, d.id);
    await m.enviar.ejecutar({ ...colab, id: v2.id, aprobadorId: ADMIN2 });
    m.estado.fallarBitacora = true;
    await expect(m.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v2.id })).rejects.toThrow('bitácora');
    m.estado.fallarBitacora = false;
    expect((await m.obtener.ejecutar({ ...yo, id: d.id })).versiones.map((v) => [v.numero, v.estado])).toEqual([
      [2, 'en_revision'],
      [1, 'aprobada'],
    ]);
  });
  it('la fecha de revisión editable no puede estar en el pasado', async () => {
    const { m, d } = await conDocumento();
    const v = await subida(m, d.id);
    await m.enviar.ejecutar({ ...colab, id: v.id, aprobadorId: ADMIN2 });
    await expect(m.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id, proximaRevision: '2026-01-01' })).rejects.toBeInstanceOf(
      ParametroInvalidoError,
    );
    await m.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id, proximaRevision: '2027-03-01' });
    expect((await m.obtener.ejecutar({ ...yo, id: d.id })).proximaRevision).toBe('2027-03-01');
  });
});

describe('distribución y lectura confirmada', () => {
  it('«todas las personas de un rol» se resuelve al momento; solo cuentan las activas', async () => {
    const { m, d } = await conDocumento();
    expect(new Set(await m.distribuir.ejecutar({ ...yo, id: d.id, usuarioIds: [ADMIN], roles: ['colaborador'] }))).toEqual(
      new Set([ADMIN, COLAB]),
    );
    await expect(m.distribuir.ejecutar({ ...yo, id: d.id, usuarioIds: [RETIRADO] })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.distribuir.ejecutar({ ...yo, id: d.id, usuarioIds: [ADMIN_B] })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.distribuir.ejecutar({ ...yo, id: d.id, roles: ['Rol Malo'] })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.distribuir.ejecutar({ ...colab, id: d.id, usuarioIds: [] })).rejects.toBeInstanceOf(SinPermisoError);
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'documento.distribucion_cambiada', despues: { destinatarios: 2 } });
  });
  it('al aprobar la primera versión cada destinatario tiene una lectura pendiente; solo la propia persona la confirma, una vez', async () => {
    const { m, d } = await conDocumento();
    await m.distribuir.ejecutar({ ...yo, id: d.id, usuarioIds: [ADMIN, COLAB] });
    const v = await vigente(m, d.id);
    expect((await m.pendientes.ejecutar(colab)).map((p) => [p.codigo, p.numeroVersion])).toEqual([['POL-001', 1]]);
    expect((await m.listar.ejecutar({ ...colab })).documentos[0]).toMatchObject({
      lecturaPendiente: true,
      lecturas: { confirmadas: 0, total: 2 },
    });
    await m.confirmar.ejecutar({ ...colab, id: v.id });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'lectura.confirmada', objeto: 'version:POL-001.v1' });
    expect(await m.pendientes.ejecutar(colab)).toEqual([]);
    await expect(m.confirmar.ejecutar({ ...colab, id: v.id })).rejects.toBeInstanceOf(ConflictoError); // ya confirmada
    await expect(m.confirmar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id })).rejects.toBeInstanceOf(ConflictoError); // sin lectura pendiente (no es destinatario)
    expect((await m.obtener.ejecutar({ ...yo, id: d.id })).versiones[0]?.lecturas).toEqual({ confirmadas: 1, total: 2 });
  });
  it('la versión nueva reabre la lectura solo si el aprobador lo marca; la anterior se conserva', async () => {
    const { m, d } = await conDocumento();
    await m.distribuir.ejecutar({ ...yo, id: d.id, usuarioIds: [COLAB] });
    const v1 = await vigente(m, d.id);
    await m.confirmar.ejecutar({ ...colab, id: v1.id });
    const v2 = await vigente(m, d.id); // sin «requiere nueva lectura»
    expect(await m.pendientes.ejecutar(colab)).toEqual([]);
    const v3 = await vigente(m, d.id, { requiereLectura: true });
    expect((await m.pendientes.ejecutar(colab)).map((p) => p.numeroVersion)).toEqual([3]);
    await expect(m.confirmar.ejecutar({ ...colab, id: v2.id })).rejects.toBeInstanceOf(ConflictoError); // ya no es la vigente
    await m.confirmar.ejecutar({ ...colab, id: v3.id });
  });
  it('una persona que se fue deja de contar como pendiente, pero su confirmación previa se conserva', async () => {
    const { m, d } = await conDocumento();
    await m.distribuir.ejecutar({ ...yo, id: d.id, usuarioIds: [ADMIN, COLAB] });
    const v = await vigente(m, d.id);
    await m.confirmar.ejecutar({ ...colab, id: v.id });
    m.estado.documentosEstado.personas.set(
      A,
      (m.estado.documentosEstado.personas.get(A) ?? []).map((p) => (p.id === ADMIN ? { ...p, rol: null, activa: false } : p)),
    );
    expect((await m.obtener.ejecutar({ ...colab, id: d.id })).lecturas).toEqual({ confirmadas: 1, total: 1 });
  });
  it('quien no es destinatario o no tiene permiso de leer no confirma nada', async () => {
    const { m, d } = await conDocumento();
    const v = await vigente(m, d.id);
    await expect(m.confirmar.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, id: v.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.pendientes.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS })).rejects.toBeInstanceOf(SinPermisoError);
  });
});

describe('descargar una versión', () => {
  it('registra la descarga con la huella ANTES de entregar y rotula si no es la vigente', async () => {
    const { m, d } = await conDocumento();
    const v1 = await vigente(m, d.id);
    m.estado.eventos = [];
    const r = await m.descargar.ejecutar({ ...colab, id: v1.id });
    expect(r).toMatchObject({ vigente: true, tipo: 'application/pdf', nombre: expect.stringMatching(/\.pdf$/) });
    expect(m.estado.eventos).toEqual([
      expect.objectContaining({ accion: 'version.descargada', objeto: 'version:POL-001.v1', objetoVersion: v1.archivo.sha256 }),
    ]);
    await vigente(m, d.id);
    expect((await m.descargar.ejecutar({ ...colab, id: v1.id })).vigente).toBe(false); // obsoleta: se entrega con la leyenda «no vigente»
  });
  it('si no se puede registrar, no se entrega nada; una versión descartada no se descarga', async () => {
    const { m, d } = await conDocumento();
    const v = await subida(m, d.id);
    m.estado.fallarBitacora = true;
    await expect(m.descargar.ejecutar({ ...colab, id: v.id })).rejects.toThrow('bitácora');
    m.estado.fallarBitacora = false;
    await m.descartar.ejecutar({ ...colab, id: v.id });
    await expect(m.descargar.ejecutar({ ...colab, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.descargar.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, id: v.id })).rejects.toBeInstanceOf(SinPermisoError);
  });
});

describe('aislamiento entre empresas', () => {
  it('un documento o una versión de A responde como inexistente desde B, en todas las operaciones', async () => {
    const { m, d } = await conDocumento();
    const v = await vigente(m, d.id);
    const b = { empresaId: B, usuarioId: ADMIN_B };
    await expect(m.obtener.ejecutar({ ...b, id: d.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.descargar.ejecutar({ ...b, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.retirar.ejecutar({ ...b, id: d.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.aprobar.ejecutar({ ...b, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.confirmar.ejecutar({ ...b, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.distribuir.ejecutar({ ...b, id: d.id, usuarioIds: [] })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.cambiar.ejecutar({ ...b, id: d.id, titulo: 'x', versionEsperada: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.revisar.ejecutar({ ...b, id: d.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.enviar.ejecutar({ ...b, id: v.id, aprobadorId: ADMIN_B })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.devolver.ejecutar({ ...b, id: v.id, motivo: 'incompleta' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.descartar.ejecutar({ ...b, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.vincular.ejecutar({ ...b, id: d.id, libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: entradas.politicas.idEstable })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.desvincular.ejecutar({ ...b, id: d.id, controlId: '00000000-0000-4000-8000-000000000999' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(subida(m, d.id, b as typeof colab)).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect((await m.listar.ejecutar(b)).documentos).toEqual([]);
    expect((await m.crear.ejecutar({ ...b, ...nuevo, responsableId: ADMIN_B })).codigo).toBe('POL-001'); // su propia secuencia
  });
});

describe('revisión periódica', () => {
  it('la registra el responsable o quien gestiona y reinicia la fecha sin crear versión', async () => {
    const { m, d } = await conDocumento(montar(), { responsableId: COLAB });
    await expect(m.revisar.ejecutar({ ...colab, id: d.id })).rejects.toBeInstanceOf(ConflictoError); // sin versión vigente
    await vigente(m, d.id);
    m.estado.eventos = [];
    const r = await m.revisar.ejecutar({ ...colab, id: d.id, motivo: 'auditoria', proximaRevision: '2027-02-01' });
    expect(r).toMatchObject({ proximaRevision: '2027-02-01', ultimaRevisionEn: expect.any(String) });
    expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'documento.revisado', despues: { motivo: 'auditoria' } })]);
    expect((await m.obtener.ejecutar({ ...yo, id: d.id })).versiones).toHaveLength(1);
    await expect(m.revisar.ejecutar({ ...colab, id: d.id, motivo: 'porque sí' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    const ajeno = await conDocumento(montar());
    await vigente(ajeno.m, ajeno.d.id);
    await expect(ajeno.m.revisar.ejecutar({ ...colab, id: ajeno.d.id })).rejects.toBeInstanceOf(SinPermisoError);
  });
  it('la lista marca vencidos, por vencer y sin versión vigente', async () => {
    const m = montar();
    const sin = await m.crear.ejecutar({ ...yo, ...nuevo, titulo: 'Sin versión' });
    const vence = await m.crear.ejecutar({ ...yo, ...nuevo, tipo: 'procedimiento', titulo: 'Vence' });
    await vigente(m, vence.id, { proximaRevision: '2026-12-01' });
    const todos = (await m.listar.ejecutar(yo)).documentos;
    expect(todos.find((x) => x.id === sin.id)).toMatchObject({ sinVigente: true, revision: null });
    expect(todos.find((x) => x.id === vence.id)).toMatchObject({ sinVigente: false, revision: 'por_vencer' });
    expect((await m.listar.ejecutar({ ...yo, sinVigente: true })).documentos.map((x) => x.id)).toEqual([sin.id]);
    expect((await m.listar.ejecutar({ ...yo, tipo: 'procedimiento' })).documentos.map((x) => x.id)).toEqual([vence.id]);
    expect((await m.listar.ejecutar({ ...yo, revisionVencida: true })).documentos).toEqual([]);
    await expect(m.listar.ejecutar({ ...yo, tipo: 'carta' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});

describe('vínculos con controles y requisitos, y cobertura documental', () => {
  it('liga a un control de la empresa y a una entrada ADOPTADA; una no adoptada o de otra empresa responde 404', async () => {
    const { m, d } = await conDocumento();
    const control = await m.crearControl.ejecutar({ ...yo, codigo: 'C-001', nombre: 'Control' });
    expect(await m.vincular.ejecutar({ ...yo, id: d.id, controlId: control.id })).toEqual({ creado: true });
    expect(await m.vincular.ejecutar({ ...yo, id: d.id, controlId: control.id })).toEqual({ creado: false });
    expect(
      await m.vincular.ejecutar({
        ...yo,
        id: d.id,
        libreriaCodigo: entradas.politicas.libreriaCodigo,
        idEstable: entradas.politicas.idEstable,
      }),
    ).toEqual({ creado: true });
    await expect(m.vincular.ejecutar({ ...yo, id: d.id, libreriaCodigo: 'otra-libreria', idEstable: 'x-1' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.vincular.ejecutar({ ...yo, id: d.id, controlId: '00000000-0000-4000-8000-000000000999' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(m.vincular.ejecutar({ ...colab, id: d.id, controlId: control.id })).rejects.toBeInstanceOf(SinPermisoError);
    expect(m.estado.eventos.filter((e) => e.accion === 'documento.vinculado')).toHaveLength(2);
    await m.desvincular.ejecutar({ ...yo, id: d.id, controlId: control.id });
    await expect(m.desvincular.ejecutar({ ...yo, id: d.id, controlId: control.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
  it('la cobertura cuenta solo documentos con versión vigente', async () => {
    const { m, d } = await conDocumento();
    await m.vincular.ejecutar({
      ...yo,
      id: d.id,
      libreriaCodigo: entradas.politicas.libreriaCodigo,
      idEstable: entradas.politicas.idEstable,
    });
    let c = await m.cobertura.ejecutar(yo);
    expect(c).toMatchObject({ total: 3, cubiertas: 0 });
    await vigente(m, d.id);
    c = await m.cobertura.ejecutar(yo);
    expect(c).toMatchObject({ total: 3, cubiertas: 1 });
    expect(c.entradas.find((x) => x.idEstable === 'a27-5-1')).toMatchObject({
      cubierta: true,
      documentos: [{ id: d.id, codigo: 'POL-001' }],
    });
    expect((await m.cobertura.ejecutar({ ...yo, soloSinDocumento: true })).entradas).toHaveLength(2);
    expect((await m.cobertura.ejecutar({ ...yo, norma: 'ISO 9001' })).total).toBe(1);
    expect((await m.listar.ejecutar({ ...yo, norma: 'ISO/IEC 27001' })).documentos.map((x) => x.id)).toEqual([d.id]);
    await m.retirar.ejecutar({ ...yo, id: d.id });
    expect((await m.cobertura.ejecutar(yo)).cubiertas).toBe(0);
  });
});

describe('retención por tipo', () => {
  it('se fija con años y motivo, se cambia con la versión esperada y marca las versiones obsoletas elegibles; no se borra nada', async () => {
    const { m, d } = await conDocumento();
    expect(await m.listarRetencion.ejecutar(yo)).toEqual([]);
    const r = await m.guardarRetencion.ejecutar({ ...yo, tipo: 'politica', anios: 1, motivo: 'MOTIVO-RETENCION política de la empresa' });
    expect(r).toEqual({ tipo: 'politica', anios: 1, motivo: 'MOTIVO-RETENCION política de la empresa', version: 1 });
    await expect(m.guardarRetencion.ejecutar({ ...yo, tipo: 'politica', anios: 2, motivo: 'x' })).rejects.toBeInstanceOf(
      ConflictoDeVersionError,
    );
    expect((await m.guardarRetencion.ejecutar({ ...yo, tipo: 'politica', anios: 2, motivo: 'otro', versionEsperada: 1 })).version).toBe(2);
    await m.guardarRetencion.ejecutar({ ...yo, tipo: 'politica', anios: 1, motivo: 'un año', versionEsperada: 2 });
    expect(m.estado.eventos.at(-1)).toMatchObject({ accion: 'retencion.cambiada', objeto: 'retencion:politica', despues: { anios: 1 } });
    expect(JSON.stringify(m.estado.eventos)).not.toContain('MOTIVO-RETENCION');
    await vigente(m, d.id);
    await vigente(m, d.id); // la v1 queda obsoleta hoy
    expect((await m.obtener.ejecutar({ ...yo, id: d.id })).versiones.find((v) => v.numero === 1)).toMatchObject({
      estado: 'obsoleta',
      elegibleParaDisposicion: false,
    });
    // pasado el período, solo se MARCA como elegible: el archivo y la fila siguen ahí
    const fila = [...m.estado.documentosEstado.versiones.values()].find((v) => v.numero === 1);
    if (fila) m.estado.documentosEstado.versiones.set(fila.id, { ...fila, obsoletaEn: new Date('2024-01-01T00:00:00Z') });
    expect((await m.obtener.ejecutar({ ...yo, id: d.id })).versiones.find((v) => v.numero === 1)).toMatchObject({
      elegibleParaDisposicion: true,
    });
    expect(m.almacen.archivos.size).toBe(2);
    await expect(m.guardarRetencion.ejecutar({ ...colab, tipo: 'politica', anios: 1, motivo: 'x' })).rejects.toBeInstanceOf(
      SinPermisoError,
    );
    await expect(
      m.guardarRetencion.ejecutar({ ...yo, tipo: 'politica', anios: 0, motivo: 'x', versionEsperada: 3 }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});

describe('directorio de personas', () => {
  it('lista solo identificador, nombre y si está activa; sin correo ni rol, y solo de la empresa de la sesión', async () => {
    const m = montar();
    const r = await m.directorio.ejecutar(colab);
    expect(r.map((p) => p.nombre)).toEqual(['Ana Admin', 'Beto Admin', 'Carla Colaboradora', 'Dario Retirado']);
    expect(Object.keys(r[0] ?? {}).sort()).toEqual(['activa', 'id', 'nombre', 'puedeAprobar']);
    expect(r.filter((p) => p.puedeAprobar).map((p) => p.nombre)).toEqual(['Ana Admin', 'Beto Admin']);
    expect(r.find((p) => p.id === RETIRADO)?.activa).toBe(false);
    expect((await m.directorio.ejecutar({ empresaId: B, usuarioId: ADMIN_B })).map((p) => p.id)).toEqual([ADMIN_B]);
    await expect(m.directorio.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS })).rejects.toBeInstanceOf(SinPermisoError);
  });
});
