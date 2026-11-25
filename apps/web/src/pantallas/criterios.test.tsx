import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { Criterios } from '../criterios/tipos';
import { PantallaCriterios } from './criterios';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colab = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const nivelDe = (p: number) => (p <= 4 ? 'bajo' : p <= 9 ? 'medio' : p <= 15 ? 'alto' : 'critico') as 'bajo' | 'medio' | 'alto' | 'critico';
const matriz = (cantidades: Record<string, number> = {}) =>
  [5, 4, 3, 2, 1].flatMap((p) => [1, 2, 3, 4, 5].map((i) => ({ probabilidad: p, impacto: i, puntaje: p * i, nivel: nivelDe(p * i), cantidad: cantidades[`${p}|${i}`] ?? 0 })));
const escala = (x: string) => [`${x} uno`, `${x} dos`, `${x} tres`, `${x} cuatro`, `${x} cinco`] as unknown as Criterios['probabilidad'];
const omision: Criterios = { origen: 'omision', version: 0, probabilidad: escala('Prob'), impacto: escala('Imp'), nivelAceptacion: null, creadoEn: null, riesgosVigentes: 0, matriz: matriz() };
const propios: Criterios = { ...omision, origen: 'empresa', version: 2, nivelAceptacion: 'medio', creadoEn: '2026-11-25T15:00:00.000Z', riesgosVigentes: 3, matriz: matriz({ '3|4': 2, '1|1': 1 }) };
const base = { empresa, persona: admin, criterios: propios, aviso: null };

describe('PantallaCriterios', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaCriterios key="a" {...base} />,
      <PantallaCriterios key="b" {...base} criterios={omision} />,
      <PantallaCriterios key="c" {...base} persona={colab} />,
      <PantallaCriterios key="d" {...base} persona={colab} criterios={omision} />,
      <PantallaCriterios key="e" {...base} aviso="criterios_guardados" />,
      <PantallaCriterios key="f" {...base} aviso="conflicto" />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
  it('sin criterios propios se rotula «Criterios por omisión de la herramienta» y no hay nivel de aceptación', () => {
    const { container } = render(<PantallaCriterios {...base} criterios={omision} />);
    expect(container.textContent).toContain('Criterios por omisión de la herramienta');
    expect(container.textContent).toContain('Nivel de aceptación: sin definir');
    expect(container.textContent).not.toContain('Criterios de la empresa, versión');
  });
  it('con criterios propios dice la versión, la fecha y el nivel de aceptación con palabras', () => {
    const { container } = render(<PantallaCriterios {...base} />);
    expect(container.textContent).toContain('Criterios de la empresa, versión 2');
    expect(container.textContent).toContain('Guardados el 2026-11-25');
    expect(container.textContent).toContain('Nivel de aceptación: Medio');
    expect(container.textContent).not.toContain('Criterios por omisión de la herramienta');
  });
  it('la matriz trae 25 celdas con el nivel en palabras y números, la cantidad de riesgos y un nombre accesible completo', () => {
    const { container } = render(<PantallaCriterios {...base} persona={colab} />);
    const filas = container.querySelectorAll('tbody tr');
    expect(filas).toHaveLength(5);
    expect(container.querySelectorAll('tbody td')).toHaveLength(25);
    const celda = container.querySelector('[aria-label="Probabilidad 3, impacto 4: nivel Alto, 2 riesgos vigentes"]');
    expect(celda?.textContent).toContain('Alto (12)');
    expect(celda?.textContent).toContain('2 riesgos');
    expect(container.querySelector('[aria-label="Probabilidad 1, impacto 1: nivel Bajo, 1 riesgo vigente"]')?.textContent).toContain('Bajo (1)');
    expect(container.textContent).toContain('Hay 3 riesgos vigentes en total.');
    // Las descripciones de la empresa rotulan filas y columnas.
    expect(container.querySelector('tbody th')?.textContent).toContain('Probabilidad 5: Prob cinco');
    expect(container.querySelector('thead')?.textContent).toContain('Impacto 1: Imp uno');
  });
  it('solo el administrador ve el formulario: POST a una ruta propia, con la versión que vio y los diez campos acotados', () => {
    const a = render(<PantallaCriterios {...base} />).container;
    const f = a.querySelector('form[action="/e/empresa-a/criterios/guardar"]')!;
    expect(f.getAttribute('method')).toBe('post');
    expect(f.querySelector('input[name="version"]')?.getAttribute('value')).toBe('2');
    const nombres = [...f.querySelectorAll('input[type="text"], input:not([type])')].map((x) => x.getAttribute('name'));
    expect(nombres).toEqual([...[1, 2, 3, 4, 5].map((n) => `probabilidad_${n}`), ...[1, 2, 3, 4, 5].map((n) => `impacto_${n}`)]);
    for (const x of f.querySelectorAll('input[name^="probabilidad_"], input[name^="impacto_"]')) {
      expect(x.hasAttribute('required')).toBe(true);
      expect(x.getAttribute('maxlength')).toBe('200');
    }
    expect(f.querySelector('select[name="nivelAceptacion"]')?.getAttribute('required')).not.toBeNull();
    expect(f.querySelector('[name="empresa"], [name="empresaId"], [name="origen"]')).toBeNull();
    expect(render(<PantallaCriterios {...base} persona={colab} />).container.querySelector('form[action$="/guardar"]')).toBeNull();
  });
  it('con la escala por omisión el formulario parte de la versión 0 (así la API detecta si otra persona guardó antes)', () => {
    const { container } = render(<PantallaCriterios {...base} criterios={omision} />);
    expect(container.querySelector('input[name="version"]')?.getAttribute('value')).toBe('0');
  });
});
