import { render, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Personas } from '../api/tipos';
import { PantallaPersonas } from './personas';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const S1 = '33333333-3333-4333-8333-333333333333';
const datos: Personas = {
  personas: [
    { id: P1, nombre: 'Laura Mena', correo: 'laura.mena@example.test', rol: 'administrador_sig', bajaEn: null, version: 3 },
    { id: P2, nombre: 'Pedro Soto', correo: 'pedro@example.test', rol: null, bajaEn: '2026-11-16T15:00:00.000Z', version: 2 },
  ],
  solicitudes: [{ id: S1, usuarioId: '44444444-4444-4444-8444-444444444444', codigo: 'K7F2-9QXM', creadaEn: '2026-11-16T15:00:00.000Z', venceEn: '2026-11-23T15:00:00.000Z' }],
};
const vista = (d: Personas = datos, aviso: Parameters<typeof PantallaPersonas>[0]['aviso'] = null) => render(<PantallaPersonas empresa={empresa} persona={admin} datos={d} aviso={aviso} />);

describe('PantallaPersonas (ADR 036)', () => {
  it('muestra cada solicitud con su código y un formulario para aprobarla con nombre, correo y rol', () => {
    const { getByRole } = vista();
    const form = getByRole('form', { name: 'Aprobar la solicitud K7F2-9QXM' });
    expect(form.getAttribute('action')).toBe('/e/empresa-a/personas/aprobar');
    expect(form.getAttribute('method')).toBe('post');
    expect((form.querySelector('input[name="solicitud"]') as HTMLInputElement).value).toBe(S1);
    expect(within(form).getByLabelText('Nombre de la persona')).toBeTruthy();
    expect((within(form).getByLabelText('Correo de la persona') as HTMLInputElement).type).toBe('email');
    expect((within(form).getByLabelText('Rol') as HTMLSelectElement).value).toBe('colaborador');
    expect(getByRole('heading', { level: 2, name: 'Solicitudes de acceso' })).toBeTruthy();
  });

  it('ofrece los seis roles, con sus nombres en español', () => {
    const { getByRole } = vista();
    const opciones = [...(within(getByRole('form', { name: 'Aprobar la solicitud K7F2-9QXM' })).getByLabelText('Rol') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(opciones).toEqual(['Administrador SIG', 'Dueño de proceso', 'Auditor interno', 'Auditor externo', 'Colaborador', 'Alta dirección']);
  });

  it('la persona con acceso lleva un formulario de cambio de rol y otro de baja, con su identificador y su versión', () => {
    const { getByRole } = vista();
    const rol = getByRole('form', { name: 'Cambiar rol de Laura Mena' });
    expect(rol.getAttribute('action')).toBe('/e/empresa-a/personas/rol');
    expect((rol.querySelector('input[name="id"]') as HTMLInputElement).value).toBe(P1);
    expect((rol.querySelector('input[name="version"]') as HTMLInputElement).value).toBe('3');
    expect((within(rol).getByLabelText('Rol de Laura Mena') as HTMLSelectElement).value).toBe('administrador_sig');
    const baja = getByRole('form', { name: 'Dar de baja a Laura Mena' });
    expect(baja.getAttribute('action')).toBe('/e/empresa-a/personas/baja');
    expect((baja.querySelector('input[name="version"]') as HTMLInputElement).value).toBe('3');
  });

  it('quien ya está de baja no tiene acciones y se ve con su fecha (el estado no depende solo del color)', () => {
    const { queryByRole, getByText } = vista();
    expect(queryByRole('form', { name: 'Cambiar rol de Pedro Soto' })).toBeNull();
    expect(queryByRole('form', { name: 'Dar de baja a Pedro Soto' })).toBeNull();
    expect(getByText(/Dada de baja el/)).toBeTruthy();
    expect(getByText('Con acceso')).toBeTruthy();
  });

  it('ningún formulario manda la empresa: sale del token (solo identificadores del recurso)', () => {
    const { container } = vista();
    const nombres = [...container.querySelectorAll('main form input, main form select')].map((e) => (e as HTMLInputElement).name);
    expect(nombres.filter((n) => /empresa|tenant|slug/i.test(n))).toEqual([]);
    for (const f of container.querySelectorAll('main form')) expect(f.getAttribute('action')).toMatch(/^\/e\/empresa-a\/personas\/(aprobar|descartar|rol|baja)$/);
  });

  it('sin solicitudes ni personas lo dice con palabras', () => {
    const { getByText } = vista({ personas: [], solicitudes: [] });
    expect(getByText('No hay solicitudes pendientes.')).toBeTruthy();
    expect(getByText('Aún no hay personas en esta empresa.')).toBeTruthy();
  });

  it('muestra el aviso de la última escritura, enfocado y de una lista cerrada', () => {
    const { getByRole } = vista(datos, 'personas_conflicto');
    expect(getByRole('group', { name: 'Aviso' }).textContent).toContain('No se pudo completar el cambio');
    expect(document.activeElement).toBe(getByRole('group', { name: 'Aviso' }));
  });

  it('escapa los datos (un nombre con HTML no se interpreta)', () => {
    const { container } = vista({ ...datos, personas: [{ ...datos.personas[0]!, nombre: '<img src=x onerror=alert(1)>' }] });
    expect(container.querySelector('img')).toBeNull();
  });

  it.each([
    ['con datos', datos],
    ['vacía', { personas: [], solicitudes: [] } as Personas],
  ])('no tiene violaciones de accesibilidad (axe) %s', async (_c, d) => {
    const { container } = vista(d);
    expect(await axe(container)).toHaveNoViolations();
  });
});
