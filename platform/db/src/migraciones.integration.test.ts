import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerUrls } from './configuracion';
import { GestorPools } from './pools';
import { MigracionFallidaError, migrarAlUltimo } from './migraciones';

const hayBase = !!process.env.DATABASE_URL_OWNER && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('migrarAlUltimo (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ['owner'], { prueba: true }) : {});
  // Nombres aleatorios y propios de esta prueba: no tocan el esquema real ni la tabla de migraciones real.
  const sufijo = randomBytes(4).toString('hex');
  const tablaControl = `prueba_mig_control_${sufijo}`;
  const tablaBloqueo = `prueba_mig_bloqueo_${sufijo}`;
  const tabla = (n: string) => `prueba_mig_${n}_${sufijo}`;
  let carpeta: string;
  const db = () => pools.db('owner');
  const existe = async (nombre: string) => {
    const r = await sql<{ e: boolean }>`select to_regclass(${'public.' + nombre}) is not null as e`.execute(db());
    return r.rows[0]?.e === true;
  };

  beforeAll(() => {
    carpeta = mkdtempSync(join(tmpdir(), 'sigiso-mig-'));
    writeFileSync(join(carpeta, '0001_a.sql'), `create table public.${tabla('a')} (id int);\ninsert into public.${tabla('a')} values (1);`);
    writeFileSync(join(carpeta, '0002_b.sql'), `create table public.${tabla('b')} (id int);`);
  });

  afterAll(async () => {
    if (!sufijo || !tablaControl.startsWith('prueba_mig_')) throw new Error('Limpieza rechazada: nombre inesperado');
    for (const t of [tabla('a'), tabla('b'), tabla('c'), tablaControl, tablaBloqueo]) {
      await sql.raw(`drop table if exists public.${t}`).execute(db());
    }
    rmSync(carpeta, { recursive: true, force: true });
    await pools.cerrar();
  });

  const opciones = () => ({ carpeta, tablaControl, tablaBloqueo });

  it('aplica las migraciones pendientes en orden', async () => {
    const r = await migrarAlUltimo(db(), opciones());
    expect(r.aplicadas).toEqual(['0001_a', '0002_b']);
    expect(await existe(tabla('a'))).toBe(true);
    expect(await existe(tabla('b'))).toBe(true);
  });

  it('es idempotente: la segunda vez no aplica nada', async () => {
    const r = await migrarAlUltimo(db(), opciones());
    expect(r.aplicadas).toEqual([]);
    const filas = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(tabla('a'))}`.execute(db());
    expect(filas.rows[0]?.n).toBe(1);
  });

  it('aplica solo las migraciones nuevas', async () => {
    writeFileSync(join(carpeta, '0003_c.sql'), `create table public.${tabla('c')} (id int);`);
    const r = await migrarAlUltimo(db(), opciones());
    expect(r.aplicadas).toEqual(['0003_c']);
  });

  it('si una migración falla, se revierte completa y se nombra cuál fue', async () => {
    const nueva = `prueba_mig_parcial_${sufijo}`;
    writeFileSync(join(carpeta, '0004_mala.sql'), `create table public.${nueva} (id int);\nselect 1/0;`);
    await expect(migrarAlUltimo(db(), opciones())).rejects.toThrow(MigracionFallidaError);
    await expect(migrarAlUltimo(db(), opciones())).rejects.toThrow(/0004_mala/);
    expect(await existe(nueva)).toBe(false);
  });
});
