// Plantilla de una librería de norma para descargar y completar. Texto PROPIO (ninguna frase proviene de una norma): solo explica el
// formato. La persona la completa con sus palabras; el sistema la valida al subirla.
export const NOMBRE_PLANTILLA = 'plantilla-libreria.yaml';

export const PLANTILLA_LIBRERIA = `# Plantilla de librería de norma (esquema 3).
# Complete con SUS PALABRAS: no copie texto de la norma. Solo se guardan el identificador, un título breve y una guía propia.
# Suba el archivo desde la pantalla «Normas». Cada versión es inmutable: para cambiar algo, suba una versión nueva.

esquema: 3
# Debe empezar con «propia-»; solo minúsculas, números y guiones (hasta 64 caracteres).
codigo: propia-mi-norma
nombre: Mi norma (resumen propio)
# Tres números separados por puntos. Súbala de nuevo con otra versión para corregirla.
version: 1.0.0
# Siempre falso en una librería propia.
es_ejemplo: false
fuente: elaboración propia de la empresa

# Las normas y ediciones a las que se refieren sus entradas.
referencias:
  - { norma: ISO 9001, edicion: "2015" }

entradas:
  # id: minúsculas, números, puntos y guiones. nivel: 1 o 2. capitulo: de 4 a 10 (solo para cláusulas).
  # alcance_comun: comun, parcial o especifico. guia: de 10 a 280 caracteres, una o dos frases, sin copiar la norma.
  - id: mi-4.1
    capitulo: 4
    nivel: 1
    titulo: Contexto de la organización
    guia: Describa con sus palabras qué conviene tener resuelto sobre el contexto de la empresa.
    alcance_comun: comun
    aplica_a:
      - { norma: ISO 9001, edicion: "2015", clausula: "4.1" }
`;
