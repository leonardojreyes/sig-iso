import { randomUUID } from "node:crypto";
import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// BITÁCORA INMUTABLE (P15, ADR 028). Solo se añade; cada empresa ve la suya; los hechos de plataforma (sin empresa) los escribe
// un rol aparte. Las filas no se pueden borrar (la bitácora es inmutable), así que cada ejecución usa empresas con UUID aleatorio.
const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)("bitácora inmutable (PostgreSQL real)", () => {
  const pools = new GestorPools(
    hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
    { max: 5 },
  );
  const app = () => pools.db("app");
  const owner = () => pools.db("owner");
  const plataforma = () => pools.db("plataforma");
  const E1 = crearEmpresaId(randomUUID());
  const E2 = crearEmpresaId(randomUUID());
  const USUARIO = randomUUID();
  const marca = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  afterAll(async () => {
    await pools.cerrar();
  });

  const registrar = (
    empresa: typeof E1,
    accion = "login.ok",
    extra: Record<string, unknown> = {},
  ) =>
    conTenant(app(), empresa, (trx) =>
      sql`insert into bitacora (empresa_id, actor_tipo, usuario_id, accion, resultado, origen_id)
          values (${empresa}, 'usuario', ${USUARIO}, ${accion}, 'ok', ${(extra.origen as string | undefined) ?? null})`.execute(
        trx,
      ),
    );

  describe("escritura por empresa", () => {
    it("la aplicación registra un hecho de su empresa y el servidor fija la fecha", async () => {
      await registrar(E1);
      const r = await conTenant(app(), E1, (trx) =>
        sql<{
          dif: number;
        }>`select extract(epoch from (clock_timestamp() - creada_en))::float as dif from bitacora`.execute(
          trx,
        ),
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]!.dif).toBeGreaterThanOrEqual(0);
      expect(r.rows[0]!.dif).toBeLessThan(30);
    });

    it("quien actúa no puede fijar la fecha ni el identificador (permiso por columna)", async () => {
      await expect(
        conTenant(app(), E1, (trx) =>
          sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado, creada_en) values (${E1}, 'sistema', 'login.ok', 'ok', now() - interval '10 years')`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        conTenant(app(), E1, (trx) =>
          sql`insert into bitacora (id, empresa_id, actor_tipo, accion, resultado) overriding system value values (1, ${E1}, 'sistema', 'login.ok', 'ok')`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow(/permission denied/i);
    });

    it("A no puede registrar un hecho en nombre de B", async () => {
      await expect(
        registrar(E2).then(() =>
          conTenant(app(), E1, (trx) =>
            sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado) values (${E2}, 'usuario', 'login.ok', 'ok')`.execute(
              trx,
            ),
          ),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("la aplicación no puede escribir hechos de plataforma (sin empresa)", async () => {
      await expect(
        conTenant(app(), E1, (trx) =>
          sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado) values (null, 'sistema', 'catalogo.cargado', 'ok')`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("registrar sin empresa en el contexto falla", async () => {
      await expect(
        sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado) values (${E1}, 'usuario', 'login.ok', 'ok')`.execute(
          app(),
        ),
      ).rejects.toThrow(/app\.tenant_id/);
    });
  });

  describe("hechos de plataforma", () => {
    it("el rol de plataforma registra solo hechos sin empresa", async () => {
      await sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado, motivo) values (null, 'plataforma', 'catalogo.cargado', 'ok', 'carga_inicial')`.execute(
        plataforma(),
      );
      await expect(
        sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado) values (${E1}, 'plataforma', 'catalogo.cargado', 'ok')`.execute(
          plataforma(),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("el rol de plataforma no puede leer la bitácora", async () => {
      await expect(
        sql`select * from bitacora`.execute(plataforma()),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  describe("lectura: cada empresa ve solo la suya", () => {
    it("A ve sus hechos; B no ve ninguno de A; ninguna ve los de plataforma", async () => {
      await registrar(E1, "logout");
      await registrar(E2, "login.ok");
      const a = await conTenant(app(), E1, (trx) =>
        sql<{
          empresa_id: string | null;
        }>`select empresa_id from bitacora`.execute(trx),
      );
      expect(a.rows.length).toBeGreaterThanOrEqual(2);
      expect(a.rows.every((f) => f.empresa_id === E1)).toBe(true);
      const b = await conTenant(app(), E2, (trx) =>
        sql<{
          empresa_id: string | null;
        }>`select empresa_id from bitacora`.execute(trx),
      );
      expect(b.rows.every((f) => f.empresa_id === E2)).toBe(true);
      const nulos = await conTenant(app(), E1, (trx) =>
        sql`select 1 from bitacora where empresa_id is null`.execute(trx),
      );
      expect(nulos.rows).toEqual([]);
    });

    it("A no lee los hechos de B ni filtrando por su empresa", async () => {
      const r = await conTenant(app(), E1, (trx) =>
        sql`select 1 from bitacora where empresa_id = ${E2}`.execute(trx),
      );
      expect(r.rows).toEqual([]);
    });

    it("consultar la bitácora sin empresa falla", async () => {
      await expect(sql`select * from bitacora`.execute(app())).rejects.toThrow(
        /app\.tenant_id/,
      );
    });

    it("el dueño de la base, para atender solicitudes de las personas, lee todos los hechos (también los de plataforma)", async () => {
      const r = await sql<{
        empresa_id: string | null;
      }>`select distinct empresa_id from bitacora where empresa_id in (${E1}, ${E2}) or empresa_id is null`.execute(
        owner(),
      );
      const empresas = r.rows.map((f) => f.empresa_id);
      expect(empresas).toContain(E1);
      expect(empresas).toContain(E2);
      expect(empresas).toContain(null);
    });
  });

  describe("inmutabilidad", () => {
    it.each(["app", "plataforma"] as const)(
      "el rol %s no puede modificar, borrar ni vaciar la bitácora",
      async (rol) => {
        const db =
          rol === "app"
            ? (f: string) =>
                conTenant(app(), E1, (trx) => sql.raw(f).execute(trx))
            : (f: string) => sql.raw(f).execute(plataforma());
        await expect(
          db("update bitacora set resultado = 'ok'"),
        ).rejects.toThrow(/permission denied/i);
        await expect(db("delete from bitacora")).rejects.toThrow(
          /permission denied/i,
        );
        await expect(db("truncate bitacora")).rejects.toThrow(
          /permission denied/i,
        );
      },
    );

    it("el dueño tampoco tiene permisos de modificación, borrado ni vaciado", async () => {
      const r = await sql<{
        p: string;
        ok: boolean;
      }>`select p, has_table_privilege('sigiso_owner', 'public.bitacora', p) as ok from unnest(array['UPDATE', 'DELETE', 'TRUNCATE']) as p`.execute(
        owner(),
      );
      expect(r.rows.map((f) => [f.p, f.ok])).toEqual([
        ["UPDATE", false],
        ["DELETE", false],
        ["TRUNCATE", false],
      ]);
    });

    // Defensa en profundidad: aunque alguien se otorgara los permisos, los disparadores lo impiden. Cada intento se revierte.
    it.each([
      ["modificar", "update", "update bitacora set resultado = 'error'"],
      ["borrar", "delete", "delete from bitacora"],
      ["vaciar", "truncate", "truncate bitacora"],
    ])(
      "aunque el dueño se otorgue el permiso y desactive la RLS, el disparador impide %s",
      async (_nombre, permiso, sentencia) => {
        const intento = owner()
          .transaction()
          .execute(async (trx) => {
            await sql
              .raw(`grant ${permiso} on bitacora to sigiso_owner`)
              .execute(trx);
            // Bloqueo máximo antes de alterar la tabla: escalarlo en `alter table` provoca interbloqueos con otros archivos de prueba.
            await sql
              .raw("lock table bitacora in access exclusive mode")
              .execute(trx);
          // Con RLS forzada y sin política de modificación el dueño no vería filas; se desactiva para probar el disparador.
          await sql.raw('alter table bitacora disable row level security').execute(trx);
            await sql.raw(sentencia).execute(trx);
            throw new Error("EJECUTADA");
          });
        await expect(intento).rejects.toThrow(/solo añadir/);
      },
    );
  });

  describe("restricciones de los datos", () => {

    it.each([
      [
        "actor_tipo desconocido",
        `insert into bitacora (empresa_id, actor_tipo, accion, resultado) values ('${E1}', 'humano', 'login.ok', 'ok')`,
      ],
      [
        "acción con formato inválido",
        `insert into bitacora (empresa_id, actor_tipo, accion, resultado) values ('${E1}', 'usuario', 'Login OK!', 'ok')`,
      ],
      [
        "resultado desconocido",
        `insert into bitacora (empresa_id, actor_tipo, accion, resultado) values ('${E1}', 'usuario', 'login.ok', 'quizas')`,
      ],
      [
        "motivo con texto libre",
        `insert into bitacora (empresa_id, actor_tipo, accion, resultado, motivo) values ('${E1}', 'usuario', 'login.ok', 'rechazado', 'La persona escribió mal su contraseña')`,
      ],
      [
        "antes que no es un objeto",
        `insert into bitacora (empresa_id, actor_tipo, accion, resultado, antes) values ('${E1}', 'usuario', 'login.ok', 'ok', '"texto"'::jsonb)`,
      ],
      [
        "despues demasiado grande",
        `insert into bitacora (empresa_id, actor_tipo, accion, resultado, despues) values ('${E1}', 'usuario', 'login.ok', 'ok', jsonb_build_object('x', repeat('x', 9000)))`,
      ],
    ])("rechaza %s", async (_nombre, sentencia) => {
      await expect(
        conTenant(app(), E1, (trx) => sql.raw(sentencia).execute(trx)),
      ).rejects.toThrow(/violates check constraint/i);
    });

    it("un mismo origen_id no se registra dos veces (idempotencia)", async () => {
      await registrar(E1, "login.fallido", { origen: `${marca}-1` });
      await expect(
        registrar(E1, "login.fallido", { origen: `${marca}-1` }),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it("la bitácora no depende de que existan la empresa ni la persona (sin claves foráneas)", async () => {
      const r = await sql<{
        n: number;
      }>`select count(*)::int as n from pg_constraint where conrelid = 'public.bitacora'::regclass and contype = 'f'`.execute(
        owner(),
      );
      expect(r.rows[0]?.n).toBe(0);
    });

    it("guarda un hecho con antes y despues dentro de los límites", async () => {
      await conTenant(app(), E1, (trx) =>
        sql`insert into bitacora (empresa_id, actor_tipo, usuario_id, accion, objeto, objeto_version, resultado, antes, despues)
            values (${E1}, 'usuario', ${USUARIO}, 'libreria.adoptada', 'libreria:ejemplo', ${"a".repeat(64)}, 'ok', '{"adoptada": false}'::jsonb, '{"adoptada": true}'::jsonb)`.execute(
          trx,
        ),
      );
    });
  });

  it("la bitácora tiene RLS activa y forzada", async () => {
    const r = await sql<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>`select relrowsecurity, relforcerowsecurity from pg_class where relname = 'bitacora'`.execute(
      owner(),
    );
    expect(r.rows[0]).toEqual({
      relrowsecurity: true,
      relforcerowsecurity: true,
    });
  });
});
