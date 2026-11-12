import { describe, expect, it } from 'vitest';
import { Evidencia } from '../domain/evidencia.js';
import { AgregarMapeoUseCase, CrearControlUseCase, RetirarControlUseCase } from './controles.use-cases.js';
import { ArchivoRechazadoError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError, SinPermisoError } from './errores.js';
import {
  DescargarEvidenciaUseCase, EliminarEvidenciaUseCase, ListarCoberturaUseCase, ListarEvidenciasUseCase, ReemplazarEvidenciaUseCase, SubirEvidenciaUseCase,
} from './evidencias.use-cases.js';
import { A, ADMIN, B, COLAB, EstadoFalso, AlmacenFalso, crearAutorizacionFalsa, crearCatalogoFalso, crearUnidadFalsa, entradas, docx, docxConMacros, ejecutable, enTrozos, flujoProhibido, megabytes, pdf, pdfTruncado, png, sha256Hex as sha, texto } from './prueba/index.js';

const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const POL = { libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: entradas.politicas.idEstable };

const montar = () => {
  const estado = new EstadoFalso();
  estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
  estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
  estado.conceder(ADMIN, A, 'controles.ver', 'controles.gestionar', 'evidencias.ver', 'evidencias.registrar', 'evidencias.eliminar');
  estado.conceder(COLAB, A, 'controles.ver', 'evidencias.ver', 'evidencias.registrar');
  estado.conceder(ADMIN_B, B, 'controles.ver', 'controles.gestionar', 'evidencias.ver', 'evidencias.registrar', 'evidencias.eliminar');
  const almacen = new AlmacenFalso();
  let ahora = new Date('2026-11-11T15:00:00Z'); // 10:00 en Ecuador: hoy = 2026-11-11
  let n = 0;
  const reloj = () => ahora;
  const nuevoId = () => `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const u = crearUnidadFalsa(estado);
  const aut = crearAutorizacionFalsa(estado);
  const cat = crearCatalogoFalso(estado);
  return {
    estado,
    almacen,
    ponerAhora: (d: Date) => { ahora = d; },
    crearControl: new CrearControlUseCase(u, aut, reloj, nuevoId),
    retirarControl: new RetirarControlUseCase(u, aut, reloj),
    agregarMapeo: new AgregarMapeoUseCase(u, aut, cat, reloj),
    subir: new SubirEvidenciaUseCase(u, aut, almacen, reloj, nuevoId),
    reemplazar: new ReemplazarEvidenciaUseCase(u, aut, almacen, reloj, nuevoId),
    eliminar: new EliminarEvidenciaUseCase(u, aut, reloj),
    listar: new ListarEvidenciasUseCase(u, aut, reloj),
    descargar: new DescargarEvidenciaUseCase(u, aut, almacen),
    cobertura: new ListarCoberturaUseCase(u, aut, cat, reloj),
  };
};
type Montaje = ReturnType<typeof montar>;
const yo = { empresaId: A, usuarioId: ADMIN };
const datos = { tipo: 'documento', titulo: 'TITULO-PRIVADO política de contraseñas', fechaHecho: '2026-11-01', nombreOriginal: 'politica.pdf' };

/** Un control vigente (C-001) de A, listo para recibir evidencias. */
const conControl = async (m: Montaje = montar()) => {
  const c = await m.crearControl.ejecutar({ ...yo, codigo: 'C-001', nombre: 'Política de contraseñas' });
  m.estado.eventos = [];
  return { m, control: c };
};
const subida = (m: Montaje, controlId: string, extra: Record<string, unknown> = {}, bytes: Uint8Array = pdf()) => m.subir.ejecutar({ ...yo, controlId, ...datos, ...extra, flujo: enTrozos(bytes) });

describe('subir una evidencia', () => {
  it('guarda el archivo, la fila y el hecho con la huella, en ese orden, y no deja temporales', async () => {
    const { m, control } = await conControl();
    const bytes = pdf();
    const e = await subida(m, control.id, {}, bytes);
    expect(e).toMatchObject({ controlId: control.id, tipo: 'documento', estado: 'activa', vigente: true, vencida: false, reemplazaId: null, fechaHecho: '2026-11-01' });
    expect(e.archivo).toEqual({ nombre: 'politica.pdf', tipo: 'application/pdf', bytes: bytes.length, sha256: sha(bytes) });
    expect(m.almacen.temporales.size).toBe(0);
    expect([...m.almacen.archivos.keys()]).toHaveLength(1);
    expect(m.estado.evidencias.size).toBe(1);
    expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'evidencia.creada', objeto: `evidencia:${e.id}`, objetoVersion: sha(bytes), resultado: 'ok' })]);
  });

  it('la bitácora no recibe ni el título ni el nombre del archivo', async () => {
    const { m, control } = await conControl();
    await subida(m, control.id, { nombreOriginal: 'NOMBRE-PRIVADO.pdf' });
    expect(JSON.stringify(m.estado.eventos)).not.toMatch(/PRIVADO|política|contraseñas/);
  });

  it('el tipo se decide por el contenido y el nombre se normaliza a una etiqueta segura', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id, { nombreOriginal: '../../etc/informe.pdf', tipo: 'registro' }, texto('Registro de la revisión.\n'));
    expect(e.archivo).toMatchObject({ nombre: 'informe.pdf', tipo: 'text/plain' }); // dice .pdf, es texto
    expect(e.tipo).toBe('registro');
  });

  it('acepta PNG y DOCX', async () => {
    const { m, control } = await conControl();
    expect((await subida(m, control.id, { nombreOriginal: 'captura.png' }, png())).archivo.tipo).toBe('image/png');
    expect((await subida(m, control.id, { nombreOriginal: 'acta.docx' }, docx())).archivo.tipo).toContain('wordprocessingml');
  });

  it('con vigencia: está vigente hasta ese día y vencida después, según la fecha de Ecuador', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id, { vigenteHasta: '2026-11-11' });
    expect(e).toMatchObject({ vigente: true, vencida: false, vigenteHasta: '2026-11-11' });
    m.ponerAhora(new Date('2026-11-12T04:00:00Z')); // 23:00 del 11 en Ecuador: sigue vigente
    expect((await m.listar.ejecutar({ ...yo, controlId: control.id }))[0]).toMatchObject({ vigente: true });
    m.ponerAhora(new Date('2026-11-12T05:00:00Z')); // medianoche del 12 en Ecuador
    expect((await m.listar.ejecutar({ ...yo, controlId: control.id }))[0]).toMatchObject({ vigente: false, vencida: true });
  });

  describe('se decide ANTES de recibir un solo byte', () => {
    const sinLeer = (m: Montaje) => {
      expect(m.almacen.fragmentosLeidos).toBe(0);
      expect(m.almacen.temporales.size).toBe(0);
      expect(m.estado.evidencias.size).toBe(0);
    };

    it('sin permiso: 403, aunque los datos también estén mal', async () => {
      const { m, control } = await conControl();
      await expect(m.subir.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, controlId: control.id, ...datos, flujo: flujoProhibido() })).rejects.toBeInstanceOf(SinPermisoError);
      await expect(m.subir.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, controlId: 'x', titulo: 7, flujo: flujoProhibido() })).rejects.toBeInstanceOf(SinPermisoError);
      sinLeer(m);
    });

    it.each([
      ['un control que no es UUID', { controlId: 'x' }],
      ['un tipo de evidencia desconocido', { tipo: 'otro' }],
      ['un título vacío', { titulo: '  ' }],
      ['una fecha del hecho inexistente', { fechaHecho: '2026-02-31' }],
      ['una fecha del hecho en el futuro (para Ecuador)', { fechaHecho: '2026-11-12' }],
      ['una vigencia anterior al hecho', { vigenteHasta: '2026-10-01' }],
      ['una vigencia con otro formato', { vigenteHasta: 'mañana' }],
    ])('%s: 400', async (_n, cambio) => {
      const { m, control } = await conControl();
      await expect(m.subir.ejecutar({ ...yo, controlId: control.id, ...datos, ...cambio, flujo: flujoProhibido() })).rejects.toBeInstanceOf(ParametroInvalidoError);
      sinLeer(m);
    });

    it('un control inexistente o de otra empresa: 404 indistinguible', async () => {
      const { m, control } = await conControl();
      await expect(m.subir.ejecutar({ ...yo, controlId: 'dddddddd-0000-4000-8000-000000000000', ...datos, flujo: flujoProhibido() })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
      await expect(m.subir.ejecutar({ empresaId: B, usuarioId: ADMIN_B, controlId: control.id, ...datos, flujo: flujoProhibido() })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
      sinLeer(m);
    });

    it('un control retirado: 409', async () => {
      const { m, control } = await conControl();
      await m.retirarControl.ejecutar({ ...yo, id: control.id, versionEsperada: 1 });
      await expect(m.subir.ejecutar({ ...yo, controlId: control.id, ...datos, flujo: flujoProhibido() })).rejects.toMatchObject({ motivo: 'retirado' });
      sinLeer(m);
    });
  });

  describe('archivos que no se aceptan: se rechazan, se registran y no queda nada', () => {
    const rechazado = async (bytes: Uint8Array, nombre: string, motivo: string, huella = true) => {
      const { m, control } = await conControl();
      await expect(subida(m, control.id, { nombreOriginal: nombre }, bytes)).rejects.toMatchObject({ motivo });
      expect(m.estado.evidencias.size).toBe(0);
      expect(m.almacen.temporales.size).toBe(0);
      expect(m.almacen.archivos.size).toBe(0);
      expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'evidencia.subida_rechazada', resultado: 'rechazado', motivo, objeto: 'control:C-001', ...(huella ? { objetoVersion: sha(bytes) } : {}) })]);
      expect(JSON.stringify(m.estado.eventos)).not.toContain(nombre);
    };

    it('un ejecutable con nombre .pdf', () => rechazado(ejecutable(), 'factura.pdf', 'tipo_no_permitido'));
    it('un HTML con nombre .txt', () => rechazado(texto('<html><script>alert(1)</script></html>'), 'nota.txt', 'tipo_no_permitido'));
    it('un SVG con nombre .png', () => rechazado(texto('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo.png', 'tipo_no_permitido'));
    it('un documento con macros', () => rechazado(docxConMacros(), 'acta.docx', 'tipo_no_permitido'));
    it('un PDF truncado', () => rechazado(pdfTruncado(), 'informe.pdf', 'firma_invalida'));
    it('un archivo vacío', () => rechazado(new Uint8Array(0), 'vacio.pdf', 'firma_invalida'));

    it('uno de más de 25 MB: se corta, se registra (sin huella) y se lanza el error', async () => {
      const { m, control } = await conControl();
      await expect(m.subir.ejecutar({ ...yo, controlId: control.id, ...datos, flujo: megabytes(26) })).rejects.toMatchObject({ motivo: 'tamano_excedido' });
      expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'evidencia.subida_rechazada', motivo: 'tamano_excedido', objeto: 'control:C-001' })]);
      expect(m.estado.eventos[0]).not.toHaveProperty('objetoVersion');
      expect(m.almacen.temporales.size + m.almacen.archivos.size + m.estado.evidencias.size).toBe(0);
    });

    it('un archivo de exactamente 25 MB sí se acepta si es de un tipo permitido', async () => {
      const { m, control } = await conControl();
      const exacto = new Uint8Array(26_214_400).fill(0x41);
      exacto.set(texto('%PDF-1.7\n'));
      expect((await subida(m, control.id, {}, exacto)).archivo.bytes).toBe(26_214_400);
    });

    it('el error es ArchivoRechazadoError', async () => {
      const { m, control } = await conControl();
      await expect(subida(m, control.id, {}, ejecutable())).rejects.toBeInstanceOf(ArchivoRechazadoError);
    });

    it('si no se puede registrar el rechazo, falla (y tampoco queda el temporal)', async () => {
      const { m, control } = await conControl();
      m.estado.fallarBitacora = true;
      await expect(subida(m, control.id, {}, ejecutable())).rejects.toThrow('bitácora no disponible');
      expect(m.almacen.temporales.size).toBe(0);
    });
  });

  describe('si algo falla a mitad de camino, no queda nada a medias', () => {
    it('si falla la bitácora: ni fila, ni archivo, ni temporal', async () => {
      const { m, control } = await conControl();
      m.estado.fallarBitacora = true;
      await expect(subida(m, control.id)).rejects.toThrow('bitácora no disponible');
      expect(m.estado.evidencias.size + m.almacen.archivos.size + m.almacen.temporales.size).toBe(0);
    });

    it('si falla el renombrado del archivo: la fila se deshace y se descarta el temporal', async () => {
      const { m, control } = await conControl();
      m.almacen.fallar.confirmar = true;
      await expect(subida(m, control.id)).rejects.toThrow('no pudo confirmar');
      expect(m.estado.evidencias.size + m.almacen.archivos.size + m.almacen.temporales.size).toBe(0);
      expect(m.estado.eventos).toEqual([]); // el hecho de la creación también se deshizo
    });
  });

  it('tope de 100 evidencias activas por control: la 101 es un conflicto y no deja temporal', async () => {
    const { m, control } = await conControl();
    for (let i = 0; i < 100; i++) {
      const id = `ffffffff-0000-4000-8000-${String(i).padStart(12, '0')}`;
      m.estado.evidencias.set(`${A}|${id}`, { creadaEn: new Date(), evidencia: Evidencia.crear({ id, empresaId: A, controlId: control.id, tipo: 'documento', titulo: 'x', fechaHecho: '2026-11-01', archivo: { id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`, nombre: 'x.pdf', tipo: 'application/pdf', bytes: 10, sha256: '0'.repeat(64) } }) });
    }
    await expect(subida(m, control.id)).rejects.toMatchObject({ motivo: 'tope_de_evidencias' });
    expect(m.almacen.temporales.size).toBe(0);
    expect(m.estado.evidencias.size).toBe(100);
  });

  it('el colaborador puede subir; B no ve lo de A', async () => {
    const { m, control } = await conControl();
    await expect(m.subir.ejecutar({ empresaId: A, usuarioId: COLAB, controlId: control.id, ...datos, flujo: enTrozos(pdf()) })).resolves.toBeDefined();
    expect(await m.listar.ejecutar({ empresaId: A, usuarioId: COLAB, controlId: control.id })).toHaveLength(1);
    await expect(m.listar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, controlId: control.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('reemplazar una evidencia', () => {
  const conEvidencia = async () => {
    const x = await conControl();
    const e = await subida(x.m, x.control.id, { vigenteHasta: '2027-01-01' });
    x.m.estado.eventos = [];
    return { ...x, e };
  };
  const nuevo = (m: Montaje, id: string, extra: Record<string, unknown> = {}, bytes: Uint8Array = png()) => m.reemplazar.ejecutar({ ...yo, id, fechaHecho: '2026-11-10', nombreOriginal: 'nueva.png', ...extra, flujo: enTrozos(bytes) });

  it('la anterior queda reemplazada, la nueva activa apunta a ella y el archivo viejo se conserva', async () => {
    const { m, e } = await conEvidencia();
    const bytes = png();
    const n = await nuevo(m, e.id, {}, bytes);
    expect(n).toMatchObject({ estado: 'activa', reemplazaId: e.id, titulo: e.titulo, tipo: e.tipo, fechaHecho: '2026-11-10', vigenteHasta: null });
    expect(n.archivo).toMatchObject({ tipo: 'image/png', sha256: sha(bytes) });
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('reemplazada');
    expect(m.almacen.archivos.size).toBe(2); // nada se borra
    expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'evidencia.reemplazada', objeto: `evidencia:${n.id}`, objetoVersion: sha(bytes) })]);
  });

  it('puede cambiar el título, el tipo y la vigencia', async () => {
    const { m, e } = await conEvidencia();
    const n = await nuevo(m, e.id, { titulo: 'Otro título', tipo: 'registro', vigenteHasta: '2028-01-01' });
    expect(n).toMatchObject({ titulo: 'Otro título', tipo: 'registro', vigenteHasta: '2028-01-01' });
  });

  it('solo se reemplaza una evidencia activa: reemplazada o eliminada es 409', async () => {
    const { m, e } = await conEvidencia();
    await nuevo(m, e.id);
    await expect(m.reemplazar.ejecutar({ ...yo, id: e.id, fechaHecho: '2026-11-10', flujo: flujoProhibido() })).rejects.toMatchObject({ motivo: 'no_activa' });
    const { m: m2, e: e2 } = await conEvidencia();
    await m2.eliminar.ejecutar({ ...yo, id: e2.id });
    await expect(m2.reemplazar.ejecutar({ ...yo, id: e2.id, fechaHecho: '2026-11-10', flujo: flujoProhibido() })).rejects.toBeInstanceOf(ConflictoError);
  });

  it('se decide antes de recibir bytes: permiso, forma y existencia', async () => {
    const { m, e, control } = await conEvidencia();
    await expect(m.reemplazar.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, id: e.id, fechaHecho: '2026-11-10', flujo: flujoProhibido() })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.reemplazar.ejecutar({ ...yo, id: 'x', fechaHecho: '2026-11-10', flujo: flujoProhibido() })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.reemplazar.ejecutar({ ...yo, id: e.id, flujo: flujoProhibido() })).rejects.toBeInstanceOf(ParametroInvalidoError); // la fecha del hecho es obligatoria
    await expect(m.reemplazar.ejecutar({ ...yo, id: e.id, fechaHecho: '2099-01-01', flujo: flujoProhibido() })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.reemplazar.ejecutar({ ...yo, id: 'dddddddd-0000-4000-8000-000000000000', fechaHecho: '2026-11-10', flujo: flujoProhibido() })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.reemplazar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: e.id, fechaHecho: '2026-11-10', flujo: flujoProhibido() })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await m.retirarControl.ejecutar({ ...yo, id: control.id, versionEsperada: 1 });
    await expect(m.reemplazar.ejecutar({ ...yo, id: e.id, fechaHecho: '2026-11-10', flujo: flujoProhibido() })).rejects.toMatchObject({ motivo: 'retirado' });
    expect(m.almacen.fragmentosLeidos).toBe(1); // solo los de la subida original (un trozo)
  });

  it('si el archivo nuevo se rechaza, la original sigue activa e intacta', async () => {
    const { m, e } = await conEvidencia();
    await expect(nuevo(m, e.id, {}, ejecutable())).rejects.toBeInstanceOf(ArchivoRechazadoError);
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('activa');
    expect(m.estado.evidencias.size).toBe(1);
    expect(m.almacen.temporales.size).toBe(0);
    expect(m.estado.eventos.map((x) => x.accion)).toEqual(['evidencia.subida_rechazada']);
  });

  it('si otra persona la cambió en medio (carrera): conflicto, sin fila nueva ni archivo huérfano', async () => {
    const { m, e } = await conEvidencia();
    m.estado.carrera = true;
    await expect(nuevo(m, e.id)).rejects.toMatchObject({ motivo: 'no_activa' });
    expect(m.estado.evidencias.size).toBe(1);
    expect(m.almacen.temporales.size).toBe(0);
    expect(m.almacen.archivos.size).toBe(1);
  });

  it('si falla la bitácora, todo se deshace: la original sigue activa', async () => {
    const { m, e } = await conEvidencia();
    m.estado.fallarBitacora = true;
    await expect(nuevo(m, e.id)).rejects.toThrow('bitácora no disponible');
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('activa');
    expect(m.estado.evidencias.size).toBe(1);
    expect(m.almacen.temporales.size).toBe(0);
  });
});

