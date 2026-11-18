import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conTenant } from "./con-tenant";
import { leerUrls, ROLES_BD } from "./configuracion";
import { GestorPools } from "./pools";

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de la copia congelada que justifica la Declaración (ADR 037): motivos, riesgos, vínculos fila–
// riesgo y referencias. Además es INMUTABLE (ni UPDATE ni DELETE para la aplicación) y las versiones anteriores siguen leyéndose.
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000f5");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000f6");
const UA = "a1a1a1a1-0000-4000-8000-0000000000f5";
const UB = "b1b1b1b1-0000-4000-8000-0000000000f6";
const VA = "da000000-0000-4000-8000-0000000000f5";
const VB = "db000000-0000-4000-8000-0000000000f6";
const VA_VIEJA = "da000000-0000-4000-8000-0000000000f7";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)("aislamiento entre empresas: copia congelada de la justificación (PostgreSQL real)", () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 5 });
  const app = () => pools.db("app");
  const owner = () => pools.db("owner");
  const TABLAS = ["declaracion_motivo", "declaracion_riesgo", "declaracion_fila_riesgo", "declaracion_referencia"] as const;

  const sembrar = async (id: typeof A, slug: string, usuario: string, ver: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${"Persona " + slug}, ${slug + "@example.test"}) on conflict do nothing`.execute(trx);
      await sql`insert into declaracion_version (id, empresa_id, numero, total, aplican, no_aplican, sin_control, aprobada_por, escala_max, corte_medio, corte_alto, corte_critico, con_motivo, riesgos_vigentes)
        values (${ver}, ${id}, 1, 1, 1, 0, 0, ${usuario}, 5, 5, 10, 16, 1, 1)`.execute(trx);
      await sql`insert into declaracion_fila (empresa_id, version_id, libreria_codigo, id_estable, orden, titulo, aplicabilidad, implementacion, controles, cobertura)
        values (${id}, ${ver}, 'iso-27001-anexo-a', 'a.5.1', 1, 'Políticas', 'aplica', 'implementado', '{}', 'sin_control')`.execute(trx);
      await sql`insert into declaracion_motivo (empresa_id, version_id, libreria_codigo, id_estable, tipo, nota)
        values (${id}, ${ver}, 'iso-27001-anexo-a', 'a.5.1', 'legal', ${"Nota de " + slug})`.execute(trx);
      await sql`insert into declaracion_riesgo (empresa_id, version_id, codigo, titulo, probabilidad, impacto, nivel, decision, responsable_id)
        values (${id}, ${ver}, 'R-001', ${"Riesgo de " + slug}, 3, 4, 'alto', 'aceptar', ${usuario})`.execute(trx);
      await sql`insert into declaracion_fila_riesgo (empresa_id, version_id, libreria_codigo, id_estable, riesgo_codigo, via)
        values (${id}, ${ver}, 'iso-27001-anexo-a', 'a.5.1', 'R-001', 'previsto')`.execute(trx);
      await sql`insert into declaracion_referencia (empresa_id, version_id, tipo, titulo, version_doc, fecha, ubicacion)
        values (${id}, ${ver}, 'plan', ${"Plan de " + slug}, '1.0', '2026-11-01', 'Carpeta SIG')`.execute(trx);
    });
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const t of ["declaracion_fila_riesgo", "declaracion_motivo", "declaracion_referencia", "declaracion_riesgo", "declaracion_fila", "declaracion_version", "usuario"])
        await sql`delete from ${sql.table(t)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, "dj-a", UA, VA);
    await sembrar(B, "dj-b", UB, VB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  for (const tabla of TABLAS) {
    describe(tabla, () => {
      it("A solo ve lo suyo", async () => {
        const r = await conTenant(app(), A, (trx) => sql<{ empresa_id: string }>`select empresa_id from ${sql.table(tabla)}`.execute(trx));
        expect(r.rows.map((f) => f.empresa_id)).toEqual([A]);
      });
      it("A no puede leer lo de B ni pidiéndolo por su empresa o su versión", async () => {
        const r = await conTenant(app(), A, (trx) => sql`select 1 from ${sql.table(tabla)} where empresa_id = ${B} or version_id = ${VB}`.execute(trx));
        expect(r.rows).toEqual([]);
      });
      it("la aplicación no puede modificar ni borrar (inmutable), ni lo propio ni lo de B", async () => {
        await expect(conTenant(app(), A, (trx) => sql`update ${sql.table(tabla)} set empresa_id = empresa_id where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
        await expect(conTenant(app(), A, (trx) => sql`delete from ${sql.table(tabla)} where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
        await expect(conTenant(app(), A, (trx) => sql`delete from ${sql.table(tabla)} where empresa_id = ${B}`.execute(trx))).rejects.toThrow();
        const quedan = await conTenant(app(), B, (trx) => sql`select 1 from ${sql.table(tabla)}`.execute(trx));
        expect(quedan.rows).toHaveLength(1);
      });
      it("sin empresa en el contexto no se lee nada (falla)", async () => {
        await expect(
          app()
            .selectFrom(tabla as never)
            .selectAll()
            .execute(),
        ).rejects.toThrow();
      });
    });
  }

  it("A no puede insertar en nombre de B ni colgar nada de una versión de B", async () => {
    const intentos = [
      sql`insert into declaracion_referencia (empresa_id, version_id, tipo, titulo, version_doc, fecha, ubicacion) values (${B}, ${VB}, 'analisis', 'intruso', '1', '2026-11-01', 'x')`,
      sql`insert into declaracion_referencia (empresa_id, version_id, tipo, titulo, version_doc, fecha, ubicacion) values (${A}, ${VB}, 'analisis', 'intruso', '1', '2026-11-01', 'x')`,
      sql`insert into declaracion_riesgo (empresa_id, version_id, codigo, titulo, probabilidad, impacto, nivel, decision) values (${A}, ${VB}, 'R-002', 'x', 1, 1, 'bajo', 'evitar')`,
      sql`insert into declaracion_motivo (empresa_id, version_id, libreria_codigo, id_estable, tipo, nota) values (${A}, ${VB}, 'iso-27001-anexo-a', 'a.5.1', 'otro', 'x')`,
      sql`insert into declaracion_fila_riesgo (empresa_id, version_id, libreria_codigo, id_estable, riesgo_codigo, via) values (${A}, ${VB}, 'iso-27001-anexo-a', 'a.5.1', 'R-001', 'control')`,
    ];
    for (const s of intentos) await expect(conTenant(app(), A, (trx) => s.execute(trx))).rejects.toThrow();
  });

  it("un riesgo congelado de A no puede tener de responsable a una persona de B", async () => {
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into declaracion_riesgo (empresa_id, version_id, codigo, titulo, probabilidad, impacto, nivel, decision, responsable_id) values (${A}, ${VA}, 'R-009', 'x', 1, 1, 'bajo', 'aceptar', ${UB})`.execute(trx),
      ),
    ).rejects.toThrow();
  });

  it("la aplicación sí puede insertar la copia de su propia versión (y la repetición se rechaza)", async () => {
    await conTenant(app(), A, (trx) =>
      sql`insert into declaracion_referencia (empresa_id, version_id, tipo, titulo, version_doc, fecha, ubicacion) values (${A}, ${VA}, 'analisis', 'Análisis', '2', '2026-11-02', 'Carpeta')`.execute(trx),
    );
    await expect(
      conTenant(app(), A, (trx) =>
        sql`insert into declaracion_referencia (empresa_id, version_id, tipo, titulo, version_doc, fecha, ubicacion) values (${A}, ${VA}, 'analisis', 'Otro', '3', '2026-11-03', 'Carpeta')`.execute(trx),
      ),
    ).rejects.toThrow();
  });

  it("una versión anterior a esta funcionalidad (sin escala ni conteos) se sigue guardando y leyendo", async () => {
    await conTenant(app(), A, (trx) =>
      sql`insert into declaracion_version (id, empresa_id, numero, total, aplican, no_aplican, sin_control, aprobada_por) values (${VA_VIEJA}, ${A}, 2, 1, 1, 0, 0, ${UA})`.execute(trx),
    );
    const r = await conTenant(app(), A, (trx) => sql<{ escala_max: number | null; con_motivo: number | null }>`select escala_max, con_motivo from declaracion_version where id = ${VA_VIEJA}`.execute(trx));
    expect(r.rows).toEqual([{ escala_max: null, con_motivo: null }]);
  });

  it("la escala y los conteos van completos o ninguno, con cortes ordenados y dentro de la escala", async () => {
    const intentar = (cols: string) =>
      conTenant(owner(), A, (trx) =>
        sql.raw(`insert into declaracion_version (id, empresa_id, numero, total, aplican, no_aplican, sin_control, aprobada_por, ${cols.split("|")[0]}) values (gen_random_uuid(), '${A}', 9, 1, 1, 0, 0, '${UA}', ${cols.split("|")[1]})`).execute(trx),
      );
    for (const malo of [
      "escala_max|5", // incompleto
      "escala_max, corte_medio, corte_alto, corte_critico, con_motivo, riesgos_vigentes|5, 10, 5, 16, 1, 1", // cortes desordenados
      "escala_max, corte_medio, corte_alto, corte_critico, con_motivo, riesgos_vigentes|5, 5, 10, 26, 1, 1", // corte fuera de la escala
      "escala_max, corte_medio, corte_alto, corte_critico, con_motivo, riesgos_vigentes|5, 5, 10, 16, 2, 1", // más con motivo que aplican
    ])
      await expect(intentar(malo)).rejects.toThrow();
  });

  it("los valores de los vínculos y de los riesgos son de listas cerradas", async () => {
    for (const s of [
      sql`insert into declaracion_fila_riesgo (empresa_id, version_id, libreria_codigo, id_estable, riesgo_codigo, via) values (${A}, ${VA}, 'iso-27001-anexo-a', 'a.5.1', 'R-001', 'otra')`,
      sql`insert into declaracion_fila_riesgo (empresa_id, version_id, libreria_codigo, id_estable, riesgo_codigo, via) values (${A}, ${VA}, 'iso-27001-anexo-a', 'a.5.1', 'R-777', 'control')`, // riesgo que no está en la copia
      sql`insert into declaracion_riesgo (empresa_id, version_id, codigo, titulo, probabilidad, impacto, nivel, decision) values (${A}, ${VA}, 'R-003', 'x', 1, 1, 'extremo', 'evitar')`,
      sql`insert into declaracion_riesgo (empresa_id, version_id, codigo, titulo, probabilidad, impacto, nivel, decision) values (${A}, ${VA}, 'riesgo', 'x', 1, 1, 'bajo', 'evitar')`,
    ])
      await expect(conTenant(owner(), A, (trx) => s.execute(trx))).rejects.toThrow();
  });
});
