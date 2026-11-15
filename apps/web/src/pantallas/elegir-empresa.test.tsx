import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es-EC';
import { PantallaEleccionEmpresa } from './elegir-empresa';

const empresas = [
  { slug: 'empresa-a', nombre: 'Empresa A (prueba)', activa: true },
  { slug: 'empresa-b', nombre: 'Empresa B (prueba)', activa: false },
];

describe('PantallaEleccionEmpresa (al entrar)', () => {
  it('no tiene violaciones de accesibilidad (axe), con y sin aviso', async () => {
    for (const e of [<PantallaEleccionEmpresa key="a" empresas={empresas} />, <PantallaEleccionEmpresa key="b" empresas={empresas} aviso="no_encontrada" />]) {
      const { container, unmount } = render(e);
      expect((await axe(container)).violations).toEqual([]);
      unmount();
    }
  });

  it('una tarjeta por empresa: un formulario POST con un solo dato (el slug) hacia la ruta de elección', () => {
    const { container, getByRole } = render(<PantallaEleccionEmpresa empresas={empresas} />);
    expect(getByRole('heading', { name: es.eleccion.titulo })).toBeTruthy();
    const forms = [...container.querySelectorAll('form[action="/empresas/elegir"]')];
    expect(forms).toHaveLength(2);
    expect(forms.map((f) => [f.getAttribute('method'), (f.querySelector('input[name="empresa"]') as HTMLInputElement).value])).toEqual([['post', 'empresa-a'], ['post', 'empresa-b']]);
    for (const f of forms) expect([...f.querySelectorAll('input')].map((i) => i.name)).toEqual(['empresa']);
    expect(getByRole('button', { name: es.eleccion.entrar('Empresa B (prueba)') })).toBeTruthy();
  });

  it('ofrece cerrar sesión (POST a /auth/logout)', () => {
    const { container, getByRole } = render(<PantallaEleccionEmpresa empresas={empresas} />);
    expect(container.querySelector('form[action="/auth/logout"]')?.getAttribute('method')).toBe('post');
    expect(getByRole('button', { name: es.sesion.cerrar })).toBeTruthy();
  });

  it.each(['no_encontrada', 'no_valido', 'no_disponible'] as const)('el aviso «%s» muestra su título', (a) => {
    const { getByText } = render(<PantallaEleccionEmpresa empresas={empresas} aviso={a} />);
    expect(getByText(es.empresas.avisos[a].detalle)).toBeTruthy();
  });

  it('los nombres con marcas HTML se escapan', () => {
    const { container } = render(<PantallaEleccionEmpresa empresas={[{ slug: 'x', nombre: '<img src=x onerror=alert(1)>', activa: false }, ...empresas]} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
