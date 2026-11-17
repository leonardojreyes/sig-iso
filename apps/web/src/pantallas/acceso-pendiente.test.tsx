import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { PantallaAccesoPendiente } from './acceso-pendiente';

const codigo = { codigo: 'K7F2-9QXM', venceEn: '2026-11-23T15:00:00.000Z' };

describe('PantallaAccesoPendiente (ADR 036)', () => {
  it('muestra el código en un encabezado propio, dice que no es una contraseña y da el plazo en hora de Ecuador', () => {
    const { getByRole, getByText, container } = render(<PantallaAccesoPendiente codigo={codigo} />);
    expect(getByRole('heading', { level: 1, name: 'Su acceso está pendiente de aprobación' })).toBeTruthy();
    expect(getByRole('region', { name: 'Su código de solicitud' }).textContent).toContain('K7F2-9QXM');
    expect(getByText(/no es una contraseña/)).toBeTruthy();
    // 2026-11-23 15:00 UTC = 10:00 en Ecuador (UTC-5).
    expect(container.textContent).toMatch(/hasta el 23 de noviembre de 2026.*10:00/);
  });

  it('no ofrece ninguna acción que dé acceso: solo informa (sin enlaces ni formularios)', () => {
    const { container } = render(<PantallaAccesoPendiente codigo={codigo} />);
    expect(container.querySelector('a, form, button')).toBeNull();
  });

  it('sin código (la cookie venció o no está) invita a ingresar de nuevo y no inventa ninguno', () => {
    const { getByRole, container } = render(<PantallaAccesoPendiente codigo={null} />);
    expect(getByRole('heading', { level: 1 }).textContent).toBe('No hay una solicitud a la vista');
    expect(getByRole('link', { name: 'Ingresar de nuevo' }).getAttribute('href')).toBe('/auth/login');
    expect(container.textContent).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
  });

  it.each([
    ['con código', codigo],
    ['sin código', null],
  ])('no tiene violaciones de accesibilidad (axe) %s', async (_c, c) => {
    const { container } = render(<PantallaAccesoPendiente codigo={c} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
