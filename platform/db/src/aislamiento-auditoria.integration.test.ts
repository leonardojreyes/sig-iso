import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';

// AISLAMIENTO ENTRE EMPRESAS (regla 2) del programa y las auditorías internas (ADR 040): con la sesión de A se intenta leer o tocar
// lo de B y debe fallar. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000f3');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000f4');
const UA = 'a1a1a1a1-0000-4000-8000-0000000000f3';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000f4';
const PRA = 'ca000000-0000-4000-8000-0000000000f3';
const PRB = 'cb000000-0000-4000-8000-0000000000f4';
const GA = 'da000000-0000-4000-8000-0000000000f3';
const GB = 'db000000-0000-4000-8000-0000000000f4';
const AA = 'fa000000-0000-4000-8000-0000000000f3';
const AB = 'fb000000-0000-4000-8000-0000000000f4';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('aislamiento entre empresas: programa y auditorías internas (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db('app');
  const owner = () => pools.db('owner');
  const TABLAS = [
    'auditoria_equipo',
    'auditoria_capitulo',
    'auditoria_proceso',
    'auditoria_norma',
    'auditoria',
    'programa_exclusion',
    'programa_norma',
    'programa_auditoria',
    'proceso',
    'usuario',
  ];

  const sembrar = async (id: typeof A, slug: string, usuario: string, proceso: string, programa: string, auditoria: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into proceso (id, empresa_id, numero, nombre, duena_id, creado_por, actualizado_por)
        values (${proceso}, ${id}, 1, ${'Proceso de ' + slug}, ${usuario}, ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into programa_auditoria (id, empresa_id, anio, objetivo, creado_por, actualizado_por)
        values (${programa}, ${id}, 2027, 'objetivo', ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into programa_norma (empresa_id, programa_id, libreria_codigo, creado_por) values (${id}, ${programa}, 'iso-prueba', ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into programa_exclusion (empresa_id, programa_id, tipo, proceso_id, motivo, creado_por)
        values (${id}, ${programa}, 'proceso', ${proceso}, 'auditado el año pasado', ${usuario})`.execute(trx);
      await sql`insert into auditoria (id, empresa_id, programa_id, anio, numero, objetivo, inicio, fin, creado_por, actualizado_por)
        values (${auditoria}, ${id}, ${programa}, 2027, 1, 'objetivo', '2027-03-01', '2027-03-05', ${usuario}, ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into auditoria_norma (empresa_id, auditoria_id, libreria_codigo, creado_por) values (${id}, ${auditoria}, 'iso-prueba', ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into auditoria_proceso (empresa_id, auditoria_id, proceso_id, creado_por) values (${id}, ${auditoria}, ${proceso}, ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into auditoria_capitulo (empresa_id, auditoria_id, libreria_codigo, capitulo, creado_por) values (${id}, ${auditoria}, 'iso-prueba', '9', ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, creado_por) values (${id}, ${auditoria}, ${usuario}, 'lider', ${usuario}) on conflict do nothing`.execute(
        trx,
      );
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
    await sembrar(A, 'aud-a', UA, PRA, GA, AA);
    await sembrar(B, 'aud-b', UB, PRB, GB, AB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  // [tabla, columna actualizable (o null si la aplicación no actualiza), valor, inserción en nombre de B]
  const CASOS = [
    [
      'programa_auditoria',
      'objetivo',
      'x',
      sql`insert into programa_auditoria (empresa_id, anio, objetivo, creado_por, actualizado_por) values (${B}, 2028, 'intruso', ${UB}, ${UB})`,
    ],
    ['programa_norma', null, null, sql`insert into programa_norma (empresa_id, programa_id, libreria_codigo, creado_por) values (${B}, ${GB}, 'otra', ${UB})`],
    [
      'programa_exclusion',
      null,
      null,
      sql`insert into programa_exclusion (empresa_id, programa_id, tipo, libreria_codigo, capitulo, motivo, creado_por) values (${B}, ${GB}, 'capitulo', 'iso-prueba', '7', 'intruso', ${UB})`,
    ],
    [
      'auditoria',
      'objetivo',
      'x',
      sql`insert into auditoria (empresa_id, programa_id, anio, numero, objetivo, inicio, fin, creado_por, actualizado_por) values (${B}, ${GB}, 2027, 9, 'intruso', '2027-04-01', '2027-04-02', ${UB}, ${UB})`,
    ],
    ['auditoria_norma', null, null, sql`insert into auditoria_norma (empresa_id, auditoria_id, libreria_codigo, creado_por) values (${B}, ${AB}, 'otra', ${UB})`],
    ['auditoria_proceso', null, null, sql`insert into auditoria_proceso (empresa_id, auditoria_id, proceso_id, creado_por) values (${B}, ${AB}, ${PRB}, ${UB})`],
    [
      'auditoria_capitulo',
      null,
      null,
      sql`insert into auditoria_capitulo (empresa_id, auditoria_id, libreria_codigo, capitulo, creado_por) values (${B}, ${AB}, 'iso-prueba', '10', ${UB})`,
    ],
    [
      'auditoria_equipo',
      null,
      null,
      sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, creado_por) values (${B}, ${AB}, ${UB}, 'auditor', ${UB})`,
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

  it('A no puede borrar la configuración de B (la RLS no la deja ver) ni borrar programas ni auditorías (sin DELETE)', async () => {
    for (const t of ['programa_norma', 'programa_exclusion', 'auditoria_norma', 'auditoria_proceso', 'auditoria_capitulo', 'auditoria_equipo']) {
      const r = await conTenant(app(), A, (trx) => sql`delete from ${sql.table(t)} where empresa_id = ${B}`.execute(trx));
      expect(r.numAffectedRows ?? 0n).toBe(0n);
      const quedan = await conTenant(app(), B, (trx) => sql`select 1 from ${sql.table(t)}`.execute(trx));
      expect(quedan.rows).toHaveLength(1);
    }
    for (const t of ['programa_auditoria', 'auditoria'])
      await expect(conTenant(app(), A, (trx) => sql`delete from ${sql.table(t)} where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
  });

  it('un dato de A no puede apuntar a una persona, un proceso, un programa ni una auditoría de B (clave foránea compuesta)', async () => {
    const malas = [
      sql`insert into programa_auditoria (empresa_id, anio, objetivo, creado_por, actualizado_por) values (${A}, 2029, 'x', ${UB}, ${UA})`,
      sql`insert into programa_exclusion (empresa_id, programa_id, tipo, proceso_id, motivo, creado_por) values (${A}, ${GA}, 'proceso', ${PRB}, 'x', ${UA})`,
      sql`insert into auditoria (empresa_id, programa_id, anio, numero, objetivo, inicio, fin, creado_por, actualizado_por) values (${A}, ${GB}, 2027, 8, 'x', '2027-05-01', '2027-05-02', ${UA}, ${UA})`,
      sql`insert into auditoria_proceso (empresa_id, auditoria_id, proceso_id, creado_por) values (${A}, ${AA}, ${PRB}, ${UA})`,
      sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, creado_por) values (${A}, ${AA}, ${UB}, 'auditor', ${UA})`,
      sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, creado_por) values (${A}, ${AB}, ${UA}, 'auditor', ${UA})`,
    ];
    for (const m of malas) await expect(conTenant(owner(), A, (trx) => m.execute(trx))).rejects.toThrow();
  });

  it('el código se deriva, hay un solo líder por auditoría y la excepción exige motivo y medida', async () => {
    const r = await conTenant(app(), A, (trx) => sql<{ codigo: string }>`select codigo from auditoria where id = ${AA}`.execute(trx));
    expect(r.rows[0]?.codigo).toBe('AI-2027-01');
    // ya hay un líder: otro rol «lider» en la misma auditoría falla
    await conTenant(owner(), A, (trx) =>
      sql`insert into usuario (id, empresa_id, nombre, correo) values ('a2a2a2a2-0000-4000-8000-0000000000f3', ${A}, 'Otra persona', 'otra-a@example.test') on conflict do nothing`.execute(
        trx,
      ),
    );
    await expect(
      conTenant(app(), A, (trx) =>
        sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, creado_por) values (${A}, ${AA}, 'a2a2a2a2-0000-4000-8000-0000000000f3', 'lider', ${UA})`.execute(
          trx,
        ),
      ),
    ).rejects.toThrow();
    // excepción sin medida compensatoria: rechazada por la base
    await expect(
      conTenant(app(), A, (trx) =>
        sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, excepcion, excepcion_motivo, excepcion_autorizada_por, creado_por)
          values (${A}, ${AA}, 'a2a2a2a2-0000-4000-8000-0000000000f3', 'auditor', true, 'no hay otra persona', ${UA}, ${UA})`.execute(trx),
      ),
    ).rejects.toThrow();
  });
});
