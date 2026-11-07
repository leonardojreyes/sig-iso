import { afterEach, describe, expect, it } from 'vitest';
import { GestorPools } from './pools';

const urls = {
  app: 'postgresql://sigiso_app:x@127.0.0.1:1/sigiso',
  plataforma: 'postgresql://sigiso_plataforma:x@127.0.0.1:1/sigiso',
};

// Estas pruebas no abren conexiones: un pool de pg es perezoso hasta la primera consulta.
describe('GestorPools (sin conexión)', () => {
  let gestor: GestorPools | undefined;
  afterEach(async () => {
    await gestor?.cerrar();
    gestor = undefined;
  });

  it('crea un pool por rol y reutiliza el mismo', () => {
    gestor = new GestorPools(urls);
    expect(gestor.pool('app')).toBe(gestor.pool('app'));
    expect(gestor.pool('app')).not.toBe(gestor.pool('plataforma'));
  });

  it('entrega la misma instancia de Kysely por rol', () => {
    gestor = new GestorPools(urls);
    expect(gestor.db('app')).toBe(gestor.db('app'));
  });

  it('falla de forma clara si se pide un rol sin URL', () => {
    gestor = new GestorPools(urls);
    expect(() => gestor!.pool('owner')).toThrow(/owner/);
  });

  it('limita el tamaño de los pools (equipo de 8 GB)', () => {
    gestor = new GestorPools(urls);
    expect(gestor.pool('app').options.max).toBeLessThanOrEqual(5);
  });

  it('cerrar es idempotente y deja los pools sin conexiones', async () => {
    gestor = new GestorPools(urls);
    gestor.pool('app');
    gestor.db('plataforma');
    await gestor.cerrar();
    await gestor.cerrar();
    expect(gestor.estadisticas().app?.total).toBe(0);
    expect(gestor.estadisticas().plataforma?.total).toBe(0);
  });

  it('tras cerrar no se pueden pedir más pools', async () => {
    gestor = new GestorPools(urls);
    await gestor.cerrar();
    expect(() => gestor!.pool('app')).toThrow(/cerrad/);
    expect(() => gestor!.db('app')).toThrow(/cerrad/);
  });
});
