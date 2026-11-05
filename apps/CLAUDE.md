# apps/ — reglas

- `api`: solo composición (módulos, OpenAPI, configuración). Sin lógica de negocio.
- `web`: Next.js. Sin valores visuales a mano; tokens y componentes de `packages/ui` (desde el paso 0.5). Textos externalizados (es-EC). WCAG 2.2 AA.
- `worker`: tareas sobre Valkey; usa los mismos casos de uso de los módulos.
- Las apps dependen de módulos solo por su `index.ts` (`@sig/<modulo>`), nunca por rutas relativas.
