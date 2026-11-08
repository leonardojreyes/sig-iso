---
name: libreria-normas
description: Crea o actualiza una librería de norma en libraries/normas/*.yaml, válida contra el esquema v2 y contra las reglas de contenido, SIN texto de la norma (solo identificador, título breve, guía propia y mapeos). Úsalo al agregar una librería, una versión nueva o entradas a una existente (regla 3, ADR 026).
---

# Skill: librería de normas (YAML)

## Cuándo usarlo

- Nueva librería (una norma, un marco, una estructura armonizada de ejemplo) o nueva versión de una existente.
- **Regla 3: nunca texto de las normas.** Solo id de cláusula o control, título breve **propio**, guía **redactada por SynapTech** y mapeos entre normas.
- Una librería de terceros solo entra tras verificar su licencia y registrar un ADR (regla 8, `/adr`).

## Formato real (esquema v2: `packages/normas-schema/libreria-norma.schema.json`)

Campos de la librería: `esquema: 2`, `codigo` (`^[a-z0-9-]{1,64}$`), `nombre`, `version` (`x.y.z`), `es_ejemplo`, `fuente` (obligatoria: de dónde sale la **guía**, p. ej. «elaboración propia SynapTech»), `referencias[{norma, edicion}]`, `entradas[]`.

Campos de cada entrada: `id` (estable y propio, `^[a-z0-9][a-z0-9.-]{0,40}$`, **no** depende de la numeración de una norma), `capitulo` (4 a 10), `nivel` (1 o 2), `titulo`, `guia`, `alcance_comun` (`comun`, `parcial` o `especifico`) y `aplica_a[{norma, edicion, clausula}]` (no vacío).

Reglas de contenido (`packages/normas-schema/src/contenido.ts`; las aplican `pnpm libraries:validate`, el CI y la carga): título de 2 a 80 caracteres; guía de 10 a **280 caracteres y máximo 2 frases**, ninguna frase de más de 200 caracteres; sin citas largas entre comillas; a lo sumo una obligación («debe», «deberá»…); sin enumeraciones con punto y coma. Son heurísticas: **no pueden comparar contra la norma**, la garantía real es la revisión humana.

## Pasos

1. **Redacta con tus palabras** la guía de cada entrada: qué pregunta ayuda a responder y qué evidencia suele haber, en tono de acompañamiento y no de requisito. Si dudas de si una frase se parece a la norma, reescríbela más lejos.
2. **Numeraciones:** los números de cláusula salen de los ejemplares vigentes que tiene el responsable. Marca las no verificadas en el encabezado del archivo y en `docs/specs/<funcionalidad>/verificacion-numeraciones.md` (patrón de `libraries/normas/ejemplo-estructura-armonizada.yaml`). Nunca copies una numeración de memoria como si estuviera comprobada.
3. **Una versión publicada es inmutable:** el catálogo rechaza la misma `codigo` + `version` con otro contenido (hash distinto). Un cambio de contenido = versión nueva.
4. **Valida:** `pnpm libraries:validate` (esquema, reglas entre campos y control de texto). Falla con código 1 y solo imprime códigos y rutas, no el contenido.
5. **Pruebas:** si el cambio altera una librería con prueba propia, actualiza `packages/normas-schema/src/libreria-ejemplo.test.ts` y `modules/normas/test/libreria-ejemplo.test.ts`. Las fixtures de prueba son **sintéticas**, nunca texto real de una norma.
6. **Revisión:** invoca `revisor-cumplimiento` (texto copiado, trazabilidad) y, si es de dominio ISO, `experto-iso` (Estructura Armonizada y mapeos). El responsable verifica numeraciones y títulos.
7. **Carga al catálogo** (cuando exista `pnpm libraries:load`, tarea 4.5): corre con el rol `sigiso_catalogo`, valida de nuevo, registra `catalogo.cargado` como hecho de plataforma y **no** es una operación de la API.

## Ejemplo (sintético, no es ninguna norma)

```yaml
esquema: 2
codigo: ejemplo-demostracion
nombre: Librería de demostración
version: 0.1.0
es_ejemplo: true
fuente: elaboración propia SynapTech
referencias:
  - { norma: Norma de ejemplo A, edicion: "2024" }
entradas:
  - id: gobierno-del-sistema
    capitulo: 5
    nivel: 1
    titulo: Gobierno del sistema
    guia: Describa quién decide, con qué información y cómo se revisa lo decidido. Conserve una evidencia fechada de cada revisión.
    alcance_comun: comun
    aplica_a:
      - { norma: Norma de ejemplo A, edicion: "2024", clausula: "X.1" }
```

## Terminado cuando

- `pnpm libraries:validate` y `pnpm test` en verde.
- `revisor-cumplimiento` sin hallazgos bloqueantes y las numeraciones marcadas como verificadas o como pendientes.
- Ningún fragmento del archivo reproduce texto de una norma.
