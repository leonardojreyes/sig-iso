import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de las evidencias (MVP, M4): con la sesión de A se intenta leer o tocar lo de B y debe
// fallar. Además, los datos del archivo no se pueden modificar y nada se borra. Corre contra PostgreSQL real con el esquema migrado.
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000f1");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000f2");
const UA = "a1a1a1a1-0000-4000-8000-0000000000f1";
const UB = "b1b1b1b1-0000-4000-8000-0000000000f2";
const CA = "ca000000-0000-4000-8000-0000000000f1";
const CB = "cb000000-0000-4000-8000-0000000000f2";
const EA = "ea000000-0000-4000-8000-0000000000f1";
const EB = "eb000000-0000-4000-8000-0000000000f2";
const SHA = "a".repeat(64);
const PDF = "application/pdf";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)(
  "aislamiento entre empresas: evidencias (PostgreSQL real)",
  () => {
    const pools = new GestorPools(
      hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
      { max: 5 },
    );
    const app = () => pools.db("app");
    const owner = () => pools.db("owner");

    // Inserta una evidencia válida con los valores que se quieran cambiar (por omisión, todo correcto).
    const insertar = (
      db: ReturnType<typeof owner>,
      empresa: typeof A,
      c: Partial<{
        id: string;
        control: string;
        usuario: string;
        archivo: string;
        tipo: string;
        vigente: string | null;
        fecha: string;
        archivoTipo: string;
        bytes: number;
        sha: string;
        reemplaza: string | null;
        titulo: string;
      }>,
    ) => {
      const v = {
        id: crypto.randomUUID(),
        control: CA,
        usuario: UA,
        archivo: crypto.randomUUID(),
        tipo: "documento",
        vigente: null,
        fecha: "2026-11-01",
        archivoTipo: PDF,
        bytes: 1000,
        sha: SHA,
        reemplaza: null,
        titulo: "Evidencia de prueba",
        ...c,
      };
      return conTenant(db, empresa, (trx) =>
        sql`insert into evidencia (id, empresa_id, control_id, tipo, titulo, fecha_hecho, vigente_hasta, reemplaza_id, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, creado_por, actualizado_por)
          values (${v.id}, ${empresa}, ${v.control}, ${v.tipo}, ${v.titulo}, ${v.fecha}, ${v.vigente}, ${v.reemplaza}, ${v.archivo}, 'archivo.pdf', ${v.archivoTipo}, ${v.bytes}, ${v.sha}, ${v.usuario}, ${v.usuario})`.execute(
          trx,
        ),
      );
    };

    const sembrar = async (
      id: typeof A,
      slug: string,
      usuario: string,
      control: string,
      evidencia: string,
    ) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(
          trx,
        );
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(
          trx,
        );
        await sql`insert into control (id, empresa_id, codigo, nombre, creado_por, actualizado_por) values (${control}, ${id}, 'C-001', 'Control', ${usuario}, ${usuario}) on conflict do nothing`.execute(
          trx,
        );
      });
      await insertar(owner(), id, { id: evidencia, control, usuario });
    };
    const limpiar = async (id: typeof A) => {
      await conTenant(owner(), id, async (trx) => {
        await sql`delete from evidencia where empresa_id = ${id}`.execute(trx);
        await sql`delete from control where empresa_id = ${id}`.execute(trx);
        await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
        await sql`delete from empresa where id = ${id}`.execute(trx);
      });
    };

    beforeAll(async () => {
      await limpiar(A);
      await limpiar(B);
      await sembrar(A, "evi-a", UA, CA, EA);
      await sembrar(B, "evi-b", UB, CB, EB);
    });
    afterAll(async () => {
      await limpiar(A);
      await limpiar(B);
      await pools.cerrar();
    });

    it("A solo ve lo suyo", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql<{ empresa_id: string }>`select empresa_id from evidencia`.execute(
          trx,
        ),
      );
      expect(r.rows.map((f) => f.empresa_id)).toEqual([A]);
    });

    it("A no puede leer lo de B ni pidiéndolo por su empresa o por su identificador", async () => {
      const porEmpresa = await conTenant(app(), A, (trx) =>
        sql`select 1 from evidencia where empresa_id = ${B}`.execute(trx),
      );
      expect(porEmpresa.rows).toEqual([]);
      const porId = await conTenant(app(), A, (trx) =>
        sql`select 1 from evidencia where id = ${EB}`.execute(trx),
      );
      expect(porId.rows).toEqual([]);
    });

    it("A no puede cambiar el estado de lo de B (la RLS no lo deja ver: no afecta ninguna fila)", async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`update evidencia set estado = 'eliminada' where empresa_id = ${B}`.execute(
          trx,
        ),
      );
      expect(r.numAffectedRows ?? 0n).toBe(0n);
      const visto = await conTenant(app(), B, (trx) =>
        sql<{ estado: string }>`select estado from evidencia`.execute(trx),
      );
      expect(visto.rows[0]?.estado).toBe("activa");
    });

    it("A no puede insertar una evidencia en nombre de B", async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`insert into evidencia (empresa_id, control_id, tipo, titulo, fecha_hecho, archivo_id, archivo_nombre, archivo_tipo, archivo_bytes, archivo_sha256, creado_por, actualizado_por)
        values (${B}, ${CB}, 'documento', 'intruso', '2026-11-01', ${crypto.randomUUID()}, 'x.pdf', ${PDF}, 10, ${SHA}, ${UB}, ${UB})`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow();
    });

    it("sin empresa en el contexto no se lee nada (falla)", async () => {
      await expect(
        app()
          .selectFrom("evidencia" as never)
          .selectAll()
          .execute(),
      ).rejects.toThrow();
    });

    describe("claves foráneas compuestas: nada de una empresa apunta a otra", () => {
      it("un control de B", async () => {
        await expect(insertar(owner(), A, { control: CB })).rejects.toThrow();
      });
      it("una persona de B, como autora", async () => {
        await expect(insertar(owner(), A, { usuario: UB })).rejects.toThrow();
      });
      it("una evidencia de B como la que se reemplaza", async () => {
        await expect(insertar(owner(), A, { reemplaza: EB })).rejects.toThrow();
      });
      it("una evidencia propia sí se puede reemplazar", async () => {
        await expect(
          insertar(owner(), A, { reemplaza: EA }),
        ).resolves.toBeDefined();
      });
    });

    describe("la aplicación no puede alterar lo guardado", () => {
      it("no puede borrar evidencias", async () => {
        await expect(
          conTenant(app(), A, (trx) =>
            sql`delete from evidencia where empresa_id = ${A}`.execute(trx),
          ),
        ).rejects.toThrow();
      });
      it.each([
        "archivo_sha256",
        "archivo_bytes",
        "archivo_tipo",
        "archivo_id",
        "titulo",
        "control_id",
        "fecha_hecho",
        "vigente_hasta",
        "empresa_id",
      ])("no puede cambiar la columna %s", async (columna) => {
        const valor =
          columna === "archivo_sha256"
            ? "b".repeat(64)
            : columna === "archivo_bytes"
              ? 5
              : columna === "archivo_tipo"
                ? "image/png"
                : columna === "titulo"
                  ? "otro"
                  : columna === "fecha_hecho" || columna === "vigente_hasta"
                    ? "2026-12-01"
                    : crypto.randomUUID();
        await expect(
          conTenant(app(), A, (trx) =>
            sql`update evidencia set ${sql.ref(columna)} = ${valor} where id = ${EA}`.execute(
              trx,
            ),
          ),
        ).rejects.toThrow();
      });
      it("solo puede cambiar el estado y quién y cuándo", async () => {
        const id = crypto.randomUUID();
        await insertar(owner(), A, { id });
        const r = await conTenant(app(), A, (trx) =>
          sql`update evidencia set estado = 'reemplazada', actualizado_por = ${UA}, actualizado_en = now() where id = ${id}`.execute(
            trx,
          ),
        );
        expect(r.numAffectedRows ?? 0n).toBe(1n);
      });
    });

    describe("reglas de la tabla", () => {
      it.each([
        ["un tipo de evidencia desconocido", { tipo: "otro" }],
        [
          "un tipo de archivo fuera de la lista cerrada (SVG)",
          { archivoTipo: "image/svg+xml" },
        ],
        ["un tipo de archivo HTML", { archivoTipo: "text/html" }],
        ["una huella que no es SHA-256", { sha: "xyz" }],
        ["una huella en mayúsculas", { sha: "A".repeat(64) }],
        ["un archivo vacío", { bytes: 0 }],
        ["un archivo de más de 25 MB", { bytes: 26214401 }],
        [
          "una vigencia anterior al hecho",
          { fecha: "2026-11-10", vigente: "2026-11-09" },
        ],
        ["un título vacío", { titulo: "" }],
        ["un título de más de 120 caracteres", { titulo: "x".repeat(121) }],
      ])("rechaza %s", async (_nombre, cambio) => {
        await expect(insertar(owner(), A, cambio)).rejects.toThrow();
      });

      it("acepta el límite exacto de 25 MB y una vigencia igual al día del hecho", async () => {
        await expect(
          insertar(owner(), A, {
            bytes: 26214400,
            fecha: "2026-11-10",
            vigente: "2026-11-10",
          }),
        ).resolves.toBeDefined();
      });

      it("el archivo del almacén no se puede repetir dentro de la empresa (pero sí entre empresas)", async () => {
        const archivo = crypto.randomUUID();
        await insertar(owner(), A, { archivo });
        await expect(insertar(owner(), A, { archivo })).rejects.toThrow();
        await expect(
          insertar(owner(), B, { archivo, control: CB, usuario: UB }),
        ).resolves.toBeDefined();
      });

      it("una evidencia no se reemplaza a sí misma", async () => {
        const id = crypto.randomUUID();
        await expect(
          insertar(owner(), A, { id, reemplaza: id }),
        ).rejects.toThrow();
      });
    });
  },
);
