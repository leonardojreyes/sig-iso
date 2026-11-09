# Verificación de numeraciones y guías — librería de ejemplo

- **Para:** el responsable del proyecto.
- **Pregunta del spec:** Q7 (¿quién verifica la numeración de cada norma antes de fijar la librería?).
- **Archivo a validar:** `libraries/normas/ejemplo-estructura-armonizada.yaml` (versión `0.1.0`, **borrador**).
- **Estado:** pendiente de tu verificación y de una decisión sobre los títulos.

## Qué tienes que hacer

Son tres comprobaciones. **No hace falta copiar ni pegar texto de las normas.**

**1. Numeración (la principal).** Compara solo números:

1. Abre tus ejemplares de **ISO 9001:2015**, **ISO/IEC 27001:2022** e **ISO/IEC 42001:2023**.
2. Mira el **índice** (tabla de contenido) de cada una.
3. Para cada fila de la tabla, comprueba que la cláusula indicada **existe con ese número** y que **trata del mismo tema** que la fila.
4. Marca la casilla «Verificado» (☐ → ☑) si las tres coinciden. Si alguna no coincide, anota el número correcto al lado.

**2. Guías.** Lee cada guía (están en el YAML, una por entrada) y confirma que **ninguna afirma algo que una de las tres normas no dice**, ni mezcla una práctica del proceso de certificación con un requisito de la norma. Es justo donde `experto-iso` halló errores en la primera versión: ya se corrigieron dos (la 9.2 y la 9.3 decían que eran prerrequisito de la auditoría de Etapa 2, y la 6.1 afirmaba algo falso para ISO 9001).

**3. Decisión sobre los títulos.** Según `revisor-cumplimiento` (que lo cita de memoria, sin poder comprobarlo), **15 de los 21 títulos coinciden, total o casi, con el nombre usual de la cláusula** («Competencia», «Auditoría interna», «Revisión por la dirección»…). Las reglas del proyecto permiten un «título breve», y los nombres cortos y genéricos de cláusula no son un párrafo copiado, pero **no son «propios»**. Tienes dos opciones, y conviene que la decidas con el asesor legal:

| Opción               | Qué implica                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Dejarlos**      | Se aceptan los nombres usuales de las cláusulas como títulos breves. Hay que mantener la nota honesta del YAML («varios títulos coinciden con nombres usuales de cláusula»)                                                                                  |
| **B. Reformularlos** | Se reescriben con palabras de SynapTech, por ejemplo «Entorno de la organización», «Compromiso de la dirección», «Capacidades del personal», «Documentos y registros», «Auditorías propias». Más seguro, pero menos reconocible para quien conoce las normas |

## Dónde poner especial atención en la numeración

Las filas con más riesgo de error, según `experto-iso`:

