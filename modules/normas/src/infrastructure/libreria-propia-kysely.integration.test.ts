import { randomBytes, randomUUID } from 'node:crypto';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { stringify } from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdoptarLibreriaUseCase } from '../application/adoptar-libreria.use-case.js';
import { CargarLibreriaUseCase } from '../application/cargar-libreria.use-case.js';
import { ListarLibreriasUseCase } from '../application/listar-librerias.use-case.js';
import { ListarRequisitosUseCase } from '../application/listar-requisitos.use-case.js';
import { LectorLibreriaYaml } from './lector-libreria-yaml.adapter.js';
import { crearUnidadDeTrabajoCarga, crearUnidadDeTrabajoNormas } from './unidad-de-trabajo-normas.js';

// Carga de una librería PROPIA con PostgreSQL real y dos empresas: lo que sube A solo lo ve y adopta A; B no la ve, y el mismo
// código en B es otra librería. Cada ejecución usa empresas, usuarios y códigos propios (la bitácora no se puede borrar).
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('carga de librerías propias (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const sufijo = randomBytes(3).toString('hex');
  const CODIGO = `propia-t-${sufijo}`;
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const UA = randomUUID();
  const UB = randomUUID();
  const permiso = { puede: async () => true };
  // Perezoso: `describe.skipIf` ejecuta igual el cuerpo sin base.
  const cargar = () => new CargarLibreriaUseCase(crearUnidadDeTrabajoCarga(pools.db('app')), permiso, new LectorLibreriaYaml());
  const adoptar = () => new AdoptarLibreriaUseCase(crearUnidadDeTrabajoNormas(pools.db('app')), permiso);
  const listar = () => new ListarLibreriasUseCase(crearUnidadDeTrabajoNormas(pools.db('app')));
  const requisitos = () => new ListarRequisitosUseCase(crearUnidadDeTrabajoNormas(pools.db('app')));

  const yaml = (cambio: Record<string, unknown> = {}) =>
    new TextEncoder().encode(
      stringify({
        esquema: 3,
        codigo: CODIGO,
        nombre: 'Librería propia de prueba',
        version: '1.0.0',
        es_ejemplo: false,
        fuente: 'elaboración propia de la empresa',
        referencias: [{ norma: 'Norma X', edicion: '2022' }],
        entradas: [
          { id: 'x-4.1', capitulo: 4, nivel: 1, titulo: 'Primer tema de prueba', guia: 'Texto sintético de prueba, sin relación con ninguna norma.', alcance_comun: 'comun', aplica_a: [{ norma: 'Norma X', edicion: '2022', clausula: '4.1' }] },
          { id: 'x-4.2', capitulo: 4, nivel: 1, titulo: 'Segundo tema de prueba', guia: 'Otro texto sintético de prueba, también sin relación con norma alguna.', alcance_comun: 'comun', aplica_a: [{ norma: 'Norma X', edicion: '2022', clausula: '4.2' }] },
        ],
        ...cambio,
      }),
    );
  const filas = async <T = Record<string, unknown>>(empresa: typeof A, consulta: ReturnType<typeof sql<T>>) => (await conTenant(owner(), empresa, (trx) => consulta.execute(trx))).rows;

  beforeAll(async () => {
    for (const [id, n, u] of [[A, 'a', UA], [B, 'b', UB]] as const) {
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${`lp-${sufijo}-${n}`}, ${`Empresa ${n}`}, '#0b5fff')`.execute(trx);
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${u}, ${id}, ${`Persona ${n}`}, ${`${u}@example.test`})`.execute(trx);
      });
    }
  });
  afterAll(async () => {
    for (const e of [A, B]) {
      await conTenant(owner(), e, async (trx) => {
        await sql`delete from empresa_libreria where empresa_id = ${e}`.execute(trx);
        await sql`delete from libreria_entrada_norma where libreria_id in (select id from libreria where empresa_id = ${e})`.execute(trx);
        await sql`delete from libreria_entrada where libreria_id in (select id from libreria where empresa_id = ${e})`.execute(trx);
        await sql`delete from libreria where empresa_id = ${e}`.execute(trx);
      });
    }
    for (const [e, u] of [[A, UA], [B, UB]] as const) {
      await conTenant(owner(), e, async (trx) => {
        await sql`delete from usuario where id = ${u}`.execute(trx);
        await sql`delete from empresa where id = ${e}`.execute(trx);
      });
    }
    await pools.cerrar();
  });

  it('A sube la librería: queda con sus entradas y normas, y el hecho en la bitácora', async () => {
    const r = await cargar().ejecutar({ empresaId: A, usuarioId: UA, contenido: yaml() });
    expect(r).toMatchObject({ estado: 'cargada', codigo: CODIGO, entradas: 2 });
    const lib = await filas(A, sql`select empresa_id, es_ejemplo, hash from libreria where empresa_id = ${A} and codigo = ${CODIGO}`);
    expect(lib).toEqual([{ empresa_id: A, es_ejemplo: false, hash: r.huella }]);
    expect((await filas(A, sql`select count(*)::int as n from libreria_entrada e join libreria l on l.id = e.libreria_id where l.empresa_id = ${A} and l.codigo = ${CODIGO}`))[0]).toEqual({ n: 2 });
    expect((await filas(A, sql`select count(*)::int as n from libreria_entrada_norma n join libreria l on l.id = n.libreria_id where l.empresa_id = ${A} and l.codigo = ${CODIGO}`))[0]).toEqual({ n: 2 });
    const hechos = await filas(A, sql`select resultado, objeto, objeto_version from bitacora where empresa_id = ${A} and accion = 'libreria.cargada'`);
    expect(hechos).toEqual([{ resultado: 'ok', objeto: `libreria:${CODIGO}`, objeto_version: r.huella }]);
  });

  it('volver a subir lo mismo es «ya cargada» y no duplica nada', async () => {
    const r = await cargar().ejecutar({ empresaId: A, usuarioId: UA, contenido: yaml() });
    expect(r.estado).toBe('ya_cargada');
    expect((await filas(A, sql`select count(*)::int as n from libreria where empresa_id = ${A} and codigo = ${CODIGO}`))[0]).toEqual({ n: 1 });
  });

  it('la misma versión con otro contenido se rechaza y no cambia lo guardado', async () => {
    const antes = (await filas(A, sql`select hash from libreria where empresa_id = ${A} and codigo = ${CODIGO}`))[0];
    const r = await cargar().ejecutar({ empresaId: A, usuarioId: UA, contenido: yaml({ nombre: 'Cambiada' }) });
    expect(r).toMatchObject({ estado: 'rechazada', motivo: 'hash_distinto' });
    expect((await filas(A, sql`select hash from libreria where empresa_id = ${A} and codigo = ${CODIGO}`))[0]).toEqual(antes);
  });

  it('una versión nueva (1.1.0) es otra fila', async () => {
    const r = await cargar().ejecutar({ empresaId: A, usuarioId: UA, contenido: yaml({ version: '1.1.0' }) });
    expect(r.estado).toBe('cargada');
  });

  it('B no ve la librería de A: ni en el listado ni por su id; el mismo código en B es otra librería', async () => {
    const deB = await listar().ejecutar(B);
    expect(deB.map((l) => l.codigo)).not.toContain(CODIGO);
    const idA = (await filas(A, sql<{ id: string }>`select id from libreria where empresa_id = ${A} and codigo = ${CODIGO} and version = '1.0.0'`))[0]!.id;
    await expect(adoptar().ejecutar({ empresaId: B, usuarioId: UB, libreriaId: idA })).rejects.toThrow();
    const r = await cargar().ejecutar({ empresaId: B, usuarioId: UB, contenido: yaml({ nombre: 'La de B' }) });
    expect(r.estado).toBe('cargada');
    expect((await filas(B, sql`select count(*)::int as n from libreria where empresa_id = ${B} and codigo = ${CODIGO}`))[0]).toEqual({ n: 1 });
  });

  it('A la adopta y ve sus requisitos; B sigue sin verlos', async () => {
    const idA = (await filas(A, sql<{ id: string }>`select id from libreria where empresa_id = ${A} and codigo = ${CODIGO} and version = '1.0.0'`))[0]!.id;
    const adopcion = await adoptar().ejecutar({ empresaId: A, usuarioId: UA, libreriaId: idA });
    expect(adopcion).toMatchObject({ entradas: 2, yaAdoptada: false });
    expect((await requisitos().ejecutar({ empresaId: A })).length).toBeGreaterThanOrEqual(2);
    expect((await requisitos().ejecutar({ empresaId: B })).filter((e) => e.libreriaId === idA)).toEqual([]);
  });

  it('un archivo rechazado deja el hecho con la huella y sin contenido, y no guarda nada', async () => {
    const r = await cargar().ejecutar({ empresaId: A, usuarioId: UA, contenido: yaml({ codigo: 'sin-prefijo' }) });
    expect(r).toMatchObject({ estado: 'rechazada', motivo: 'codigo_no_permitido' });
    expect((await filas(A, sql`select 1 from libreria where codigo = 'sin-prefijo'`)).length).toBe(0);
    const hechos = await filas(A, sql`select motivo, objeto, objeto_version from bitacora where empresa_id = ${A} and accion = 'libreria.cargada' and resultado = 'rechazado' and motivo = 'codigo_no_permitido'`);
    expect(hechos).toEqual([{ motivo: 'codigo_no_permitido', objeto: 'libreria:archivo', objeto_version: r.huella }]);
  });

  it('dos cargas simultáneas de lo mismo: una gana y la otra es «ya cargada» (sin error)', async () => {
    const contenido = yaml({ version: '3.0.0' });
    const rs = await Promise.all([cargar().ejecutar({ empresaId: A, usuarioId: UA, contenido }), cargar().ejecutar({ empresaId: A, usuarioId: UA, contenido })]);
    expect(rs.map((r) => r.estado).sort()).toEqual(['cargada', 'ya_cargada']);
    expect((await filas(A, sql`select count(*)::int as n from libreria where empresa_id = ${A} and codigo = ${CODIGO} and version = '3.0.0'`))[0]).toEqual({ n: 1 });
  });
});
