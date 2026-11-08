import { join } from 'node:path';
import { cargarUrlsDePrueba, hayBaseDePruebas } from '@sig/db/pruebas-env';
import { defineConfig } from 'vitest/config';

const env = cargarUrlsDePrueba(join(import.meta.dirname, '../../.env.local'));
// El adaptador de base de datos solo se cubre con las pruebas de integración. Sin base de datos (macOS y Windows del CI) se
// omiten y no se puede exigir el umbral; se exige en el trabajo `integracion` del CI.
const hayBase = hayBaseDePruebas(env);

export default defineConfig({
  test: {
    env,
    globalSetup: ['./test/migrar-global.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/*.test.ts', 'src/prueba/**', 'src/**/*.port.ts'],
      thresholds: hayBase ? { lines: 80, functions: 80, statements: 80, branches: 80 } : {},
      reporter: ['text-summary', 'lcov'],
    },
  },
});
