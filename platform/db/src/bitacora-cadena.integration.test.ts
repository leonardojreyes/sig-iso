import { randomUUID } from "node:crypto";
import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// ENCADENADO POR HUELLAS de la bitácora (H6.6, ADR 028). Cada empresa tiene su cadena (y la plataforma, la suya):
// secuencia sin huecos + cada huella depende de la anterior + un ancla fuera de la cadena que detecta que se borró el final.
// Las alteraciones se prueban DENTRO de una transacción que siempre se revierte: la bitácora real no se toca.
const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;
const GENESIS = "0".repeat(64);

describe.skipIf(!hayBase)(
  "bitácora: encadenado por huellas (PostgreSQL real)",
  () => {
    const pools = new GestorPools(
      hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
      { max: 10 },
    );
    const app = () => pools.db("app");
    const owner = () => pools.db("owner");
    afterAll(async () => {
      await pools.cerrar();
    });

    const nuevaEmpresa = () => crearEmpresaId(randomUUID());
    const registrar = (
      empresa: ReturnType<typeof nuevaEmpresa>,
      accion = "login.ok",
    ) =>
      conTenant(app(), empresa, (trx) =>
        sql`insert into bitacora (empresa_id, actor_tipo, usuario_id, accion, resultado) values (${empresa}, 'usuario', ${randomUUID()}, ${accion}, 'ok')`.execute(
          trx,
        ),
      );
    const registrarVarias = async (
      empresa: ReturnType<typeof nuevaEmpresa>,
      n: number,
    ) => {
      for (let i = 0; i < n; i++) await registrar(empresa);
    };
    const cadena = async (empresa: string) =>
      (
        await sql<{
          id: string;
          secuencia: string;
          hash_previo: string;
          hash: string;
        }>`select id::text, secuencia::text, hash_previo, hash from bitacora where empresa_id = ${empresa} order by bitacora.secuencia`.execute(
          owner(),
        )
      ).rows;
    const verificar = async (clave: string) =>
      (
        await sql<{
          clave: string;
          secuencia: string | null;
          problema: string;
        }>`select clave, secuencia::text, problema from bitacora_verificar(${clave})`.execute(
          owner(),
        )
      ).rows;
    const anclar = () =>
      sql<{ n: number }>`select bitacora_anclar() as n`.execute(owner());

    /** Aplica una alteración como lo haría alguien con acceso total a la base, verifica DENTRO de la transacción y revierte. */
    const alterar = async (clave: string, sentencias: string[]) => {
      let problemas: {
        clave: string;
        secuencia: string | null;
        problema: string;
      }[] = [];
      try {
        await owner()
          .transaction()
          .execute(async (trx) => {
            for (const s of [
              "grant update, delete, truncate, insert on bitacora to sigiso_owner",
              "alter table bitacora disable row level security",
              "alter table bitacora disable trigger bitacora_sin_modificar",
              "alter table bitacora disable trigger bitacora_sin_vaciar",
              ...sentencias,
            ]) {
              await sql.raw(s).execute(trx);
            }
            problemas = (
              await sql<{
                clave: string;
                secuencia: string | null;
                problema: string;
              }>`select clave, secuencia::text, problema from bitacora_verificar(${clave})`.execute(
                trx,
              )
            ).rows;
            throw new Error("REVERTIR");
          });
      } catch (e) {
        if (!(e instanceof Error) || e.message !== "REVERTIR") throw e;
      }
      return problemas;
    };

    describe("secuencia y huellas", () => {
      it("cada empresa tiene su propia cadena, que empieza en 1 y crece de uno en uno", async () => {
        const a = nuevaEmpresa();
        const b = nuevaEmpresa();
        await registrarVarias(a, 3);
        await registrar(b);
        expect((await cadena(a)).map((f) => f.secuencia)).toEqual([
          "1",
          "2",
          "3",
        ]);
        expect((await cadena(b)).map((f) => f.secuencia)).toEqual(["1"]);
      });

      it("la primera huella previa es la génesis y cada una enlaza con la huella de la anterior", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 4);
        const filas = await cadena(e);
        expect(filas[0]?.hash_previo).toBe(GENESIS);
        for (let i = 1; i < filas.length; i++)
          expect(filas[i]?.hash_previo).toBe(filas[i - 1]?.hash);
        for (const f of filas) expect(f.hash).toMatch(/^[0-9a-f]{64}$/);
        expect(new Set(filas.map((f) => f.hash)).size).toBe(filas.length);
      });

      it("quien actúa no puede fijar la secuencia ni las huellas", async () => {
        const e = nuevaEmpresa();
        await expect(
          conTenant(app(), e, (trx) =>
            sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado, secuencia) values (${e}, 'usuario', 'login.ok', 'ok', 99)`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow(/permission denied/i);
        await expect(
          conTenant(app(), e, (trx) =>
            sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado, hash) values (${e}, 'usuario', 'login.ok', 'ok', 'x')`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow(/permission denied/i);
      });

      it("una cadena sana no tiene problemas", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 5);
        expect(await verificar(e)).toEqual([]);
      });

      it("inserciones concurrentes dejan la secuencia exacta, sin huecos ni repetidos", async () => {
        const e = nuevaEmpresa();
        await Promise.all(Array.from({ length: 30 }, () => registrar(e)));
        const filas = await cadena(e);
        expect(filas.map((f) => Number(f.secuencia))).toEqual(
          Array.from({ length: 30 }, (_, i) => i + 1),
        );
        expect(await verificar(e)).toEqual([]);
      });

      it("una inserción revertida no deja hueco en la secuencia", async () => {
        const e = nuevaEmpresa();
        await registrar(e);
        await expect(
          conTenant(app(), e, async (trx) => {
            await sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado) values (${e}, 'usuario', 'login.ok', 'ok')`.execute(
              trx,
            );
            throw new Error("falla a propósito");
          }),
        ).rejects.toThrow("falla a propósito");
        await registrar(e);
        expect((await cadena(e)).map((f) => f.secuencia)).toEqual(["1", "2"]);
        expect(await verificar(e)).toEqual([]);
      });

      it("el rol de plataforma tiene su propia cadena, separada de las empresas", async () => {
        await sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado) values (null, 'plataforma', 'catalogo.cargado', 'ok')`.execute(
          pools.db("plataforma"),
        );
        const r = await sql<{
          n: number;
        }>`select count(*)::int as n from bitacora where empresa_id is null and secuencia is not null and hash is not null`.execute(
          owner(),
        );
        expect(r.rows[0]?.n).toBeGreaterThan(0);
        expect(await verificar("plataforma")).toEqual([]);
      });

      it("un mismo origen_id repetido no avanza la secuencia", async () => {
        const e = nuevaEmpresa();
        const origen = `o-${randomUUID()}`;
        const ins = () =>
          conTenant(app(), e, (trx) =>
            sql`insert into bitacora (empresa_id, actor_tipo, accion, resultado, origen_id) values (${e}, 'proceso', 'login.fallido', 'rechazado', ${origen})`.execute(
              trx,
            ),
          );
        await ins();
        await expect(ins()).rejects.toThrow(/duplicate key|unique/i);
        await registrar(e);
        expect((await cadena(e)).map((f) => f.secuencia)).toEqual(["1", "2"]);
      });
    });

    describe("detección de alteraciones (como quien tiene acceso total a la base)", () => {
      it.each([
        ["el resultado", "resultado = 'error'"],
        ["la acción", "accion = 'logout'"],
        ["la persona", `usuario_id = '${randomUUID()}'`],
        ["la fecha", "creada_en = creada_en - interval '1 day'"],
        ["el contenido de antes", `antes = '{"x": 1}'::jsonb`],
      ])(
        "si se modifica %s de un registro, la verificación lo detecta",
        async (_nombre, cambio) => {
          const e = nuevaEmpresa();
          await registrarVarias(e, 4);
          const problemas = await alterar(e, [
            `update bitacora set ${cambio} where empresa_id = '${e}' and secuencia = 2`,
          ]);
          expect(problemas.map((p) => [p.secuencia, p.problema])).toEqual([
            ["2", "huella_invalida"],
          ]);
        },
      );

      it("si se borra un registro del medio, la verificación detecta el hueco", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 4);
        const problemas = (
          await alterar(e, [
            `delete from bitacora where empresa_id = '${e}' and secuencia = 2`,
          ])
        ).map((p) => p.problema);
        expect(problemas).toContain("hueco_en_la_secuencia");
        expect(problemas).toContain("enlace_roto");
      });

      it("si se borran los últimos registros DESPUÉS de anclar, la verificación detecta el ancla perdida", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 4);
        await anclar();
        const problemas = await alterar(e, [
          `delete from bitacora where empresa_id = '${e}' and secuencia in (3, 4)`,
        ]);
        expect(problemas.map((p) => p.problema)).toContain("ancla_perdida");
      });

      it("si se vacía toda la tabla después de anclar, la verificación detecta las anclas perdidas", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 3);
        await anclar();
        const problemas = await alterar(e, ["truncate bitacora"]);
        expect(problemas.map((p) => p.problema)).toEqual(["ancla_perdida"]);
      });

      it("si se reescribe el final de la cadena recalculando todas las huellas, el ancla lo delata", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 4);
        await anclar();
        const problemas = await alterar(e, [
          `update bitacora set resultado = 'error' where empresa_id = '${e}' and secuencia = 2`,
          `do $$
         declare f record; anterior text;
         begin
           select hash into anterior from bitacora where empresa_id = '${e}' and secuencia = 1;
           for f in select id from bitacora where empresa_id = '${e}' and secuencia >= 2 order by secuencia loop
             update bitacora set hash_previo = anterior where id = f.id;
             update bitacora set hash = bitacora_huella(bitacora) where id = f.id returning hash into anterior;
           end loop;
         end $$`,
        ]);
        // La cadena queda internamente consistente: solo el ancla (guardada aparte) revela la reescritura.
        expect(problemas.map((p) => p.problema)).toEqual(["ancla_perdida"]);
      });

      it("LÍMITE CONOCIDO: lo borrado entre dos anclas no se detecta", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 3);
        // Sin ancla posterior a estos registros, borrar el final deja una cadena que parece válida.
        const problemas = await alterar(e, [
          `delete from bitacora where empresa_id = '${e}' and secuencia = 3`,
        ]);
        expect(problemas).toEqual([]);
      });

      it("si el trigger de encadenado se saltara, el índice único impide repetir la secuencia", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 2);
        await expect(
          alterar(e, [
            "alter table bitacora disable trigger bitacora_encadenar",
            `insert into bitacora (empresa_id, actor_tipo, accion, resultado, secuencia, hash_previo, hash) values ('${e}', 'sistema', 'login.ok', 'ok', 2, '${GENESIS}', '${"a".repeat(64)}')`,
          ]),
        ).rejects.toThrow(/duplicate key|unique/i);
      });
    });

    describe("anclas", () => {
      it("anclar es idempotente: sin hechos nuevos no añade anclas", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 2);
        await anclar();
        const segunda = await anclar();
        expect(segunda.rows[0]?.n).toBe(0);
        await registrar(e);
        const tercera = await anclar();
        expect(tercera.rows[0]?.n).toBeGreaterThanOrEqual(1);
      });

      it("guarda la última secuencia y huella de cada cadena", async () => {
        const e = nuevaEmpresa();
        await registrarVarias(e, 3);
        await anclar();
        const ultima = (await cadena(e)).at(-1)!;
        const r = await sql<{
          secuencia: string;
          hash: string;
        }>`select secuencia::text, hash from bitacora_ancla where clave = ${e} order by bitacora_ancla.secuencia desc limit 1`.execute(
          owner(),
        );
        expect(r.rows[0]).toEqual({
          secuencia: ultima.secuencia,
          hash: ultima.hash,
        });
      });

      it("la tabla de anclas también es de solo añadir, incluso para el dueño", async () => {
        const permisos = await sql<{
          p: string;
          ok: boolean;
        }>`select p, has_table_privilege('sigiso_owner', 'public.bitacora_ancla', p) as ok from unnest(array['UPDATE', 'DELETE', 'TRUNCATE']) as p`.execute(
          owner(),
        );
        expect(permisos.rows.map((f) => f.ok)).toEqual([false, false, false]);
        for (const [permiso, sentencia] of [
          ["update", "update bitacora_ancla set clave = 'x'"],
          ["delete", "delete from bitacora_ancla"],
          ["truncate", "truncate bitacora_ancla"],
        ] as const) {
          const intento = owner()
            .transaction()
            .execute(async (trx) => {
              await sql
                .raw(`grant ${permiso} on bitacora_ancla to sigiso_owner`)
                .execute(trx);
              await sql.raw(sentencia).execute(trx);
              throw new Error("EJECUTADA");
            });
          await expect(intento).rejects.toThrow(/solo añadir/);
        }
      });

      it.each(["app", "catalogo", "plataforma"] as const)(
        "el rol %s no accede a las anclas ni ejecuta la verificación o el anclado",
        async (rol) => {
          const db = pools.db(rol);
          await expect(
            sql`select * from bitacora_ancla`.execute(db),
          ).rejects.toThrow(/permission denied/i);
          await expect(
            sql`select * from bitacora_verificar()`.execute(db),
          ).rejects.toThrow(/permission denied/i);
          await expect(
            sql`select bitacora_anclar()`.execute(db),
          ).rejects.toThrow(/permission denied/i);
        },
      );
    });

    it("una verificación global de todas las cadenas, tras todo lo anterior, no reporta problemas", async () => {
      const r = await sql<{
        problema: string;
      }>`select problema from bitacora_verificar()`.execute(owner());
      expect(r.rows).toEqual([]);
    });
  },
);