describe('eliminar una evidencia', () => {
  it('cambia su estado, deja el hecho con su huella y conserva el archivo', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id);
    m.estado.eventos = [];
    await m.eliminar.ejecutar({ ...yo, id: e.id });
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('eliminada');
    expect(m.almacen.archivos.size).toBe(1);
    expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'evidencia.eliminada', objeto: `evidencia:${e.id}`, objetoVersion: e.archivo.sha256 })]);
    expect(await m.listar.ejecutar({ ...yo, controlId: control.id })).toEqual([]);
    expect(await m.listar.ejecutar({ ...yo, controlId: control.id, incluirHistoricas: true })).toHaveLength(1);
  });

  it('solo el administrador: el colaborador recibe 403 aunque pueda subir', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id);
    await expect(m.eliminar.ejecutar({ empresaId: A, usuarioId: COLAB, id: e.id })).rejects.toBeInstanceOf(SinPermisoError);
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('activa');
  });

  it('eliminar dos veces o eliminar una reemplazada es 409; la de otra empresa o inexistente, 404; forma inválida, 400', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id);
    await m.eliminar.ejecutar({ ...yo, id: e.id });
    await expect(m.eliminar.ejecutar({ ...yo, id: e.id })).rejects.toMatchObject({ motivo: 'no_activa' });
    await expect(m.eliminar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: e.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.eliminar.ejecutar({ ...yo, id: 'dddddddd-0000-4000-8000-000000000000' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.eliminar.ejecutar({ ...yo, id: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });

  it('si falla la bitácora, no cambia nada', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id);
    m.estado.fallarBitacora = true;
    await expect(m.eliminar.ejecutar({ ...yo, id: e.id })).rejects.toThrow('bitácora no disponible');
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('activa');
  });
});

