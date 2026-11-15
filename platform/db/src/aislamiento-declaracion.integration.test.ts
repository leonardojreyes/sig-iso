import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de la Declaración de Aplicabilidad (MVP, M5): con la sesión de A se intenta leer o tocar lo
// de B y debe fallar. Además, la versión aprobada es inmutable (ni UPDATE ni DELETE para la aplicación). PostgreSQL real.
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000e1");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000e2");
const UA = "a1a1a1a1-0000-4000-8000-0000000000e1";
const UB = "b1b1b1b1-0000-4000-8000-0000000000e2";
const VA = "da000000-0000-4000-8000-0000000000e1";
const VB = "db000000-0000-4000-8000-0000000000e2";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)(
  "aislamiento entre empresas: declaración de aplicabilidad (PostgreSQL real)",
  () => {
    const pools = new GestorPools(
      hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
      { max: 5 },
    );
    const app = () => pools.db("app");
    const owner = () => pools.db("owner");

    const version = (
      db: ReturnType<typeof owner>,
      empresa: typeof A,
      c: Partial<{
        id: string;
        numero: number;
        usuario: string;
        total: number;
        aplican: number;
        noAplican: number;
        sinControl: number;
        alcance: string | null;
      }> = {},
    ) => {
      const v = {
        id: crypto.randomUUID(),
        numero: 1,
        usuario: UA,
        total: 2,
        aplican: 1,
        noAplican: 1,
        sinControl: 0,
        alcance: "Alcance de prueba",
        ...c,
      };
      return conTenant(db, empresa, (trx) =>
        sql`insert into declaracion_version (id, empresa_id, numero, alcance_texto, total, aplican, no_aplican, sin_control, aprobada_por)
          values (${v.id}, ${empresa}, ${v.numero}, ${v.alcance}, ${v.total}, ${v.aplican}, ${v.noAplican}, ${v.sinControl}, ${v.usuario})`.execute(
          trx,
        ),
      );
    };

    const fila = (
      db: ReturnType<typeof owner>,
      empresa: typeof A,
      c: Partial<{
        version: string;
        id: string;
        aplicabilidad: string;
        implementacion: string | null;
        justificacion: string | null;
        controles: string[];
        cobertura: string;
        titulo: string;
      }> = {},
    ) => {
      const v = {
        version: VA,
        id: "a.5.1",
        aplicabilidad: "aplica",
        implementacion: "implementado" as string | null,
        justificacion: null as string | null,
        controles: ["C-001"],
        cobertura: "cubierta",
        titulo: "Políticas de seguridad",
        ...c,
      };
      return conTenant(db, empresa, (trx) =>
        sql`insert into declaracion_fila (empresa_id, version_id, libreria_codigo, id_estable, orden, titulo, grupo, aplicabilidad, implementacion, justificacion, controles, cobertura)
          values (${empresa}, ${v.version}, 'iso-27001-anexo-a', ${v.id}, 1, ${v.titulo}, 'Organizacionales', ${v.aplicabilidad}, ${v.implementacion}, ${v.justificacion}, ${sql.val(v.controles)}, ${v.cobertura})`.execute(
          trx,
        ),
      );
    };

    const sembrar = async (
      id: typeof A,
      slug: string,
      usuario: string,
      ver: string,
    ) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(
          trx,
        );
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(
          trx,
        );
      });
      await version(owner(), id, { id: ver, usuario });
      await fila(owner(), id, { version: ver });
    };
    const limpiar = async (id: typeof A) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`delete from declaracion_fila where empresa_id = ${id}`.execute(
          trx,
        );
        await sql`delete from declaracion_version where empresa_id = ${id}`.execute(
          trx,
        );
        await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
        await sql`delete from empresa where id = ${id}`.execute(trx);
      });
    };

    beforeAll(async () => {
      await limpiar(A);
      await limpiar(B);
      await sembrar(A, "dec-a", UA, VA);
      await sembrar(B, "dec-b", UB, VB);
    });
    afterAll(async () => {
      await limpiar(A);
      await limpiar(B);
      await pools.cerrar();
    });

    it.each(["declaracion_version", "declaracion_fila"])(
      "A solo ve lo suyo en %s",
      async (tabla) => {
        const r = await conTenant(app(), A, (trx) =>
          sql<{
            empresa_id: string;
          }>`select empresa_id from ${sql.table(tabla)}`.execute(trx),
        );
        expect(r.rows.length).toBeGreaterThan(0);
        expect(r.rows.every((f) => f.empresa_id === A)).toBe(true);
      },
    );

    it.each(["declaracion_version", "declaracion_fila"])(
      "A no puede leer %s de B ni pidiéndola por su empresa",
      async (tabla) => {
        const r = await conTenant(app(), A, (trx) =>
          sql`select 1 from ${sql.table(tabla)} where empresa_id = ${B}`.execute(
            trx,
          ),
        );
        expect(r.rows).toEqual([]);
      },
    );

    it("A no puede leer una versión de B por su identificador", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`select 1 from declaracion_version where id = ${VB}`.execute(trx),
      );
      expect(r.rows).toEqual([]);
    });

    it("A no puede insertar una versión ni una fila en nombre de B", async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`insert into declaracion_fila (empresa_id, version_id, libreria_codigo, id_estable, orden, titulo, aplicabilidad, implementacion, cobertura)
          values (${B}, ${VB}, 'iso-27001-anexo-a', 'a.5.2', 1, 'intruso', 'aplica', 'parcial', 'sin_control')`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow();
      await expect(
        conTenant(app(), A, (trx) =>
          sql`insert into declaracion_version (empresa_id, numero, total, aplican, no_aplican, sin_control, aprobada_por) values (${B}, 3, 1, 1, 0, 0, ${UB})`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow();
    });

    it("sin empresa en el contexto no se lee nada (falla)", async () => {
      await expect(
        app()
          .selectFrom("declaracion_version" as never)
          .selectAll()
          .execute(),
      ).rejects.toThrow();
    });

    describe("claves foráneas compuestas", () => {
      it("una fila no puede colgar de la versión de otra empresa", async () => {
        await expect(
          fila(owner(), A, { version: VB, id: "a.5.9" }),
        ).rejects.toThrow();
      });
      it("una versión no puede ser aprobada por una persona de otra empresa", async () => {
        await expect(
          version(owner(), A, { numero: 5, usuario: UB }),
        ).rejects.toThrow();
      });
    });

    describe("la versión aprobada es inmutable para la aplicación", () => {
      it.each(["declaracion_version", "declaracion_fila"])(
        "no puede borrar %s",
        async (tabla) => {
          await expect(
            conTenant(app(), A, (trx) =>
              sql`delete from ${sql.table(tabla)} where empresa_id = ${A}`.execute(
                trx,
              ),
            ),
          ).rejects.toThrow();
        },
      );
      it("no puede actualizar ninguna versión", async () => {
        await expect(
          conTenant(app(), A, (trx) =>
            sql`update declaracion_version set total = 99 where id = ${VA}`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow();
      });
      it("no puede actualizar ninguna fila", async () => {
        await expect(
          conTenant(app(), A, (trx) =>
            sql`update declaracion_fila set justificacion = 'cambiada' where version_id = ${VA}`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow();
      });
    });

    describe("reglas de la tabla", () => {
      it("el número de versión no se repite dentro de la empresa (pero sí entre empresas)", async () => {
        await expect(version(owner(), A, { numero: 1 })).rejects.toThrow();
        await expect(
          version(owner(), B, { numero: 1, usuario: UB }),
        ).rejects.toThrow(); // B ya tiene la 1
        await expect(
          version(owner(), B, { numero: 7, usuario: UB }),
        ).resolves.toBeDefined();
      });
      it.each([
        ["un número menor que 1", { numero: 0 }],
        ["conteos negativos", { total: -1 }],
        ["más de 4000 caracteres de alcance", { alcance: "x".repeat(4001) }],
        [
          "aplican más los que no cuadran con el total",
          { total: 3, aplican: 1, noAplican: 1 },
        ],
      ])("rechaza una versión con %s", async (_n, cambio) => {
        await expect(
          version(owner(), A, { numero: 11, ...cambio }),
        ).rejects.toThrow();
      });
      it.each([
        [
          "una aplicabilidad desconocida (por decidir no se guarda)",
          { aplicabilidad: "por_decidir" },
        ],
        [
          "aplica sin implementación",
          { aplicabilidad: "aplica", implementacion: null },
        ],
        [
          "no aplica con implementación",
          {
            aplicabilidad: "no_aplica",
            implementacion: "parcial",
            justificacion: "No hay procesos de ese tipo",
          },
        ],
        [
          "no aplica sin justificación",
          {
            aplicabilidad: "no_aplica",
            implementacion: null,
            justificacion: null,
          },
        ],
        ["una implementación desconocida", { implementacion: "mas_o_menos" }],
        ["una cobertura desconocida", { cobertura: "quizas" }],
        ["un título vacío", { titulo: "" }],
        [
          "una justificación de más de 1000 caracteres",
          {
            aplicabilidad: "no_aplica",
            implementacion: null,
            justificacion: "x".repeat(1001),
          },
        ],
      ])("rechaza una fila con %s", async (_n, cambio) => {
        await expect(
          fila(owner(), A, { id: "a.5.3", ...cambio }),
        ).rejects.toThrow();
      });
      it("acepta una fila que no aplica con su justificación", async () => {
        await expect(
          fila(owner(), A, {
            id: "a.5.4",
            aplicabilidad: "no_aplica",
            implementacion: null,
            justificacion: "No desarrollamos software",
            controles: [],
            cobertura: "no_aplica",
          }),
        ).resolves.toBeDefined();
      });
      it("la misma entrada no se repite dentro de una versión", async () => {
        await expect(fila(owner(), A, { id: "a.5.1" })).rejects.toThrow();
      });
    });
  },
);
