# ADR 003 — Monorepo: Nx + pnpm

- **Estado:** Aprobado (2026-11-04)
- **Fecha:** 2026-11-04
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Varias apps, módulos y paquetes compartidos que deben evolucionar juntos con límites verificables.

## Decisión

Nx como orquestador y verificador de límites; pnpm como gestor de paquetes (eficiente en disco, útil con 36 GB).

## Alternativas consideradas

Turborepo (sin verificación de límites de módulo equivalente).

## Estándar y licencia

- Estándar: —
- Licencia: MIT

## Consecuencias

Nota: la preferencia global del responsable es npm; para el monorepo se adopta pnpm por Nx y por ahorro de disco. Los scripts son Node para funcionar igual en Windows y macOS.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
