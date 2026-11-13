import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../application/catalogo-lectura.port.js';
import { AprobarDeclaracionUseCase, ExportarDeclaracionUseCase, ListarVersionesDeclaracionUseCase, ObtenerDeclaracionUseCase, ObtenerVersionDeclaracionUseCase } from '../application/declaracion.use-cases.js';
import { ConflictoError, EntradaNoEncontradaError } from '../application/errores.js';
import { EvaluarEntradaUseCase } from '../application/evaluar-entrada.use-case.js';
import { detectarTipoArchivo } from '../domain/deteccion-archivo.js';
import { DeclaracionKysely } from './declaracion-kysely.adapter.js';
import { GeneradorDocumentoDocx } from './generador-documento-docx.adapter.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real: aprobar congela una versión inmutable, la numeración por empresa, la carrera entre dos aprobaciones, la
// bitácora persistida con la huella del documento exportado y el AISLAMIENTO entre empresas (regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000d1');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000d2');
const UA = 'a1a1a1a1-0000-4000-8000-0000000000d1';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000d2';
const LIB = 'c0c0c0c0-0000-4000-8000-0000000000d3';
const CODIGO = 'prueba-decl-anexo-a';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;
const entrada = (id: string, orden: number): EntradaCatalogo => ({
  libreriaCodigo: CODIGO, libreriaId: LIB, idEstable: id, tipo: 'control', capitulo: null, grupo: 'Organizacionales', titulo: `Control ${id}`, guia: 'Guía de prueba breve.',
  aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }], orden,
});

