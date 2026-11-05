import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/*.test.ts', 'src/prueba/**', 'src/**/*.port.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 },
      reporter: ['text-summary', 'lcov'],
    },
  },
});
