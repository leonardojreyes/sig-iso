import { join } from 'node:path';
import { cargarUrlsDePrueba } from '@sig/db/pruebas-env';
import { defineConfig } from 'vitest/config';

// Las pruebas de integración usan PostgreSQL real (roles y bases) y migran sigiso_test antes de correr.
const env = cargarUrlsDePrueba(join(import.meta.dirname, '../.env.local'));

export default defineConfig({
  test: {
    env,
    globalSetup: ['./test/migrar-global.ts'],
    // Las pruebas de integración crean roles y bases reales en PostgreSQL (CREATE DATABASE hace checkpoint).
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
