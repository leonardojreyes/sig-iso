// Lo que necesitan los ARCHIVOS DE CONFIGURACIÓN de vitest. No importa nada del paquete a propósito: Vite carga estos
// archivos con Node directamente y no resuelve importaciones sin extensión.
import { existsSync, readFileSync } from 'node:fs';

/**
 * URLs de las bases desde `.env.local` (lo crea `pnpm db:init`). En CI las variables llegan por el entorno del trabajo.
 * Solo se cargan las DATABASE_URL_*. Con SIGISO_SIN_BASE=1 no se carga nada: corren solo las pruebas unitarias,
 * como en macOS y Windows del CI (útil para reproducirlo en local).
 */
export const cargarUrlsDePrueba = (archivoEnvLocal: string): Record<string, string> => {
  if (process.env.SIGISO_SIN_BASE === '1' || !existsSync(archivoEnvLocal)) return {};
  const urls: Record<string, string> = {};
  for (const linea of readFileSync(archivoEnvLocal, 'utf8').split(/\r?\n/)) {
    const m = /^(DATABASE_URL_[A-Z]+)=(.+)$/.exec(linea);
    if (m?.[1] && m[2]) urls[m[1]] = m[2];
  }
  return urls;
};

/** Hay base de datos de pruebas configurada (dueño y base de pruebas). */
export const hayBaseDePruebas = (env: Readonly<Record<string, string | undefined>>): boolean => Boolean(env.DATABASE_URL_OWNER && env.DATABASE_URL_TEST);
