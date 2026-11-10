import { describe, expect, it } from 'vitest';
import { EntradaLibreria } from './entrada-libreria.js';
import { ErrorNormas } from './errores.js';

const base = {
  id: '22222222-2222-4222-8222-222222222222',
  libreriaId: '11111111-1111-4111-8111-111111111111',
  idEstable: 'ha-contexto',
  capitulo: 4,
  nivel: 1 as const,
  titulo: 'Contexto',
  guia: 'Describe el entorno de la organización y quiénes tienen interés en sus resultados.',
  alcanceComun: 'comun' as const,
  aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1' }],
  esEjemplo: true,
  orden: 1,
};

const falla = (cambio: Record<string, unknown>) => {
  try { EntradaLibreria.crear({ ...base, ...cambio } as never); } catch (e) { return e as ErrorNormas; }
  return undefined;
};

describe('EntradaLibreria — capítulo (4 a 10)', () => {
  it.each([4, 5, 6, 7, 8, 9])('acepta el capítulo %i', (capitulo) => {
    expect(EntradaLibreria.crear({ ...base, capitulo }).capitulo).toBe(capitulo);
  });
  it.each([0, 1, 3, 11, 4.5, -4, Number.NaN, '4' as never])('rechaza el capítulo %j', (capitulo) => {
    expect(falla({ capitulo })?.campo).toBe('capitulo');
  });
});

describe('EntradaLibreria — capítulo 10 por tema', () => {
  const diez = { capitulo: 10, idEstable: 'ha-mejora', aplicaA: [
    { norma: 'ISO 9001', edicion: '2015', clausula: '10.3' },
    { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '10.1' },
  ] };

  it('acepta una entrada temática con una cláusula distinta por norma', () => {
    const e = EntradaLibreria.crear({ ...base, ...diez });
    expect(e.aplicaA.map((a) => a.clausula)).toEqual(['10.3', '10.1']);
  });
  it.each(['10.1', '10.3', '10', '10-1'])('rechaza el identificador numérico %s en el capítulo 10', (idEstable) => {
    expect(falla({ ...diez, idEstable })?.campo).toBe('idEstable');
  });
  it('en otros capítulos un identificador numérico sí se admite', () => {
    expect(EntradaLibreria.crear({ ...base, idEstable: '4.1' }).idEstable).toBe('4.1');
  });
});

