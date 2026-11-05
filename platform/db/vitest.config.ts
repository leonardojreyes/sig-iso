import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Las pruebas de integración leen las URLs de las bases desde `.env.local` (lo crea `pnpm db:init`).
// En CI las variables llegan por el entorno del trabajo. Solo se cargan las DATABASE_URL_*.
const cargarUrls = (): Record<string, string> => {
  const archivo = join(import.meta.dirname, '../../.env.local');
  if (!existsSync(archivo)) return {};
  const urls: Record<string, string> = {};
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = /^(DATABASE_URL_[A-Z]+)=(.+)$/.exec(linea);
    if (m?.[1] && m[2]) urls[m[1]] = m[2];
  }
  return urls;
};

export default defineConfig({
  test: {
    env: cargarUrls(),
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 },
      reporter: ['text-summary', 'lcov'],
    },
  },
});
