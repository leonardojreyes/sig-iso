# ADR 023 — Look and feel: tokens semánticos, tema por empresa y contraste automático

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

El ADR 019 fijó la herramienta (tokens W3C, Tailwind, Storybook) y dejó el detalle al paso 0.5. Cada empresa debe poder usar su color sin romper la accesibilidad.

## Decisión

- Estilo sobrio, densidad media, modo claro y oscuro; Inter Variable e iconos `lucide-react`.
- Tokens semánticos (fondo, texto, primario, estados) sobre una paleta base; las pantallas solo usan los semánticos.
- Tema por empresa derivado de un único color primario; si no cumple WCAG 2.2 AA se ajusta y se avisa.
- Componentes propios sobre Tailwind (inspirados en shadcn/ui, sin Radix por ahora).
- Excepción a la regla 7: el ancho dinámico de barras de progreso usa `style` en línea porque es un dato, no un valor visual.
- La prueba de contraste corre en CI para claro, oscuro y dos empresas de prueba.

## Alternativas consideradas

- Permitir paleta completa por empresa: más libertad, pero imposible garantizar contraste.

## Estándar y licencia

- Estándar: W3C Design Tokens, WCAG 2.2 AA
- Licencias: MIT / Apache 2.0 / MPL 2.0 / OFL (Inter) / ISC (`lucide-react`, permisiva equivalente a MIT)

## Consecuencias

Una empresa no elige libremente más que su primario. Los colores de estado son fijos para todas.
