import { conTenant, GestorPools, leerUrls, ROLES_BD } from "@sig/db";
import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AutorizacionPort } from "../application/autorizacion.port.js";
import type {
  CatalogoLecturaPort,
  EntradaCatalogo,
} from "../application/catalogo-lectura.port.js";
import {
  AgregarMapeoUseCase,
  CambiarControlUseCase,
  CrearControlUseCase,
  ListarControlesUseCase,
  QuitarMapeoUseCase,
  RetirarControlUseCase,
} from "../application/controles.use-cases.js";
import {
  ConflictoDeVersionError,
  ConflictoError,
  EntradaNoEncontradaError,
  ParametroInvalidoError,
} from "../application/errores.js";
import { crearUnidadDeTrabajoCertificacion } from "./unidad-de-trabajo-certificacion.js";

// Con PostgreSQL real: controles y mapeos, bitácora en la misma transacción, concurrencia optimista, RLS y claves compuestas (regla 2).
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000c5");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000c6");
const UA = "a1a1a1a1-0000-4000-8000-0000000000c5";
const UA2 = "a2a2a2a2-0000-4000-8000-0000000000c5";
const UB = "b1b1b1b1-0000-4000-8000-0000000000c6";
const LIB = "c0c0c0c0-0000-4000-8000-0000000000c7";
const CODIGO_LIB = "prueba-ctl-anexo-a";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;
const entrada = (id: string, normas = ["ISO/IEC 27001"]): EntradaCatalogo => ({
  libreriaCodigo: CODIGO_LIB,
  libreriaId: LIB,
  idEstable: id,
  tipo: "control",
  capitulo: null,
  grupo: "Organizacionales",
  titulo: `Control ${id}`,
  guia: "Guía de prueba breve.",
  aplicaA: normas.map((n) => ({
    norma: n,
    edicion: "2022",
    clausula: "A.5.1",
  })),
  orden: 1,
});

