import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { conTenant, GestorPools, leerUrls, ROLES_BD } from "@sig/db";
import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AlmacenArchivosPort } from "../application/almacen-archivos.port.js";
import type { AutorizacionPort } from "../application/autorizacion.port.js";
import type {
  CatalogoLecturaPort,
  EntradaCatalogo,
} from "../application/catalogo-lectura.port.js";
import {
  AgregarMapeoUseCase,
  CrearControlUseCase,
} from "../application/controles.use-cases.js";
import {
  ArchivoRechazadoError,
  ConflictoError,
  EntradaNoEncontradaError,
} from "../application/errores.js";
import {
  DescargarEvidenciaUseCase,
  EliminarEvidenciaUseCase,
  ListarCoberturaUseCase,
  ListarEvidenciasUseCase,
  ReemplazarEvidenciaUseCase,
  SubirEvidenciaUseCase,
} from "../application/evidencias.use-cases.js";
import {
  docxConMacros,
  ejecutable,
  enTrozos,
  pdf,
  png,
  texto,
} from "../application/prueba/archivos.js";
import { AlmacenArchivosLocal } from "./almacen-archivos-local.adapter.js";
import { crearUnidadDeTrabajoCertificacion } from "./unidad-de-trabajo-certificacion.js";

// Con PostgreSQL real y el disco real: flujo completo, transacción única con el renombrado, concurrencia y aislamiento (regla 2).
const A = crearEmpresaId("aaaaaaaa-0000-4000-8000-0000000000c8");
const B = crearEmpresaId("bbbbbbbb-0000-4000-8000-0000000000c9");
const UA = "a1a1a1a1-0000-4000-8000-0000000000c8";
const UA2 = "a2a2a2a2-0000-4000-8000-0000000000c8";
const UB = "b1b1b1b1-0000-4000-8000-0000000000c9";
const LIB = "c0c0c0c0-0000-4000-8000-0000000000ca";
const CODIGO_LIB = "prueba-evi-anexo-a";

const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
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
const leerTodo = async (f: AsyncIterable<Uint8Array>) => {
  const partes: Uint8Array[] = [];
  for await (const p of f) partes.push(p);
  return Buffer.concat(partes);
};

