import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { MarcoApp, SelectorEmpresa } from './marco';
import { PantallaPanelPendiente } from './panel-pendiente';

const una: Empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const varias: Empresa = { ...una, otrasEmpresas: [{ slug: 'empresa-b', nombre: 'Empresa B (prueba)' }, { slug: 'empresa-c', nombre: 'Empresa C (prueba)' }] };

describe('SelectorEmpresa (ADR 035)', () => {
  it('quien pertenece a una sola empresa no ve selector', () => {
    const { container } = render(<SelectorEmpresa empresa={una} />);
    expect(container.innerHTML).toBe('');
    expect(render(<SelectorEmpresa empresa={{ ...una, otrasEmpresas: [] }} />).container.innerHTML).toBe('');
  });

  it('un consultor ve un formulario POST a la ruta de la empresa actual con las otras empresas, y sin identificadores', () => {
    const { container, getByLabelText, getByRole } = render(<SelectorEmpresa empresa={varias} />);
    const form = container.querySelector('form')!;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe('/e/empresa-a/empresa/cambiar');
    const select = getByLabelText(es.empresas.cambiarAria) as HTMLSelectElement;
    expect(select.name).toBe('empresa');
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([['empresa-b', 'Empresa B (prueba)'], ['empresa-c', 'Empresa C (prueba)']]);
    expect(getByRole('button', { name: es.empresas.cambiar })).toBeTruthy();
    expect([...form.querySelectorAll('input,select,textarea')].map((e) => e.getAttribute('name'))).toEqual(['empresa']);
  });

  it('aparece en la cabecera del marco solo si hay otras empresas', () => {
    expect(render(<MarcoApp empresa={una} activo="panel">x</MarcoApp>).container.querySelector('form[action$="/empresa/cambiar"]')).toBeNull();
    expect(render(<MarcoApp empresa={varias} activo="panel">x</MarcoApp>).container.querySelector('form[action="/e/empresa-a/empresa/cambiar"]')).not.toBeNull();
  });

  it('no tiene violaciones de accesibilidad (axe) con y sin selector', async () => {
    for (const e of [una, varias]) {
      const { container, unmount } = render(<MarcoApp empresa={e} activo="panel" persona="Consultor">contenido</MarcoApp>);
      expect((await axe(container)).violations).toEqual([]);
      unmount();
    }
  });
});

describe('aviso de cambio de empresa en el panel', () => {
  it.each(Object.keys(es.empresas.avisos) as (keyof typeof es.empresas.avisos)[])('el aviso «%s» muestra su título y detalle', (a) => {
    const { getByText } = render(<PantallaPanelPendiente empresa={una} persona="Persona" aviso={a} />);
    expect(getByText(es.empresas.avisos[a].detalle)).toBeTruthy();
  });
  it('sin aviso no muestra ninguna alerta', () => {
    const { queryByRole } = render(<PantallaPanelPendiente empresa={una} persona="Persona" />);
    expect(queryByRole('alert')).toBeNull();
  });
});
