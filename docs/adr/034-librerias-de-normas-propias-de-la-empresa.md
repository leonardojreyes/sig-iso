# ADR 034 — Librerías de normas propias de la empresa, subidas desde la interfaz

- **Estado:** Aprobado (2026-11-13), como parte del plan del MVP de certificación (M6a)
- **Fecha:** 2026-11-13
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Hoy una librería de norma se carga con un comando (`pnpm libraries:load`) al catálogo global (ADR 026). Eso no es amigable: cada empresa debe poder subir sus normas desde la web, sin terminal, y luego adoptarlas. El responsable decidió (2026-11-13): se sube el **archivo YAML**; la persona lo elige con el **selector de archivos o carpeta del navegador**; y la librería es **propia de cada empresa**.

## Decisión

1. **Se sube el YAML de la librería** (esquema v3 del ADR 026), no el PDF de la norma. El PDF es texto licenciado y no se lee, no se guarda ni se convierte (regla 3). No existe una conversión automática de PDF a YAML que respete esa regla: la librería solo lleva identificador, título breve, guía propia y mapeos, que escribe una persona (o se redacta como borrador con ayuda y la revisa la empresa). Para ayudar, la pantalla ofrece **descargar una plantilla** de YAML vacía y con comentarios.
2. **Selector del navegador.** La interfaz usa un selector de archivo (y de carpeta, que sube cada `.yaml` que contiene, con tope de cantidad). No se lee ninguna ruta del servidor: el servidor solo recibe bytes.
3. **Librería propia de la empresa.** Tablas nuevas con `empresa_id`, RLS forzada y claves foráneas compuestas; el catálogo global sigue existiendo para las librerías de la plataforma. La empresa ve su catálogo propio más el global y adopta de ambos. Una versión subida es **inmutable** (la aplicación solo inserta); un cambio es una versión nueva.
4. **Validación antes de guardar.** Lista cerrada (YAML por contenido, no por extensión), tamaño máximo (1 MB por archivo), análisis seguro (sin etiquetas ni anclas que expandan), esquema completo y reglas de contenido (rechaza texto de norma). Los errores se muestran en palabras claras, con la ubicación; nada se guarda si hay uno.
5. **Permisos.** Solo el administrador SIG de la empresa (permiso nuevo `normas.cargar`); el colaborador solo ve.
6. **Bitácora.** Cada carga (aceptada o rechazada) registra código, versión, huella SHA-256 y conteos; nunca el contenido ni el texto de los errores.

## Consecuencias

- Una empresa puede cargar una librería sin ayuda técnica; el comando sigue sirviendo para el catálogo global.
- La responsabilidad de que el YAML no contenga texto licenciado es de quien sube; el sistema lo mitiga con las reglas de contenido, pero no puede garantizarlo.
- Hay dos orígenes de librería (global y propia) y las pantallas existentes de adopción deben contemplar ambos.
