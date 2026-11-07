import { describe, expect, it } from 'vitest';
import { ConfiguracionBdError, leerUrls, ROLES_BD } from './configuracion';

const env = {
  DATABASE_URL_OWNER: 'postgresql://sigiso_owner:clave-o@127.0.0.1:5432/sigiso',
  DATABASE_URL_APP: 'postgresql://sigiso_app:clave-a@127.0.0.1:5432/sigiso',
  DATABASE_URL_CATALOGO: 'postgresql://sigiso_catalogo:clave-c@127.0.0.1:5432/sigiso',
  DATABASE_URL_PLATAFORMA: 'postgresql://sigiso_plataforma:clave-p@127.0.0.1:5432/sigiso',
  DATABASE_URL_TEST: 'postgresql://sigiso_owner:clave-o@127.0.0.1:5432/sigiso_test',
};

describe('leerUrls', () => {
  it('tiene los cuatro roles', () => {
    expect([...ROLES_BD]).toEqual(['owner', 'app', 'catalogo', 'plataforma']);
  });

  it('devuelve la URL de cada rol pedido', () => {
    const urls = leerUrls(env, ['app', 'plataforma']);
    expect(urls.app).toBe(env.DATABASE_URL_APP);
    expect(urls.plataforma).toBe(env.DATABASE_URL_PLATAFORMA);
    expect(urls.owner).toBeUndefined();
  });

  it('en modo prueba apunta todos los roles a la base de pruebas', () => {
    const urls = leerUrls(env, ROLES_BD, { prueba: true });
    expect(urls.owner).toBe(env.DATABASE_URL_TEST);
    expect(urls.app).toBe('postgresql://sigiso_app:clave-a@127.0.0.1:5432/sigiso_test');
    expect(urls.catalogo).toBe('postgresql://sigiso_catalogo:clave-c@127.0.0.1:5432/sigiso_test');
    expect(urls.plataforma).toBe('postgresql://sigiso_plataforma:clave-p@127.0.0.1:5432/sigiso_test');
  });

  it('falla si falta la variable de un rol y nombra la variable', () => {
    expect(() => leerUrls({ ...env, DATABASE_URL_APP: undefined }, ['app'])).toThrow(ConfiguracionBdError);
    expect(() => leerUrls({ ...env, DATABASE_URL_APP: '' }, ['app'])).toThrow(/DATABASE_URL_APP/);
  });

  it('falla en modo prueba si falta DATABASE_URL_TEST', () => {
    expect(() => leerUrls({ ...env, DATABASE_URL_TEST: undefined }, ['app'], { prueba: true })).toThrow(/DATABASE_URL_TEST/);
  });

  it.each([
    ['protocolo que no es PostgreSQL', 'mysql://u:p@h:3306/db'],
    ['sin usuario', 'postgresql://127.0.0.1:5432/sigiso'],
    ['sin nombre de base', 'postgresql://u:p@127.0.0.1:5432'],
    ['texto que no es URL', 'esto no es una url'],
  ])('rechaza una URL inválida (%s) sin repetir su contenido', (_n, valor) => {
    try {
      leerUrls({ ...env, DATABASE_URL_APP: valor }, ['app']);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfiguracionBdError);
      expect((e as Error).message).toContain('DATABASE_URL_APP');
      expect((e as Error).message).not.toContain(valor);
    }
  });

  it('un error nunca incluye la contraseña', () => {
    try {
      leerUrls({ ...env, DATABASE_URL_APP: 'mysql://u:clave-secreta@h/db' }, ['app']);
    } catch (e) {
      expect((e as Error).message).not.toContain('clave-secreta');
    }
  });
});
