# Guía de estilo — sig-iso

Paso 0.5 de la Fase 0. Decisiones en [ADR 019](../adr/019-sistema-de-diseno.md) y [ADR 023](../adr/023-look-and-feel.md).

## Principios

- Sobrio y profesional; densidad media; modo claro y oscuro.
- Ningún valor visual a mano: solo tokens (`packages/tokens`).
- Español de Ecuador; textos externalizados en `apps/web/src/i18n/es-EC.ts` y `packages/ui/src/i18n.ts`.
- El estado nunca se comunica solo con color: siempre va con texto o icono.

## Color

- Primario inicial: verde esmeralda SynapTech `#0E5C42` (`brand.700`).
- Semánticos: éxito, advertencia, peligro, información y neutro, cada uno con variante suave.
- Fondo, superficie, borde y texto salen de la escala neutra (slate).
- Por empresa: se deriva un tema desde un color primario (`derivarTema`). Si no cumple contraste, se ajusta y se avisa.

## Contraste (WCAG 2.2 AA)

- Texto normal: 4.5:1. Bordes de controles y anillo de foco: 3:1.
- Verificado por `packages/tokens/src/tokens.test.ts` en claro y oscuro, y para dos empresas (A verde, B azul).

## Tipografía e iconos

- Sans: Inter Variable, con respaldo del sistema. Mono: pila del sistema.
- Iconos: `lucide-react`.

## Componentes

- Base (`packages/ui/src/base`): formularios y presentación.
- Dominio (`packages/ui/src/dominio`): semáforo de cumplimiento, barra de madurez por cláusula, matriz de riesgos, línea de tiempo de certificación.
- Catálogo vivo: Storybook (`pnpm --filter @sig/storybook dev`, puerto 6006).

## Pantallas plantilla

Ingreso, panel, listado con filtros, formulario y detalle, en `apps/web/src/pantallas`. Rutas: `/e/<empresa>/…`.

## Tematización por empresa

Cada bloque CSS queda acotado por `[data-empresa="<id>"]`. En 0.6 la marca viene de la base de datos.
