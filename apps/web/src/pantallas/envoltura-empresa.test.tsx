import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnvolturaEmpresa } from './envoltura-empresa';

describe('EnvolturaEmpresa: la marca de UNA empresa, acotada a su propio contenedor', () => {
  const a = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };

  it('marca el contenedor con la empresa e inyecta solo su CSS, acotado por [data-empresa]', () => {
    const { container } = render(
      <EnvolturaEmpresa empresa={a}>
        <p>hola</p>
      </EnvolturaEmpresa>,
    );
    const div = container.querySelector('[data-empresa]')!;
    expect(div.getAttribute('data-empresa')).toBe('empresa-a');
    const css = container.querySelector('style')!.textContent!;
    expect(css).toContain('[data-empresa="empresa-a"]');
    expect(css).not.toMatch(/data-empresa="(?!empresa-a")/);
    expect(div.textContent).toContain('hola');
  });

  it('el CSS de una empresa nunca trae el de otra (ni su identificador ni su color)', () => {
    const b = { id: 'empresa-b', nombre: 'Empresa B (prueba)', primario: '#b45309' };
    const cssA = render(<EnvolturaEmpresa empresa={a}>x</EnvolturaEmpresa>).container.querySelector(
      'style',
    )!.textContent!;
    const cssB = render(<EnvolturaEmpresa empresa={b}>x</EnvolturaEmpresa>).container.querySelector(
      'style',
    )!.textContent!;
    expect(cssA).not.toContain('empresa-b');
    expect(cssA.toLowerCase()).not.toContain('b45309');
    expect(cssB).not.toContain('empresa-a');
    expect(cssB.toLowerCase()).not.toContain('0b5fff');
  });

  it('un identificador de empresa inválido no produce CSS (falla en vez de inyectar algo raro)', () => {
    expect(() => render(<EnvolturaEmpresa empresa={{ ...a, id: 'a"]{x:y}</style>' }}>x</EnvolturaEmpresa>)).toThrow();
  });
});
