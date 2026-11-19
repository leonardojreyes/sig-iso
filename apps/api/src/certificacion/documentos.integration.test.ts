import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlmacenArchivosLocal } from '@sig/certificacion';
import { A, ADMIN, B, COLAB, EstadoFalso, ejecutable, entradas, pdf } from '@sig/certificacion/prueba';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { CertificacionApiModule } from './certificacion-api.module.js';
import { opcionesDePrueba } from './prueba/opciones.js';

// Control documental (ADR 039) sobre una aplicación Nest REAL: subidas multipart de verdad, el disco real y los casos de uso reales con
// fakes que separan los datos por empresa. Cada respuesta se valida contra los esquemas de openapi.yaml. Orden: 401 → 403 → 400 → 404 → 409.
const ADMIN2 = '33333333-3333-4333-8333-3333333333e3';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const SIN_PERMISOS = '99999999-9999-4999-8999-999999999999';
const ID_FALSO = 'dddddddd-0000-4000-8000-000000000000';
const TODOS = [
  'documentos.ver',
  'documentos.redactar',
  'documentos.aprobar',
  'documentos.gestionar',
  'documentos.leer',
  'controles.ver',
  'controles.gestionar',
] as const;
const DOC = { tipo: 'politica', titulo: 'TITULO-PRIVADO Política de acceso', clasificacion: 'interna', responsableId: ADMIN };

const RUTAS: [string, string, unknown][] = [
  ['GET', '/documentos', undefined],
  ['POST', '/documentos', DOC],
  ['GET', `/documentos/${ID_FALSO}`, undefined],
  ['PUT', `/documentos/${ID_FALSO}`, { versionEsperada: 1 }],
  ['POST', `/documentos/${ID_FALSO}/retiro`, undefined],
  ['POST', `/documentos/${ID_FALSO}/revision`, {}],
  ['PUT', `/documentos/${ID_FALSO}/distribucion`, {}],
  ['POST', `/documentos/${ID_FALSO}/vinculos`, { controlId: ID_FALSO }],
  ['POST', `/documentos/${ID_FALSO}/vinculos/eliminacion`, { controlId: ID_FALSO }],
  ['POST', `/versiones/${ID_FALSO}/envio`, { aprobadorId: ID_FALSO }],
  ['POST', `/versiones/${ID_FALSO}/devolucion`, { motivo: 'incompleta' }],
  ['POST', `/versiones/${ID_FALSO}/aprobacion`, {}],
  ['POST', `/versiones/${ID_FALSO}/descarte`, undefined],
  ['GET', `/versiones/${ID_FALSO}/archivo`, undefined],
  ['POST', `/versiones/${ID_FALSO}/lectura`, undefined],
  ['GET', '/lecturas/pendientes', undefined],
  ['GET', '/cobertura-documental', undefined],
  ['GET', '/retencion', undefined],
  ['PUT', '/retencion', { tipo: 'politica', anios: 5, motivo: 'x' }],
  ['GET', '/certificacion/personas', undefined],
];