| Fila                                            | Qué comprobar                                                                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ha-mejora` y `ha-no-conformidad` (capítulo 10) | El orden del capítulo 10 **difiere entre las normas**. La tabla supone que la mejora continua es la 10.3 en ISO 9001 y la 10.1 en 27001 y 42001, y que «no conformidad y acción correctiva» es la 10.2 en las tres |
| `ha-mejora`                                     | ISO 9001 tiene además una cláusula 10.1 de generalidades de la mejora que **no tiene entrada propia**; la entrada apunta a su 10.3. Confirma que está bien así                                                     |
| `ha-6.3`                                        | Confirma que la **planificación de cambios** existe como 6.3 en **las tres ediciones**. Es la más dudosa para ISO/IEC 42001                                                                                        |
| `ha-4.4`                                        | Confirma que el tema («el sistema y sus procesos») corresponde a la 4.4 en las tres                                                                                                                                |
| Columna «Alcance»                               | `parcial` significa que el tema existe en las tres pero su contenido de fondo difiere. Confirma que te parece bien en las 9 filas marcadas                                                                         |

`experto-iso` tiene certeza alta de la numeración de ISO 9001:2015 y de ISO/IEC 27001:2022, y algo menos de la de ISO/IEC 42001:2023: conviene que mires en su ejemplar al menos la 4.4, la 6.3 y el capítulo 10.

## Una duda sobre las ediciones

Existe la **Enmienda 1:2024** de ISO 9001:2015 y de ISO/IEC 27001:2022 (cambio climático en 4.1 y 4.2), según `experto-iso` con certeza media-alta. No es una edición nueva, así que no cambia la numeración. Decide si el campo `edicion` del YAML debe reflejarla; por ahora se deja la edición base.

## Tabla de verificación

|   # | Entrada             | Tema (título provisional)          | Cap. | ISO 9001:2015 | ISO/IEC 27001:2022 | ISO/IEC 42001:2023 | Alcance | Verificado |
| --: | ------------------- | ---------------------------------- | ---: | :-----------: | :----------------: | :----------------: | :-----: | :--------: |
|   1 | `ha-4.1`            | Contexto de la organización        |    4 |      4.1      |        4.1         |        4.1         |  comun  |     ☐      |
|   2 | `ha-4.2`            | Partes interesadas                 |    4 |      4.2      |        4.2         |        4.2         |  comun  |     ☐      |
|   3 | `ha-4.3`            | Alcance del sistema                |    4 |      4.3      |        4.3         |        4.3         |  comun  |     ☐      |
|   4 | `ha-4.4`            | El sistema y sus procesos          |    4 |      4.4      |        4.4         |        4.4         | parcial |     ☐      |
|   5 | `ha-5.1`            | Liderazgo y compromiso             |    5 |      5.1      |        5.1         |        5.1         | parcial |     ☐      |
|   6 | `ha-5.2`            | Política                           |    5 |      5.2      |        5.2         |        5.2         |  comun  |     ☐      |
|   7 | `ha-5.3`            | Roles y responsabilidades          |    5 |      5.3      |        5.3         |        5.3         |  comun  |     ☐      |
|   8 | `ha-6.1`            | Riesgos y oportunidades            |    6 |      6.1      |        6.1         |        6.1         | parcial |     ☐      |
|   9 | `ha-6.2`            | Objetivos y su planificación       |    6 |      6.2      |        6.2         |        6.2         |  comun  |     ☐      |
|  10 | `ha-6.3`            | Planificación de cambios           |    6 |      6.3      |        6.3         |        6.3         | parcial |     ☐      |
|  11 | `ha-7.1`            | Recursos                           |    7 |      7.1      |        7.1         |        7.1         | parcial |     ☐      |
|  12 | `ha-7.2`            | Competencia                        |    7 |      7.2      |        7.2         |        7.2         |  comun  |     ☐      |
|  13 | `ha-7.3`            | Toma de conciencia                 |    7 |      7.3      |        7.3         |        7.3         |  comun  |     ☐      |
|  14 | `ha-7.4`            | Comunicación                       |    7 |      7.4      |        7.4         |        7.4         |  comun  |     ☐      |
|  15 | `ha-7.5`            | Información documentada            |    7 |      7.5      |        7.5         |        7.5         |  comun  |     ☐      |
|  16 | `ha-8.1`            | Planificación y control operativo  |    8 |      8.1      |        8.1         |        8.1         | parcial |     ☐      |
|  17 | `ha-9.1`            | Seguimiento y medición             |    9 |      9.1      |        9.1         |        9.1         | parcial |     ☐      |
|  18 | `ha-9.2`            | Auditoría interna                  |    9 |      9.2      |        9.2         |        9.2         |  comun  |     ☐      |
|  19 | `ha-9.3`            | Revisión por la dirección          |    9 |      9.3      |        9.3         |        9.3         | parcial |     ☐      |
|  20 | `ha-mejora`         | Mejora                             |   10 |     10.3      |        10.1        |        10.1        | parcial |     ☐      |
|  21 | `ha-no-conformidad` | No conformidad y acción correctiva |   10 |     10.2      |        10.2        |        10.2        |  comun  |     ☐      |

## Cuando termines

Avísame con una de estas respuestas:

- **«Todo coincide»** (y la decisión sobre los títulos: A o B). Subo la `version` a `1.0.0`, quito la marca de borrador del YAML y queda lista para cargarse en el catálogo, después de la revisión final de `revisor-cumplimiento`.
- **«No coinciden estas filas: …»**, con los números correctos. Corrijo el YAML y lo vuelvo a validar.

Mientras la librería siga como borrador, **no se carga en ningún catálogo**.

> **Estado (2026-11-08):** sin los ejemplares a la mano, la versión `0.1.0` se cargó solo como ejemplo en la base local de desarrollo (`pnpm libraries:load`), con el aviso en el nombre. Esta lista de comprobación sigue pendiente: al completarla se corrige el archivo, se sube la versión y se vuelve a cargar (las versiones cargadas son inmutables).
