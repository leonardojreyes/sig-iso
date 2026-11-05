# ADR 026 — Librería de normas global, adopción por empresa y esquema v2

- **Estado:** Propuesto (pendiente de aprobación del responsable)
- **Fecha:** 2026-11-05
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

El ADR 020 fijó el formato de las librerías de normas (YAML con esquema JSON, **sin texto de las normas**) y previó librerías globales de solo lectura y propias por empresa. El corte vertical 0.6 las lleva a la práctica con una librería de ejemplo de la Estructura Armonizada.

Tres hechos obligan a ajustar el diseño:

1. Las empresas no deben poder escribir en un catálogo que ven todas: un error o un abuso afectaría a todos los clientes.
2. Una misma cláusula **no tiene el mismo identificador ni el mismo contenido en todas las normas** (capítulo 10, subapartados, capítulo 8). El esquema v1 modela una norma por archivo y no puede expresarlo; `experto-iso` lo señaló.
3. La protección contra texto copiado de una norma no se puede garantizar por programa: no tenemos ese texto con que comparar.

## Decisión

### 1. Catálogo global de solo lectura y adopción por empresa

- El **catálogo** (librerías, entradas y su correspondencia con normas) es **global y de solo lectura** para las empresas. Se carga con `pnpm libraries:load`, que usa un rol propio (`sigiso_catalogo`) y **nunca** se carga desde la API ni desde la interfaz.
- Una empresa **adopta** una librería del catálogo (`empresa_libreria`). No hay «desadopción» en este corte.
- Los metadatos de una librería son visibles para todas las empresas; sus **entradas solo las ve quien la adoptó**. Lo impone la base de datos (políticas RLS), no solo la aplicación. Ya está implementado en la migración 0002.

### 2. Identidad e inmutabilidad del catálogo

- Una librería se identifica por `codigo` y `version` (semver). Cada versión es **inmutable**: se calcula una huella SHA-256 de su contenido canónico.
- Cargar de nuevo la misma versión con la misma huella no cambia nada («ya cargada»). La misma versión con **otra** huella se **rechaza**. Un cambio de contenido exige una versión nueva.
- La carga es **todo o nada** (una transacción) y deja un hecho de plataforma en la bitácora (`catalogo.cargado`), aceptado o rechazado, con el identificador de cada entrada y el código del motivo, **nunca el contenido** rechazado.

### 3. Esquema de librería v2

Reemplaza al v1. No hay librerías en formato v1 en el repositorio, así que no hay migración de datos. Campos:

| Nivel    | Campo                | Regla                                                                                  |
| -------- | -------------------- | -------------------------------------------------------------------------------------- |
| Librería | `esquema`            | Obligatorio, valor `2`                                                                 |
| Librería | `codigo`             | Minúsculas, dígitos y guiones, hasta 64 caracteres                                     |
| Librería | `nombre`             | Hasta 120 caracteres                                                                   |
| Librería | `version`            | semver `x.y.z`                                                                         |
| Librería | `es_ejemplo`         | Booleano obligatorio                                                                   |
| Librería | `fuente`             | Obligatorio, hasta 200 caracteres (por ejemplo, «elaboración propia SynapTech»)        |
| Librería | `referencias`        | Lista de `{norma, edicion}` a las que hace referencia                                  |
| Entrada  | `id`                 | Identificador estable propio de la librería (no depende de la numeración de una norma) |
| Entrada  | `capitulo` y `nivel` | Capítulo 4 a 10; nivel 1 o 2                                                           |
| Entrada  | `titulo`             | Título breve y propio, hasta 80 caracteres                                             |
| Entrada  | `guia`               | Guía propia, hasta **280 caracteres y 2 frases**                                       |
| Entrada  | `alcance_comun`      | `comun`, `parcial` o `especifico`                                                      |
| Entrada  | `aplica_a`           | Al menos un `{norma, edicion, clausula}`: el identificador de cláusula **por norma**   |

Se usa `aplica_a` por norma (una sola entrada con el identificador que cada norma le da) en lugar de duplicar la entrada por edición con un identificador armonizado. Es más simple de cargar y mantiene a la vista la diferencia entre normas; la correspondencia fina entre controles y requisitos se resuelve en el módulo de controles, no aquí.

En el catálogo la unidad es la **entrada** (un apartado). El término «requisito» del glosario sigue designando la condición evaluable; una cláusula real puede descomponerse en varios requisitos en un módulo posterior.

### 4. Control de derechos de autor

Capas, de la más débil a la más fuerte:

1. **Esquema y reglas de contenido** (título, guía, frases, patrones estructurales y no frases de normas): se comprueban en `pnpm libraries:validate` y en el CI, y de nuevo al cargar el catálogo.
2. **Límites en la base de datos** (`CHECK`): título de hasta 80 caracteres, guía de hasta 280 y capítulo entre 4 y 10.
3. **Revisión humana obligatoria** de `revisor-cumplimiento` antes de publicar una librería en el catálogo.

**Límite honesto:** las dos primeras capas no pueden garantizar que no haya texto copiado; solo acotan el riesgo. La garantía real es la tercera.

### 5. Presentación

Una librería con `es_ejemplo: true` se muestra siempre rotulada como **librería de ejemplo con guías propias de SynapTech, no la norma**, y remite al ejemplar que la empresa adquirió como referencia oficial.

### 6. Numeraciones

Las numeraciones de cláusula de cada norma **deben verificarse contra los ejemplares vigentes** antes de fijar una librería (pregunta Q7 del spec). El capítulo 10 se modela por tema («Mejora» y «No conformidad y acción correctiva»), cada uno con el identificador que le da cada norma, porque el orden de 10.1 a 10.3 difiere entre ellas.

## Alternativas consideradas

- **Copia de la librería por empresa:** duplica datos y provoca deriva entre copias; descartada para el catálogo global (queda para librerías propias de cada empresa, con su propio ADR).
- **Catálogo editable desde la API o la interfaz:** permitiría a un cliente envenenar el catálogo de todos los demás, incluso con texto de normas; descartada.
- **Una entrada por norma y edición con un identificador armonizado compartido:** es la opción que propuso `experto-iso`; se descartó por más compleja de cargar sin aportar a este corte.
- **Importar librerías de terceros:** requiere revisar licencia y un ADR; CISO Assistant es AGPLv3, solo inspiración (ADR 020).

## Estándar y licencia

- Estándar: JSON Schema 2020-12 (esquema); YAML 1.2 (archivos)
- Licencia: propia (contenido de SynapTech). Herramientas: `ajv` (MIT) y `yaml` (ISC)

## Consecuencias

- Hay que reescribir `packages/normas-schema` a v2, con fixtures sintéticos (tarea 4.2), y extraer las reglas de contenido como funciones puras reutilizables por el dominio y por los scripts (tarea 4.3).
- `libraries:load` (tarea 4.5) valida, rechaza una versión con otra huella, carga todo o nada y registra el hecho de plataforma.
- La librería de ejemplo se redacta con `experto-iso` y requiere la **verificación de numeraciones por el responsable** y la revisión de `revisor-cumplimiento` antes de publicarse (tarea 4.4).
- Las librerías propias por empresa quedan fuera de este corte y exigirán su propio ADR (con `empresa_id`).
- Esta decisión se revisa si cambia la forma de entregar librerías (por ejemplo, un servicio externo de catálogo).

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
