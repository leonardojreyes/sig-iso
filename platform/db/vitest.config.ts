import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Las pruebas de integración leen las URLs de las bases desde `.env.local` (lo crea `pnpm db:init`).
// En CI las variables llegan por el entorno del trabajo. Solo se cargan las DATABASE_URL_*.
const cargarUrls = (): Record<string, string> => {
  // SIGISO_SIN_BASE=1 corre solo las pruebas unitarias, aunque exista .env.local (útil para reproducir el CI de macOS y Windows).
  if (process.env.SIGISO_SIN_BASE === '1') return {};
  const archivo = join(import.meta.dirname, '../../.env.local');
  if (!existsSync(archivo)) return {};
  const urls: Record<string, string> = {};
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = /^(DATABASE_URL_[A-Z]+)=(.+)$/.exec(linea);
    if (m?.[1] && m[2]) urls[m[1]] = m[2];
  }
  return urls;
};

const env = cargarUrls();
// El código de acceso a datos solo se cubre con las pruebas de integración (PostgreSQL real). Sin base de datos (macOS y
// Windows del CI) esas pruebas se omiten y no se puede exigir el umbral; se exige en el trabajo `integracion` del CI.
const hayBase = Boolean(env.DATABASE_URL_TEST && env.DATABASE_URL_OWNER);

export default defineConfig({
  test: {
    env,
    globalSetup: ['./test/migrar-global.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/*.test.ts'],
      thresholds: hayBase ? { lines: 80, functions: 80, statements: 80, branches: 80 } : {},
      reporter: ['text-summary', 'lcov'],
    },
  },
});