describe.skipIf(!hayBase)("controles y mapeos sobre PostgreSQL real", () => {
  const pools = new GestorPools(
    hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
    { max: 6 },
  );
  const owner = () => pools.db("owner");
  const unidad = () => crearUnidadDeTrabajoCertificacion(pools.db("app"));
  const permitir: AutorizacionPort = { puede: async () => true };
  let adoptadas: EntradaCatalogo[] = [
    entrada("a27-5-1"),
    entrada("a27-5-2", ["ISO/IEC 27001", "ISO 9001"]),
  ];
  const catalogo: CatalogoLecturaPort = {
    listarEntradasVigentes: async () => adoptadas,
  };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 10, 12, 0, t++));
  let n = 0;
  const nuevoId = () =>
    `ec000000-0000-4000-8000-${String(Date.now() % 1e6).padStart(6, "0")}${String(++n).padStart(6, "0")}`;
  const crear = () =>
    new CrearControlUseCase(unidad(), permitir, reloj, nuevoId);
  const cambiar = () => new CambiarControlUseCase(unidad(), permitir, reloj);
  const retirar = () => new RetirarControlUseCase(unidad(), permitir, reloj);
  const agregar = () =>
    new AgregarMapeoUseCase(unidad(), permitir, catalogo, reloj);
  const quitar = () => new QuitarMapeoUseCase(unidad(), permitir);
  const listar = () => new ListarControlesUseCase(unidad(), permitir, catalogo);

  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`delete from control_mapeo where empresa_id = ${id}`.execute(
        trx,
      );
      await sql`delete from control where empresa_id = ${id}`.execute(trx);
      await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };
  const sembrar = async (id: typeof A, slug: string, ...usuarios: string[]) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${"Empresa " + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      for (const [i, u] of usuarios.entries())
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${u}, ${id}, ${"Persona " + i}, ${slug + i + "@example.test"}) on conflict do nothing`.execute(
          trx,
        );
    });
  };
  // La bitácora es inmutable: no se limpia. Cada ejecución mide solo los hechos posteriores a este punto de partida.
  let base = "0";
  const hechos = (empresa: typeof A) =>
    conTenant(
      owner(),
      empresa,
      async (trx) =>
        (
          await sql<{
            accion: string;
            objeto: string;
            usuario_id: string;
            antes: unknown;
            despues: unknown;
          }>`select accion, objeto, usuario_id, antes, despues from bitacora
        where empresa_id = ${empresa} and id > ${base}::bigint and accion in ('control.creado','control.cambiado','control.retirado','mapeo.creado','mapeo.eliminado') order by id`.execute(
            trx,
          )
        ).rows,
    );

  beforeAll(async () => {
    base = (
      await sql<{
        m: string;
      }>`select coalesce(max(id), 0)::text as m from bitacora`.execute(owner())
    ).rows[0]!.m;
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, "ctl5-a", UA, UA2);
    await sembrar(B, "ctl5-b", UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  it("crea, cambia y retira un control, con el hecho de cada paso en la bitácora (sin el texto)", async () => {
    const c = await crear().ejecutar({
      empresaId: A,
      usuarioId: UA,
      codigo: "C-001",
      nombre: "NOMBRE-PRIVADO",
      descripcion: "DESCRIPCION-PRIVADA",
      responsableId: UA2,
    });
    expect(c).toMatchObject({
      codigo: "C-001",
      estado: "vigente",
      version: 1,
      responsableId: UA2,
    });
    const c2 = await cambiar().ejecutar({
      empresaId: A,
      usuarioId: UA,
      id: c.id,
      versionEsperada: 1,
      descripcion: null,
    });
    expect(c2).toMatchObject({
      descripcion: null,
      version: 2,
      responsableId: UA2,
    });
    // Sin cambios: no sube la versión ni deja hecho.
    expect(
      (
        await cambiar().ejecutar({
          empresaId: A,
          usuarioId: UA,
          id: c.id,
          versionEsperada: 2,
          descripcion: null,
        })
      ).version,
    ).toBe(2);
    expect(
      (
        await retirar().ejecutar({
          empresaId: A,
          usuarioId: UA,
          id: c.id,
          versionEsperada: 2,
        })
      ).estado,
    ).toBe("retirado");
    const h = await hechos(A);
    expect(
      h
        .filter((x) => x.objeto === "control:C-001")
        .map((x) => [x.accion, x.usuario_id]),
    ).toEqual([
      ["control.creado", UA],
      ["control.cambiado", UA],
      ["control.retirado", UA],
    ]);
    expect(JSON.stringify(h)).not.toMatch(/PRIVAD/);
  });

  it("el código no se repite en la empresa (ni con el de un control retirado)", async () => {
    await expect(
      crear().ejecutar({
        empresaId: A,
        usuarioId: UA,
        codigo: "C-001",
        nombre: "Repetido",
      }),
    ).rejects.toBeInstanceOf(ConflictoError);
  });

  it("una versión vieja no pisa lo guardado: conflicto", async () => {
    const c = await crear().ejecutar({
      empresaId: A,
      usuarioId: UA,
      codigo: "C-010",
      nombre: "Concurrencia",
    });
    await cambiar().ejecutar({
      empresaId: A,
      usuarioId: UA,
      id: c.id,
      versionEsperada: 1,
      nombre: "Primera persona",
    });
    await expect(
      cambiar().ejecutar({
        empresaId: A,
        usuarioId: UA2,
        id: c.id,
        versionEsperada: 1,
        nombre: "Segunda persona",
      }),
    ).rejects.toBeInstanceOf(ConflictoDeVersionError);
    const [fila] = (
      await listar().ejecutar({ empresaId: A, usuarioId: UA })
    ).controles.filter((x) => x.id === c.id);
    expect(fila?.nombre).toBe("Primera persona");
  });

  it("dos cambios simultáneos con la misma versión: gana uno y el otro recibe conflicto", async () => {
    const c = await crear().ejecutar({
      empresaId: A,
      usuarioId: UA,
      codigo: "C-011",
      nombre: "Carrera",
    });
    const resultados = await Promise.allSettled([
      cambiar().ejecutar({
        empresaId: A,
        usuarioId: UA,
        id: c.id,
        versionEsperada: 1,
        nombre: "Uno",
      }),
      cambiar().ejecutar({
        empresaId: A,
        usuarioId: UA2,
        id: c.id,
        versionEsperada: 1,
        nombre: "Dos",
      }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rechazo.reason).toBeInstanceOf(ConflictoDeVersionError);
    const [fila] = (
      await listar().ejecutar({ empresaId: A, usuarioId: UA })
    ).controles.filter((x) => x.id === c.id);
    expect(fila?.version).toBe(2);
  });

  it("un responsable de otra empresa se rechaza como parámetro inválido y no deja nada a medias", async () => {
    await expect(
      crear().ejecutar({
        empresaId: A,
        usuarioId: UA,
        codigo: "C-020",
        nombre: "Responsable ajeno",
        responsableId: UB,
      }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
    const c = await crear().ejecutar({
      empresaId: A,
      usuarioId: UA,
      codigo: "C-021",
      nombre: "Responsable propio",
    });
    await expect(
      cambiar().ejecutar({
        empresaId: A,
        usuarioId: UA,
        id: c.id,
        versionEsperada: 1,
        responsableId: UB,
      }),
    ).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect(
      (await listar().ejecutar({ empresaId: A, usuarioId: UA })).controles.some(
        (x) => x.codigo === "C-020",
      ),
    ).toBe(false);
    expect((await hechos(A)).some((x) => x.objeto === "control:C-020")).toBe(
      false,
    );
  });

  it("mapea, repite sin error, lista el marco con las normas alcanzadas y quita con rastro", async () => {
    const c = await crear().ejecutar({
      empresaId: A,
      usuarioId: UA,
      codigo: "C-030",
      nombre: "Marco",
    });
    expect(
      await agregar().ejecutar({
        empresaId: A,
        usuarioId: UA,
        controlId: c.id,
        libreriaCodigo: CODIGO_LIB,
        idEstable: "a27-5-1",
      }),
    ).toEqual({ creado: true });
    expect(
      await agregar().ejecutar({
        empresaId: A,
        usuarioId: UA,
        controlId: c.id,
        libreriaCodigo: CODIGO_LIB,
        idEstable: "a27-5-1",
      }),
    ).toEqual({ creado: false });
    await agregar().ejecutar({
      empresaId: A,
      usuarioId: UA,
      controlId: c.id,
      libreriaCodigo: CODIGO_LIB,
      idEstable: "a27-5-2",
    });
    const [fila] = (
      await listar().ejecutar({ empresaId: A, usuarioId: UA })
    ).controles.filter((x) => x.id === c.id);
    expect(fila?.mapeos.map((m) => m.idEstable)).toEqual([
      "a27-5-1",
      "a27-5-2",
    ]);
    expect(fila?.normas).toEqual(["ISO 9001", "ISO/IEC 27001"]);
    await quitar().ejecutar({
      empresaId: A,
      usuarioId: UA,
      controlId: c.id,
      libreriaCodigo: CODIGO_LIB,
      idEstable: "a27-5-1",
    });
    await expect(
      quitar().ejecutar({
        empresaId: A,
        usuarioId: UA,
        controlId: c.id,
        libreriaCodigo: CODIGO_LIB,
        idEstable: "a27-5-1",
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    const h = (await hechos(A)).filter((x) =>
      x.objeto.startsWith("mapeo:C-030"),
    );
    expect(h.map((x) => [x.accion, x.objeto])).toEqual([
      ["mapeo.creado", "mapeo:C-030.a27-5-1"],
      ["mapeo.creado", "mapeo:C-030.a27-5-2"],
      ["mapeo.eliminado", "mapeo:C-030.a27-5-1"],
    ]);
  });

  it("un control retirado no recibe mapeos ni los pierde", async () => {
    const c = await crear().ejecutar({
      empresaId: A,
      usuarioId: UA,
      codigo: "C-031",
      nombre: "Retirado con mapeo",
    });
    await agregar().ejecutar({
      empresaId: A,
      usuarioId: UA,
      controlId: c.id,
      libreriaCodigo: CODIGO_LIB,
      idEstable: "a27-5-1",
    });
    await retirar().ejecutar({
      empresaId: A,
      usuarioId: UA,
      id: c.id,
      versionEsperada: 1,
    });
    await expect(
      agregar().ejecutar({
        empresaId: A,
        usuarioId: UA,
        controlId: c.id,
        libreriaCodigo: CODIGO_LIB,
        idEstable: "a27-5-2",
      }),
    ).rejects.toMatchObject({ motivo: "retirado" });
    await expect(
      quitar().ejecutar({
        empresaId: A,
        usuarioId: UA,
        controlId: c.id,
        libreriaCodigo: CODIGO_LIB,
        idEstable: "a27-5-1",
      }),
    ).rejects.toMatchObject({ motivo: "retirado" });
    const marco = await listar().ejecutar({
      empresaId: A,
      usuarioId: UA,
      incluirRetirados: true,
    });
    expect(marco.controles.find((x) => x.id === c.id)?.mapeos).toHaveLength(1);
    expect(
      (await listar().ejecutar({ empresaId: A, usuarioId: UA })).controles.some(
        (x) => x.id === c.id,
      ),
    ).toBe(false);
  });

  it("si falla un paso, no queda el control ni su hecho (todo en la misma transacción)", async () => {
    const antes = (await hechos(A)).length;
    await expect(
      new CrearControlUseCase(
        {
          ejecutar: (empresa, fn) =>
            unidad().ejecutar(empresa, async (c) =>
              fn({
                ...c,
                bitacora: {
                  registrar: async () => {
                    throw new Error("bitácora caída");
                  },
                },
              }),
            ),
        },
        permitir,
        reloj,
        nuevoId,
      ).ejecutar({
        empresaId: A,
        usuarioId: UA,
        codigo: "C-040",
        nombre: "No debe quedar",
      }),
    ).rejects.toThrow("bitácora caída");
    expect(
      (
        await listar().ejecutar({
          empresaId: A,
          usuarioId: UA,
          incluirRetirados: true,
        })
      ).controles.some((x) => x.codigo === "C-040"),
    ).toBe(false);
    expect((await hechos(A)).length).toBe(antes);
  });

  it("AISLAMIENTO: B no ve ni toca los controles ni los mapeos de A; el código de A se puede usar en B", async () => {
    const deA = (await listar().ejecutar({ empresaId: A, usuarioId: UA }))
      .controles;
    expect(deA.length).toBeGreaterThan(0);
    expect(
      (await listar().ejecutar({ empresaId: B, usuarioId: UB })).controles,
    ).toEqual([]);
    const ajeno = deA[0]!;
    await expect(
      cambiar().ejecutar({
        empresaId: B,
        usuarioId: UB,
        id: ajeno.id,
        versionEsperada: ajeno.version,
        nombre: "intruso",
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      retirar().ejecutar({
        empresaId: B,
        usuarioId: UB,
        id: ajeno.id,
        versionEsperada: ajeno.version,
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      agregar().ejecutar({
        empresaId: B,
        usuarioId: UB,
        controlId: ajeno.id,
        libreriaCodigo: CODIGO_LIB,
        idEstable: "a27-5-1",
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      quitar().ejecutar({
        empresaId: B,
        usuarioId: UB,
        controlId: ajeno.id,
        libreriaCodigo: CODIGO_LIB,
        idEstable: "a27-5-1",
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    const propio = await crear().ejecutar({
      empresaId: B,
      usuarioId: UB,
      codigo: "C-001",
      nombre: "El de B",
    });
    expect(propio.codigo).toBe("C-001");
    expect((await hechos(B)).map((x) => x.accion)).toEqual(["control.creado"]);
    // Nada de B alteró lo de A.
    expect(
      (await listar().ejecutar({ empresaId: A, usuarioId: UA })).controles.find(
        (x) => x.id === ajeno.id,
      )?.nombre,
    ).toBe(ajeno.nombre);
  });

  it("sin librerías adoptadas no se puede mapear nada", async () => {
    const c = await crear().ejecutar({
      empresaId: A,
      usuarioId: UA,
      codigo: "C-050",
      nombre: "Sin catálogo",
    });
    adoptadas = [];
    await expect(
      agregar().ejecutar({
        empresaId: A,
        usuarioId: UA,
        controlId: c.id,
        libreriaCodigo: CODIGO_LIB,
        idEstable: "a27-5-1",
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    adoptadas = [
      entrada("a27-5-1"),
      entrada("a27-5-2", ["ISO/IEC 27001", "ISO 9001"]),
    ];
  });
});
