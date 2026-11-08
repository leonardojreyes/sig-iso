import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Las pruebas de límites lanzan ESLint con el grafo de Nx: pueden tardar unos segundos.
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["**/*.test.ts"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 },
      reporter: ["text-summary", "lcov"],
    },
  },
});
