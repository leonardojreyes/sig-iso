import { describe, expect, it } from 'vitest';
import { leerConfiguracionAuth, leerConfiguracionLimites, leerOrigenesCors } from './configuracion.js';

describe('leerConfiguracionAuth', () => {
  it('con el entorno vacío usa los valores por defecto documentados', () => {
    expect(leerConfiguracionAuth({})).toEqual({
      emisor: 'http://127.0.0.1:8080/realms/sigiso',
      audiencia: 'sigiso-api',
      clienteAutorizado: 'sigiso-web',
      jwksUrl: 'http://127.0.0.1:8080/realms/sigiso/protocol/openid-connect/certs',
    });
  });

  it('toma los valores del entorno y deriva el JWKS del emisor', () => {
    const c = leerConfiguracionAuth({ OIDC_ISSUER_URL: 'https://id.empresa.example/realms/x/', OIDC_AUDIENCE: 'api-x', OIDC_CLIENT_ID: 'web-x' });
    expect(c).toEqual({
      emisor: 'https://id.empresa.example/realms/x',
      audiencia: 'api-x',
      clienteAutorizado: 'web-x',
      jwksUrl: 'https://id.empresa.example/realms/x/protocol/openid-connect/certs',
    });
  });

  it('OIDC_JWKS_URL tiene prioridad sobre la derivada', () => {
    expect(leerConfiguracionAuth({ OIDC_JWKS_URL: 'http://127.0.0.1:9000/certs' }).jwksUrl).toBe('http://127.0.0.1:9000/certs');
  });

  it.each([
    ['OIDC_ISSUER_URL', 'no-es-url'],
    ['OIDC_ISSUER_URL', 'file:///etc/passwd'],
    ['OIDC_ISSUER_URL', 'https://u:CLAVE-SECRETA@id.example/realms/x'],
    ['OIDC_JWKS_URL', 'ftp://x/certs'],
    ['OIDC_AUDIENCE', ''],
    ['OIDC_CLIENT_ID', '   '],
  ])('rechaza %s=%j nombrando la variable y sin repetir su valor', (variable, valor) => {
    let mensaje = '';
    try {
      leerConfiguracionAuth({ [variable]: valor });
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toContain(variable);
    expect(mensaje).not.toContain('CLAVE-SECRETA');
    if (valor.length > 3) expect(mensaje).not.toContain(valor);
  });
});

describe('leerOrigenesCors', () => {
  it('por defecto no admite ningún origen (la web llama desde su servidor, ADR 027)', () => {
    expect(leerOrigenesCors({})).toEqual([]);
    expect(leerOrigenesCors({ CORS_ORIGINS: '' })).toEqual([]);
  });

  it('lee una lista separada por comas, sin espacios ni duplicados', () => {
    expect(leerOrigenesCors({ CORS_ORIGINS: 'http://localhost:3000, https://app.example.test ,http://localhost:3000' })).toEqual(['http://localhost:3000', 'https://app.example.test']);
  });

  it.each(['*', 'null', 'http://localhost:3000/ruta', 'ftp://x', 'localhost:3000', 'https://u:p@x.example', 'http://x.example,*'])('rechaza el origen %j', (o) => {
    expect(() => leerOrigenesCors({ CORS_ORIGINS: o })).toThrow(/CORS_ORIGINS/);
  });
});

describe('leerConfiguracionLimites', () => {
  it('por defecto: 120 solicitudes por minuto por persona y 600 por empresa', () => {
    expect(leerConfiguracionLimites({})).toEqual({ persona: 120, empresa: 600 });
  });

  it('toma los valores del entorno', () => {
    expect(leerConfiguracionLimites({ RATE_LIMIT_PERSONA: '30', RATE_LIMIT_EMPRESA: '200' })).toEqual({ persona: 30, empresa: 200 });
  });

  it.each([
    ['RATE_LIMIT_PERSONA', '0'], ['RATE_LIMIT_PERSONA', '-3'], ['RATE_LIMIT_PERSONA', '1.5'], ['RATE_LIMIT_PERSONA', 'mucho'], ['RATE_LIMIT_PERSONA', ''],
    ['RATE_LIMIT_EMPRESA', '0'], ['RATE_LIMIT_EMPRESA', '1e3'], ['RATE_LIMIT_EMPRESA', ' 10'], ['RATE_LIMIT_EMPRESA', '100001'],
  ])('rechaza %s=%j nombrando la variable', (variable, valor) => {
    expect(() => leerConfiguracionLimites({ [variable]: valor })).toThrow(new RegExp(variable));
  });

  it('exige que el límite de la empresa no sea menor que el de una persona', () => {
    expect(() => leerConfiguracionLimites({ RATE_LIMIT_PERSONA: '500', RATE_LIMIT_EMPRESA: '100' })).toThrow(/RATE_LIMIT_EMPRESA/);
  });
});
