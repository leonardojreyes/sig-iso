# sig-iso — Sistema de Gestión Integrado ISO (SynapTech)

Plataforma multiempresa para el ciclo de certificación ISO 9001, 27001:2022 y 42001:2023 (extensible a otras normas como datos). Uso interno de SynapTech primero; luego producto para empresas del Ecuador.

**Al iniciar una sesión: lee `docs/fase0/estado.md`.** Responde siempre en español. Commits en inglés, Conventional Commits.

## Mapa

| Ruta | Contenido |
| --- | --- |
| `apps/api` · `apps/web` · `apps/worker` | NestJS (3001) · Next.js (3000) · tareas |
| `modules/<modulo>/src/{domain,application,infrastructure,interface}` | Monolito modular, hexagonal |
| `platform/` · `packages/` | Transversal (tenancy, auth, ia-gateway, auditoría) · compartido (contracts, ui, tokens, prompts) |
| `libraries/normas/` | Librerías de normas en YAML, **sin texto de las normas** |
| `docs/` | `fase0/` (estado, base técnica) · `adr/` · `specs/` · `producto/` · `security/` · `design/` |

Base técnica completa: `docs/fase0/base-tecnica.md`. Visión y dominio: `docs/producto/`. Decisiones: `docs/adr/README.md` (lee los ADR relevantes antes de proponer cambios). Prompt de la Fase 0: `FASE0.md`.

## Comandos

```
pnpm dev         # web http://localhost:3000 · API http://localhost:3001/docs
pnpm lint        # eslint (incluye límites de módulos y de capas)
pnpm typecheck   # tsc --noEmit por proyecto
pnpm test        # vitest por proyecto (vía Nx, sin daemon)
pnpm build
```

Scripts siempre en Node (no bash). Debe funcionar igual en macOS y Windows. Gestor: **pnpm** (ADR 003), aunque tu preferencia global sea npm.

## Reglas no negociables

1. Dominio puro: sin NestJS, BD, `fetch` ni proveedores de IA. Dependencias solo hacia adentro (`interface → application → domain`; `infrastructure → application/domain`).
2. Multiempresa: toda entidad de negocio lleva `empresa_id`; RLS en PostgreSQL; cada módulo trae una prueba que intenta leer datos de otra empresa y **debe fallar**.
3. **Nunca incluir texto de normas ISO.** Solo id de cláusula/control, título breve y guía propia.
4. Trazabilidad (P15): toda creación, cambio, aprobación y eliminación va a la bitácora inmutable.
5. La IA entra solo por `AsistentePort`; todo lo generado se marca "borrador generado por IA".
6. Contrato primero (OpenAPI 3.1). Español de Ecuador en interfaz, textos externalizados.
7. Ningún valor visual a mano: solo tokens del sistema de diseño.
8. Licencias: MIT/Apache/BSD/MPL. AGPL, BSL, SSPL solo con ADR de excepción.
9. Secretos: nunca en el código; `.env` fuera de git, plantilla `.env.example`.
10. Decisiones nuevas → ADR en `docs/adr/` (comando `/adr`).

## Estilo de código

- `async/await`, nunca `.then()`; funciones flecha en callbacks.
- Con `tsx`/esbuild no hay metadata de tipos: en NestJS usa `@Inject(TOKEN)` explícito y `@ApiProperty({ type: ... })` con tipo.
- Pruebas con Vitest junto al código (`*.test.ts`). TDD en `/implement`. Cobertura mínima 80 % en dominio.

## Flujo por funcionalidad

`/spec` → `/plan` (modo plan) → `/tasks` → `/implement` (una tarea por sesión, TDD) → `/review` (subagentes en paralelo) → PR con controles en verde y aprobación humana. Subagentes en `.claude/agents/`, comandos en `.claude/commands/`.

## Restricciones del entorno

Mac M1 de 8 GB, **sin Docker** (ADR 022): PostgreSQL 16 nativo. Informa el tamaño antes de descargar imágenes o modelos grandes. No ejecutes comandos destructivos ni `git push` a `main` sin aprobación explícita. Ahorra tokens: pasa rutas, no archivos completos.
