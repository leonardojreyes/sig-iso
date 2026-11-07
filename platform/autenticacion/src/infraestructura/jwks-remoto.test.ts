import { describe, expect, it } from 'vitest';
import { crearJwksRemoto } from './jwks-remoto.js';

describe('crearJwksRemoto', () => {
  it('crea un resolutor de claves para una dirección http o https', () => {
    expect(typeof crearJwksRemoto('http://127.0.0.1:8081/realms/sigiso/protocol/openid-connect/certs')).toBe('function');
    expect(typeof crearJwksRemoto('https://id.example.test/certs')).toBe('function');
  });
  it.each(['no-es-url', 'file:///etc/passwd', 'ftp://x.example/certs', 'javascript:alert(1)', 'https://u:clave@id.example.test/certs'])('rechaza %s', (url) => {
    expect(() => crearJwksRemoto(url)).toThrow();
  });
  it('el error no repite la contraseña de la dirección', () => {
    try {
      crearJwksRemoto('https://u:CLAVE-SECRETA@id.example.test/certs');
    } catch (e) {
      expect((e as Error).message).not.toContain('CLAVE-SECRETA');
      return;
    }
    throw new Error('debía lanzar');
  });
});
