import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { crearPkce, decodificarPayload, extraerFormulario, guardarCookies } from './flujo-codigo.mjs';

describe('crearPkce', () => {
  it('el desafío es SHA-256 base64url del verificador (S256) y el verificador tiene entropía suficiente', () => {
    const { verificador, desafio } = crearPkce();
    expect(verificador).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(desafio).toBe(createHash('sha256').update(verificador).digest('base64url'));
    expect(crearPkce().verificador).not.toBe(verificador);
  });
});

describe('extraerFormulario', () => {
  const html = `<html><body><form id="kc-form-login" onsubmit="x" action="http://127.0.0.1:8080/realms/sigiso/login-actions/authenticate?session_code=abc&amp;execution=e1&amp;client_id=sigiso-web&amp;tab_id=t1" method="post">
    <input id="username" name="username" type="text" /><input id="password" name="password" type="password" />
    <input type="hidden" name="credentialId" value="" /></form></body></html>`;
  it('lee la acción (con &amp; decodificado) y los campos ocultos', () => {
    const f = extraerFormulario(html);
    expect(f.action).toBe(
      'http://127.0.0.1:8080/realms/sigiso/login-actions/authenticate?session_code=abc&execution=e1&client_id=sigiso-web&tab_id=t1',
    );
    expect(f.campos).toEqual({ credentialId: '' });
  });
  it('falla de forma clara si la página no trae el formulario de ingreso', () => {
    expect(() => extraerFormulario('<html>nada</html>')).toThrow(/formulario de ingreso/i);
  });
});

describe('guardarCookies', () => {
  it('conserva nombre=valor, descarta atributos y reemplaza repetidas', () => {
    const jar = new Map();
    guardarCookies(jar, ['AUTH_SESSION_ID=a1; Path=/; HttpOnly', 'KC_RESTART=r1; Path=/; Secure']);
    guardarCookies(jar, ['AUTH_SESSION_ID=a2; Path=/']);
    expect(jar.get('AUTH_SESSION_ID')).toBe('a2');
    expect([...jar].map(([k, v]) => `${k}=${v}`).join('; ')).toBe('AUTH_SESSION_ID=a2; KC_RESTART=r1');
  });
});

describe('decodificarPayload', () => {
  it('lee las notificaciones de un JWT sin verificar (solo para informar)', () => {
    const p = Buffer.from(JSON.stringify({ a: 1 })).toString('base64url');
    expect(decodificarPayload(`x.${p}.y`)).toEqual({ a: 1 });
    expect(() => decodificarPayload('sin-puntos')).toThrow(/JWT/);
  });
});
