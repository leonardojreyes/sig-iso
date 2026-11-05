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
  const { error, results } = await migrator.migrateToLatest();
  const fallida = results?.find((r) => r.status === 'Error');
  if (fallida) throw new MigracionFallidaError(fallida.migrationName, error);
  if (error) throw new MigracionFallidaError('(registro de migraciones)', error);
  return { aplicadas: (results ?? []).filter((r) => r.status === 'Success').map((r) => r.migrationName) };
};