describe('controladores del control documental (ADR 039)', () => {
  let arnes: Arnes;
  let estado: EstadoFalso;
  let raiz: string;
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tAdmin = () => token(A, ADMIN);
  const tAdmin2 = () => token(A, ADMIN2);
  const tColab = () => token(A, COLAB);
  const tSin = () => token(A, SIN_PERMISOS);
  const tAdminB = () => token(B, ADMIN_B);
  const enDisco = async (empresa: string = A) => readdir(join(raiz, empresa)).catch(() => [] as string[]);

  beforeAll(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'sigiso-api-doc-'));
    estado = new EstadoFalso();
    arnes = await crearArnes({
      hechos: bitacora.hechos,
      modulos: [
        CertificacionApiModule.register(
          opcionesDePrueba({ estado, almacen: new AlmacenArchivosLocal(raiz), reloj: () => new Date('2026-11-18T15:00:00Z') }),
        ),
      ],
    });
  });
  afterAll(async () => {
    await arnes.cerrar();
    await rm(raiz, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await rm(join(raiz, A), { recursive: true, force: true });
    await rm(join(raiz, B), { recursive: true, force: true });
    const d = estado.documentosEstado;
    for (const m of [estado.controles, d.documentos, d.versiones, d.destinatarios, d.lecturas, d.retenciones] as Map<string, unknown>[])
      m.clear();
    d.controles.clear();
    d.entradas.clear();
    estado.eventos = [];
    estado.permisos.clear();
    estado.carrera = false;
    estado.fallarBitacora = false;
    estado.catalogoPorEmpresa.clear();
    estado.catalogoPorEmpresa.set(A, [entradas.contexto, entradas.politicas, entradas.roles]);
    estado.catalogoPorEmpresa.set(B, [entradas.politicas]);
    for (const u of [ADMIN, ADMIN2]) estado.conceder(u, A, ...TODOS);
    estado.conceder(COLAB, A, 'documentos.ver', 'documentos.redactar', 'documentos.leer');
    estado.conceder(ADMIN_B, B, ...TODOS);
    d.personas.set(A, [
      { id: ADMIN, nombre: 'Ana Admin', rol: 'administrador_sig', activa: true },
      { id: ADMIN2, nombre: 'Beto Admin', rol: 'administrador_sig', activa: true },
      { id: COLAB, nombre: 'Carla Colaboradora', rol: 'colaborador', activa: true },
    ]);
    d.personas.set(B, [{ id: ADMIN_B, nombre: 'Admin B', rol: 'administrador_sig', activa: true }]);
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
  const formulario = (nota: string | undefined, bytes: Uint8Array | undefined, archivoPrimero = false, nombre = 'politica.pdf') => {
    const f = new FormData();
    const archivo = () => bytes && f.append('archivo', new Blob([bytes as BlobPart]), nombre);
    if (archivoPrimero) archivo();
    if (nota !== undefined) f.append('nota', nota);
    if (!archivoPrimero) archivo();
    return f;
  };
  const crearDoc = async (extra: Record<string, unknown> = {}, t?: string) => {
    const r = await pedir('/documentos', t ?? (await tAdmin()), 'POST', { ...DOC, ...extra });
    expect(r.status).toBe(201);
    return json(r);
  };
  const subir = async (docId: string, t?: string, bytes: Uint8Array = pdf()) =>
    pedir(`/documentos/${docId}/versiones`, t ?? (await tColab()), 'POST', formulario('NOTA-PRIVADA versión inicial', bytes));
  const vigente = async (docId: string) => {
    const v = await json(await subir(docId));
    expect((await pedir(`/versiones/${v.id}/envio`, await tColab(), 'POST', { aprobadorId: ADMIN2 })).status).toBe(200);
    const a = await pedir(`/versiones/${v.id}/aprobacion`, await tAdmin2(), 'POST', {});
    expect(a.status).toBe(200);
    return json(a);
  };

  describe('401 sin token: no se lee ni se guarda nada', () => {
    it.each(RUTAS)('%s %s', async (metodo, ruta, cuerpo) => {
      await problema(await pedir(ruta, undefined, metodo, cuerpo), 401, 'no_autenticado');
      expect(estado.documentosEstado.documentos.size).toBe(0);
    });
  });

  describe('403 sin permiso: se decide ANTES de mirar el cuerpo o el identificador', () => {
    it.each(RUTAS)('%s %s', async (metodo, ruta, cuerpo) => {
      await problema(await pedir(ruta, await tSin(), metodo, cuerpo), 403, 'sin_permiso');
    });
    it('el colaborador no aprueba, no gestiona ni retira', async () => {
      const d = await crearDoc();
      const v = await json(await subir(d.id));
      await problema(await pedir(`/versiones/${v.id}/aprobacion`, await tColab(), 'POST', {}), 403, 'sin_permiso');
      await problema(await pedir(`/documentos/${d.id}/retiro`, await tColab(), 'POST'), 403, 'sin_permiso');
      await problema(await pedir('/retencion', await tColab(), 'PUT', { tipo: 'politica', anios: 5, motivo: 'x' }), 403, 'sin_permiso');
    });
  });

  it('flujo completo: crear, subir, enviar, aprobar y leer; cada respuesta cumple el contrato y la bitácora no lleva texto', async () => {
    const d = await crearDoc();
    valida('Documento', d);
    expect(d).toMatchObject({ codigo: 'POL-001', sinVigente: true });
    const dist = await pedir(`/documentos/${d.id}/distribucion`, await tAdmin(), 'PUT', { usuarioIds: [COLAB] });
    expect(dist.status).toBe(200);
    valida('Distribucion', await json(dist));

    const r = await subir(d.id);
    expect(r.status).toBe(201);
    const v = await json(r);
    valida('VersionDocumento', v);
    expect(v).toMatchObject({ numero: 1, estado: 'borrador', autorId: COLAB });
    expect((await enDisco()).length).toBeGreaterThan(0);

    const e = await pedir(`/versiones/${v.id}/envio`, await tColab(), 'POST', { aprobadorId: ADMIN2 });
    expect(e.status).toBe(200);
    expect((await json(e)).estado).toBe('en_revision');
    const a = await pedir(`/versiones/${v.id}/aprobacion`, await tAdmin2(), 'POST', {});
    expect(a.status).toBe(200);
    expect(await json(a)).toMatchObject({ estado: 'aprobada', vigente: true });

    const det = await json(await pedir(`/documentos/${d.id}`, await tColab()));
    valida('DocumentoDetalle', det);
    expect(det).toMatchObject({ sinVigente: false, proximaRevision: '2027-11-18', lecturaPendiente: true, unicoAdministrador: false });

    const pend = await json(await pedir('/lecturas/pendientes', await tColab()));
    expect(pend).toHaveLength(1);
    pend.forEach((x: unknown) => valida('LecturaPendiente', x));
    expect((await pedir(`/versiones/${v.id}/lectura`, await tColab(), 'POST')).status).toBe(204);
    await problema(await pedir(`/versiones/${v.id}/lectura`, await tColab(), 'POST'), 409, 'conflicto');

    const lista = await json(await pedir('/documentos', await tColab()));
    valida('ListaDocumentos', lista);
    expect(lista.documentos[0]).toMatchObject({ lecturaPendiente: false, lecturas: { confirmadas: 1, total: 1 } });
    expect(JSON.stringify(estado.eventos)).not.toMatch(/TITULO-PRIVADO|NOTA-PRIVADA|Ana|Beto/);
  });

  it('la descarga es un adjunto íntegro, sin caché, con la huella registrada ANTES; una descartada no se descarga', async () => {
    const d = await crearDoc();
    const bytes = pdf();
    const v = await json(await subir(d.id, undefined, bytes));
    estado.eventos = [];
    const r = await pedir(`/versiones/${v.id}/archivo`, await tColab());
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    expect(r.headers.get('content-type')).toMatch(/^application\/pdf/);
    expect(Buffer.compare(Buffer.from(await r.arrayBuffer()), Buffer.from(bytes))).toBe(0);
    expect(estado.eventos).toEqual([expect.objectContaining({ accion: 'version.descargada', objetoVersion: v.archivo.sha256 })]);
    expect((await pedir(`/versiones/${v.id}/descarte`, await tColab(), 'POST')).status).toBe(204);
    await problema(await pedir(`/versiones/${v.id}/archivo`, await tColab()), 404, 'no_encontrado');
    estado.fallarBitacora = true;
    const d2 = await crearDoc().catch(() => null);
    expect(d2).toBeNull(); // sin poder registrar, no se crea nada
  });

  describe('subida: se decide antes de leer el archivo y no deja efectos al fallar', () => {
    it('un tipo no permitido responde 415 y no queda ningún archivo; sin la nota antes del archivo responde 400', async () => {
      const d = await crearDoc();
      await problema(
        await pedir(`/documentos/${d.id}/versiones`, await tColab(), 'POST', formulario('x', ejecutable(), false, 'politica.pdf')),
        415,
        'tipo_no_permitido',
      );
      await problema(
        await pedir(`/documentos/${d.id}/versiones`, await tColab(), 'POST', formulario('x', pdf(), true)),
        400,
        'parametro_invalido',
      ); // el archivo llegó antes que la nota
      await problema(
        await pedir(`/documentos/${d.id}/versiones`, await tColab(), 'POST', formulario(undefined, pdf())),
        400,
        'parametro_invalido',
      );
      await problema(
        await pedir(`/documentos/${d.id}/versiones`, await tColab(), 'POST', formulario('x', undefined)),
        400,
        'parametro_invalido',
      );
      expect(await enDisco()).toEqual([]);
      expect(estado.documentosEstado.versiones.size).toBe(0);
      expect(estado.eventos.filter((e) => e.accion === 'version.subida_rechazada')).toHaveLength(1);
    });
    it('un documento ajeno o inexistente responde 404 y una versión abierta, 409', async () => {
      const d = await crearDoc();
      await problema(
        await pedir(`/documentos/${ID_FALSO}/versiones`, await tColab(), 'POST', formulario('x', pdf())),
        404,
        'no_encontrado',
      );
      expect((await subir(d.id)).status).toBe(201);
      await problema(await subir(d.id), 409, 'conflicto');
      expect((await enDisco()).length).toBe(1);
    });
  });

  it('crear valida datos (400), un cuerpo con campos de más no los cuela y el responsable debe ser de la empresa', async () => {
    await problema(await pedir('/documentos', await tAdmin(), 'POST', { ...DOC, tipo: 'carta' }), 400, 'parametro_invalido');
    await problema(await pedir('/documentos', await tAdmin(), 'POST', { ...DOC, responsableId: ADMIN_B }), 400, 'parametro_invalido');
    await problema(await pedir('/documentos', await tAdmin(), 'POST', { ...DOC, emisor: 'Un organismo' }), 400, 'parametro_invalido');
    const r = await pedir('/documentos', await tAdmin(), 'POST', { ...DOC, codigo: 'POL-999', estado: 'retirado', empresaId: B });
    expect(r.status).toBe(201);
    expect(await json(r)).toMatchObject({ codigo: 'POL-001', estado: 'activo' });
  });

  it('cambiar exige la versión que la persona vio (409 si otra cambió antes)', async () => {
    const d = await crearDoc();
    const ok = await pedir(`/documentos/${d.id}`, await tAdmin(), 'PUT', { titulo: 'Otro título', versionEsperada: 1 });
    expect(ok.status).toBe(200);
    expect(await json(ok)).toMatchObject({ titulo: 'Otro título', version: 2 });
    await problema(await pedir(`/documentos/${d.id}`, await tAdmin(), 'PUT', { titulo: 'x', versionEsperada: 1 }), 409, 'conflicto');
    await problema(await pedir(`/documentos/${d.id}`, await tAdmin(), 'PUT', { titulo: 'x' }), 400, 'parametro_invalido');
  });

  it('vínculos: 201 la primera vez y 200 si ya existía; una entrada no adoptada responde 404', async () => {
    const d = await crearDoc();
    const body = { libreriaCodigo: entradas.politicas.libreriaCodigo, idEstable: entradas.politicas.idEstable };
    const r1 = await pedir(`/documentos/${d.id}/vinculos`, await tAdmin(), 'POST', body);
    expect(r1.status).toBe(201);
    valida('VinculoDocumentoResultado', await json(r1));
    expect((await pedir(`/documentos/${d.id}/vinculos`, await tAdmin(), 'POST', body)).status).toBe(200);
    await problema(
      await pedir(`/documentos/${d.id}/vinculos`, await tAdmin(), 'POST', { libreriaCodigo: 'otra', idEstable: 'x-1' }),
      404,
      'no_encontrado',
    );
    expect((await pedir(`/documentos/${d.id}/vinculos/eliminacion`, await tAdmin(), 'POST', body)).status).toBe(204);
    await problema(await pedir(`/documentos/${d.id}/vinculos/eliminacion`, await tAdmin(), 'POST', body), 404, 'no_encontrado');
  });

  it('cobertura documental, retención y directorio cumplen el contrato', async () => {
    const d = await crearDoc();
    await pedir(`/documentos/${d.id}/vinculos`, await tAdmin(), 'POST', {
      libreriaCodigo: entradas.politicas.libreriaCodigo,
      idEstable: entradas.politicas.idEstable,
    });
    await vigente(d.id);
    const cob = await json(await pedir('/cobertura-documental?soloSinDocumento=true', await tColab()));
    valida('CoberturaDocumental', cob);
    expect(cob).toMatchObject({ total: 3, cubiertas: 1 });
    expect(cob.entradas).toHaveLength(2);
    const ret = await pedir('/retencion', await tAdmin(), 'PUT', { tipo: 'politica', anios: 5, motivo: 'política de la empresa' });
    expect(ret.status).toBe(200);
    valida('Retencion', await json(ret));
    await problema(
      await pedir('/retencion', await tAdmin(), 'PUT', { tipo: 'politica', anios: 0, motivo: 'x' }),
      400,
      'parametro_invalido',
    );
    await problema(await pedir('/retencion', await tAdmin(), 'PUT', { tipo: 'politica', anios: 3, motivo: 'x' }), 409, 'conflicto');
    const personas = await json(await pedir('/certificacion/personas', await tColab()));
    expect(personas.map((p: J) => Object.keys(p).sort())).toEqual([
      ['activa', 'id', 'nombre', 'puedeAprobar'],
      ['activa', 'id', 'nombre', 'puedeAprobar'],
      ['activa', 'id', 'nombre', 'puedeAprobar'],
    ]);
    personas.forEach((p: unknown) => valida('PersonaDirectorio', p));
  });

  it('aislamiento: A y B no se ven en ninguna operación, y la empresa del cuerpo se ignora', async () => {
    const d = await crearDoc();
    const v = await vigente(d.id);
    const tb = await tAdminB();
    for (const [metodo, ruta, cuerpo] of [
      ['GET', `/documentos/${d.id}`, undefined],
      ['PUT', `/documentos/${d.id}`, { titulo: 'x', versionEsperada: 1 }],
      ['POST', `/documentos/${d.id}/retiro`, undefined],
      ['PUT', `/documentos/${d.id}/distribucion`, {}],
      ['POST', `/versiones/${v.id}/envio`, { aprobadorId: ADMIN_B }],
      ['POST', `/versiones/${v.id}/aprobacion`, {}],
      ['POST', `/versiones/${v.id}/lectura`, undefined],
      ['GET', `/versiones/${v.id}/archivo`, undefined],
      ['POST', `/documentos/${d.id}/vinculos`, { controlId: ID_FALSO }],
      ['POST', `/documentos/${d.id}/vinculos/eliminacion`, { controlId: ID_FALSO }],
      ['POST', `/documentos/${d.id}/revision`, {}],
      ['POST', `/versiones/${v.id}/devolucion`, { motivo: 'incompleta' }],
      ['POST', `/versiones/${v.id}/descarte`, undefined],
    ] as [string, string, unknown][])
      await problema(await pedir(ruta, tb, metodo, cuerpo), 404, 'no_encontrado');
    expect((await json(await pedir('/documentos', tb))).documentos).toEqual([]);
    await problema(await pedir(`/documentos/${d.id}/versiones`, tb, 'POST', formulario('x', pdf())), 404, 'no_encontrado');
    expect(await json(await pedir('/lecturas/pendientes', tb))).toEqual([]);
    expect((await json(await pedir('/certificacion/personas', tb))).map((p: J) => p.id)).toEqual([ADMIN_B]);
    expect((await json(await pedir('/cobertura-documental', tb))).cubiertas).toBe(0);
    expect(await enDisco(B)).toEqual([]);
    expect((await json(await pedir('/documentos', tb, 'POST', { ...DOC, responsableId: ADMIN_B, empresaId: A }))).codigo).toBe('POL-001');
  });
});
