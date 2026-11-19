import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../application/catalogo-lectura.port.js';
import { CrearControlUseCase } from '../application/controles.use-cases.js';
import {
  CambiarDistribucionUseCase,
  CrearDocumentoUseCase,
  GuardarRetencionUseCase,
  ListarCoberturaDocumentalUseCase,
  ListarDirectorioUseCase,
  ListarDocumentosUseCase,
  ObtenerDocumentoUseCase,
  RetirarDocumentoUseCase,
  VincularDocumentoUseCase,
} from '../application/documentos.use-cases.js';
import { ConflictoError, EntradaNoEncontradaError } from '../application/errores.js';
import { enTrozos, pdf } from '../application/prueba/archivos.js';
import {
  AprobarVersionUseCase,
  ConfirmarLecturaUseCase,
  DescargarVersionUseCase,
  EnviarARevisionUseCase,
  MisLecturasPendientesUseCase,
  SubirVersionUseCase,
} from '../application/versiones.use-cases.js';
import { AlmacenArchivosLocal } from './almacen-archivos-local.adapter.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real y el disco real: flujo completo, una sola vigente, concurrencia, transacción única y aislamiento (regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000d8');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000d9');
const ADMIN1 = 'a1a1a1a1-0000-4000-8000-0000000000d8';
const ADMIN2 = 'a2a2a2a2-0000-4000-8000-0000000000d8';
const COLAB = 'a3a3a3a3-0000-4000-8000-0000000000d8';
const BAJA = 'a4a4a4a4-0000-4000-8000-0000000000d8';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000d9';
const LIB = 'c0c0c0c0-0000-4000-8000-0000000000da';
const CODIGO_LIB = 'prueba-doc-anexo-a';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;
const entrada = (id: string): EntradaCatalogo => ({
  libreriaCodigo: CODIGO_LIB,
  libreriaId: LIB,
  idEstable: id,
  tipo: 'control',
  capitulo: null,
  grupo: 'Organizacionales',
  titulo: `Control ${id}`,
  guia: 'Guía breve.',
  aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }],
  orden: 1,
});
const leerTodo = async (f: AsyncIterable<Uint8Array>) => {
  const partes: Uint8Array[] = [];
  for await (const p of f) partes.push(p);
  return Buffer.concat(partes);
};

