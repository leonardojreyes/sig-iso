import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AprobarAlcanceUseCase, GuardarAlcanceUseCase, ListarAlcancesUseCase } from '../application/alcance.use-cases.js';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../application/catalogo-lectura.port.js';
import { ConflictoDeVersionError } from '../application/errores.js';
import { EvaluarEntradaUseCase } from '../application/evaluar-entrada.use-case.js';
import { ListarDiagnosticoUseCase } from '../application/listar-diagnostico.use-case.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real: flujo de evaluación y de alcance, bitácora persistida, conflicto de versión y AISLAMIENTO entre empresas (regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000c1');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000c2');
const UA = 'a1a1a1a1-0000-4000-8000-0000000000c1';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000c2';
const LIB = 'c0c0c0c0-0000-4000-8000-0000000000c3';
const CODIGO = 'prueba-cert-anexo-a';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;
const entrada = (id: string, grupo = 'Organizacionales'): EntradaCatalogo => ({
  libreriaCodigo: CODIGO, libreriaId: LIB, idEstable: id, tipo: 'control', capitulo: null, grupo, titulo: `Control ${id}`, guia: 'Guía de prueba breve.',
  aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }], orden: 1,
});

describe.skipIf(!hayBase)('certificación sobre PostgreSQL real: alcance y diagnóstico', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 6 });
  const owner = () => pools.db('owner');
  const unidad = () => crearUnidadDeTrabajoCertificacion(pools.db('app'));
  const permitir: AutorizacionPort = { puede: async () => true };
  const catalogo: CatalogoLecturaPort = { listarEntradasVigentes: async () => [entrada('a27-5-1'), entrada('a27-5-2')] };
  const reloj = () => new Date('2026-11-10T12:00:00Z');
  const evaluar = () => new EvaluarEntradaUseCase(unidad(), permitir, catalogo, reloj);
  const listar = () => new ListarDiagnosticoUseCase(unidad(), permitir, catalogo);
  const guardar = () => new GuardarAlcanceUseCase(unidad(), permitir, catalogo, reloj);
  const aprobar = () => new AprobarAlcanceUseCase(unidad(), permitir, catalogo, reloj);
  const alcances = () => new ListarAlcancesUseCase(unidad(), permitir, catalogo);

  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`delete from evaluacion where empresa_id = ${id}`.execute(trx);
      await sql`delete from alcance where empresa_id = ${id}`.execute(trx);
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
  const hechos = (empresa: typeof A) =>
    conTenant(owner(), empresa, async (trx) => (await sql<{ accion: string; usuario_id: string; despues: unknown; antes: unknown }>`select accion, usuario_id, antes, despues from bitacora where empresa_id = ${empresa} and accion in ('evaluacion.cambiada','alcance.cambiado','alcance.aprobado') order by id`.execute(trx)).rows);

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, async (trx) => {
      await sql`delete from libreria where id = ${LIB}`.execute(trx);
      await sql`insert into libreria (id, codigo, nombre, version, hash, es_ejemplo, fuente) values (${LIB}, ${CODIGO}, 'Prueba', '1.0.0', ${'1'.repeat(64)}, true, 'prueba')`.execute(trx);
    });
    await sembrar(A, 'cert-a', UA);
    await sembrar(B, 'cert-b', UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, (trx) => sql`delete from libreria where id = ${LIB}`.execute(trx)).catch(() => undefined);
    await pools.cerrar();
  });

  it('evalúa, vuelve a evaluar con la versión vista y guarda el hecho en la bitácora (sin el comentario)', async () => {
    const r1 = await evaluar().ejecutar({ empresaId: A, usuarioId: UA, libreriaCodigo: CODIGO, idEstable: 'a27-5-1', estado: 'parcial', comentario: 'COMENTARIO-PRIVADO', fechaObjetivo: '2026-12-31' });
    expect(r1).toMatchObject({ estado: 'parcial', version: 1, fechaObjetivo: '2026-12-31' });
    const r2 = await evaluar().ejecutar({ empresaId: A, usuarioId: UA, libreriaCodigo: CODIGO, idEstable: 'a27-5-1', estado: 'cumple', versionEsperada: 1 });
    expect(r2.version).toBe(2);
    const h = await hechos(A);
    expect(h.filter((x) => x.accion === 'evaluacion.cambiada')).toHaveLength(2);
    expect(JSON.stringify(h)).not.toContain('COMENTARIO-PRIVADO');
    expect(h.at(-1)).toMatchObject({ usuario_id: UA, antes: { estado: 'parcial' }, despues: { estado: 'cumple' } });
  });

  it('un conflicto de versión real (versión vieja) no pisa lo guardado', async () => {
    await expect(evaluar().ejecutar({ empresaId: A, usuarioId: UA, libreriaCodigo: CODIGO, idEstable: 'a27-5-1', estado: 'no_cumple', versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    const d = await listar().ejecutar({ empresaId: A, usuarioId: UA });
    expect(d.filas.find((f) => f.idEstable === 'a27-5-1')!.evaluacion).toMatchObject({ estado: 'cumple', version: 2 });
  });

  it('dos escrituras simultáneas sobre la misma versión: una gana y la otra recibe el conflicto', async () => {
    const intento = (estado: 'cumple' | 'no_cumple') => evaluar().ejecutar({ empresaId: A, usuarioId: UA, libreriaCodigo: CODIGO, idEstable: 'a27-5-2', estado });
    const r = await Promise.allSettled([intento('cumple'), intento('no_cumple')]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(r.filter((x) => x.status === 'rejected').map((x) => (x as PromiseRejectedResult).reason)[0]).toBeInstanceOf(ConflictoDeVersionError);
  });

  it('el diagnóstico devuelve la madurez con lo guardado', async () => {
    const d = await listar().ejecutar({ empresaId: A, usuarioId: UA, norma: 'ISO/IEC 27001' });
    expect(d.madurez.porNorma['ISO/IEC 27001']).toMatchObject({ total: 2, sinEvaluar: 0 });
    expect(d.madurez.porAgrupador).toEqual([expect.objectContaining({ tipo: 'tema', clave: 'Organizacionales' })]);
  });

  it('alcance: se define, se aprueba (quién y cuándo) y cambiarlo quita la aprobación; todo queda en la bitácora', async () => {
    await guardar().ejecutar({ empresaId: A, usuarioId: UA, norma: 'ISO/IEC 27001', texto: 'TEXTO-PRIVADO del alcance' });
    const ap = await aprobar().ejecutar({ empresaId: A, usuarioId: UA, norma: 'ISO/IEC 27001' });
    expect(ap).toMatchObject({ aprobado: true, aprobadoEn: '2026-11-10T12:00:00.000Z' });
    const camb = await guardar().ejecutar({ empresaId: A, usuarioId: UA, norma: 'ISO/IEC 27001', texto: 'Otro texto' });
    expect(camb.aprobado).toBe(false);
    const h = await hechos(A);
    expect(h.map((x) => x.accion).filter((a) => a.startsWith('alcance'))).toEqual(['alcance.cambiado', 'alcance.aprobado', 'alcance.cambiado']);
    expect(JSON.stringify(h)).not.toContain('TEXTO-PRIVADO');
  });

  it('AISLAMIENTO: B no ve lo evaluado ni el alcance de A, y lo suyo es aparte', async () => {
    const deB = await listar().ejecutar({ empresaId: B, usuarioId: UB });
    expect(deB.filas.every((f) => f.evaluacion === null)).toBe(true);
    expect((await alcances().ejecutar({ empresaId: B, usuarioId: UB })).every((a) => a.texto === null)).toBe(true);
    await evaluar().ejecutar({ empresaId: B, usuarioId: UB, libreriaCodigo: CODIGO, idEstable: 'a27-5-1', estado: 'no_cumple' });
    const deA = await listar().ejecutar({ empresaId: A, usuarioId: UA });
    expect(deA.filas.find((f) => f.idEstable === 'a27-5-1')!.evaluacion).toMatchObject({ estado: 'cumple', version: 2 });
    expect(await hechos(B)).toHaveLength(1);
  });

  it('una persona de A no puede quedar como autora en B (la clave foránea compuesta lo impide)', async () => {
    await expect(conTenant(owner(), B, (trx) => sql`insert into alcance (empresa_id, norma, texto, actualizado_por) values (${B}, 'ISO 9001', 'x', ${UA})`.execute(trx))).rejects.toThrow();
  });
});