describe.skipIf(!hayBase)("evidencias sobre PostgreSQL y disco reales", () => {
  const pools = new GestorPools(
    hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
    { max: 8 },
  );
  const owner = () => pools.db("owner");
  const unidad = () => crearUnidadDeTrabajoCertificacion(pools.db("app"));
  const permitir: AutorizacionPort = { puede: async () => true };
  const catalogo: CatalogoLecturaPort = {
    listarEntradasVigentes: async () => [
      entrada("a27-5-1"),
      entrada("a27-5-2", ["ISO/IEC 27001", "ISO 9001"]),
    ],
  };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 11, 15, 0, t++));
  let n = 0;
  const nuevoId = () =>
    `ec000000-0000-4000-8000-${String(Date.now() % 1e6).padStart(6, "0")}${String(++n).padStart(6, "0")}`;
  let raiz: string;
  let almacen: AlmacenArchivosLocal;
  const casos = (alm: AlmacenArchivosPort = almacen, u = unidad()) => ({
    crearControl: new CrearControlUseCase(u, permitir, reloj, nuevoId),
    mapear: new AgregarMapeoUseCase(u, permitir, catalogo, reloj),
    subir: new SubirEvidenciaUseCase(u, permitir, alm, reloj, nuevoId),
    reemplazar: new ReemplazarEvidenciaUseCase(
      u,
      permitir,
      alm,
      reloj,
      nuevoId,
    ),
    eliminar: new EliminarEvidenciaUseCase(u, permitir, reloj),
    listar: new ListarEvidenciasUseCase(u, permitir, reloj),
    descargar: new DescargarEvidenciaUseCase(u, permitir, alm),
    cobertura: new ListarCoberturaUseCase(u, permitir, catalogo, reloj),
  });
  let c: ReturnType<typeof casos>;
  const datos = {
    tipo: "documento",
    titulo: "TITULO-PRIVADO",
    fechaHecho: "2026-11-01",
    vigenteHasta: "2027-06-30",
    nombreOriginal: "politica.pdf",
  };
  const yo = { empresaId: A, usuarioId: UA };
  let codigoSecuencia = 0;
  const nuevoControl = async (empresa: typeof A = A, usuario = UA) =>
    await c.crearControl.ejecutar({
      empresaId: empresa,
      usuarioId: usuario,
      codigo: `E-${Date.now() % 1e5}-${++codigoSecuencia}`,
      nombre: "Control con evidencias",
    });
  const subida = (
    controlId: string,
    bytes: Uint8Array = pdf(),
    extra: Record<string, unknown> = {},
  ) =>
    c.subir.ejecutar({
      ...yo,
      controlId,
      ...datos,
      ...extra,
      flujo: enTrozos(bytes, 700),
    });
  const archivosEnDisco = async (empresa: typeof A = A) =>
    readdir(join(raiz, empresa)).catch(() => [] as string[]);

  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`delete from evidencia where empresa_id = ${id}`.execute(trx);
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
  const hechos = (empresa: typeof A, ...acciones: string[]) =>
    conTenant(
      owner(),
      empresa,
      async (trx) =>
        (
          await sql<{
            accion: string;
            objeto: string;
            objeto_version: string | null;
            motivo: string | null;
            resultado: string;
            usuario_id: string;
          }>`select accion, objeto, objeto_version, motivo, resultado, usuario_id from bitacora
        where empresa_id = ${empresa} and id > ${base}::bigint and accion = any(${acciones}::text[]) order by id`.execute(
            trx,
          )
        ).rows,
    );

  beforeAll(async () => {
    raiz = await mkdtemp(join(tmpdir(), "sigiso-evi-it-"));
    almacen = new AlmacenArchivosLocal(raiz);
    c = casos();
    base = (
      await sql<{
        m: string;
      }>`select coalesce(max(id), 0)::text as m from bitacora`.execute(owner())
    ).rows[0]!.m;
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, "evi5-a", UA, UA2);
    await sembrar(B, "evi5-b", UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
    await rm(raiz, { recursive: true, force: true });
  });

  it("sube, guarda la fila y el archivo, deja la huella en la bitácora y se descarga idéntica", async () => {
    const control = await nuevoControl();
    const bytes = pdf();
    const e = await subida(control.id, bytes);
    expect(e).toMatchObject({
      estado: "activa",
      vigente: true,
      fechaHecho: "2026-11-01",
      vigenteHasta: "2027-06-30",
      reemplazaId: null,
    });
    expect(e.archivo).toEqual({
      nombre: "politica.pdf",
      tipo: "application/pdf",
      bytes: bytes.length,
      sha256: sha(bytes),
    });
    expect((await archivosEnDisco()).some((f) => f.startsWith("tmp-"))).toBe(
      false,
    );

    const d = await c.descargar.ejecutar({ ...yo, id: e.id });
    expect(Buffer.compare(await leerTodo(d.flujo), Buffer.from(bytes))).toBe(0);
    expect(d).toMatchObject({
      nombre: "politica.pdf",
      tipo: "application/pdf",
      sha256: sha(bytes),
    });

    const h = (
      await hechos(A, "evidencia.creada", "evidencia.descargada")
    ).filter((x) => x.objeto === `evidencia:${e.id}`);
    expect(h.map((x) => [x.accion, x.objeto_version, x.usuario_id])).toEqual([
      ["evidencia.creada", sha(bytes), UA],
      ["evidencia.descargada", sha(bytes), UA],
    ]);
    expect(JSON.stringify(h)).not.toMatch(/PRIVADO|politica/);
  });

  it("las fechas llegan tal cual se guardaron, sin depender de la zona horaria del servidor", async () => {
    const control = await nuevoControl();
    const e = await subida(control.id, pdf(), {
      fechaHecho: "2026-01-01",
      vigenteHasta: "2026-12-31",
    });
    const [leida] = await c.listar.ejecutar({ ...yo, controlId: control.id });
    expect(leida).toMatchObject({
      id: e.id,
      fechaHecho: "2026-01-01",
      vigenteHasta: "2026-12-31",
    });
  });

  it("rechaza un ejecutable con nombre .pdf: sin fila, sin archivo y con el rechazo en la bitácora", async () => {
    const control = await nuevoControl();
    const antes = (await archivosEnDisco()).length;
    await expect(
      subida(control.id, ejecutable(), { nombreOriginal: "factura.pdf" }),
    ).rejects.toBeInstanceOf(ArchivoRechazadoError);
    await expect(
      subida(control.id, docxConMacros(), { nombreOriginal: "acta.docx" }),
    ).rejects.toMatchObject({ motivo: "tipo_no_permitido" });
    expect(
      await c.listar.ejecutar({
        ...yo,
        controlId: control.id,
        incluirHistoricas: true,
      }),
    ).toEqual([]);
    expect((await archivosEnDisco()).length).toBe(antes);
    const h = (await hechos(A, "evidencia.subida_rechazada")).slice(-2);
    expect(
      h.map((x) => [
        x.resultado,
        x.motivo,
        x.objeto_version === sha(ejecutable()) ||
          x.objeto_version === sha(docxConMacros()),
      ]),
    ).toEqual([
      ["rechazado", "tipo_no_permitido", true],
      ["rechazado", "tipo_no_permitido", true],
    ]);
    expect(JSON.stringify(h)).not.toContain("factura");
  });

  it("si falla la bitácora dentro de la transacción: ni fila, ni archivo, ni temporal", async () => {
    const control = await nuevoControl();
    const u = unidad();
    const sinBitacora = {
      ejecutar: (empresa: typeof A, fn: Parameters<typeof u.ejecutar>[1]) =>
        u.ejecutar(empresa, async (ctx) =>
          fn({
            ...ctx,
            bitacora: {
              registrar: async () => {
                throw new Error("bitácora caída");
              },
            },
          }),
        ),
    } as unknown as typeof u;
    const antes = await archivosEnDisco();
    await expect(
      casos(almacen, sinBitacora).subir.ejecutar({
        ...yo,
        controlId: control.id,
        ...datos,
        flujo: enTrozos(pdf()),
      }),
    ).rejects.toThrow("bitácora caída");
    expect(
      await c.listar.ejecutar({
        ...yo,
        controlId: control.id,
        incluirHistoricas: true,
      }),
    ).toEqual([]);
    expect(await archivosEnDisco()).toEqual(antes);
  });

  it("si falla el renombrado del archivo, la fila se deshace en la base real", async () => {
    const control = await nuevoControl();
    const roto: AlmacenArchivosPort = {
      guardarTemporal: (...a) => almacen.guardarTemporal(...a),
      abrirLector: (...a) => almacen.abrirLector(...a),
      confirmar: async () => {
        throw new Error("disco lleno");
      },
      descartar: (...a) => almacen.descartar(...a),
      abrir: (...a) => almacen.abrir(...a),
    };
    const antes = await archivosEnDisco();
    await expect(
      casos(roto).subir.ejecutar({
        ...yo,
        controlId: control.id,
        ...datos,
        flujo: enTrozos(pdf()),
      }),
    ).rejects.toThrow("disco lleno");
    expect(
      await c.listar.ejecutar({
        ...yo,
        controlId: control.id,
        incluirHistoricas: true,
      }),
    ).toEqual([]);
    expect(await archivosEnDisco()).toEqual(antes); // el temporal se descartó
    expect(
      (await hechos(A, "evidencia.creada")).some(
        (x) => x.objeto_version === null,
      ),
    ).toBe(false);
  });

  it("reemplaza: la anterior queda reemplazada (con su archivo) y la nueva la referencia; eliminar conserva el archivo", async () => {
    const control = await nuevoControl();
    const a = await subida(control.id, pdf());
    const bytes = png();
    const b = await c.reemplazar.ejecutar({
      ...yo,
      id: a.id,
      fechaHecho: "2026-11-10",
      nombreOriginal: "captura.png",
      flujo: enTrozos(bytes),
    });
    expect(b).toMatchObject({
      estado: "activa",
      reemplazaId: a.id,
      vigenteHasta: null,
    });
    const todas = await c.listar.ejecutar({
      ...yo,
      controlId: control.id,
      incluirHistoricas: true,
    });
    expect(todas.map((x) => [x.id, x.estado])).toEqual([
      [b.id, "activa"],
      [a.id, "reemplazada"],
    ]);
    expect((await c.descargar.ejecutar({ ...yo, id: a.id })).tipo).toBe(
      "application/pdf",
    ); // el historial se descarga
    await c.eliminar.ejecutar({ ...yo, id: b.id });
    await expect(
      c.descargar.ejecutar({ ...yo, id: b.id }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(
      (await c.listar.ejecutar({ ...yo, controlId: control.id })).length,
    ).toBe(0);
    const h = (
      await hechos(A, "evidencia.reemplazada", "evidencia.eliminada")
    ).filter((x) => x.objeto === `evidencia:${b.id}`);
    expect(h.map((x) => [x.accion, x.objeto_version])).toEqual([
      ["evidencia.reemplazada", sha(bytes)],
      ["evidencia.eliminada", sha(bytes)],
    ]);
  });

  it("dos subidas simultáneas al mismo control se turnan y ambas quedan", async () => {
    const control = await nuevoControl();
    const r = await Promise.all([
      subida(control.id, texto("primero\n")),
      subida(control.id, texto("segundo\n")),
    ]);
    expect(new Set(r.map((x) => x.id)).size).toBe(2);
    expect(
      (await c.listar.ejecutar({ ...yo, controlId: control.id })).length,
    ).toBe(2);
  });

  it("dos eliminaciones simultáneas de la misma evidencia: una gana y la otra recibe conflicto", async () => {
    const control = await nuevoControl();
    const e = await subida(control.id);
    const r = await Promise.allSettled([
      c.eliminar.ejecutar({ ...yo, id: e.id }),
      c.eliminar.ejecutar({ empresaId: A, usuarioId: UA2, id: e.id }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(
      (r.find((x) => x.status === "rejected") as PromiseRejectedResult).reason,
    ).toBeInstanceOf(ConflictoError);
    expect(
      (await hechos(A, "evidencia.eliminada")).filter(
        (x) => x.objeto === `evidencia:${e.id}`,
      ),
    ).toHaveLength(1);
  });

  it("dos reemplazos simultáneos de la misma evidencia: una gana, la otra recibe conflicto y no deja archivo huérfano", async () => {
    const control = await nuevoControl();
    const e = await subida(control.id);
    const antes = (await archivosEnDisco()).length;
    const r = await Promise.allSettled([
      c.reemplazar.ejecutar({
        ...yo,
        id: e.id,
        fechaHecho: "2026-11-10",
        flujo: enTrozos(png()),
      }),
      c.reemplazar.ejecutar({
        empresaId: A,
        usuarioId: UA2,
        id: e.id,
        fechaHecho: "2026-11-10",
        flujo: enTrozos(texto("otro\n")),
      }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(
      (r.find((x) => x.status === "rejected") as PromiseRejectedResult).reason,
    ).toBeInstanceOf(ConflictoError);
    expect((await archivosEnDisco()).length).toBe(antes + 1); // solo el archivo del que ganó
    expect(
      (await c.listar.ejecutar({ ...yo, controlId: control.id })).length,
    ).toBe(1);
  });

  it("la cobertura sale de la base: una evidencia en un control cubre todas las entradas que mapea", async () => {
    const control = await nuevoControl();
    await c.mapear.ejecutar({
      ...yo,
      controlId: control.id,
      libreriaCodigo: CODIGO_LIB,
      idEstable: "a27-5-1",
    });
    await c.mapear.ejecutar({
      ...yo,
      controlId: control.id,
      libreriaCodigo: CODIGO_LIB,
      idEstable: "a27-5-2",
    });
    const antes = await c.cobertura.ejecutar(yo);
    expect(antes.entradas.map((e) => e.estado)).toEqual([
      "sin_evidencia",
      "sin_evidencia",
    ]);
    await subida(control.id);
    const despues = await c.cobertura.ejecutar(yo);
    expect(despues.entradas.map((e) => e.estado)).toEqual([
      "cubierta",
      "cubierta",
    ]);
    expect(despues.total).toMatchObject({
      total: 2,
      cubiertas: 2,
      porcentaje: 100,
    });
    expect(despues.porNorma.map((x) => x.norma)).toEqual([
      "ISO 9001",
      "ISO/IEC 27001",
    ]);
  });

  it("AISLAMIENTO: B no ve, no descarga, no reemplaza ni elimina lo de A, y su archivo no se abre desde B", async () => {
    const control = await nuevoControl();
    const e = await subida(control.id);
    const b = { empresaId: B, usuarioId: UB };
    await expect(
      c.listar.ejecutar({ ...b, controlId: control.id }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      c.descargar.ejecutar({ ...b, id: e.id }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      c.eliminar.ejecutar({ ...b, id: e.id }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      c.reemplazar.ejecutar({
        ...b,
        id: e.id,
        fechaHecho: "2026-11-10",
        flujo: enTrozos(pdf()),
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      c.subir.ejecutar({
        ...b,
        controlId: control.id,
        ...datos,
        flujo: enTrozos(pdf()),
      }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    // El archivo de A no se abre usando la empresa B, aunque se conozca su identificador en el almacén.
    await expect(almacen.abrir(B, await filaArchivo(e.id))).rejects.toThrow();
    expect(
      (await c.listar.ejecutar({ ...yo, controlId: control.id })).map(
        (x) => x.estado,
      ),
    ).toEqual(["activa"]);
    expect((await archivosEnDisco(B)).length).toBe(0);
    expect(
      (
        await hechos(
          B,
          "evidencia.creada",
          "evidencia.descargada",
          "evidencia.eliminada",
          "evidencia.reemplazada",
        )
      ).length,
    ).toBe(0);
    const coberturaB = await c.cobertura.ejecutar(b);
    expect(coberturaB.entradas.every((x) => x.evidencias === 0)).toBe(true);
  });

  /** El nombre del archivo en el almacén (UUID) de una evidencia, leído directamente de la tabla. */
  const filaArchivo = async (id: string) =>
    (
      await conTenant(owner(), A, (trx) =>
        sql<{
          archivo_id: string;
        }>`select archivo_id from evidencia where id = ${id}`.execute(trx),
      )
    ).rows[0]!.archivo_id;
});
