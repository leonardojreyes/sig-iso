import { fireEvent, render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { contraste, cssMarca, derivarTema } from '@sig/tokens';
import { requisitoDe, requisitosDe } from '../datos-demo';
import { cssDeEmpresa, empresas, obtenerEmpresa } from '../empresas';
import { PantallaDetalleRequisito } from './detalle-requisito';
import { PantallaFormularioRequisito, validarRequisito } from './formulario-requisito';
import { PantallaIngreso } from './ingreso';
import { logoSeguro } from './marco';
import { PantallaPanel } from './panel';
import { filtrarRequisitos, PantallaRequisitos } from './requisitos';

const sinViolaciones = async (ui: React.ReactElement) => {
  const { container } = render(ui);
  expect(await axe(container)).toHaveNoViolations();
};

describe.each(Object.values(empresas))('pantallas plantilla — $nombre (axe)', (empresa) => {
  it('ingreso', () => sinViolaciones(<PantallaIngreso empresa={empresa} />));
  it('panel', () => sinViolaciones(<PantallaPanel empresa={empresa} />));
  it('listado con filtros', () => sinViolaciones(<PantallaRequisitos empresa={empresa} filtros={{}} />));
  it('listado sin resultados', () => sinViolaciones(<PantallaRequisitos empresa={empresa} filtros={{ q: 'zzz' }} />));
  it('formulario', () => sinViolaciones(<PantallaFormularioRequisito empresa={empresa} />));
  it('detalle', () => sinViolaciones(<PantallaDetalleRequisito empresa={empresa} requisito={requisitosDe(empresa.id)[0]!} />));
});

describe('listado: filtros', () => {
  it('filtra por norma, estado y texto', () => {
    expect(filtrarRequisitos('a', { norma: 'ISO 9001' }).every((r) => r.norma === 'ISO 9001')).toBe(true);
    expect(filtrarRequisitos('a', { estado: 'noCumple' }).length).toBeGreaterThan(0);
    expect(filtrarRequisitos('a', { q: 'auditoría' }).map((r) => r.id)).toContain('r4');
    expect(filtrarRequisitos('a', { q: 'zzz' })).toEqual([]);
  });
});

describe('formulario: validación', () => {
  it('detecta cláusula, título y guía inválidos', () => {
    expect(Object.keys(validarRequisito({ clausula: '6 1', titulo: '', guia: 'corta' })).sort()).toEqual(['clausula', 'guia', 'titulo']);
    expect(validarRequisito({ clausula: '6.1.2', titulo: 'Título válido', guia: 'Una guía con más de diez caracteres.' })).toEqual({});
  });
  it('muestra errores enlazados y luego el éxito, sin violaciones axe', async () => {
    const { container, getByRole, findByText } = render(<PantallaFormularioRequisito empresa={empresas.a!} />);
    fireEvent.submit(getByRole('form', { name: 'Nuevo requisito' }));
    expect(await findByText(/identificador válido/)).toBeTruthy();
    expect(container.querySelector('[aria-invalid="true"]')).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('marca por empresa', () => {
  it('los colores de las dos empresas son distintos y cumplen AA', () => {
    const [a, b] = [derivarTema(empresas.a!), derivarTema(empresas.b!)];
    expect(a.claro['--sig-color-primary']).not.toBe(b.claro['--sig-color-primary']);
    // En modo claro los colores de ambas empresas ya cumplen y no se alteran.
    expect(a.claro['--sig-color-primary']!.toLowerCase()).toBe('#0e5c42');
    expect(b.claro['--sig-color-primary']!.toLowerCase()).toBe('#1d4ed8');
    // En modo oscuro el verde se aclara (y avisa) para cumplir AA; ambos modos cumplen.
    for (const t of [a, b]) {
      expect(contraste(t.claro['--sig-color-primary']!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contraste(t.oscuro['--sig-color-primary']!, '#0f172a')).toBeGreaterThanOrEqual(4.5);
    }
    expect(a.advertencias.some((x) => x.includes('modo oscuro'))).toBe(true);
  });
});

describe('aislamiento entre empresas', () => {
  it('un requisito de A no se resuelve bajo B y viceversa', () => {
    expect(requisitoDe('a', 'r4')).toBeDefined();
    expect(requisitoDe('b', 'r4')).toBeUndefined();
    expect(requisitosDe('b').every((r) => r.empresaId === 'b')).toBe(true);
    expect(requisitosDe('a').every((r) => r.empresaId === 'a')).toBe(true);
  });

  it('el listado de una empresa nunca incluye datos de la otra', () => {
    const idsA = new Set(filtrarRequisitos('a', {}).map((r) => r.empresaId));
    const idsB = new Set(filtrarRequisitos('b', {}).map((r) => r.empresaId));
    expect([...idsA]).toEqual(['a']);
    expect([...idsB]).toEqual(['b']);
  });

  it('el CSS de marca de una empresa no contiene el id ni el color de la otra', () => {
    const cssA = cssDeEmpresa(empresas.a!).toLowerCase();
    expect(cssA).toContain('data-empresa="a"');
    expect(cssA).not.toContain('data-empresa="b"');
    expect(cssA).not.toContain('#1d4ed8');
  });

  it('rechaza ids heredados o malformados', () => {
    for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'A', '', 'a b', '../a']) {
      expect(obtenerEmpresa(id)).toBeUndefined();
      expect(requisitosDe(id)).toEqual([]);
    }
    expect(obtenerEmpresa('a')?.id).toBe('a');
  });

  it('cssMarca rechaza un id malicioso', () => {
    const tema = derivarTema(empresas.a!);
    expect(() => cssMarca('a"]{}</style><script>', tema)).toThrow();
  });
});

describe('logo de empresa', () => {
  it('solo acepta rutas propias o https', () => {
    expect(logoSeguro('/logos/a.svg')).toBe('/logos/a.svg');
    expect(logoSeguro('https://cdn.ejemplo.ec/logo.png')).toBeDefined();
    for (const u of ['http://x.ec/l.png', '//x.ec/l.png', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', undefined]) {
      expect(logoSeguro(u)).toBeUndefined();
    }
  });
});
