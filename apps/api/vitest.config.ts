import { join } from 'node:path';
import { cargarUrlsDePrueba } from '@sig/db/pruebas-env';
import { defineConfig } from 'vitest/config';

// Algunas pruebas usan PostgreSQL real (bitácora) y migran sigiso_test antes de correr; sin base se omiten.
const env = cargarUrlsDePrueba(join(import.meta.dirname, '../../.env.local'));

export default defineConfig({
  test: {
    env,
    globalSetup: ['./test/migrar-global.ts'],
    testTimeout: 30_000,
  },
});
