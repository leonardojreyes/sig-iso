// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from './configuracion';

const clave = () => randomBytes(32).toString('base64url');
const base = () => ({ OIDC_CLIENT_SECRET: 'secreto-de-prueba-123', SESSION_SEALING_KEY: clave() });

describe('leerConfiguracion de ingreso (web)', () => {
  it('valores por omisión de desarrollo: Keycloak local, cliente sigiso-web y retorno en localhost:3000', () => {
    const c = leerConfiguracion(base());
    expect(c.emisor).toBe('http://127.0.0.1:8080/realms/sigiso');
    expect(c.clienteId).toBe('sigiso-web');
    expect(c.redirectUri).toBe('http://localhost:3000/auth/callback');
    expect(c.origen).toBe('http://localhost:3000');
    expect(c.seguro).toBe(false);
    expect(c.nombreCookie).toBe('sig-oidc');
  });

  it('con HTTPS la cookie es Secure y lleva el prefijo __Host-', () => {
    const c = leerConfiguracion({ ...base(), OIDC_REDIRECT_URI: 'https://sig.ejemplo.ec/auth/callback' });
    expect(c.seguro).toBe(true);
    expect(c.origen).toBe('https://sig.ejemplo.ec');
    expect(c.nombreCookie).toBe('__Host-sig-oidc');
  });

  it('quita la barra final del emisor y toma los valores del entorno', () => {
    const c = leerConfiguracion({
      ...base(),
      OIDC_ISSUER_URL: 'https://id.ejemplo.ec/realms/sigiso/',
      OIDC_CLIENT_ID: 'otra-web',
    });
    expect(c.emisor).toBe('https://id.ejemplo.ec/realms/sigiso');
    expect(c.clienteId).toBe('otra-web');
  });

  it('exige el secreto del cliente y la clave de sellado, nombrando la variable y sin repetir valores', () => {
    expect(() => leerConfiguracion({ SESSION_SEALING_KEY: clave() })).toThrow(/OIDC_CLIENT_SECRET/);
    expect(() => leerConfiguracion({ OIDC_CLIENT_SECRET: 'x' })).toThrow(/SESSION_SEALING_KEY/);
    expect(() => leerConfiguracion({ ...base(), SESSION_SEALING_KEY: 'corta-y-secreta' })).toThrow(
      /SESSION_SEALING_KEY/,
    );
    try {
      leerConfiguracion({ ...base(), SESSION_SEALING_KEY: 'corta-y-secreta' });
    } catch (e) {
      expect(String(e)).not.toContain('corta-y-secreta');
    }
  });

  it('rechaza direcciones que no sean http(s), con credenciales, consulta o fragmento', () => {
    for (const [variable, valor] of [
      ['OIDC_ISSUER_URL', 'ftp://id.ejemplo.ec/realms/x'],
      ['OIDC_ISSUER_URL', 'javascript:alert(1)'],
      ['OIDC_ISSUER_URL', 'http://u:p@id.ejemplo.ec/realms/x'],
      ['OIDC_ISSUER_URL', 'http://id.ejemplo.ec/realms/x?a=1'],
      ['OIDC_ISSUER_URL', 'no es una url'],
      ['OIDC_REDIRECT_URI', 'http://localhost:3000/auth/callback#frag'],
      ['OIDC_REDIRECT_URI', 'http://localhost:3000/auth/callback?x=1'],
      ['OIDC_REDIRECT_URI', 'http://u:p@localhost:3000/auth/callback'],
      ['OIDC_REDIRECT_URI', '/auth/callback'],
    ] as const) {
      expect(() => leerConfiguracion({ ...base(), [variable]: valor }), `${variable}=${valor}`).toThrow(
        new RegExp(variable),
      );
    }
  });

  it('la clave anterior (rotación) es opcional; si está, también debe ser válida y distinta', () => {
    const activa = clave();
    const anterior = clave();
    const c = leerConfiguracion({ ...base(), SESSION_SEALING_KEY: activa, SESSION_SEALING_KEY_PREVIOUS: anterior });
    expect(c.clavesSellado).toHaveLength(2);
    expect(c.clavesSellado[0]!.secreto).toBe(activa);
    expect(c.clavesSellado[1]!.secreto).toBe(anterior);
    expect(c.clavesSellado[0]!.id).not.toBe(c.clavesSellado[1]!.id);
    expect(() => leerConfiguracion({ ...base(), SESSION_SEALING_KEY_PREVIOUS: 'mala' })).toThrow(
      /SESSION_SEALING_KEY_PREVIOUS/,
    );
    expect(
      leerConfiguracion({ ...base(), SESSION_SEALING_KEY: activa, SESSION_SEALING_KEY_PREVIOUS: activa }).clavesSellado,
    ).toHaveLength(1);
    expect(leerConfiguracion(base()).clavesSellado).toHaveLength(1);
  });
});