describe.skipIf(!hayBase)('declaración de aplicabilidad sobre PostgreSQL real', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const unidad = () => crearUnidadDeTrabajoCertificacion(pools.db('app'));
  const permitir: AutorizacionPort = { puede: async () => true };
  const catalogo: CatalogoLecturaPort = { listarEntradasVigentes: async () => [entrada('a27-5-1', 1), entrada('a27-5-2', 2)] };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 12, 15, 0, t++));
  let n = 0;
  const nuevoId = () => `dc000000-0000-4000-8000-${String(Date.now() % 1e6).padStart(6, '0')}${String(++n).padStart(6, '0')}`;
  const evaluar = () => new EvaluarEntradaUseCase(unidad(), permitir, catalogo, reloj);
  const aprobar = () => new AprobarDeclaracionUseCase(unidad(), permitir, catalogo, reloj, nuevoId);
  const borrador = () => new ObtenerDeclaracionUseCase(unidad(), permitir, catalogo, reloj);
  const versiones = () => new ListarVersionesDeclaracionUseCase(unidad(), permitir);
  const version = () => new ObtenerVersionDeclaracionUseCase(unidad(), permitir);
  const exportar = () => new ExportarDeclaracionUseCase(unidad(), permitir, catalogo, new GeneradorDocumentoDocx(), reloj);
  const yo = { empresaId: A, usuarioId: UA };
  const completar = async (empresa: typeof A, usuario: string) => {
    await evaluar().ejecutar({ empresaId: empresa, usuarioId: usuario, libreriaCodigo: CODIGO, idEstable: 'a27-5-1', estado: 'cumple', comentario: 'COMENTARIO-PRIVADO' });
    await evaluar().ejecutar({ empresaId: empresa, usuarioId: usuario, libreriaCodigo: CODIGO, idEstable: 'a27-5-2', estado: 'no_aplica', comentario: 'No hay personal propio' });
  };

  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`delete from declaracion_fila where empresa_id = ${id}`.execute(trx);
      await sql`delete from declaracion_version where empresa_id = ${id}`.execute(trx);
      await sql`delete from evaluacion where empresa_id = ${id}`.execute(trx);
      await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };
  const sembrar = async (id: typeof A, slug: string, usuario: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}) on conflict do nothing`.execute(trx);
    });
  };
  // La bitácora es inmutable: no se limpia. Cada ejecución mide solo los hechos posteriores a este punto de partida.
  let base = '0';
  const hechos = (empresa: typeof A) =>
    conTenant(owner(), empresa, async (trx) =>
      (await sql<{ accion: string; objeto: string; objeto_version: string | null; despues: Record<string, unknown> | null }>`select accion, objeto, objeto_version, despues from bitacora where empresa_id = ${empresa} and id > ${base}::bigint and accion like 'declaracion.%' order by id`.execute(trx)).rows,
    );

  beforeAll(async () => {
    base = (await sql<{ m: string }>`select coalesce(max(id), 0)::text as m from bitacora`.execute(owner())).rows[0]!.m;
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, async (trx) => {
      await sql`delete from libreria where id = ${LIB}`.execute(trx);
      await sql`insert into libreria (id, codigo, nombre, version, hash, es_ejemplo, fuente) values (${LIB}, ${CODIGO}, 'Prueba', '1.0.0', ${'2'.repeat(64)}, true, 'prueba')`.execute(trx);
    });
    await sembrar(A, 'decl-a', UA);
    await sembrar(B, 'decl-b', UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, (trx) => sql`delete from libreria where id = ${LIB}`.execute(trx)).catch(() => undefined);
    await pools.cerrar();
  });

  it('sin evaluar no se puede aprobar y no queda nada', async () => {
    await expect(aprobar().ejecutar(yo)).rejects.toBeInstanceOf(ConflictoError);
    expect(await versiones().ejecutar(yo)).toEqual([]);
    expect(await hechos(A)).toEqual([]);
  });

  it('aprueba, congela las filas y la bitácora lleva solo los conteos', async () => {
    await completar(A, UA);
    const antes = await borrador().ejecutar(yo);
    expect(antes.resumen).toMatchObject({ total: 2, aplican: 1, noAplican: 1, porDecidir: 0, aprobable: true });
    const v = await aprobar().ejecutar(yo);
    expect(v).toMatchObject({ numero: 1, total: 2, aplican: 1, noAplican: 1, aprobadaPor: UA });
    const guardada = await version().ejecutar({ ...yo, id: v.id });
    expect(guardada.filas.map((f) => [f.idEstable, f.aplicabilidad, f.implementacion, f.justificacion])).toEqual([
      ['a27-5-1', 'aplica', 'implementado', null],
      ['a27-5-2', 'no_aplica', null, 'No hay personal propio'],
    ]);
    const h = await hechos(A);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ accion: 'declaracion.aprobada', objeto: 'declaracion:v1', despues: { total: 2, aplican: 1, no_aplican: 1, sin_control: 1 } });
    expect(JSON.stringify(h)).not.toMatch(/COMENTARIO-PRIVADO|No hay personal/);
  });

  it('una segunda aprobación crea la versión 2 y la 1 no cambia aunque el diagnóstico cambie', async () => {
    await evaluar().ejecutar({ empresaId: A, usuarioId: UA, libreriaCodigo: CODIGO, idEstable: 'a27-5-2', estado: 'parcial', versionEsperada: 1 });
    const v2 = await aprobar().ejecutar(yo);
    expect(v2.numero).toBe(2);
    const lista = await versiones().ejecutar(yo);
    expect(lista.map((x) => x.numero)).toEqual([2, 1]);
    const v1 = await version().ejecutar({ ...yo, id: lista[1]!.id });
    expect(v1.filas[1]).toMatchObject({ aplicabilidad: 'no_aplica', justificacion: 'No hay personal propio' });
  });

  it('dos aprobaciones a la vez: una gana y la otra recibe conflicto, sin números repetidos', async () => {
    const r = await Promise.allSettled([aprobar().ejecutar(yo), aprobar().ejecutar(yo)]);
    const ok = r.filter((x) => x.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const x of r) if (x.status === 'rejected') expect(x.reason).toBeInstanceOf(ConflictoError);
    const numeros = (await versiones().ejecutar(yo)).map((x) => x.numero);
    expect(new Set(numeros).size).toBe(numeros.length);
    expect(numeros[0]).toBe(2 + ok.length);
  });

  it('la aplicación no puede modificar ni borrar una versión aprobada', async () => {
    const [v] = await versiones().ejecutar(yo);
    await expect(conTenant(pools.db('app'), A, (trx) => sql`update declaracion_version set total = 99 where id = ${v!.id}`.execute(trx))).rejects.toThrow();
    await expect(conTenant(pools.db('app'), A, (trx) => sql`delete from declaracion_fila where version_id = ${v!.id}`.execute(trx))).rejects.toThrow();
  });

  it('la exportación de una versión sale como Word válido y deja la huella en la bitácora', async () => {
    const [v] = await versiones().ejecutar(yo);
    const x = await exportar().ejecutar({ ...yo, versionId: v!.id });
    const lector = { tamano: x.bytes.length, leer: async (d: number, h: number) => x.bytes.subarray(d, Math.min(h, x.bytes.length)) };
    expect(await detectarTipoArchivo(lector)).toEqual({ ok: true, tipo: x.tipo }); // lo reconoce el mismo detector que protege las subidas
    const h = (await hechos(A)).filter((f) => f.accion === 'declaracion.exportada');
    expect(h.at(-1)).toMatchObject({ objeto: `declaracion:v${v!.numero}`, objeto_version: x.sha256 });
  });

  it('AISLAMIENTO: B no ve versiones de A, ni las lee, ni las exporta', async () => {
    const [v] = await versiones().ejecutar(yo);
    const yoB = { empresaId: B, usuarioId: UB };
    expect(await versiones().ejecutar(yoB)).toEqual([]);
    await expect(version().ejecutar({ ...yoB, id: v!.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(exportar().ejecutar({ ...yoB, versionId: v!.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect((await borrador().ejecutar(yoB)).ultimaVersion).toBeNull();
    // B tiene su propia numeración
    await completar(B, UB);
    expect((await aprobar().ejecutar(yoB)).numero).toBe(1);
  });

  it('AISLAMIENTO: el repositorio, aun con la empresa mal puesta, no cruza datos (RLS)', async () => {
    const [v] = await versiones().ejecutar(yo);
    const lectura = await conTenant(pools.db('app'), B, (trx) => new DeclaracionKysely(trx, B).obtener(v!.id));
    expect(lectura).toBeNull();
    const intento = await conTenant(pools.db('app'), B, (trx) => new DeclaracionKysely(trx, A).obtener(v!.id));
    expect(intento).toBeNull();
  });
});
