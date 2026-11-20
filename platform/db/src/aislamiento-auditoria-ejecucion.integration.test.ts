import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de la ejecución de la auditoría interna (ADR 040): lista, preguntas, hallazgos e informe. Con la
// sesión de A se intenta leer o tocar lo de B y debe fallar. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000f5');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000f6');
const UA = 'a1a1a1a1-0000-4000-8000-0000000000f5';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000f6';
const PRA = 'ca000000-0000-4000-8000-0000000000f5';
const PRB = 'cb000000-0000-4000-8000-0000000000f6';
const GA = 'da000000-0000-4000-8000-0000000000f5';
const GB = 'db000000-0000-4000-8000-0000000000f6';
const AA = 'fa000000-0000-4000-8000-0000000000f5';
const AB = 'fb000000-0000-4000-8000-0000000000f6';
const IA = 'ea000000-0000-4000-8000-0000000000f5';
const IB = 'eb000000-0000-4000-8000-0000000000f6';
const HUELLA = 'a'.repeat(64);

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('aislamiento entre empresas: ejecución de la auditoría interna (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db('app');
  const owner = () => pools.db('owner');
  const TABLAS = [
    'auditoria_informe',
    'hallazgo',
    'auditoria_pregunta',
    'auditoria_item',
    'auditoria',
    'programa_auditoria',
    'proceso',
    'usuario',
  ];

  const sembrar = async (
    id: typeof A,
    slug: string,
    usuario: string,
    proceso: string,
    programa: string,
    auditoria: string,
    item: string,
  ) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into proceso (id, empresa_id, numero, nombre, duena_id, creado_por, actualizado_por)
        values (${proceso}, ${id}, 1, 'Proceso', ${usuario}, ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into programa_auditoria (id, empresa_id, anio, objetivo, creado_por, actualizado_por)
        values (${programa}, ${id}, 2027, 'objetivo', ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into auditoria (id, empresa_id, programa_id, anio, numero, objetivo, inicio, fin, creado_por, actualizado_por)
        values (${auditoria}, ${id}, ${programa}, 2027, 1, 'objetivo', '2027-03-01', '2027-03-05', ${usuario}, ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into auditoria_item (id, empresa_id, auditoria_id, libreria_codigo, libreria_version, id_estable, creado_por, actualizado_por)
        values (${item}, ${id}, ${auditoria}, 'iso-prueba', '1.0.0', 'a27-9-2', ${usuario}, ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into auditoria_pregunta (empresa_id, item_id, texto, creado_por) values (${id}, ${item}, '¿Existe el registro?', ${usuario})`.execute(
        trx,
      );
      await sql`insert into hallazgo (empresa_id, auditoria_id, item_id, numero, tipo, proceso_id, libreria_codigo, id_estable, enunciado, evidencia, registrado_por, creado_por, actualizado_por)
        values (${id}, ${auditoria}, ${item}, 1, 'nc_menor', ${proceso}, 'iso-prueba', 'a27-9-2', 'enunciado', 'evidencia', ${usuario}, ${usuario}, ${usuario})`.execute(
        trx,
      );
      await sql`insert into auditoria_informe (empresa_id, auditoria_id, contenido, huella, emitido_por)
        values (${id}, ${auditoria}, '{}'::jsonb, ${HUELLA}, ${usuario}) on conflict do nothing`.execute(trx);
    });
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const t of TABLAS) await sql`delete from ${sql.table(t)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'ejec-a', UA, PRA, GA, AA, IA);
    await sembrar(B, 'ejec-b', UB, PRB, GB, AB, IB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  // [tabla, columna actualizable (o null si la aplicación no actualiza), valor, inserción en nombre de B]
  const CASOS = [
    [
      'auditoria_item',
      'nota',
      'x',
      sql`insert into auditoria_item (empresa_id, auditoria_id, libreria_codigo, libreria_version, id_estable, creado_por, actualizado_por) values (${B}, ${AB}, 'iso-prueba', '1.0.0', 'a27-9-9', ${UB}, ${UB})`,
    ],
    [
      'auditoria_pregunta',
      null,
      null,
      sql`insert into auditoria_pregunta (empresa_id, item_id, texto, creado_por) values (${B}, ${IB}, 'intruso', ${UB})`,
    ],
    [
      'hallazgo',
      'enunciado',
      'x',
      sql`insert into hallazgo (empresa_id, auditoria_id, numero, tipo, enunciado, evidencia, registrado_por, creado_por, actualizado_por) values (${B}, ${AB}, 9, 'observacion', 'intruso', 'x', ${UB}, ${UB}, ${UB})`,
    ],
    [
      'auditoria_informe',
      null,
      null,
      sql`insert into auditoria_informe (empresa_id, auditoria_id, contenido, huella, emitido_por) values (${B}, ${AB}, '{}'::jsonb, ${HUELLA}, ${UB})`,
    ],
  ] as const;

  for (const [tabla, columna, valor, insertar] of CASOS) {
    describe(tabla, () => {
      it('A solo ve lo suyo', async () => {
        const r = await conTenant(app(), A, (trx) => sql<{ empresa_id: string }>`select empresa_id from ${sql.table(tabla)}`.execute(trx));
        expect(r.rows.map((f) => f.empresa_id)).toEqual([A]);
      });
      it('A no puede leer lo de B ni pidiéndolo por su empresa', async () => {
        const r = await conTenant(app(), A, (trx) => sql`select 1 from ${sql.table(tabla)} where empresa_id = ${B}`.execute(trx));
        expect(r.rows).toEqual([]);
      });
      it('A no puede modificar lo de B', async () => {
        if (columna === null) {
          await expect(
            conTenant(app(), A, (trx) => sql`update ${sql.table(tabla)} set creado_por = ${UA} where empresa_id = ${B}`.execute(trx)),
          ).rejects.toThrow(); // sin UPDATE
          return;
        }
        const r = await conTenant(app(), A, (trx) =>
          sql`update ${sql.table(tabla)} set ${sql.ref(columna)} = ${valor} where empresa_id = ${B}`.execute(trx),
        );
        expect(r.numAffectedRows ?? 0n).toBe(0n); // la RLS no deja ver las filas de B
        const visto = await conTenant(app(), B, (trx) =>
          sql<{ v: string | null }>`select ${sql.ref(columna)}::text as v from ${sql.table(tabla)}`.execute(trx),
        );
        expect(visto.rows[0]?.v).not.toBe(valor);
      });
      it('A no puede insertar en nombre de B', async () => {
        await expect(conTenant(app(), A, (trx) => insertar.execute(trx))).rejects.toThrow();
      });
      it('sin empresa en el contexto no se lee nada (falla)', async () => {
        await expect(
          app()
            .selectFrom(tabla as never)
            .selectAll()
            .execute(),
        ).rejects.toThrow();
      });
    });
  }

  it('A no puede borrar preguntas ni filas de B (la RLS no las deja ver); hallazgos e informes no se borran (sin DELETE)', async () => {
    for (const t of ['auditoria_pregunta', 'auditoria_item']) {
      const r = await conTenant(app(), A, (trx) => sql`delete from ${sql.table(t)} where empresa_id = ${B}`.execute(trx));
      expect(r.numAffectedRows ?? 0n).toBe(0n);
    }
    for (const t of ['hallazgo', 'auditoria_informe'])
      await expect(conTenant(app(), A, (trx) => sql`delete from ${sql.table(t)} where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
  });

  it('un dato de A no puede apuntar a una auditoría, una fila, un proceso ni una persona de B (clave foránea compuesta)', async () => {
    const malas = [
      sql`insert into auditoria_item (empresa_id, auditoria_id, libreria_codigo, libreria_version, id_estable, creado_por, actualizado_por) values (${A}, ${AB}, 'iso-prueba', '1.0.0', 'a27-8-8', ${UA}, ${UA})`,
      sql`insert into auditoria_pregunta (empresa_id, item_id, texto, creado_por) values (${A}, ${IB}, 'x', ${UA})`,
      sql`insert into hallazgo (empresa_id, auditoria_id, numero, tipo, proceso_id, enunciado, evidencia, registrado_por, creado_por, actualizado_por) values (${A}, ${AA}, 7, 'observacion', ${PRB}, 'x', 'x', ${UA}, ${UA}, ${UA})`,
      sql`insert into hallazgo (empresa_id, auditoria_id, item_id, numero, tipo, enunciado, evidencia, registrado_por, creado_por, actualizado_por) values (${A}, ${AA}, ${IB}, 6, 'observacion', 'x', 'x', ${UA}, ${UA}, ${UA})`,
      sql`insert into hallazgo (empresa_id, auditoria_id, numero, tipo, enunciado, evidencia, registrado_por, creado_por, actualizado_por) values (${A}, ${AA}, 5, 'observacion', 'x', 'x', ${UB}, ${UA}, ${UA})`,
    ];
    for (const m of malas) await expect(conTenant(owner(), A, (trx) => m.execute(trx))).rejects.toThrow();
  });

  it('las reglas de la base: la NC exige proceso y requisito, la NC mayor su justificación, y un resultado distinto de «conforme» exige nota', async () => {
    const malas = [
      sql`insert into hallazgo (empresa_id, auditoria_id, numero, tipo, enunciado, evidencia, registrado_por, creado_por, actualizado_por) values (${A}, ${AA}, 4, 'nc_menor', 'x', 'x', ${UA}, ${UA}, ${UA})`,
      sql`insert into hallazgo (empresa_id, auditoria_id, numero, tipo, proceso_id, libreria_codigo, id_estable, enunciado, evidencia, registrado_por, creado_por, actualizado_por) values (${A}, ${AA}, 3, 'nc_mayor', ${PRA}, 'iso-prueba', 'a27-9-2', 'x', 'x', ${UA}, ${UA}, ${UA})`,
      sql`update auditoria_item set resultado = 'no_conforme', evaluado_por = ${UA}, evaluado_en = now() where id = ${IA}`,
    ];
    for (const m of malas) await expect(conTenant(app(), A, (trx) => m.execute(trx))).rejects.toThrow();
    await conTenant(app(), A, (trx) =>
      sql`update auditoria_item set resultado = 'no_conforme', nota = 'no se encontró el registro', evaluado_por = ${UA}, evaluado_en = now() where id = ${IA}`.execute(
        trx,
      ),
    );
  });
});
