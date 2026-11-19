import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';

// AISLAMIENTO ENTRE EMPRESAS (regla 2) del control documental (ADR 039): con la sesión de A se intenta leer o tocar lo de B y debe
// fallar. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000d1');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000d2');
const UA = 'a1a1a1a1-0000-4000-8000-0000000000d1';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000d2';
const CA = 'ca000000-0000-4000-8000-0000000000d1';
const CB = 'cb000000-0000-4000-8000-0000000000d2';
const DA = 'da000000-0000-4000-8000-0000000000d1';
const DB = 'db000000-0000-4000-8000-0000000000d2';
const VA = 'fa000000-0000-4000-8000-0000000000d1';
const VB = 'fb000000-0000-4000-8000-0000000000d2';
const HUELLA = 'a'.repeat(64);
const PDF = 'application/pdf';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('aislamiento entre empresas: control documental (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db('app');
  const owner = () => pools.db('owner');

  const sembrar = async (id: typeof A, slug: string, usuario: string, control: string, doc: string, version: string, archivo: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into control (id, empresa_id, codigo, nombre, creado_por, actualizado_por)
        values (${control}, ${id}, 'C-001', ${'Control de ' + slug}, ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into documento (id, empresa_id, tipo, numero, titulo, clasificacion, responsable_id, creado_por, actualizado_por)
        values (${doc}, ${id}, 'politica', 1, ${'Política de ' + slug}, 'interna', ${usuario}, ${usuario}, ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into documento_version (id, empresa_id, documento_id, numero, estado, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256,
          autor_id, aprobador_id, aprobada_por, aprobada_en, creado_por, actualizado_por)
        values (${version}, ${id}, ${doc}, 1, 'aprobada', 'versión inicial', ${archivo}, 'politica', ${PDF}, 10, ${HUELLA},
          ${usuario}, ${usuario}, ${usuario}, now(), ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into documento_destinatario (empresa_id, documento_id, usuario_id, creado_por) values (${id}, ${doc}, ${usuario}, ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into documento_lectura (empresa_id, version_id, usuario_id) values (${id}, ${version}, ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into documento_control (empresa_id, documento_id, control_id, creado_por) values (${id}, ${doc}, ${control}, ${usuario}) on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into documento_entrada (empresa_id, documento_id, libreria_codigo, id_estable, creado_por)
        values (${id}, ${doc}, 'iso-prueba', 'a27-5-1', ${usuario}) on conflict do nothing`.execute(trx);
      await sql`insert into retencion_tipo (empresa_id, tipo, anios, motivo, actualizado_por) values (${id}, 'politica', 5, 'política de la empresa', ${usuario}) on conflict do nothing`.execute(
        trx,
      );
    });
  };
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
        'usuario',
      ])
        await sql`delete from ${sql.table(t)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'doc-a', UA, CA, DA, VA, 'a0000000-0000-4000-8000-0000000000d1');
    await sembrar(B, 'doc-b', UB, CB, DB, VB, 'b0000000-0000-4000-8000-0000000000d2');
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  // [tabla, columna actualizable (o null si la aplicación no actualiza), valor, inserción en nombre de B]
  const CASOS = [
    [
      'documento',
      'titulo',
      'x',
      sql`insert into documento (empresa_id, tipo, numero, titulo, clasificacion, responsable_id, creado_por, actualizado_por) values (${B}, 'manual', 9, 'intruso', 'interna', ${UB}, ${UB}, ${UB})`,
    ],
    [
      'documento_version',
      'devuelta_nota',
      'x',
      sql`insert into documento_version (empresa_id, documento_id, numero, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, autor_id, creado_por, actualizado_por) values (${B}, ${DB}, 9, 'intruso', 'b0000000-0000-4000-8000-0000000000e9', 'x', ${PDF}, 1, ${HUELLA}, ${UB}, ${UB}, ${UB})`,
    ],
    [
      'documento_destinatario',
      null,
      null,
      sql`insert into documento_destinatario (empresa_id, documento_id, usuario_id, creado_por) values (${B}, ${DB}, ${UB}, ${UB})`,
    ],
    [
      'documento_lectura',
      'confirmada_en',
      '2026-01-01T00:00:00Z',
      sql`insert into documento_lectura (empresa_id, version_id, usuario_id) values (${B}, ${VB}, ${UB})`,
    ],
    [
      'documento_control',
      null,
      null,
      sql`insert into documento_control (empresa_id, documento_id, control_id, creado_por) values (${B}, ${DB}, ${CB}, ${UB})`,
    ],
    [
      'documento_entrada',
      null,
      null,
      sql`insert into documento_entrada (empresa_id, documento_id, libreria_codigo, id_estable, creado_por) values (${B}, ${DB}, 'iso-prueba', 'a27-9-9', ${UB})`,
    ],
    [
      'retencion_tipo',
      'motivo',
      'x',
      sql`insert into retencion_tipo (empresa_id, tipo, anios, motivo, actualizado_por) values (${B}, 'manual', 1, 'intruso', ${UB})`,
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

  it('A no puede borrar destinatarios, vínculos ni lecturas de B (la RLS no los deja ver)', async () => {
    for (const t of ['documento_destinatario', 'documento_control', 'documento_entrada']) {
      const r = await conTenant(app(), A, (trx) => sql`delete from ${sql.table(t)} where empresa_id = ${B}`.execute(trx));
      expect(r.numAffectedRows ?? 0n).toBe(0n);
      const quedan = await conTenant(app(), B, (trx) => sql`select 1 from ${sql.table(t)}`.execute(trx));
      expect(quedan.rows).toHaveLength(1);
    }
    await expect(conTenant(app(), A, (trx) => sql`delete from documento_lectura where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
  });

  it('un documento o una versión de A no puede apuntar a una persona, un control ni un documento de B (clave foránea compuesta)', async () => {
    const malas = [
      sql`insert into documento (empresa_id, tipo, numero, titulo, clasificacion, responsable_id, creado_por, actualizado_por) values (${A}, 'manual', 8, 'x', 'interna', ${UB}, ${UA}, ${UA})`,
      sql`insert into documento_control (empresa_id, documento_id, control_id, creado_por) values (${A}, ${DA}, ${CB}, ${UA})`,
      sql`insert into documento_control (empresa_id, documento_id, control_id, creado_por) values (${A}, ${DB}, ${CA}, ${UA})`,
      sql`insert into documento_destinatario (empresa_id, documento_id, usuario_id, creado_por) values (${A}, ${DA}, ${UB}, ${UA})`,
      sql`insert into documento_lectura (empresa_id, version_id, usuario_id) values (${A}, ${VB}, ${UA})`,
      sql`insert into documento_version (empresa_id, documento_id, numero, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, autor_id, creado_por, actualizado_por) values (${A}, ${DB}, 7, 'x', 'a0000000-0000-4000-8000-0000000000e7', 'x', ${PDF}, 1, ${HUELLA}, ${UA}, ${UA}, ${UA})`,
    ];
    for (const m of malas) await expect(conTenant(owner(), A, (trx) => m.execute(trx))).rejects.toThrow();
  });

  it('el código se deriva por tipo y es único por empresa; dos empresas pueden usar el mismo', async () => {
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into documento (empresa_id, tipo, numero, titulo, clasificacion, responsable_id, creado_por, actualizado_por) values (${A}, 'politica', 1, 'repetido', 'interna', ${UA}, ${UA}, ${UA})`.execute(
          trx,
        ),
      ),
    ).rejects.toThrow();
    const ambos = await Promise.all(
      [A, B].map((e) => conTenant(app(), e, (trx) => sql<{ codigo: string }>`select codigo from documento`.execute(trx))),
    );
    expect(ambos.map((r) => r.rows[0]?.codigo)).toEqual(['POL-001', 'POL-001']);
  });

  it('la base garantiza una sola versión aprobada por documento', async () => {
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into documento_version (empresa_id, documento_id, numero, estado, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, autor_id, aprobador_id, aprobada_por, aprobada_en, creado_por, actualizado_por)
          values (${A}, ${DA}, 2, 'aprobada', 'otra', 'a0000000-0000-4000-8000-0000000000e2', 'x', ${PDF}, 1, ${HUELLA}, ${UA}, ${UA}, ${UA}, now(), ${UA}, ${UA})`.execute(
          trx,
        ),
      ),
    ).rejects.toThrow();
  });

  it('la aplicación no puede borrar documentos ni versiones, ni cambiar el archivo, la huella o la nota de una versión', async () => {
    await expect(conTenant(app(), A, (trx) => sql`delete from documento where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
    await expect(conTenant(app(), A, (trx) => sql`delete from documento_version where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
    for (const columna of ['archivo_sha256', 'archivo_id', 'nota', 'autor_id'])
      await expect(
        conTenant(app(), A, (trx) =>
          sql`update documento_version set ${sql.ref(columna)} = ${columna === 'archivo_sha256' ? 'b'.repeat(64) : columna === 'nota' ? 'cambio' : UA} where empresa_id = ${A}`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow();
  });

  it('las listas cerradas, la excepción del único administrador y el emisor de un documento externo se comprueban en la base', async () => {
    const malos = [
      sql`insert into documento (empresa_id, tipo, numero, titulo, clasificacion, responsable_id, creado_por, actualizado_por) values (${A}, 'carta', 20, 'x', 'interna', ${UA}, ${UA}, ${UA})`,
      sql`insert into documento (empresa_id, tipo, numero, titulo, clasificacion, responsable_id, creado_por, actualizado_por) values (${A}, 'manual', 21, 'x', 'secreta', ${UA}, ${UA}, ${UA})`,
      sql`insert into documento (empresa_id, tipo, numero, titulo, clasificacion, responsable_id, emisor, creado_por, actualizado_por) values (${A}, 'manual', 22, 'x', 'interna', ${UA}, 'Un emisor', ${UA}, ${UA})`,
      sql`insert into documento_version (empresa_id, documento_id, numero, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, autor_id, por_su_autor, creado_por, actualizado_por) values (${A}, ${DA}, 30, 'x', 'a0000000-0000-4000-8000-0000000000e3', 'x', ${PDF}, 1, ${HUELLA}, ${UA}, true, ${UA}, ${UA})`,
      sql`insert into documento_version (empresa_id, documento_id, numero, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, autor_id, creado_por, actualizado_por) values (${A}, ${DA}, 31, 'x', 'a0000000-0000-4000-8000-0000000000e4', 'x', 'application/x-msdownload', 1, ${HUELLA}, ${UA}, ${UA}, ${UA})`,
      sql`insert into documento_version (empresa_id, documento_id, numero, nota, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, autor_id, creado_por, actualizado_por) values (${A}, ${DA}, 32, 'x', 'a0000000-0000-4000-8000-0000000000e5', 'x', ${PDF}, 1, 'no-es-huella', ${UA}, ${UA}, ${UA})`,
      sql`insert into retencion_tipo (empresa_id, tipo, anios, motivo, actualizado_por) values (${A}, 'manual', 0, 'x', ${UA})`,
    ];
    for (const m of malos) await expect(conTenant(owner(), A, (trx) => m.execute(trx))).rejects.toThrow();
    // Un documento externo sí lleva emisor y edición.
    await conTenant(owner(), A, async (trx) => {
      await sql`insert into documento (empresa_id, tipo, numero, titulo, clasificacion, responsable_id, emisor, edicion_fuente, creado_por, actualizado_por)
        values (${A}, 'externo', 1, 'Reglamento', 'publica', ${UA}, 'Un emisor', '2024', ${UA}, ${UA})`.execute(trx);
      await sql`delete from documento where empresa_id = ${A} and tipo = 'externo'`.execute(trx);
    });
  });
});
