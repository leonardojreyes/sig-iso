// Ejecutor de migraciones SQL (ADR 024). Cada archivo `NNNN_nombre.sql` de `migrations/` se aplica una sola vez, en orden,
// con el rol dueño. Usa el Migrator de Kysely: lleva el registro de lo aplicado y bloquea ejecuciones simultáneas.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sql, type Kysely } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';

export const CARPETA_MIGRACIONES = join(import.meta.dirname, '../migrations');

const NOMBRE = /^(\d{4}_[a-z0-9_]+)\.sql$/;

export class MigracionInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'MigracionInvalidaError';
  }
}

export class MigracionFallidaError extends Error {
  constructor(
    readonly migracion: string,
    causa?: unknown,
  ) {
    super(`La migración "${migracion}" falló y se revirtió${causa instanceof Error ? `: ${causa.message}` : ''}`, { cause: causa });
    this.name = 'MigracionFallidaError';
  }
}

export interface MigracionSql {
  readonly nombre: string;
  readonly sql: string;
}

/** Lee las migraciones .sql de una carpeta, ordenadas por nombre. Rechaza nombres mal formados y archivos vacíos. */
export const leerMigracionesSql = (carpeta: string): MigracionSql[] => {
  if (!existsSync(carpeta) || !statSync(carpeta).isDirectory()) throw new MigracionInvalidaError('La carpeta de migraciones no existe');
  const migraciones: MigracionSql[] = [];
  for (const archivo of readdirSync(carpeta).sort()) {
    if (!archivo.endsWith('.sql')) continue;
    const m = NOMBRE.exec(archivo);
    if (!m?.[1]) throw new MigracionInvalidaError(`Nombre de migración no válido: "${archivo}" (se espera NNNN_nombre_en_minusculas.sql)`);
    const contenido = readFileSync(join(carpeta, archivo), 'utf8');
    if (contenido.trim() === '') throw new MigracionInvalidaError(`La migración "${archivo}" está vacía`);
    migraciones.push({ nombre: m[1], sql: contenido });
  }
  return migraciones;
};

export interface OpcionesMigracion {
  readonly carpeta?: string;
  readonly tablaControl?: string;
  readonly tablaBloqueo?: string;
}

export interface ResultadoEjecucion {
  readonly error?: unknown;
  readonly results?: readonly { readonly migrationName: string; readonly status: 'Success' | 'Error' | 'NotExecuted' }[];
}

const pausar = (ms: number): Promise<void> => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/**
 * Ejecuta el migrador y devuelve lo aplicado.
 *
 * - Si una migración falla, se informa con su nombre y NO se reintenta: se revirtió y reintentar no la arregla.
 * - Si falla la preparación del registro de migraciones (no hay ninguna migración fallida, así que no se aplicó nada), se
 *   reintenta unas veces. Motivo: Kysely inspecciona TODAS las tablas del esquema con `pg_get_serial_sequence(tabla, columna)`
 *   y esa llamada falla si otra sesión borra una tabla en ese instante (ocurre al correr pruebas en paralelo).
 */
export const ejecutarConReintentos = async (ejecutar: () => Promise<ResultadoEjecucion>, opciones: { intentos?: number; pausaMs?: number } = {}): Promise<{ aplicadas: string[] }> => {
  const intentos = opciones.intentos ?? 6;
  const pausaMs = opciones.pausaMs ?? 100;
  for (let intento = 1; ; intento++) {
    const { error, results } = await ejecutar();
    const fallida = results?.find((r) => r.status === 'Error');
    if (fallida) throw new MigracionFallidaError(fallida.migrationName, error);
    if (!error) return { aplicadas: (results ?? []).filter((r) => r.status === 'Success').map((r) => r.migrationName) };
    if (intento >= intentos) throw new MigracionFallidaError('(registro de migraciones)', error);
    await pausar(pausaMs * intento);
  }
};

/** Aplica las migraciones pendientes. Si una falla se revierte y se lanza `MigracionFallidaError` con su nombre. */
export const migrarAlUltimo = async (db: Kysely<unknown>, opciones: OpcionesMigracion = {}): Promise<{ aplicadas: string[] }> => {
  const migraciones = leerMigracionesSql(opciones.carpeta ?? CARPETA_MIGRACIONES);
  const proveedor: MigrationProvider = {
    getMigrations: async () =>
      Object.fromEntries(
        migraciones.map((m): [string, Migration] => [
          m.nombre,
          {
            up: async (trx) => {
              await sql.raw(m.sql).execute(trx);
            },
          },
        ]),
      ),
  };
  const migrator = new Migrator({
    db,
    provider: proveedor,
    migrationTableName: opciones.tablaControl ?? 'kysely_migration',
    migrationLockTableName: opciones.tablaBloqueo ?? 'kysely_migration_lock',
  });
  return ejecutarConReintentos(() => migrator.migrateToLatest());
};
