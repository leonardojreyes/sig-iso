import { describe, expect, it } from 'vitest';
import { entornoDeServicio, SERVICIOS } from './dev-env.mjs';

const archivo = [
  '# comentario',
  'DATABASE_URL_OWNER=postgresql://owner:o@127.0.0.1/sigiso',
  'DATABASE_URL_APP=postgresql://app:a@127.0.0.1/sigiso',
  'DATABASE_URL_PLATAFORMA=postgresql://plat:p@127.0.0.1/sigiso',
  'DATABASE_URL_TEST=postgresql://owner:o@127.0.0.1/sigiso_test',
  'OIDC_CLIENT_SECRET=secreto-web',
  'SESSION_SEALING_KEY=clave-sellado',
  'KEYCLOAK_ADMIN_PASSWORD=clave-admin',
  'KEYCLOAK_EVENTS_CLIENT_SECRET=secreto-eventos',
  'OPENFGA_API_TOKEN=token-fga',
  'OPENFGA_DATASTORE_URI=postgresql://fga:f@127.0.0.1/openfga',
  'OIDC_ISSUER_URL=http://127.0.0.1:8080/realms/sigiso',
  'CORS_ORIGINS=http://localhost:3000',
].join('\n');

describe('entornoDeServicio: cada servicio recibe solo lo que necesita', () => {
  it('la web recibe los datos del ingreso y NINGUNA base de datos ni secreto de otros servicios', () => {
    const e = entornoDeServicio('web', archivo, {});
    expect(e.OIDC_CLIENT_SECRET).toBe('secreto-web');
    expect(e.SESSION_SEALING_KEY).toBe('clave-sellado');
    expect(e.OIDC_ISSUER_URL).toBe('http://127.0.0.1:8080/realms/sigiso');
    for (const k of [
      'DATABASE_URL_OWNER',
      'DATABASE_URL_APP',
      'DATABASE_URL_PLATAFORMA',
      'DATABASE_URL_TEST',
      'KEYCLOAK_ADMIN_PASSWORD',
      'KEYCLOAK_EVENTS_CLIENT_SECRET',
      'OPENFGA_API_TOKEN',
      'OPENFGA_DATASTORE_URI',
      'CORS_ORIGINS',
    ]) {
      expect(e[k], k).toBeUndefined();
    }
  });

  it('la API recibe solo las bases de la aplicación y de plataforma (nunca el dueño ni la de pruebas) y NO el secreto del cliente web ni la clave de sellado', () => {
    const e = entornoDeServicio('api', archivo, {});
    expect(e.DATABASE_URL_APP).toContain('app:a@');
    expect(e.DATABASE_URL_PLATAFORMA).toContain('plat:p@');
    expect(e.CORS_ORIGINS).toBe('http://localhost:3000');
    for (const k of [
      'DATABASE_URL_OWNER',
      'DATABASE_URL_TEST',
      'OIDC_CLIENT_SECRET',
      'SESSION_SEALING_KEY',
      'KEYCLOAK_ADMIN_PASSWORD',
      'KEYCLOAK_EVENTS_CLIENT_SECRET',
      'OPENFGA_API_TOKEN',
      'OPENFGA_DATASTORE_URI',
    ]) {
      expect(e[k], k).toBeUndefined();
    }
  });

  it('lo que ya está en el entorno de la terminal manda sobre el archivo', () => {
    const e = entornoDeServicio('web', archivo, { OIDC_CLIENT_SECRET: 'desde-la-terminal', PATH: '/bin' });
    expect(e.OIDC_CLIENT_SECRET).toBe('desde-la-terminal');
    expect(e.PATH).toBe('/bin');
  });

  it('ignora comentarios, líneas vacías y claves mal formadas; sin archivo no falla', () => {
    expect(entornoDeServicio('web', '# nada\n\n=sin-nombre\nESTO NO\n', { PATH: '/bin' })).toEqual({ PATH: '/bin' });
    expect(entornoDeServicio('web', '', {})).toEqual({});
  });

  it('las listas de variables permitidas no se solapan con secretos del otro servicio', () => {
    expect(SERVICIOS.web).not.toContain('DATABASE_URL_APP');
    expect(SERVICIOS.api).not.toContain('OIDC_CLIENT_SECRET');
    expect(SERVICIOS.api).not.toContain('SESSION_SEALING_KEY');
    expect(() => entornoDeServicio('desconocido', archivo, {})).toThrow(/servicio/i);
  });
});
