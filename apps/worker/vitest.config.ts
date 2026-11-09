import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["**/*.test.ts", "src/main.ts"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 },
      reporter: ["text-summary", "lcov"],
    },
  },
});
