import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es-EC';
import type { MarcaDetalle } from '../marca/marca';
import type { Empresa } from '../marca/tipos';
import { PantallaMarca } from './marca';

const empresa: Empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colaborador = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const marca = (o: Partial<MarcaDetalle> = {}): MarcaDetalle => ({ nombre: 'Empresa A (prueba)', colorPrimario: '#0b5fff', colorOriginal: '#0b5fff', ajustadoPorContraste: false, logoUrl: null, ...o });
const t = es.marcaEdicion;

describe('PantallaMarca', () => {
  it('no tiene violaciones de accesibilidad (axe) en sus estados', async () => {
    const estados = [
      <PantallaMarca key="a" empresa={empresa} persona={admin} marca={marca()} />,
      <PantallaMarca key="b" empresa={empresa} persona={colaborador} marca={marca()} />,
      <PantallaMarca key="c" empresa={empresa} persona={admin} marca={marca({ colorOriginal: '#ffe066', colorPrimario: '#8a6d00', ajustadoPorContraste: true })} aviso="guardada" />,
      <PantallaMarca key="d" empresa={empresa} persona={admin} marca={marca({ logoUrl: 'https://cdn.example.test/a.png' })} aviso="no_valido" />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect((await axe(container)).violations).toEqual([]);
      unmount();
    }
  });

  it('el administrador ve el formulario: POST a su ruta, con color y logo, y sin campo de empresa', () => {
    const { container, getByLabelText } = render(<PantallaMarca empresa={empresa} persona={admin} marca={marca({ logoUrl: 'https://cdn.example.test/a.png', colorOriginal: '#0e5c42' })} />);
    const form = container.querySelector('form[action="/e/empresa-a/marca/guardar"]')!;
    expect(form.getAttribute('method')).toBe('post');
    const color = getByLabelText(t.colorEtiqueta) as HTMLInputElement;
    expect([color.name, color.type, color.value]).toEqual(['color', 'color', '#0e5c42']);
    const logo = getByLabelText(t.logoEtiqueta) as HTMLInputElement;
    expect([logo.name, logo.value]).toEqual(['logo', 'https://cdn.example.test/a.png']);
    expect([...form.querySelectorAll('input')].map((i) => i.name)).toEqual(['color', 'logo']);
  });

  it('el colaborador ve la marca pero NO el formulario', () => {
    const { container, getByText } = render(<PantallaMarca empresa={empresa} persona={colaborador} marca={marca()} />);
    expect(container.querySelector('form')).toBeNull();
    expect(getByText(t.soloAdmin)).toBeTruthy();
  });

  it('si el color se ajustó por contraste lo dice, con el color elegido y el aplicado', () => {
    const { getByText } = render(<PantallaMarca empresa={empresa} persona={admin} marca={marca({ colorOriginal: '#ffe066', colorPrimario: '#8a6d00', ajustadoPorContraste: true })} />);
    expect(getByText(t.ajustado('#ffe066', '#8a6d00'))).toBeTruthy();
  });

  it('si cumple el contraste lo dice', () => {
    expect(render(<PantallaMarca empresa={empresa} persona={admin} marca={marca()} />).getByText(t.sinAjuste)).toBeTruthy();
  });

  it('sin logo muestra el monograma y lo explica; con logo no', () => {
    const sin = render(<PantallaMarca empresa={empresa} persona={admin} marca={marca()} />);
    expect(sin.getByText(t.sinLogo)).toBeTruthy();
    sin.unmount();
    const { queryByText } = render(<PantallaMarca empresa={{ ...empresa, logoUrl: 'https://cdn.example.test/a.png' }} persona={admin} marca={marca({ logoUrl: 'https://cdn.example.test/a.png' })} />);
    expect(queryByText(t.sinLogo)).toBeNull();
  });

  it('una muestra de color con un valor que no es #RRGGBB no se dibuja (no se usa un color sin comprobar)', () => {
    const { container } = render(<PantallaMarca empresa={empresa} persona={admin} marca={marca({ colorPrimario: 'red; background:url(x)', colorOriginal: 'javascript:1' })} />);
    expect(container.querySelector('[style]')).toBeNull();
  });

  it.each(Object.keys(t.avisos) as (keyof typeof t.avisos)[])('el aviso «%s» muestra su título y detalle', (a) => {
    const { getByText } = render(<PantallaMarca empresa={empresa} persona={admin} marca={marca()} aviso={a} />);
    expect(getByText(t.avisos[a].titulo)).toBeTruthy();
    expect(getByText(t.avisos[a].detalle)).toBeTruthy();
  });
});
