import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// Verifica las reglas de límites de Nx sobre `platform/` con la configuración real del repositorio.
const raiz = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const REGLA = "@nx/enforce-module-boundaries";
const RESTRINGIDAS = "no-restricted-imports";

let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint({ cwd: raiz });
});

const violaciones = async (
  codigo: string,
  archivo: string,
  regla = REGLA,
): Promise<string[]> => {
  const [resultado] = await eslint.lintText(codigo, {
    filePath: resolve(raiz, archivo),
  });
  return (resultado?.messages ?? [])
    .filter((m) => m.ruleId === regla)
    .map((m) => m.message);
};

describe("límites de platform/ (type:platform)", () => {
  it("platform no puede importar un módulo", async () => {
    const v = await violaciones(
      "import { Libreria } from '@sig/normas';\nexport const x = Libreria;\n",
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

// Dominio y aplicación no conocen librerías de infraestructura ni el sistema de archivos (hexagonal).
const prohibidas = [
  "kysely",
  "jose",
  "ajv",
  "ajv/dist/2020",
  "yaml",
  "node:fs",
  "node:async_hooks",
  "node:path",
  "@sig/tenancy/contexto",
];

describe.each(["domain", "application"])(
  "importaciones prohibidas en %s",
  (capa) => {
    const archivo = `modules/normas/src/${capa}/prueba.ts`;

    it.each(prohibidas)("rechaza importar %s", async (paquete) => {
      const v = await violaciones(
        `import * as x from '${paquete}';\nexport const y = x;\n`,
        archivo,
        RESTRINGIDAS,
      );
      expect(v.length).toBeGreaterThan(0);
    });

    it("acepta importar código propio de la misma capa", async () => {
      const v = await violaciones(
        "import { x } from './otro';\nexport const y = x;\n",
        archivo,
        RESTRINGIDAS,
      );
      expect(v).toEqual([]);
    });
  },
);

describe("importaciones permitidas en infrastructure", () => {
  it.each(["kysely", "jose", "yaml", "node:fs"])(
    "acepta importar %s",
    async (paquete) => {
      const v = await violaciones(
        `import * as x from '${paquete}';\nexport const y = x;\n`,
        "modules/normas/src/infrastructure/prueba.ts",
        RESTRINGIDAS,
      );
      expect(v).toEqual([]);
    },
  );
});

describe("uso de @sig/tenancy", () => {
  it("el dominio puede importar el tipo puro EmpresaId", async () => {
    const v = await violaciones(
      "import type { EmpresaId } from '@sig/tenancy';\nexport type X = EmpresaId;\n",
      "modules/normas/src/domain/prueba.ts",
      RESTRINGIDAS,
    );
    expect(v).toEqual([]);
  });

  it.each(["infrastructure", "interface"])(
    "%s puede importar el contexto de empresa sin violar los límites de Nx",
    async (capa) => {
      const v = await violaciones(
        "import { empresaActual } from '@sig/tenancy/contexto';\nexport const x = empresaActual;\n",
        `modules/normas/src/${capa}/prueba.ts`,
      );
      expect(v).toEqual([]);
    },
  );
});

describe("platform puede depender de otro platform", () => {
  it("platform/db puede importar @sig/tenancy", async () => {
    const v = await violaciones(
      "import { crearEmpresaId } from '@sig/tenancy';\nexport const x = crearEmpresaId;\n",
      "platform/db/src/prueba.ts",
    );
    expect(v).toEqual([]);
  });

  it("platform sigue sin poder importar un módulo", async () => {
    const v = await violaciones(
      "import { Libreria } from '@sig/normas';\nexport const x = Libreria;\n",
      "platform/db/src/prueba.ts",
    );
    expect(v.length).toBeGreaterThan(0);
  });
});
