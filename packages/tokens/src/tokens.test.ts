import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AA_COMPONENTE, AA_TEXTO, contraste, cssMarca, derivarTema } from './index';

const { claro, oscuro } = JSON.parse(readFileSync(join(import.meta.dirname, '../dist/tokens.resolved.json'), 'utf8')) as {
  claro: Record<string, string>;
  oscuro: Record<string, string>;
};

const modos = { claro, oscuro } as const;

describe.each(Object.entries(modos))('tokens base — modo %s', (_nombre, t) => {
  const c = (k: string) => t[`color.${k}`]!;

  it('texto principal y atenuado sobre fondo y superficies (AA 4.5)', () => {
    for (const fondo of ['background', 'surface', 'surface-muted']) {
      expect(contraste(c('text'), c(fondo))).toBeGreaterThanOrEqual(AA_TEXTO);
      expect(contraste(c('text-muted'), c(fondo))).toBeGreaterThanOrEqual(AA_TEXTO);
    }
  });
  it('texto sobre botón primario y sobre primario suave (AA 4.5)', () => {
    expect(contraste(c('on-primary'), c('primary'))).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(c('on-primary'), c('primary-hover'))).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(c('on-primary-subtle'), c('primary-subtle'))).toBeGreaterThanOrEqual(AA_TEXTO);
  });
  it('primario como texto/enlace sobre fondo y superficie (AA 4.5)', () => {
    expect(contraste(c('primary'), c('background'))).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(c('primary'), c('surface'))).toBeGreaterThanOrEqual(AA_TEXTO);
  });
  it.each(['success', 'warning', 'danger', 'info', 'neutral-status'])('estado %s legible sobre su fondo suave y la superficie (AA 4.5)', (e) => {
    const suave = e === 'neutral-status' ? 'neutral-status-subtle' : `${e}-subtle`;
    expect(contraste(c(e), c(suave))).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(c(e), c('surface'))).toBeGreaterThanOrEqual(AA_TEXTO);
  });
  it('bordes de controles y anillo de foco (componentes, 3:1)', () => {
    expect(contraste(c('border-strong'), c('surface'))).toBeGreaterThanOrEqual(AA_COMPONENTE);
    expect(contraste(c('ring'), c('surface'))).toBeGreaterThanOrEqual(AA_COMPONENTE);
  });
});

describe('tematización por empresa', () => {
  const empresas = [
    { id: 'a', nombre: 'Empresa A', primario: '#0E5C42' },
    { id: 'b', nombre: 'Empresa B', primario: '#1D4ED8' },
  ];

  it.each(empresas)('$nombre cumple AA en claro y oscuro', (e) => {
    const t = derivarTema(e);
    expect(contraste(t.claro['--sig-color-primary']!, '#ffffff')).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(t.claro['--sig-color-on-primary']!, t.claro['--sig-color-primary']!)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(t.oscuro['--sig-color-primary']!, '#0f172a')).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(t.oscuro['--sig-color-on-primary']!, t.oscuro['--sig-color-primary']!)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(t.claro['--sig-color-on-primary-subtle']!, t.claro['--sig-color-primary-subtle']!)).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(contraste(t.oscuro['--sig-color-on-primary-subtle']!, t.oscuro['--sig-color-primary-subtle']!)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('las dos empresas producen colores distintos', () => {
    const [a, b] = empresas.map((e) => derivarTema(e));
    expect(a!.claro['--sig-color-primary']).not.toBe(b!.claro['--sig-color-primary']);
  });

  it('ajusta y avisa cuando el color de la empresa no cumple (amarillo)', () => {
    const t = derivarTema({ nombre: 'Amarilla', primario: '#FACC15' });
    expect(t.advertencias.length).toBeGreaterThan(0);
    expect(contraste(t.claro['--sig-color-primary']!, '#ffffff')).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('rechaza un color inválido', () => {
    expect(() => derivarTema({ nombre: 'x', primario: 'verde' })).toThrow();
  });

  it('genera CSS acotado por empresa', () => {
    const css = cssMarca('a', derivarTema(empresas[0]!));
    expect(css).toContain('[data-empresa="a"]');
    expect(css).toContain('--sig-color-primary');
  });
});
