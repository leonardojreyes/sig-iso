// Un pool de conexiones por rol de base de datos, creado cuando se pide por primera vez (sin conexiones al construir).
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { RolBd, UrlsPorRol } from './configuracion';

export interface OpcionesPool {
  /** Máximo de conexiones por rol. Pequeño a propósito: el equipo de desarrollo tiene 8 GB. */
  readonly max?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
}

export interface EstadisticasPool {
  readonly total: number;
  readonly inactivas: number;
  readonly esperando: number;
}

export class GestorPools {
  private readonly pools = new Map<RolBd, pg.Pool>();
  private readonly kyselys = new Map<RolBd, Kysely<unknown>>();
  private cerrado = false;

  constructor(
    private readonly urls: UrlsPorRol,
    private readonly opciones: OpcionesPool = {},
  ) {}

  /** Pool del rol. Falla si ya se cerró el gestor o si el rol no tiene URL. */
  pool(rol: RolBd): pg.Pool {
    this.asegurarAbierto();
    const existente = this.pools.get(rol);
    if (existente) return existente;
    const url = this.urls[rol];
    if (!url) throw new Error(`No hay URL configurada para el rol de base de datos "${rol}"`);
    const pool = new pg.Pool({
      connectionString: url,
      application_name: `sigiso-${rol}`,
      max: this.opciones.max ?? 5,
      idleTimeoutMillis: this.opciones.idleTimeoutMillis ?? 10_000,
      connectionTimeoutMillis: this.opciones.connectionTimeoutMillis ?? 5_000,
    });
    // Un error en una conexión inactiva no debe tumbar el proceso.
    pool.on('error', () => {});
    this.pools.set(rol, pool);
    return pool;
  }

  /** Kysely sobre el pool del rol. El tipo `DB` lo define cada módulo. */
  db<DB = unknown>(rol: RolBd): Kysely<DB> {
    this.asegurarAbierto();
    const existente = this.kyselys.get(rol);
    if (existente) return existente as Kysely<DB>;
    const kysely = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: this.pool(rol) }) });
    this.kyselys.set(rol, kysely);
    return kysely as Kysely<DB>;
  }

  estadisticas(): Partial<Record<RolBd, EstadisticasPool>> {
    const resultado: Partial<Record<RolBd, EstadisticasPool>> = {};
    for (const [rol, pool] of this.pools) {
      resultado[rol] = { total: pool.totalCount, inactivas: pool.idleCount, esperando: pool.waitingCount };
    }
    return resultado;
  }

  /** Cierra todos los pools. Se puede llamar varias veces. */
  async cerrar(): Promise<void> {
    this.cerrado = true;
    const pendientes: Promise<void>[] = [];
    for (const [rol, pool] of this.pools) {
      const kysely = this.kyselys.get(rol);
      // `Kysely.destroy()` cierra el pool que le dimos; sin Kysely se cierra el pool directamente.
      if (kysely) pendientes.push(kysely.destroy());
      else if (!pool.ended) pendientes.push(pool.end());
    }
    await Promise.all(pendientes);
  }

  private asegurarAbierto(): void {
    if (this.cerrado) throw new Error('El gestor de pools está cerrado');
  }
}