describe('listar las evidencias de un control', () => {
  it('de la más nueva a la más antigua, con el valor de vigencia al día', async () => {
    const { m, control } = await conControl();
    const a = await subida(m, control.id, { titulo: 'Primera' });
    m.ponerAhora(new Date('2026-11-11T16:00:00Z'));
    const b = await subida(m, control.id, { titulo: 'Segunda' });
    expect((await m.listar.ejecutar({ ...yo, controlId: control.id })).map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it('exige permiso, forma válida y que el control sea de la empresa', async () => {
    const { m, control } = await conControl();
    await expect(m.listar.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, controlId: control.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.listar.ejecutar({ ...yo, controlId: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.listar.ejecutar({ ...yo, controlId: control.id, incluirHistoricas: 'si' as never })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.listar.ejecutar({ ...yo, controlId: 'dddddddd-0000-4000-8000-000000000000' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });
});

describe('descargar una evidencia', () => {
  const leer = async (flujo: AsyncIterable<Uint8Array>) => {
    const partes: Uint8Array[] = [];
    for await (const p of flujo) partes.push(p);
    return Buffer.concat(partes);
  };

  it('entrega el archivo con la extensión del tipo detectado y deja el hecho con la huella', async () => {
    const { m, control } = await conControl();
    const bytes = texto('Registro de accesos.\n');
    const e = await subida(m, control.id, { nombreOriginal: 'informe.pdf' }, bytes); // dice .pdf, es texto
    m.estado.eventos = [];
    const d = await m.descargar.ejecutar({ empresaId: A, usuarioId: COLAB, id: e.id });
    expect(d).toMatchObject({ nombre: 'informe.txt', tipo: 'text/plain', bytes: bytes.length, sha256: sha(bytes) });
    expect(Buffer.compare(await leer(d.flujo), Buffer.from(bytes))).toBe(0);
    expect(m.estado.eventos).toEqual([expect.objectContaining({ accion: 'evidencia.descargada', objeto: `evidencia:${e.id}`, objetoVersion: sha(bytes) })]);
  });

  it('una reemplazada se puede descargar (es el historial); una eliminada no', async () => {
    const { m, control } = await conControl();
    const a = await subida(m, control.id);
    await m.reemplazar.ejecutar({ ...yo, id: a.id, fechaHecho: '2026-11-10', flujo: enTrozos(png()) });
    await expect(m.descargar.ejecutar({ ...yo, id: a.id })).resolves.toMatchObject({ tipo: 'application/pdf' });
    const b = await subida(m, control.id, { titulo: 'Otra' });
    await m.eliminar.ejecutar({ ...yo, id: b.id });
    await expect(m.descargar.ejecutar({ ...yo, id: b.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('exige permiso y forma; la de otra empresa es 404 igual que una inexistente', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id);
    await expect(m.descargar.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS, id: e.id })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.descargar.ejecutar({ ...yo, id: 'x' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(m.descargar.ejecutar({ empresaId: B, usuarioId: ADMIN_B, id: e.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(m.descargar.ejecutar({ ...yo, id: 'dddddddd-0000-4000-8000-000000000000' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('si no se puede registrar la descarga, NO se entrega el archivo (falla cerrada)', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id);
    let aperturas = 0;
    const abrir = m.almacen.abrir.bind(m.almacen);
    m.almacen.abrir = async (...a) => { aperturas += 1; return abrir(...a); };
    m.estado.fallarBitacora = true;
    await expect(m.descargar.ejecutar({ ...yo, id: e.id })).rejects.toThrow('bitácora no disponible');
    expect(aperturas).toBe(0);
  });
});

describe('cobertura', () => {
  const montarCobertura = async () => {
    const { m, control } = await conControl();
    const c2 = await m.crearControl.ejecutar({ ...yo, codigo: 'C-002', nombre: 'Otro control' });
    await m.agregarMapeo.ejecutar({ ...yo, controlId: control.id, ...POL });
    await m.agregarMapeo.ejecutar({ ...yo, controlId: control.id, libreriaCodigo: entradas.contexto.libreriaCodigo, idEstable: entradas.contexto.idEstable });
    await m.agregarMapeo.ejecutar({ ...yo, controlId: c2.id, libreriaCodigo: entradas.roles.libreriaCodigo, idEstable: entradas.roles.idEstable });
    return { m, control, c2 };
  };
  const estados = async (m: Montaje, extra: Record<string, unknown> = {}) => Object.fromEntries((await m.cobertura.ejecutar({ ...yo, ...extra })).entradas.map((e) => [e.idEstable, e.estado]));

  it('una evidencia en un control cubre todas las entradas que mapea', async () => {
    const { m, control } = await montarCobertura();
    expect(await estados(m)).toEqual({ 'ha-4.1': 'sin_evidencia', 'a27-5-1': 'sin_evidencia', 'a27-5-2': 'sin_evidencia' });
    await subida(m, control.id);
    expect(await estados(m)).toEqual({ 'ha-4.1': 'cubierta', 'a27-5-1': 'cubierta', 'a27-5-2': 'sin_evidencia' });
  });

  it('vence, se elimina o se retira el control: deja de estar cubierta', async () => {
    const { m, control } = await montarCobertura();
    const e = await subida(m, control.id, { vigenteHasta: '2026-11-11' });
    expect((await estados(m))['a27-5-1']).toBe('cubierta');
    m.ponerAhora(new Date('2026-11-12T15:00:00Z'));
    expect((await estados(m))['a27-5-1']).toBe('evidencia_vencida');
    m.ponerAhora(new Date('2026-11-11T15:00:00Z'));
    await m.eliminar.ejecutar({ ...yo, id: e.id });
    expect((await estados(m))['a27-5-1']).toBe('sin_evidencia');
    await subida(m, control.id);
    await m.retirarControl.ejecutar({ ...yo, id: control.id, versionEsperada: 1 });
    expect((await estados(m))['a27-5-1']).toBe('sin_control');
  });

  it('las entradas evaluadas «no aplica» no piden cobertura', async () => {
    const { m } = await montarCobertura();
    const { Evaluacion } = await import('../domain/evaluacion.js');
    m.estado.evaluaciones.set(`${A}|${entradas.politicas.libreriaCodigo}|${entradas.politicas.idEstable}`, Evaluacion.crear({ empresaId: A, libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: entradas.politicas.idEstable, libreriaId: entradas.politicas.libreriaId, estado: 'no_aplica', comentario: 'No tenemos ese proceso', version: 1 }));
    const r = await m.cobertura.ejecutar(yo);
    expect(r.entradas.find((e) => e.idEstable === 'a27-5-1')?.estado).toBe('no_aplica');
    expect(r.total.total).toBe(2);
  });

  it('resume por norma, trae el título de cada entrada y filtra por norma', async () => {
    const { m, control } = await montarCobertura();
    await subida(m, control.id);
    const r = await m.cobertura.ejecutar(yo);
    expect(r.hoy).toBe('2026-11-11');
    expect(r.normas).toEqual(['ISO 9001', 'ISO/IEC 27001']);
    expect(r.porNorma.map((n) => n.norma)).toEqual(['ISO 9001', 'ISO/IEC 27001']);
    expect(r.porNorma.find((n) => n.norma === 'ISO 9001')).toMatchObject({ total: 1, cubiertas: 1, porcentaje: 100 });
    expect(r.entradas.find((e) => e.idEstable === 'ha-4.1')).toMatchObject({ titulo: 'Contexto', tipo: 'clausula', controles: 1, evidencias: 1 });
    const solo9001 = await m.cobertura.ejecutar({ ...yo, norma: 'ISO 9001' });
    expect(solo9001.entradas.map((e) => e.idEstable)).toEqual(['ha-4.1']);
    expect(solo9001.total).toMatchObject({ total: 1, cubiertas: 1 });
  });

  it('exige permiso y una norma con forma válida; B no ve la cobertura de A', async () => {
    const { m, control } = await montarCobertura();
    await subida(m, control.id);
    await expect(m.cobertura.ejecutar({ empresaId: A, usuarioId: SIN_PERMISOS })).rejects.toBeInstanceOf(SinPermisoError);
    await expect(m.cobertura.ejecutar({ ...yo, norma: '<script>' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    const deB = await m.cobertura.ejecutar({ empresaId: B, usuarioId: ADMIN_B });
    expect(deB.entradas.map((e) => [e.idEstable, e.estado])).toEqual([['a27-5-1', 'sin_control']]);
    expect(deB.total.cubiertas).toBe(0);
  });
});

describe('subida en dos fases (iniciar y confirmar)', () => {
  const iniciar = (m: Montaje, controlId: string, bytes: Uint8Array = pdf()) => m.subir.iniciar({ ...yo, controlId, ...datos, flujo: enTrozos(bytes) });

  it('iniciar recibe y valida el archivo pero NO toca la base de datos: sin fila, sin hecho y sin archivo definitivo', async () => {
    const { m, control } = await conControl();
    const pendiente = await iniciar(m, control.id);
    expect(m.almacen.temporales.size).toBe(1);
    expect(m.almacen.archivos.size).toBe(0);
    expect(m.estado.evidencias.size).toBe(0);
    expect(m.estado.eventos).toEqual([]);
    await pendiente.descartar();
  });

  it('confirmar hace la transacción: fila, hecho y archivo definitivo', async () => {
    const { m, control } = await conControl();
    const e = await (await iniciar(m, control.id)).confirmar();
    expect(e.estado).toBe('activa');
    expect(m.almacen.temporales.size).toBe(0);
    expect(m.almacen.archivos.size).toBe(1);
    expect(m.estado.eventos.map((x) => x.accion)).toEqual(['evidencia.creada']);
  });

  it('descartar borra el temporal y no deja ningún rastro, ni siquiera en la bitácora', async () => {
    const { m, control } = await conControl();
    const pendiente = await iniciar(m, control.id);
    await pendiente.descartar();
    expect(m.almacen.temporales.size + m.almacen.archivos.size + m.estado.evidencias.size).toBe(0);
    expect(m.estado.eventos).toEqual([]);
  });

  it('una subida solo se usa una vez: confirmar dos veces falla, y descartar después de confirmar no borra nada', async () => {
    const { m, control } = await conControl();
    const pendiente = await iniciar(m, control.id);
    await pendiente.confirmar();
    await expect(pendiente.confirmar()).rejects.toThrow('ya se confirmó');
    await pendiente.descartar();
    expect(m.almacen.archivos.size).toBe(1);
    expect(m.estado.evidencias.size).toBe(1);
    const otra = await iniciar(m, control.id, texto('otro\n'));
    await otra.descartar();
    await expect(otra.confirmar()).rejects.toThrow('ya se confirmó o se descartó');
  });

  it('si confirmar falla, descarta el temporal y no deja nada', async () => {
    const { m, control } = await conControl();
    const pendiente = await iniciar(m, control.id);
    m.estado.fallarBitacora = true;
    await expect(pendiente.confirmar()).rejects.toThrow('bitácora no disponible');
    expect(m.almacen.temporales.size + m.almacen.archivos.size + m.estado.evidencias.size).toBe(0);
  });

  it('iniciar sigue decidiendo antes de leer: sin permiso, no se lee un byte', async () => {
    const { m, control } = await conControl();
    await expect(m.subir.iniciar({ empresaId: A, usuarioId: SIN_PERMISOS, controlId: control.id, ...datos, flujo: flujoProhibido() })).rejects.toBeInstanceOf(SinPermisoError);
    expect(m.almacen.fragmentosLeidos).toBe(0);
  });

  it('un archivo rechazado lanza en iniciar (y queda el rechazo), así que nunca hay nada que confirmar', async () => {
    const { m, control } = await conControl();
    await expect(iniciar(m, control.id, ejecutable())).rejects.toBeInstanceOf(ArchivoRechazadoError);
    expect(m.estado.eventos.map((x) => x.accion)).toEqual(['evidencia.subida_rechazada']);
  });

  it('reemplazar también tiene dos fases: iniciar no cambia la original; confirmar sí; descartar la deja activa', async () => {
    const { m, control } = await conControl();
    const e = await subida(m, control.id);
    m.estado.eventos = [];
    const entrada = { ...yo, id: e.id, fechaHecho: '2026-11-10', flujo: enTrozos(png()) };
    const p1 = await m.reemplazar.iniciar(entrada);
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('activa');
    expect(m.estado.evidencias.size).toBe(1);
    expect(m.estado.eventos).toEqual([]);
    await p1.descartar();
    expect(m.almacen.temporales.size).toBe(0);
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('activa');
    const p2 = await m.reemplazar.iniciar({ ...entrada, flujo: enTrozos(png()) });
    const n = await p2.confirmar();
    expect(n.reemplazaId).toBe(e.id);
    expect(m.estado.evidencias.get(`${A}|${e.id}`)?.evidencia.estado).toBe('reemplazada');
  });
});
