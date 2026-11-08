import { afterAll, describe, expect, it } from 'vitest';
import { leerUrls, ROLES_BD, type RolBd } from './configuracion';
import { GestorPools } from './pools';

// Integración con PostgreSQL real (bases creadas por `pnpm db:init`). Se omite si no hay URLs en el entorno.
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('GestorPools (PostgreSQL real)', () => {
  const gestor = hayBase ? new GestorPools(leerUrls(process.env, ROLES_BD, { prueba: true })) : undefined;
  afterAll(async () => {
    await gestor?.cerrar();
  });

  const esperado: Record<RolBd, string> = { owner: 'sigiso_owner', app: 'sigiso_app', catalogo: 'sigiso_catalogo', plataforma: 'sigiso_plataforma' };

  it.each(ROLES_BD)('el pool del rol %s se conecta con ese rol a la base de pruebas', async (rol) => {
    const { rows } = await gestor!.pool(rol).query('select current_user as u, current_database() as b');
    expect(rows[0]).toEqual({ u: esperado[rol], b: 'sigiso_test' });
  });

  it.each(ROLES_BD)('el rol %s no es superusuario ni tiene BYPASSRLS', async (rol) => {
    const { rows } = await gestor!.pool(rol).query('select rolsuper, rolbypassrls from pg_roles where rolname = current_user');
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('Kysely ejecuta consultas por el pool del rol', async () => {
    const { rows } = await (await import('kysely')).sql<{ u: string }>`select current_user as u`.execute(gestor!.db('app'));
    expect(rows[0]?.u).toBe('sigiso_app');
  });

  it('identifica la aplicación en la conexión', async () => {
    const { rows } = await gestor!.pool('app').query('show application_name');
    expect(rows[0]?.application_name).toBe('sigiso-app');
  });

  it('cerrar libera todas las conexiones', async () => {
    const otro = new GestorPools(leerUrls(process.env, ['app'], { prueba: true }));
    await otro.pool('app').query('select 1');
    expect(otro.estadisticas().app?.total).toBeGreaterThan(0);
    await otro.cerrar();
    expect(otro.estadisticas().app?.total).toBe(0);
  });
});
