import { join } from 'node:path';
import { cargarUrlsDePrueba } from '@sig/db/pruebas-env';
import { defineConfig } from 'vitest/config';

const env = cargarUrlsDePrueba(join(import.meta.dirname, '../../.env.local'));

export default defineConfig({
  test: {
    env,
    globalSetup: ['./test/migrar-global.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      // El dominio y los casos de uso exigen 80 %. El adaptador de PostgreSQL lo cubre su prueba de integración (trabajo `integracion`).
      include: ['src/domain/**', 'src/application/**'],
      exclude: ['**/*.test.ts', '**/*.port.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 },
      reporter: ['text-summary', 'lcov'],
    },
  },
});
