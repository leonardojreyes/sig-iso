import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PuntoControlArchivo } from "./punto-control";

let carpeta: string;
beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), "worker-pc-"));
});
afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

const HORA = 1_794_000_000_000;

describe("PuntoControlArchivo", () => {
  it("sin archivo no hay punto de control (null)", async () => {
    expect(
      await new PuntoControlArchivo(join(carpeta, "pc.json")).leer(),
    ).toBeNull();
  });

  it("guarda y vuelve a leer, creando la carpeta si falta", async () => {
    const ruta = join(carpeta, "sub", "pc.json");
    const pc = new PuntoControlArchivo(ruta);
    await pc.guardar(HORA);
    expect(await pc.leer()).toBe(HORA);
    expect(await new PuntoControlArchivo(ruta).leer()).toBe(HORA);
  });

  it("el archivo es privado (0600) y solo guarda la hora", async () => {
    const ruta = join(carpeta, "pc.json");
    await new PuntoControlArchivo(ruta).guardar(HORA);
    if (process.platform !== "win32")
      expect(statSync(ruta).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(ruta, "utf8"))).toEqual({ hasta: HORA });
  });

  it("sobrescribe sin dejar archivos temporales", async () => {
    const ruta = join(carpeta, "pc.json");
    const pc = new PuntoControlArchivo(ruta);
    await pc.guardar(HORA);
    await pc.guardar(HORA + 5);
    expect(await pc.leer()).toBe(HORA + 5);
    expect(readdirSync(carpeta)).toEqual(["pc.json"]);
  });

  it.each([
    ["texto", "no json"],
    ["sin campo", "{}"],
    ["hora como texto", '{"hasta":"1"}'],
    ["hora decimal", '{"hasta":1.5}'],
    ["hora negativa", '{"hasta":-1}'],
    ["hora fuera de rango", '{"hasta":99999999999999999}'],
    ["arreglo", "[1]"],
  ])(
    "un archivo dañado (%s) falla con un error claro en vez de reiniciar en silencio",
    async (_n, contenido) => {
      const ruta = join(carpeta, "pc.json");
      writeFileSync(ruta, contenido);
      await expect(new PuntoControlArchivo(ruta).leer()).rejects.toThrow(
        /punto de control/i,
      );
    },
  );

  it.each([
    [1.5],
    [-1],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [0],
    [Date.UTC(2101, 0, 1)],
  ])("rechaza guardar %s", async (valor) => {
    const ruta = join(carpeta, "pc.json");
    await expect(new PuntoControlArchivo(ruta).guardar(valor)).rejects.toThrow(
      /punto de control/i,
    );
    expect(readdirSync(carpeta)).toEqual([]);
  });

  it("un error distinto de «no existe» al leer se propaga", async () => {
    const ruta = join(carpeta, "pc.json");
    mkdirSync(ruta); // es una carpeta: leerla da EISDIR
    await expect(new PuntoControlArchivo(ruta).leer()).rejects.toThrow();
  });
});
