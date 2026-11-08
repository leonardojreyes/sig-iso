import { contraste } from '@sig/tokens';
import { describe, expect, it } from 'vitest';
import { crearMarca, ErrorMarca } from './marca-empresa.js';

const base = { nombre: 'Empresa Alfa', colorPrimario: '#0b5fff' };

describe('MarcaEmpresa — color (H3.2)', () => {
  it('conserva un color que ya cumple el contraste AA', () => {
    const m = crearMarca(base);
    expect(m.colorPrimario).toBe('#0b5fff');
    expect(m.colorOriginal).toBe('#0b5fff');
    expect(m.ajustadoPorContraste).toBe(false);
  });

  it('ajusta un color claro hasta cumplir AA y avisa (ajustadoPorContraste)', () => {
    const m = crearMarca({ ...base, colorPrimario: '#ffe066' });
    expect(m.ajustadoPorContraste).toBe(true);
    expect(m.colorOriginal).toBe('#ffe066');
    expect(m.colorPrimario).not.toBe('#ffe066');
    expect(contraste(m.colorPrimario, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('el color aplicado siempre cumple AA, incluso con blanco puro', () => {
    const m = crearMarca({ ...base, colorPrimario: '#FFFFFF' });
    expect(contraste(m.colorPrimario, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(m.ajustadoPorContraste).toBe(true);
  });

  it('mayúsculas y minúsculas no cuentan como ajuste', () => {
    const m = crearMarca({ ...base, colorPrimario: '#0B5FFF' });
    expect(m.ajustadoPorContraste).toBe(false);
  });

  it.each(['rojo', '#fff', '#12345g', '0b5fff', '#0b5fff;x', ''])('rechaza el color inválido %j', (c) => {
    expect(() => crearMarca({ ...base, colorPrimario: c })).toThrow(ErrorMarca);
  });
});

describe('MarcaEmpresa — nombre', () => {
  it('recorta espacios y exige 1 a 120 caracteres', () => {
    expect(crearMarca({ ...base, nombre: '  Alfa  ' }).nombre).toBe('Alfa');
    expect(() => crearMarca({ ...base, nombre: '   ' })).toThrow(ErrorMarca);
    expect(() => crearMarca({ ...base, nombre: 'a'.repeat(121) })).toThrow(ErrorMarca);
    expect(crearMarca({ ...base, nombre: 'a'.repeat(120) }).nombre).toHaveLength(120);
  });
});

describe('MarcaEmpresa — logo (H3.3)', () => {
  it.each([
    'https://cdn.empresa.ec/logo.png',
    'https://cdn.empresa.ec:8443/a/logo.svg',
    '/logos/alfa.png',
  ])('acepta %s', (logo) => {
    expect(crearMarca({ ...base, logoUrl: logo }).logoUrl).toBe(logo);
  });

  it.each([
    'http://cdn.empresa.ec/logo.png',
    'https://user:clave@cdn.empresa.ec/logo.png',
    '//evil.example/logo.png',
    '/\\evil.example/logo.png',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,AAAA',
    'ftp://x.ec/l.png',
    'logo.png',
    'https://cdn.empresa.ec/lo go.png',
    `https://cdn.empresa.ec/${'a'.repeat(2048)}`,
    '',
  ])('descarta %j y usa el monograma', (logo) => {
    const m = crearMarca({ ...base, logoUrl: logo });
    expect(m.logoUrl).toBeNull();
    expect(m.monograma).toBe('EA');
  });

  it('sin logo es nulo (null o ausente)', () => {
    expect(crearMarca(base).logoUrl).toBeNull();
    expect(crearMarca({ ...base, logoUrl: null }).logoUrl).toBeNull();
  });
});

describe('MarcaEmpresa — monograma', () => {
  it.each([
    ['Empresa Alfa', 'EA'],
    ['Synaptech', 'S'],
    ['  óscar  ñandú  sa', 'ÓÑ'],
    ['123 Servicios', 'S'],
  ])('%j → %j', (nombre, esperado) => {
    expect(crearMarca({ ...base, nombre }).monograma).toBe(esperado);
  });

  it('usa un signo neutro si el nombre no tiene letras', () => {
    expect(crearMarca({ ...base, nombre: '123' }).monograma).toBe('?');
  });
});

describe('MarcaEmpresa — inmutabilidad', () => {
  it('el resultado está congelado', () => {
    expect(Object.isFrozen(crearMarca(base))).toBe(true);
  });
});