describe.skipIf(!hayBase)('control documental sobre PostgreSQL y disco reales', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const unidad = () => crearUnidadDeTrabajoCertificacion(pools.db('app'));
  const permitir: AutorizacionPort = { puede: async () => true };
  const catalogo: CatalogoLecturaPort = { listarEntradasVigentes: async () => [entrada('a27-5-1'), entrada('a27-5-2')] };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 18, 15, 0, t++));
  const nuevoId = () => crypto.randomUUID();
  let raiz: string;
  let almacen: AlmacenArchivosLocal;
  const casos = () => {
    const u = unidad();
    return {
      crearControl: new CrearControlUseCase(u, permitir, reloj, nuevoId),
      crear: new CrearDocumentoUseCase(u, permitir, reloj, nuevoId),
      obtener: new ObtenerDocumentoUseCase(u, permitir, reloj),
      listar: new ListarDocumentosUseCase(u, permitir, catalogo, reloj),
      retirar: new RetirarDocumentoUseCase(u, permitir, reloj),
      distribuir: new CambiarDistribucionUseCase(u, permitir),
      vincular: new VincularDocumentoUseCase(u, permitir, catalogo),
      cobertura: new ListarCoberturaDocumentalUseCase(u, permitir, catalogo),
      retencion: new GuardarRetencionUseCase(u, permitir, reloj),
      directorio: new ListarDirectorioUseCase(u, permitir),
      subir: new SubirVersionUseCase(u, permitir, almacen, reloj, nuevoId),
      enviar: new EnviarARevisionUseCase(u, permitir, reloj),
      aprobar: new AprobarVersionUseCase(u, permitir, reloj),
      descargar: new DescargarVersionUseCase(u, permitir, almacen),
      confirmar: new ConfirmarLecturaUseCase(u, permitir, reloj),
      pendientes: new MisLecturasPendientesUseCase(u, permitir),
    };
  };
  let c: ReturnType<typeof casos>;
  const colab = { empresaId: A, usuarioId: COLAB };
  const admin = { empresaId: A, usuarioId: ADMIN1 };
  const nuevoDoc = (extra: Record<string, unknown> = {}) =>
    c.crear.ejecutar({
      ...admin,
      tipo: 'politica',
      titulo: 'Política de acceso',
      clasificacion: 'interna',
      responsableId: ADMIN1,
      ...extra,
    });
  const subida = (documentoId: string, bytes: Uint8Array = pdf()) =>
    c.subir.ejecutar({ ...colab, documentoId, nota: 'versión inicial', nombreOriginal: 'politica.pdf', flujo: enTrozos(bytes, 700) });
  const vigente = async (documentoId: string, extra: Record<string, unknown> = {}) => {
    const v = await subida(documentoId);
    await c.enviar.ejecutar({ ...colab, id: v.id, aprobadorId: ADMIN2 });
    return c.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id, ...extra });
  };
  const archivosEnDisco = async (empresa: typeof A = A) => readdir(join(raiz, empresa)).catch(() => [] as string[]);

  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const t of [
        'retencion_tipo',
        'documento_entrada',
        'documento_control',
        'documento_lectura',
        'documento_destinatario',
        'documento_version',
        'documento',
        'control',
      ])
        await sql`delete from ${sql.table(t)} where empresa_id = ${id}`.execute(trx);
    });
  };
  const sembrar = async (id: typeof A, slug: string, personas: Array<[string, string | null, boolean]>) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      for (const [uid, rol, baja] of personas)
        await sql`insert into usuario (id, empresa_id, nombre, correo, rol, baja_en) values (${uid}, ${id}, ${'Persona ' + uid.slice(0, 2)}, ${uid + '@example.test'}, ${rol}, ${baja ? new Date() : null}) on conflict do nothing`.execute(
          trx,
        );
    });
  };

  beforeAll(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'sigiso-doc-'));
    almacen = new AlmacenArchivosLocal(raiz);
    c = casos();
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'docint-a', [
      [ADMIN1, 'administrador_sig', false],
      [ADMIN2, 'administrador_sig', false],
      [COLAB, 'colaborador', false],
      [BAJA, null, true],
    ]);
    await sembrar(B, 'docint-b', [[UB, 'administrador_sig', false]]);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, async (trx) => void (await sql`delete from usuario where empresa_id = ${A}`.execute(trx)));
    await conTenant(owner(), B, async (trx) => void (await sql`delete from usuario where empresa_id = ${B}`.execute(trx)));
    await conTenant(owner(), A, async (trx) => void (await sql`delete from empresa where id = ${A}`.execute(trx)));
    await conTenant(owner(), B, async (trx) => void (await sql`delete from empresa where id = ${B}`.execute(trx)));
    await pools.cerrar();
    await rm(raiz, { recursive: true, force: true });
  });

  it('el directorio distingue a las personas activas de quien se dio de baja y no trae el correo', async () => {
    const r = await c.directorio.ejecutar(colab);
    expect(r).toHaveLength(4);
    expect(r.find((p) => p.id === BAJA)?.activa).toBe(false);
    expect(r.find((p) => p.id === COLAB)?.activa).toBe(true);
    expect(JSON.stringify(r)).not.toContain('example.test');
    expect((await c.directorio.ejecutar({ empresaId: B, usuarioId: UB })).map((p) => p.id)).toEqual([UB]);
  });

  it('flujo completo: crear, subir, enviar, aprobar, nueva versión, lecturas y descarga; una sola vigente y el archivo íntegro', async () => {
    const d = await nuevoDoc();
    expect(d.codigo).toMatch(/^POL-\d{3}$/);
    await c.distribuir.ejecutar({ ...admin, id: d.id, usuarioIds: [COLAB], roles: ['administrador_sig'] });
    const bytes = pdf();
    const v1 = await subida(d.id, bytes);
    expect((await archivosEnDisco()).length).toBeGreaterThan(0);
    await c.enviar.ejecutar({ ...colab, id: v1.id, aprobadorId: ADMIN2 });
    const a1 = await c.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v1.id });
    expect(a1).toMatchObject({ estado: 'aprobada', vigente: true, porSuAutor: false });
    expect((await c.pendientes.ejecutar(colab)).map((p) => p.codigo)).toContain(d.codigo);
    await c.confirmar.ejecutar({ ...colab, id: v1.id });
    expect((await c.pendientes.ejecutar(colab)).map((p) => p.codigo)).not.toContain(d.codigo);
    const v2 = await vigente(d.id);
    const detalle = await c.obtener.ejecutar({ ...admin, id: d.id });
    expect(detalle.versiones.map((v) => [v.numero, v.estado])).toEqual([
      [2, 'aprobada'],
      [1, 'obsoleta'],
    ]);
    expect(detalle.versiones.filter((v) => v.vigente)).toHaveLength(1);
    expect(detalle).toMatchObject({ proximaRevision: '2027-11-18', revision: 'al_dia', sinVigente: false });
    expect(detalle.versiones.find((v) => v.numero === 1)?.lecturas).toEqual({ confirmadas: 1, total: 3 });
    expect(detalle.versiones.find((v) => v.numero === 2)?.lecturas).toBeNull(); // sin «requiere nueva lectura» no se reabre
    const bajada = await c.descargar.ejecutar({ ...colab, id: v1.id });
    expect(bajada).toMatchObject({ vigente: false, tipo: 'application/pdf' });
    expect(Buffer.compare(await leerTodo(bajada.flujo), Buffer.from(bytes))).toBe(0);
    expect(v2.numero).toBe(2);
  });

  it('dos subidas a la vez al mismo documento: una sola versión abierta y ningún archivo huérfano', async () => {
    const d = await nuevoDoc({ titulo: 'Carrera de subidas' });
    const antes = (await archivosEnDisco()).length;
    const r = await Promise.allSettled([subida(d.id), subida(d.id)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const falla = r.find((x) => x.status === 'rejected') as PromiseRejectedResult;
    expect(falla.reason).toBeInstanceOf(ConflictoError);
    const det = await c.obtener.ejecutar({ ...admin, id: d.id });
    expect(det.versiones).toHaveLength(1);
    expect((await archivosEnDisco()).length).toBe(antes + 1);
  });

  it('dos aprobaciones a la vez de la misma versión: solo una prospera y queda una sola vigente', async () => {
    const d = await nuevoDoc({ titulo: 'Carrera de aprobaciones' });
    const v = await subida(d.id);
    await c.enviar.ejecutar({ ...colab, id: v.id, aprobadorId: ADMIN2 });
    const r = await Promise.allSettled([
      c.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id }),
      c.aprobar.ejecutar({ empresaId: A, usuarioId: ADMIN2, id: v.id }),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((await c.obtener.ejecutar({ ...admin, id: d.id })).versiones.filter((x) => x.vigente)).toHaveLength(1);
  });

  it('retirar deja el documento sin versión vigente y la base conserva su historia', async () => {
    const d = await nuevoDoc({ titulo: 'Para retirar' });
    await vigente(d.id);
    await c.retirar.ejecutar({ ...admin, id: d.id });
    const det = await c.obtener.ejecutar({ ...admin, id: d.id });
    expect(det).toMatchObject({ estado: 'retirado', vigente: null });
    expect(det.versiones.map((v) => v.estado)).toEqual(['obsoleta']);
    const filas = await conTenant(owner(), A, (trx) =>
      sql<{ n: string }>`select count(*)::text as n from documento_version where empresa_id = ${A} and documento_id = ${d.id}`.execute(trx),
    );
    expect(filas.rows[0]?.n).toBe('1');
  });

  it('vínculos, cobertura documental y retención se guardan y se leen de la base', async () => {
    const d = await nuevoDoc({ titulo: 'Con vínculos' });
    const control = await c.crearControl.ejecutar({ ...admin, codigo: `D-${Date.now() % 1e5}`, nombre: 'Control' });
    expect(await c.vincular.ejecutar({ ...admin, id: d.id, controlId: control.id })).toEqual({ creado: true });
    expect(await c.vincular.ejecutar({ ...admin, id: d.id, libreriaCodigo: CODIGO_LIB, idEstable: 'a27-5-1' })).toEqual({ creado: true });
    await expect(c.vincular.ejecutar({ ...admin, id: d.id, libreriaCodigo: CODIGO_LIB, idEstable: 'a27-9-9' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    expect((await c.cobertura.ejecutar(admin)).cubiertas).toBe(0); // sin versión vigente no cubre
    await vigente(d.id);
    const cob = await c.cobertura.ejecutar(admin);
    expect(cob.entradas.find((x) => x.idEstable === 'a27-5-1')?.documentos.map((x) => x.id)).toEqual([d.id]);
    const r1 = await c.retencion.ejecutar({ ...admin, tipo: 'manual', anios: 5, motivo: 'política de la empresa' });
    expect(r1.version).toBe(1);
    expect((await c.retencion.ejecutar({ ...admin, tipo: 'manual', anios: 7, motivo: 'ley', versionEsperada: 1 })).version).toBe(2);
    await expect(c.retencion.ejecutar({ ...admin, tipo: 'manual', anios: 1, motivo: 'x', versionEsperada: 1 })).rejects.toThrow();
  });

  it('A y B no se ven: lo de A responde como inexistente desde B, y el archivo de A no se alcanza', async () => {
    const d = await nuevoDoc({ titulo: 'Solo de A' });
    const v = await vigente(d.id);
    const b = { empresaId: B, usuarioId: UB };
    await expect(c.obtener.ejecutar({ ...b, id: d.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.descargar.ejecutar({ ...b, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.confirmar.ejecutar({ ...b, id: v.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.retirar.ejecutar({ ...b, id: d.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect((await c.listar.ejecutar(b)).documentos).toEqual([]);
    await expect(c.subir.ejecutar({ ...b, documentoId: d.id, nota: 'x', flujo: enTrozos(pdf()) })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    expect(await archivosEnDisco(B)).toEqual([]);
    expect((await c.crear.ejecutar({ ...b, tipo: 'politica', titulo: 'De B', clasificacion: 'interna', responsableId: UB })).codigo).toBe(
      'POL-001',
    );
    await expect(
      c.crear.ejecutar({ ...b, tipo: 'politica', titulo: 'De B', clasificacion: 'interna', responsableId: ADMIN1 }),
    ).rejects.toThrow(); // responsable de otra empresa
  });
});
