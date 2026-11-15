import { describe, expect, it } from 'vitest';
import { LectorLibreriaYaml } from './lector-libreria-yaml.adapter.js';

const t = (s: string) => new TextEncoder().encode(s);

describe('LectorLibreriaYaml', () => {
  const lector = new LectorLibreriaYaml();

  it('lee YAML normal', () => expect(lector.leer(t('a: 1\nb: [x, y]\n'))).toEqual({ ok: true, datos: { a: 1, b: ['x', 'y'] } }));
  it('la huella es el SHA-256 de los bytes', () => expect(lector.huellaDe(t('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));

  it.each([
    ['un PDF o una imagen (bytes que no son UTF-8)', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe, 0x00])],
    ['texto con bytes nulos', t('a: 1\u0000b')],
  ])('rechaza %s como tipo no permitido', (_n, bytes) => {
    expect(lector.leer(bytes)).toEqual({ ok: false, motivo: 'tipo_no_permitido', codigo: 'no_es_texto' });
  });

  it.each([
    ['YAML mal formado', 'a: [1, 2\nsecreto: SECRETO-XYZ'],
    ['alias y anclas (bomba YAML)', 'a: &a [1,2,3]\nb: [*a,*a,*a]\n'],
    ['claves repetidas', 'codigo: a\ncodigo: b\n'],
  ])('rechaza %s sin citar el contenido', (_n, texto) => {
    const r = lector.leer(t(texto));
    expect(r).toEqual({ ok: false, motivo: 'formato_invalido', codigo: 'yaml_invalido' });
    expect(JSON.stringify(r)).not.toContain('SECRETO-XYZ');
  });
});
