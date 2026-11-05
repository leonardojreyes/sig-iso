import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// Verifica las reglas de límites de Nx sobre `platform/` con la configuración real del repositorio.
const raiz = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const REGLA = "@nx/enforce-module-boundaries";

let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint({ cwd: raiz });
});

const violaciones = async (
  codigo: string,
  archivo: string,
): Promise<string[]> => {
  const [resultado] = await eslint.lintText(codigo, {
    filePath: resolve(raiz, archivo),
  });
  return (resultado?.messages ?? [])
    .filter((m) => m.ruleId === REGLA)
    .map((m) => m.message);
};

describe("límites de platform/ (type:platform)", () => {
  it("platform no puede importar un módulo", async () => {
    const v = await violaciones(
      "import { Norma } from '@sig/normas';\nexport const x = Norma;\n",
      "platform/tenancy/src/prueba.ts",
    );
    expect(v.length).toBeGreaterThan(0);
  });

  it("un módulo sí puede importar platform", async () => {
    const v = await violaciones(
      "import '@sig/tenancy';\n",
      "modules/normas/src/prueba.ts",
    );
    expect(v).toEqual([]);
  });

  it("platform sí puede importar paquetes (type:package)", async () => {
    const v = await violaciones(
      "import '@sig/tokens';\n",
      "platform/tenancy/src/prueba.ts",
    );
    expect(v).toEqual([]);
  });

  it("un paquete no puede importar platform", async () => {
    const v = await violaciones(
      "import '@sig/tenancy';\n",
      "packages/tokens/src/prueba.ts",
    );
    expect(v.length).toBeGreaterThan(0);
  });
});
