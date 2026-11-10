import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// Límites hexagonales de `modules/asistente`, verificados con la configuración REAL de ESLint del repositorio (misma técnica que
// platform/tenancy/src/limites.test.ts). Si el módulo no existe en el grafo de Nx con la etiqueta `type:module`, estas pruebas fallan.
const raiz = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const NX = "@nx/enforce-module-boundaries";
const RESTRINGIDAS = "no-restricted-imports";

let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint({ cwd: raiz });
});

const violaciones = async (
  codigo: string,
  archivo: string,
  regla: string,
): Promise<string[]> => {
  const [resultado] = await eslint.lintText(codigo, {
    filePath: resolve(raiz, archivo),
  });
  return (resultado?.messages ?? [])
    .filter((m) => m.ruleId === regla)
    .map((m) => m.message);
};

describe("límites de modules/asistente (type:module)", () => {
  it("no puede importar otro módulo (modules/normas ni modules/empresas): se compone en apps/api", async () => {
    for (const otro of ["@sig/normas", "@sig/empresas"]) {
      const v = await violaciones(
        `import * as x from '${otro}';\nexport const y = x;\n`,
        "modules/asistente/src/application/prueba.ts",
        NX,
      );
      expect(v.length, otro).toBeGreaterThan(0);
    }
  });

  it("no puede importar apps/ (una importación relativa que cruza de proyecto)", async () => {
    const v = await violaciones(
      "import * as x from '../../../../apps/api/src/main';\nexport const y = x;\n",
      "modules/asistente/src/application/prueba.ts",
      NX,
    );
    expect(v.length).toBeGreaterThan(0);
  });

  it.each([
    "@sig/tenancy",
    "@sig/auditoria",
    "@sig/normas-schema",
    "@sig/prompts",
  ])("sí puede importar %s (platform o package)", async (paquete) => {
    const v = await violaciones(
      `import '${paquete}';\n`,
      "modules/asistente/src/application/prueba.ts",
      NX,
    );
    expect(v).toEqual([]);
  });

  it("otro módulo no puede importar @sig/asistente", async () => {
    const v = await violaciones(
      "import * as x from '@sig/asistente';\nexport const y = x;\n",
      "modules/normas/src/application/prueba.ts",
      NX,
    );
    expect(v.length).toBeGreaterThan(0);
  });

  it("un paquete (type:package) no puede importar @sig/asistente", async () => {
    const v = await violaciones(
      "import * as x from '@sig/asistente';\nexport const y = x;\n",
      "packages/prompts/src/prueba.ts",
      NX,
    );
    expect(v.length).toBeGreaterThan(0);
  });
});

// Dominio y aplicación no conocen librerías de infraestructura, el sistema de archivos ni el contexto de empresa de AsyncLocalStorage.
const PROHIBIDAS = [
  "kysely",
  "jose",
  "ajv",
  "yaml",
  "node:fs",
  "node:path",
  "node:async_hooks",
  "@sig/tenancy/contexto",
];

describe.each(["domain", "application"])(
  "importaciones prohibidas en %s",
  (capa) => {
    const archivo = `modules/asistente/src/${capa}/prueba.ts`;

    it.each(PROHIBIDAS)("rechaza importar %s", async (paquete) => {
      const v = await violaciones(
        `import * as x from '${paquete}';\nexport const y = x;\n`,
        archivo,
        RESTRINGIDAS,
      );
      expect(v.length).toBeGreaterThan(0);
    });

    it("acepta importar código propio de la misma capa y el tipo puro EmpresaId", async () => {
      const v = await violaciones(
        "import { x } from './otro';\nimport type { EmpresaId } from '@sig/tenancy';\nexport const y = x;\nexport type Z = EmpresaId;\n",
        archivo,
        RESTRINGIDAS,
      );
      expect(v).toEqual([]);
    });
  },
);

describe("importaciones permitidas en infrastructure", () => {
  it.each(["kysely", "node:fs"])("acepta importar %s", async (paquete) => {
    const v = await violaciones(
      `import * as x from '${paquete}';\nexport const y = x;\n`,
      "modules/asistente/src/infrastructure/prueba.ts",
      RESTRINGIDAS,
    );
    expect(v).toEqual([]);
  });
});
