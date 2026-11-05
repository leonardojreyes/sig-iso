import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Las pruebas de integración crean roles y bases reales en PostgreSQL (CREATE DATABASE hace checkpoint).
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
