import { describe, expect, it } from 'vitest';
import { huellaCanonica } from './carga-catalogo.js';

// Librería SINTÉTICA (ningún texto de norma).
const libreria = () => ({
  esquema: 2 as const,
  codigo: 'prueba-sintetica',
  nombre: 'Librería sintética de prueba',
  version: '1.0.0',
  es_ejemplo: true,
  fuente: 'elaboración propia SynapTech',
  referencias: [{ norma: 'Norma A', edicion: '2015' }],
  entradas: [
    {
      id: 'ha-4.1',
      capitulo: 4,
      nivel: 1 as const,
      titulo: 'Primer tema',
      guia: 'Texto sintético uno, sin relación con ninguna norma.',
      alcance_comun: 'comun' as const,
      aplica_a: [{ norma: 'Norma A', edicion: '2015', clausula: '4.1' }],
    },
    {
      id: 'ha-4.2',
      capitulo: 4,
      nivel: 1 as const,
      titulo: 'Segundo tema',
      guia: 'Texto sintético dos, sin relación con ninguna norma.',
      alcance_comun: 'parcial' as const,
      aplica_a: [{ norma: 'Norma A', edicion: '2015', clausula: '4.2' }],
    },
  ],
});

describe('huellaCanonica (SHA-256 del contenido, ADR 026)', () => {
  it('es un SHA-256 en hexadecimal (64 caracteres)', () => {
    expect(huellaCanonica(libreria())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('no depende del orden de las claves ni de cómo se escribió el archivo', () => {
    const a = libreria();
    const reordenada = {
      entradas: a.entradas.map((e) => ({
        aplica_a: e.aplica_a,
        alcance_comun: e.alcance_comun,
        guia: e.guia,
        titulo: e.titulo,
        nivel: e.nivel,
        capitulo: e.capitulo,
        id: e.id,
      })),
      referencias: a.referencias,
      fuente: a.fuente,
      es_ejemplo: a.es_ejemplo,
      version: a.version,
      nombre: a.nombre,
      codigo: a.codigo,
      esquema: a.esquema,
    };
    expect(huellaCanonica(reordenada)).toBe(huellaCanonica(a));
  });

  it('cambia con CUALQUIER cambio de contenido (versión, nombre, fuente, guía, título, clasificación, correspondencias)', () => {
    const base = huellaCanonica(libreria());
    const cambios: Array<(l: ReturnType<typeof libreria>) => void> = [
      (l) => void (l.version = '1.0.1'),
      (l) => void (l.nombre += '.'),
      (l) => void (l.fuente += '.'),
      (l) => void (l.es_ejemplo = false),
      (l) => void (l.entradas[0]!.guia += '.'),
      (l) => void (l.entradas[0]!.titulo += 's'),
      (l) => void (l.entradas[0]!.alcance_comun = 'especifico' as never),
      (l) => void (l.entradas[0]!.aplica_a[0]!.clausula = '4.9'),
      (l) => void l.entradas.pop(),
      (l) => void l.referencias.push({ norma: 'Norma B', edicion: '2020' }),
    ];
    for (const [i, cambiar] of cambios.entries()) {
      const l = libreria();
      cambiar(l);
      expect(huellaCanonica(l), `cambio ${i}`).not.toBe(base);
    }
  });

  it('el ORDEN de las entradas importa (es el orden en que se muestran)', () => {
    const l = libreria();
    l.entradas.reverse();
    expect(huellaCanonica(l)).not.toBe(huellaCanonica(libreria()));
  });

  it('no confunde valores que se parecen al unirlos (separadores)', () => {
    const a = libreria();
    const b = libreria();
    a.nombre = 'ab';
    a.fuente = 'c';
    b.nombre = 'a';
    b.fuente = 'bc';
    expect(huellaCanonica(a)).not.toBe(huellaCanonica(b));
  });
});
