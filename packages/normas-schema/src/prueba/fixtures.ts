// Librería SINTÉTICA para pruebas: ningún texto de norma, solo frases neutras inventadas para este archivo.
export const libreriaValida = (): Record<string, unknown> => ({
  esquema: 2,
  codigo: 'prueba-sintetica',
  nombre: 'Librería sintética de prueba',
  version: '1.0.0',
  es_ejemplo: true,
  fuente: 'elaboración propia SynapTech',
  referencias: [
    { norma: 'Norma A', edicion: '2015' },
    { norma: 'Norma B', edicion: '2022' },
  ],
  entradas: [
    {
      id: 'ha-4.1',
      capitulo: 4,
      nivel: 1,
      titulo: 'Primer tema de prueba',
      guia: 'Texto sintético de prueba, sin relación con ninguna norma.',
      alcance_comun: 'comun',
      aplica_a: [
        { norma: 'Norma A', edicion: '2015', clausula: '4.1' },
        { norma: 'Norma B', edicion: '2022', clausula: '4.1' },
      ],
    },
    {
      id: 'ha-mejora',
      capitulo: 10,
      nivel: 1,
      titulo: 'Tema con numeración distinta',
      guia: 'Otro texto sintético de prueba que difiere según la norma.',
      alcance_comun: 'parcial',
      aplica_a: [
        { norma: 'Norma A', edicion: '2015', clausula: '10.3' },
        { norma: 'Norma B', edicion: '2022', clausula: '10.1' },
      ],
    },
  ],
});

type Obj = Record<string, unknown>;
/** Copia profunda para estropear un campo sin tocar el original. */
export const clonar = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const entrada = (l: Obj, i = 0): Obj => (l.entradas as Obj[])[i]!;
