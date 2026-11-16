import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { AvisoEnfocado } from './aviso-enfocado';

describe('AvisoEnfocado (un aviso que llega con la página recibe el foco)', () => {
  it('toma el foco al montarse, para que el lector de pantalla lo lea', () => {
    const { getByRole } = render(<AvisoEnfocado etiqueta="Aviso"><p>Marca guardada</p></AvisoEnfocado>);
    expect(document.activeElement).toBe(getByRole('group', { name: 'Aviso' }));
  });

  it('es enfocable por programa pero NO entra en el orden del tabulador (tabindex -1)', () => {
    const { getByRole } = render(<AvisoEnfocado etiqueta="Aviso">x</AvisoEnfocado>);
    expect(getByRole('group').getAttribute('tabindex')).toBe('-1');
  });

  it('puede ser una sección nombrada por un encabezado', () => {
    const { container, getByRole } = render(
      <AvisoEnfocado como="section" etiquetadoPor="titulo-resultado">
        <h2 id="titulo-resultado">Resultado</h2>
      </AvisoEnfocado>,
    );
    expect(container.querySelector('section')).not.toBeNull();
    expect(document.activeElement).toBe(getByRole('group', { name: 'Resultado' }));
  });

  it('no tiene violaciones de accesibilidad (axe)', async () => {
    const { container } = render(<AvisoEnfocado etiqueta="Aviso"><p>Texto</p></AvisoEnfocado>);
    expect((await axe(container)).violations).toEqual([]);
  });
});
