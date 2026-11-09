// Punto de control del sondeo: hora (ms) del último evento procesado. Escritura atómica (temporal + rename), privada.
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface PuntoControlPort {
  leer(): Promise<number | null>;
  guardar(hasta: number): Promise<void>;
}

const MINIMO = Date.UTC(2020, 0, 1);
const MAXIMO = Date.UTC(2100, 0, 1);

const valido = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= MINIMO && v <= MAXIMO;
const dañado = (): never => {
  throw new Error(
    "El punto de control está dañado o no es válido: revíselo antes de continuar.",
  );
};

export class PuntoControlArchivo implements PuntoControlPort {
  constructor(private readonly ruta: string) {}

  async leer(): Promise<number | null> {
    let texto: string;
    try {
      texto = await readFile(this.ruta, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    let dato: unknown;
    try {
      dato = JSON.parse(texto);
    } catch {
      return dañado();
    }
    const hasta =
      typeof dato === "object" && dato !== null && !Array.isArray(dato)
        ? (dato as { hasta?: unknown }).hasta
        : undefined;
    return valido(hasta) ? hasta : dañado();
  }

  async guardar(hasta: number): Promise<void> {
    if (!valido(hasta)) dañado();
    await mkdir(dirname(this.ruta), { recursive: true });
    const temporal = join(
      dirname(this.ruta),
      `.pc-${process.pid}-${Date.now()}.tmp`,
    );
    try {
      await writeFile(temporal, `${JSON.stringify({ hasta })}\n`, {
        mode: 0o600,
      });
      await rename(temporal, this.ruta);
    } finally {
      await rm(temporal, { force: true });
    }
  }
}
