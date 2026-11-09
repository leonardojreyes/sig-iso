import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { MARCA_GENERICA } from '../marca/generica';
import { PantallaIngreso } from './ingreso';
import { PantallaInicio } from './inicio';

describe('PantallaIngreso (pantalla real: el ingreso lo hace Keycloak)', () => {
  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = render(<PantallaIngreso empresa={MARCA_GENERICA} retorno="/e/empresa-a/requisitos" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ofrece una sola acción: un enlace a /auth/login que recuerda a dónde volver', () => {
    const { container, getByRole } = render(
      <PantallaIngreso empresa={MARCA_GENERICA} retorno="/e/empresa-a/requisitos" />,
    );
    const enlace = getByRole('link', { name: /Ingresar con mi cuenta/ });
    expect(enlace.getAttribute('href')).toBe('/auth/login?retorno=%2Fe%2Fempresa-a%2Frequisitos');
    expect(container.querySelectorAll('a[href^="/auth/login"]')).toHaveLength(1);
  });

  it('NO pide correo ni contraseña en la aplicación (se escriben solo en el servicio de identidad)', () => {
    const { container } = render(<PantallaIngreso empresa={MARCA_GENERICA} />);
    expect(container.querySelectorAll('input, form, textarea, select')).toHaveLength(0);
    expect((container.textContent ?? '').toLowerCase()).not.toContain('contraseña');
    expect(container.textContent).not.toContain('plantilla');
  });

  it('sin destino de retorno el enlace no lo lleva; uno peligroso se descarta', () => {
    const href = (retorno?: string) => {
      const { getByRole, unmount } = render(<PantallaIngreso empresa={MARCA_GENERICA} retorno={retorno} />);
      const valor = getByRole('link', { name: /Ingresar con mi cuenta/ }).getAttribute('href');
      unmount();
      return valor;
    };
    expect(href()).toBe('/auth/login');
    for (const malo of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '/%2fevil'])
      expect(href(malo), malo).toBe('/auth/login');
  });

  it('muestra la marca del producto, no la de ninguna empresa', () => {
    const { container } = render(<PantallaIngreso empresa={MARCA_GENERICA} />);
    expect(container.textContent).toContain('sig-iso');
    expect(container.textContent).not.toMatch(/Empresa A|Empresa B|SynapTech Ecuador|Andes/);
  });

  it.each([
    ['ingreso_invalido', 'No se pudo completar el ingreso'],
    ['ingreso_cancelado', 'El ingreso se canceló'],
    ['ingreso_no_disponible', 'El ingreso no está disponible'],
  ] as const)(
    'con el código «%s» muestra un aviso genérico en español, sin revelar el motivo interno',
    async (error, frase) => {
      const { container } = render(<PantallaIngreso empresa={MARCA_GENERICA} error={error} />);
      expect(container.textContent).toContain(frase);
      expect(container.querySelector('[role="alert"]')).toBeTruthy();
      expect(container.textContent).not.toMatch(/state|emisor|nonce|id_token|código de autorización|Keycloak/i);
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('sin error no hay avisos', () => {
    expect(render(<PantallaIngreso empresa={MARCA_GENERICA} />).container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('PantallaInicio (portada real, sin demostración)', () => {
  it.each([null, 'ingreso_invalido'] as const)(
    'no tiene violaciones de accesibilidad (axe) con error = %s',
    async (error) => {
      const { container } = render(<PantallaInicio error={error} />);
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('tiene el nombre del producto y UNA acción de ingresar hacia /auth/login', () => {
    const { container, getByRole } = render(<PantallaInicio error={null} />);
    expect(getByRole('heading', { level: 1 }).textContent).toContain('sig-iso');
    expect(getByRole('link', { name: /Ingresar con mi cuenta/ }).getAttribute('href')).toBe('/auth/login');
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('ya no es el entorno de demostración: sin empresas de prueba ni enlaces a empresas', () => {
    const { container } = render(<PantallaInicio error={null} />);
    expect(container.textContent).not.toMatch(/demostración|Elija una empresa|SynapTech Ecuador|Andes Log/i);
    expect(container.querySelectorAll('a[href^="/e/"]')).toHaveLength(0);
  });

  it('muestra el aviso del ingreso fallido', () => {
    const { container } = render(<PantallaInicio error="ingreso_cancelado" />);
    expect(container.textContent).toContain('El ingreso se canceló');
  });
});