describe('EntradaLibreria — aplica_a', () => {
  it('no puede estar vacío', () => { expect(falla({ aplicaA: [] })?.campo).toBe('aplicaA'); });
  it.each([undefined, null, 'ISO 9001'])('rechaza un aplicaA que no es lista (%j)', (aplicaA) => {
    expect(falla({ aplicaA })?.campo).toBe('aplicaA');
  });
  it('rechaza norma y edición repetidas', () => {
    expect(falla({ aplicaA: [base.aplicaA[0], { ...base.aplicaA[0], clausula: '4.2' }] })?.campo).toBe('aplicaA');
  });
  it('acepta la misma norma con otra edición', () => {
    const e = EntradaLibreria.crear({ ...base, aplicaA: [base.aplicaA[0]!, { norma: 'ISO 9001', edicion: '2008', clausula: '4.1' }] });
    expect(e.aplicaA).toHaveLength(2);
  });
  it.each([
    [{ norma: '', edicion: '2015', clausula: '4.1' }],
    [{ norma: 'N'.repeat(61), edicion: '2015', clausula: '4.1' }],
    [{ norma: 'ISO 9001', edicion: '15', clausula: '4.1' }],
    [{ norma: 'ISO 9001', edicion: '2015', clausula: '4..1' }],
    [{ norma: 'ISO 9001', edicion: '2015', clausula: '' }],
    [{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1 ' }],
    [{ norma: 'ISO 9001', edicion: '2015', clausula: `4.${'1'.repeat(19)}` }],
  ])('rechaza la correspondencia inválida %j', (a) => {
    expect(falla({ aplicaA: [a] })?.campo).toBe('aplicaA');
  });
  it('acepta cláusulas de anexo (A.5.1)', () => {
    expect(EntradaLibreria.crear({ ...base, aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }] }).aplicaA[0]?.clausula).toBe('A.5.1');
  });
  it('la lista guardada no se altera si se cambia la original', () => {
    const lista = [{ ...base.aplicaA[0]! }];
    const e = EntradaLibreria.crear({ ...base, aplicaA: lista });
    lista.push({ norma: 'X', edicion: '2020', clausula: '1' });
    lista[0]!.clausula = '9.9';
    expect(e.aplicaA).toEqual([{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1' }]);
    expect(Object.isFrozen(e.aplicaA)).toBe(true);
  });
});

describe('EntradaLibreria — resto de campos', () => {
  it.each([
    ['id', { id: 'x' }], ['libreriaId', { libreriaId: 'x' }],
    ['idEstable', { idEstable: 'Mayús' }], ['idEstable', { idEstable: '' }], ['idEstable', { idEstable: 'a'.repeat(42) }],
    ['nivel', { nivel: 3 }], ['nivel', { nivel: 0 }],
    ['alcanceComun', { alcanceComun: 'todo' }],
    ['esEjemplo', { esEjemplo: 1 }],
    ['orden', { orden: -1 }], ['orden', { orden: 1.5 }],
  ])('rechaza un valor inválido de %s', (campo, cambio) => {
    expect(falla(cambio)?.campo).toBe(campo);
  });
  it.each([1, 2])('acepta nivel %i', (nivel) => { expect(EntradaLibreria.crear({ ...base, nivel: nivel as 1 | 2 }).nivel).toBe(nivel); });
  it.each(['comun', 'parcial', 'especifico'] as const)('acepta alcance %s', (alcanceComun) => {
    expect(EntradaLibreria.crear({ ...base, alcanceComun }).alcanceComun).toBe(alcanceComun);
  });
});

describe('EntradaLibreria — título y guía (regla 3: nada de texto de normas)', () => {
  it('recorta el título', () => { expect(EntradaLibreria.crear({ ...base, titulo: '  Contexto  ' }).titulo).toBe('Contexto'); });
  it.each([['x'], ['t'.repeat(81)], ['']])('rechaza el título %j por longitud', (titulo) => {
    expect(falla({ titulo })?.campo).toBe('titulo');
  });
  it.each([['corta'], ['g'.repeat(281)]])('rechaza la guía por longitud', (guia) => {
    expect(falla({ guia })?.campo).toBe('guia');
  });
  it('rechaza una guía de tres frases', () => {
    expect(falla({ guia: 'Primera idea clara. Segunda idea clara. Tercera idea clara.' })?.campo).toBe('guia');
  });
  it('rechaza una guía con tono normativo', () => {
    expect(falla({ guia: 'La organización deberá determinar y deberá mantener esta información documentada.' })?.campo).toBe('guia');
  });
  it('rechaza una cita textual larga y los enlaces', () => {
    expect(falla({ guia: 'Usa «una frase copiada literalmente de algún documento externo» en tu texto.' })?.campo).toBe('guia');
    expect(falla({ guia: 'Consulta https://ejemplo.ec/norma para ver el detalle completo de esto.' })?.campo).toBe('guia');
  });
  it('el error lleva códigos de motivo y no repite el texto rechazado', () => {
    const texto = 'Texto SECRETO con tres frases. Otra frase. Y otra más.';
    const e = falla({ guia: texto });
    expect(e?.motivos).toContain('guia_demasiadas_frases');
    expect(e?.message).not.toContain('SECRETO');
    expect(JSON.stringify(e?.motivos)).not.toContain('SECRETO');
  });
  it('queda congelada', () => { expect(Object.isFrozen(EntradaLibreria.crear(base))).toBe(true); });
});

describe('EntradaLibreria — controles del Anexo A (tipo «control»)', () => {
  const control = { tipo: 'control' as const, capitulo: null, grupo: 'Organizacionales', idEstable: 'a27-5-1', alcanceComun: 'especifico' as const, aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }] };

  it('una entrada sin tipo es una cláusula con tema nulo (compatibilidad con las librerías anteriores)', () => {
    const e = EntradaLibreria.crear(base);
    expect(e.tipo).toBe('clausula');
    expect(e.grupo).toBeNull();
  });

  it('acepta un control con tema, sin capítulo, y conserva el identificador «A.5.1» de su norma', () => {
    const e = EntradaLibreria.crear({ ...base, ...control });
    expect(e).toMatchObject({ tipo: 'control', capitulo: null, grupo: 'Organizacionales' });
    expect(e.aplicaA[0]?.clausula).toBe('A.5.1');
  });

  it('el tema se recorta y no admite caracteres de control', () => {
    expect(EntradaLibreria.crear({ ...base, ...control, grupo: '  Personas  ' }).grupo).toBe('Personas');
    expect(falla({ ...control, grupo: 'Per\nsonas' })?.campo).toBe('grupo');
  });

  it.each([['sin tema', { grupo: undefined }], ['tema demasiado corto', { grupo: 'a' }], ['tema demasiado largo', { grupo: 'x'.repeat(61) }], ['tema que no es texto', { grupo: 5 }]])('rechaza un control %s', (_n, cambio) => {
    expect(falla({ ...control, ...cambio })?.campo).toBe('grupo');
  });

  it('rechaza un control con capítulo y una cláusula con tema', () => {
    expect(falla({ ...control, capitulo: 5 })?.campo).toBe('capitulo');
    expect(falla({ grupo: 'Organizacionales' })?.campo).toBe('grupo');
  });

  it('rechaza un tipo desconocido', () => {
    expect(falla({ tipo: 'objetivo' })?.campo).toBe('tipo');
  });

  it('un control no está sujeto a la regla del capítulo 10 por tema', () => {
    expect(EntradaLibreria.crear({ ...base, ...control, idEstable: 'a27-10' }).tipo).toBe('control');
  });
});
