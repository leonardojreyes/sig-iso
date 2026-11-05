import { randomBytes } from 'node:crypto';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';

// AISLAMIENTO SOBRE UN CATÁLOGO GLOBAL: la librería es de todos, pero sus entradas solo las ve quien la adoptó.
// Empresas C y D (distintas de las de aislamiento.integration.test.ts: los archivos de prueba corren en paralelo).
const C = crearEmpresaId('cccccccc-0000-4000-8000-00000000000c');
const D = crearEmpresaId('dddddddd-0000-4000-8000-00000000000d');
const USUARIO_C = 'c1c1c1c1-0000-4000-8000-0000000000c1';
const USUARIO_D = 'd1d1d1d1-0000-4000-8000-0000000000d1';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('aislamiento entre empresas: catálogo y adopción (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db('app');
  const owner = () => pools.db('owner');
  const catalogo = () => pools.db('catalogo');
  const hex = () => randomBytes(32).toString('hex');
  const sufijo = randomBytes(3).toString('hex');

  // Dos librerías de prueba (propias de esta ejecución). La L1 la adopta C; la L2 no la adopta nadie.
  let L1 = '';
  let L2 = '';
  let ENTRADA_L1 = '';
  let ENTRADA_L2 = '';

  const crearLibreria = async (codigo: string, entradaId: string) => {
    const lib = await sql<{ id: string }>`insert into libreria (codigo, nombre, version, hash, es_ejemplo, fuente)
      values (${codigo}, ${'Librería ' + codigo}, '1.0.0', ${hex()}, true, 'elaboración propia SynapTech') returning id`.execute(catalogo());
    const libreriaId = lib.rows[0]!.id;
    const e = await sql<{ id: string }>`insert into libreria_entrada (libreria_id, id_estable, capitulo, nivel, titulo, guia, alcance_comun, orden)
      values (${libreriaId}, ${entradaId}, 4, 1, 'Contexto de la organización', 'Identifica los factores que afectan lo que el sistema busca lograr.', 'comun', 1) returning id`.execute(catalogo());
    const eid = e.rows[0]!.id;
    await sql`insert into libreria_entrada_norma (entrada_id, libreria_id, norma, edicion, clausula) values (${eid}, ${libreriaId}, 'ISO 9001', '2015', '4.1')`.execute(catalogo());
    await sql`insert into libreria_entrada_norma (entrada_id, libreria_id, norma, edicion, clausula) values (${eid}, ${libreriaId}, 'ISO/IEC 27001', '2022', '4.1')`.execute(catalogo());
    return { libreriaId, entradaId: eid };
  };

  const sembrarEmpresa = async (id: typeof C, slug: string, usuario: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}) on conflict do nothing`.execute(trx);
    });
  };

  // Orden que tolera datos sobrantes de ejecuciones anteriores: primero TODAS las adopciones (una fila de una empresa puede
  // apuntar a un usuario de otra si una ejecución previa falló), luego usuarios y empresas.
  const limpiarEmpresas = async () => {
    for (const id of [C, D]) {
      await conTenant(owner(), id, (trx) => sql`delete from empresa_libreria where empresa_id = ${id}`.execute(trx));
    }
    for (const id of [C, D]) {
      await conTenant(owner(), id, async (trx) => {
        await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
        await sql`delete from empresa where id = ${id}`.execute(trx);
      });
    }
  };

  const limpiarLibrerias = async () => {
    // Solo las librerías que crea esta prueba (código `prueba-uno|dos-<6 hex>`), incluidas las de ejecuciones anteriores fallidas.
    const patron = '^prueba-(uno|dos)-[0-9a-f]{6}$';
    await sql`delete from libreria_entrada_norma where libreria_id in (select id from libreria where codigo ~ ${patron})`.execute(owner());
    await sql`delete from libreria_entrada where libreria_id in (select id from libreria where codigo ~ ${patron})`.execute(owner());
    await sql`delete from libreria where codigo ~ ${patron}`.execute(owner());
  };

  beforeAll(async () => {
    await limpiarEmpresas();
    await limpiarLibrerias();
    await sembrarEmpresa(C, 'prueba-c', USUARIO_C);
    await sembrarEmpresa(D, 'prueba-d', USUARIO_D);
    const l1 = await crearLibreria(`prueba-uno-${sufijo}`, 'ha-4.1');
    const l2 = await crearLibreria(`prueba-dos-${sufijo}`, 'ha-4.1');
    L1 = l1.libreriaId;
    ENTRADA_L1 = l1.entradaId;
    L2 = l2.libreriaId;
    ENTRADA_L2 = l2.entradaId;
    // C adopta la L1.
    await conTenant(app(), C, (trx) => sql`insert into empresa_libreria (empresa_id, libreria_id, adoptada_por) values (${C}, ${L1}, ${USUARIO_C})`.execute(trx));
  });

  afterAll(async () => {
    await limpiarEmpresas();
    await limpiarLibrerias();
    await pools.cerrar();
  });

  const propias = (rows: { libreria_id: string }[]) => rows.filter((r) => r.libreria_id === L1 || r.libreria_id === L2);

  describe('metadatos: el catálogo es global', () => {
    it('cualquier empresa ve las librerías disponibles, con o sin adopción', async () => {
      for (const id of [C, D]) {
        const r = await conTenant(app(), id, (trx) => sql<{ id: string }>`select id from libreria where id in (${L1}, ${L2})`.execute(trx));
        expect(r.rows.map((f) => f.id).sort()).toEqual([L1, L2].sort());
      }
    });
  });

  describe('entradas: solo para quien adoptó la librería', () => {
    it('C, que adoptó la L1, ve sus entradas y sus normas', async () => {
      const e = await conTenant(app(), C, (trx) => sql<{ libreria_id: string }>`select libreria_id from libreria_entrada where libreria_id in (${L1}, ${L2})`.execute(trx));
      expect(propias(e.rows)).toHaveLength(1);
      expect(e.rows[0]?.libreria_id).toBe(L1);
      const n = await conTenant(app(), C, (trx) => sql<{ norma: string }>`select norma from libreria_entrada_norma where libreria_id = ${L1} order by norma`.execute(trx));
      expect(n.rows.map((f) => f.norma)).toEqual(['ISO 9001', 'ISO/IEC 27001']);
    });

    it('C no ve las entradas de la L2, que existe pero no adoptó', async () => {
      const r = await conTenant(app(), C, (trx) => sql`select id from libreria_entrada where libreria_id = ${L2}`.execute(trx));
      expect(r.rows).toEqual([]);
    });

    it('D, que no adoptó nada, no ve ninguna entrada ni norma de la L1', async () => {
      const e = await conTenant(app(), D, (trx) => sql`select id from libreria_entrada where libreria_id in (${L1}, ${L2})`.execute(trx));
      expect(e.rows).toEqual([]);
      const n = await conTenant(app(), D, (trx) => sql`select entrada_id from libreria_entrada_norma where libreria_id in (${L1}, ${L2})`.execute(trx));
      expect(n.rows).toEqual([]);
    });

    it('D no puede leer una entrada de la L1 pidiéndola por su id', async () => {
      const r = await conTenant(app(), D, (trx) => sql`select id from libreria_entrada where id = ${ENTRADA_L1}`.execute(trx));
      expect(r.rows).toEqual([]);
      const n = await conTenant(app(), D, (trx) => sql`select entrada_id from libreria_entrada_norma where entrada_id = ${ENTRADA_L1}`.execute(trx));
      expect(n.rows).toEqual([]);
    });

    it('al adoptar D la L1, D pasa a ver sus entradas (y la L2 sigue oculta)', async () => {
      await conTenant(app(), D, (trx) => sql`insert into empresa_libreria (empresa_id, libreria_id, adoptada_por) values (${D}, ${L1}, ${USUARIO_D})`.execute(trx));
      const e = await conTenant(app(), D, (trx) => sql<{ id: string }>`select id from libreria_entrada where id in (${ENTRADA_L1}, ${ENTRADA_L2})`.execute(trx));
      expect(e.rows.map((f) => f.id)).toEqual([ENTRADA_L1]);
      await conTenant(owner(), D, (trx) => sql`delete from empresa_libreria where empresa_id = ${D}`.execute(trx));
    });
  });

  describe('adopciones: cada empresa ve y crea solo las suyas', () => {
    it('C ve su adopción; D no ve la de C', async () => {
      const c = await conTenant(app(), C, (trx) => sql<{ libreria_id: string }>`select libreria_id from empresa_libreria`.execute(trx));
      expect(c.rows.map((f) => f.libreria_id)).toEqual([L1]);
      const d = await conTenant(app(), D, (trx) => sql`select libreria_id from empresa_libreria where empresa_id = ${C}`.execute(trx));
      expect(d.rows).toEqual([]);
    });

    it('C no puede adoptar una librería en nombre de D', async () => {
      await expect(conTenant(app(), C, (trx) => sql`insert into empresa_libreria (empresa_id, libreria_id, adoptada_por) values (${D}, ${L2}, ${USUARIO_C})`.execute(trx))).rejects.toThrow(/row-level security/i);
    });

    it('adoptar dos veces la misma librería falla (clave primaria)', async () => {
      await expect(conTenant(app(), C, (trx) => sql`insert into empresa_libreria (empresa_id, libreria_id, adoptada_por) values (${C}, ${L1}, ${USUARIO_C})`.execute(trx))).rejects.toThrow(/duplicate key|unique/i);
    });

    it('no hay "desadopción": la aplicación no puede borrar ni modificar adopciones', async () => {
      await expect(conTenant(app(), C, (trx) => sql`delete from empresa_libreria where libreria_id = ${L1}`.execute(trx))).rejects.toThrow(/permission denied/i);
      await expect(conTenant(app(), C, (trx) => sql`update empresa_libreria set adoptada_por = ${USUARIO_C}`.execute(trx))).rejects.toThrow(/permission denied/i);
    });
  });

  describe('sin empresa o sin permiso', () => {
    it('consultar entradas o adopciones sin empresa falla', async () => {
      await expect(sql`select * from libreria_entrada`.execute(app())).rejects.toThrow(/app\.tenant_id/);
      await expect(sql`select * from empresa_libreria`.execute(app())).rejects.toThrow(/app\.tenant_id/);
    });

    it('la aplicación no puede escribir en el catálogo', async () => {
      await expect(conTenant(app(), C, (trx) => sql`insert into libreria (codigo, nombre, version, hash, es_ejemplo, fuente) values ('x', 'x', '1.0.0', ${hex()}, true, 'x')`.execute(trx))).rejects.toThrow(/permission denied/i);
      await expect(conTenant(app(), C, (trx) => sql`update libreria_entrada set titulo = 'Hackeado'`.execute(trx))).rejects.toThrow(/permission denied/i);
      await expect(conTenant(app(), C, (trx) => sql`delete from libreria_entrada`.execute(trx))).rejects.toThrow(/permission denied/i);
    });

    it('el rol del catálogo carga y lee, pero no modifica ni borra, y no toca datos de empresas', async () => {
      const r = await sql<{ n: number }>`select count(*)::int as n from libreria_entrada where libreria_id in (${L1}, ${L2})`.execute(catalogo());
      expect(r.rows[0]?.n).toBe(2);
      await expect(sql`update libreria_entrada set titulo = 'x'`.execute(catalogo())).rejects.toThrow(/permission denied/i);
      await expect(sql`delete from libreria_entrada`.execute(catalogo())).rejects.toThrow(/permission denied/i);
      for (const tabla of ['empresa', 'usuario', 'empresa_libreria']) {
        await expect(conTenant(catalogo(), C, (trx) => sql`select * from ${sql.table(tabla)}`.execute(trx))).rejects.toThrow(/permission denied/i);
      }
    });

    it('el rol de plataforma no accede al catálogo ni a las adopciones', async () => {
      for (const tabla of ['libreria', 'libreria_entrada', 'libreria_entrada_norma', 'empresa_libreria']) {
        await expect(conTenant(pools.db('plataforma'), C, (trx) => sql`select * from ${sql.table(tabla)}`.execute(trx))).rejects.toThrow(/permission denied/i);
      }
    });
  });

  describe('el catálogo se protege también en la base de datos', () => {
    it('no se puede publicar dos veces la misma versión de una librería', async () => {
      await expect(
        sql`insert into libreria (codigo, nombre, version, hash, es_ejemplo, fuente) values (${`prueba-uno-${sufijo}`}, 'otra', '1.0.0', ${hex()}, true, 'x')`.execute(catalogo()),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it.each([
      ['capítulo fuera de 4 a 10', `capitulo = 3`],
      ['guía de más de 280 caracteres', `guia = repeat('x', 281)`],
      ['título de más de 80 caracteres', `titulo = repeat('x', 81)`],
      ['alcance desconocido', `alcance_comun = 'otro'`],
    ])('rechaza una entrada con %s', async (_nombre, cambio) => {
      // Se parte de una entrada válida y se invalida un campo: el límite lo impone la base, no solo la aplicación.
      const columnas: Record<string, string> = { capitulo: '4', titulo: `'Título válido'`, guia: `'Una guía propia de prueba.'`, alcance_comun: `'comun'` };
      const [col, val] = cambio.split(' = ') as [string, string];
      columnas[col] = val;
      await expect(
        sql
          .raw(
            `insert into libreria_entrada (libreria_id, id_estable, capitulo, nivel, titulo, guia, alcance_comun, orden) values ('${L2}', 'x-${randomBytes(2).toString('hex')}', ${columnas.capitulo}, 1, ${columnas.titulo}, ${columnas.guia}, ${columnas.alcance_comun}, 9)`,
          )
          .execute(catalogo()),
      ).rejects.toThrow(/violates check constraint/i);
    });

    it('las tablas con datos por empresa tienen RLS activa y forzada', async () => {
      const r = await sql<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>`select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('libreria_entrada', 'libreria_entrada_norma', 'empresa_libreria')`.execute(owner());
      expect(r.rows).toHaveLength(3);
      for (const f of r.rows) expect([f.relname, f.relrowsecurity, f.relforcerowsecurity]).toEqual([f.relname, true, true]);
    });
  });
});
