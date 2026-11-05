import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import { cargarUrlsDePrueba, hayBaseDePruebas } from './src/pruebas-env';

const env = cargarUrlsDePrueba(join(import.meta.dirname, '../../.env.local'));
// El código de acceso a datos solo se cubre con las pruebas de integración (PostgreSQL real). Sin base de datos (macOS y
// Windows del CI) esas pruebas se omiten y no se puede exigir el umbral; se exige en el trabajo `integracion` del CI.
const hayBase = hayBaseDePruebas(env);

export default defineConfig({
  test: {
    env,
    globalSetup: ['./test/migrar-global.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/*.test.ts', 'src/pruebas.ts', 'src/pruebas-env.ts'],
      thresholds: hayBase ? { lines: 80, functions: 80, statements: 80, branches: 80 } : {},
      reporter: ['text-summary', 'lcov'],
    },
  },
});
