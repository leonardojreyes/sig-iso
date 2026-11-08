---
name: modulo-hexagonal
description: Crea un módulo nuevo en modules/<modulo> con las cuatro capas hexagonales (domain, application, infrastructure, interface), su CLAUDE.md, la prueba de aislamiento entre empresas y, si hace falta, instrumentación OpenTelemetry. Úsalo al empezar una funcionalidad de negocio que no cabe en un módulo existente (ADR 001, ADR 024).
---

# Skill: módulo hexagonal

## Cuándo usarlo

- Una funcionalidad de negocio nueva (por ejemplo `evaluacion`, `auditoria-interna`) que no pertenece a `modules/empresas` ni a `modules/normas`.
- **No** lo uses para código transversal (autenticación, base de datos, bitácora, autorización): eso va en `platform/*`.
- Antes de empezar: `/spec` y `/plan` de la funcionalidad, y el ADR si hay una decisión nueva (`/adr`).

## Estructura real (plantilla de referencia: `modules/empresas`, el más corto; `modules/normas`, el más completo)

```
modules/<modulo>/
  package.json          name @sig/<modulo>, "main"/"types": src/index.ts, nx.tags ["type:module"], scripts test/typecheck/build/test:cov
  tsconfig.json         { "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
  vitest.config.ts      env de pruebas (`cargarUrlsDePrueba`), globalSetup, cobertura 80 % en domain y application
  CLAUDE.md             reglas del módulo (capas, qué expone, qué permisos usa)
  test/migrar-global.ts deja migrada `sigiso_test` antes de las pruebas de integración
  src/
    domain/             entidades, objetos de valor, errores. Sin frameworks, sin BD, sin node:*  (lo verifica pnpm lint)
    application/        casos de uso + puertos (*.port.ts con token Symbol). Sin NestJS, sin kysely, sin node:*
    infrastructure/     adaptadores (Kysely sobre PostgreSQL). Todo acceso a datos pasa por conTenant
    interface/          (solo si el módulo expone algo propio; los controladores HTTP viven hoy en apps/api, que solo compone)
    index.ts            ÚNICA API pública del módulo
```

## Pasos

1. **Copiar el esqueleto** de `modules/empresas` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `test/migrar-global.ts`), cambiar el nombre a `@sig/<modulo>` y dejar solo las dependencias que uses (`@sig/db`, `@sig/tenancy`, `@sig/autorizacion`, `kysely`). `modules/*` ya está en `pnpm-workspace.yaml`; ejecuta `pnpm install`.
2. **Escribir `CLAUDE.md` del módulo** (≤ 20 líneas): propósito, entidades, puertos, permisos de `@sig/autorizacion` que necesita y qué hechos registra en la bitácora.
3. **TDD, de adentro hacia afuera:**
   - `domain`: prueba y entidad o regla. Los identificadores de empresa son `EmpresaId` de `@sig/tenancy`; toda entidad de negocio lleva `empresaId` (regla 2).
   - `application`: un puerto por dependencia externa (`*.port.ts` con `export const X_REPOSITORY = Symbol('X_REPOSITORY')`), el caso de uso y su prueba con fakes (ver `modules/normas/src/application/prueba/fakes.ts`). El permiso se decide **antes** de mirar el recurso, y el caso de uso que cambia datos registra la bitácora **en la misma unidad de trabajo** (`UnidadDeTrabajoPort`, ADR 024).
   - `infrastructure`: adaptador Kysely que recibe el `Kysely` del pool del rol `sigiso_app` (nunca el dueño) y **siempre** usa `conTenant(db, empresaId, ...)` de `@sig/db`.
4. **Prueba de aislamiento entre empresas (obligatoria)**, en `src/infrastructure/<x>-kysely.integration.test.ts`, con PostgreSQL real, dos empresas A y B y `describe.skipIf(!hayBase)`. Copia el patrón de `modules/empresas/src/infrastructure/empresa-kysely.integration.test.ts`. Debe demostrar que leer por identificador, listar y consultar sin empresa **fallan o devuelven un 404 indistinguible** para la otra empresa. Si el módulo trae tablas nuevas, la migración y su política van con la skill `migracion-rls`.
5. **`src/index.ts`**: exporta solo lo que usan las apps (casos de uso, puertos, tokens, adaptadores, errores). Nadie importa por rutas internas, ni un módulo de otro módulo salvo por `@sig/<modulo>`.
6. **Componer en `apps/api`**: agrega `"@sig/<modulo>": "workspace:*"` a `apps/api/package.json`, crea el módulo Nest en `apps/api/src/<area>/` con `@Inject(TOKEN)` explícito (con tsx no hay metadatos de tipos) y regístralo en `app.module.ts` y `composicion.ts`. El endpoint se agrega con la skill `endpoint-contrato`.
7. **OpenTelemetry (ADR 010, ADR 025):** el span por solicitud (método, patrón de ruta, estado y `empresa_id`) lo crea el middleware de la API (`apps/api/src/telemetria`); **el módulo no importa OpenTelemetry**. Si un caso de uso necesita un span propio, se hace en un adaptador de `infrastructure` con `@opentelemetry/api`, con el atributo `empresa_id` y **nunca** datos personales ni valores de entrada.
8. **Cierre:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:cov`, luego `/review` (arquitecto, revisor-multiempresa, revisor-seguridad; revisor-cumplimiento si hay datos personales). Actualiza `docs/fase0/estado.md`.

## Ejemplo mínimo (módulo `hallazgos`, ilustrativo)

```ts
// domain/hallazgo.ts — sin imports de otras capas ni de frameworks
import type { EmpresaId } from '@sig/tenancy';
export class Hallazgo {
  private constructor(readonly id: string, readonly empresaId: EmpresaId, readonly titulo: string) {}
  static crear(d: { id: string; empresaId: EmpresaId; titulo: string }): Hallazgo {
    if (d.titulo.trim().length < 3 || d.titulo.length > 120) throw new ErrorHallazgo('titulo');
    return new Hallazgo(d.id, d.empresaId, d.titulo.trim());
  }
}

// application/hallazgo-repository.port.ts
export const HALLAZGO_REPOSITORY = Symbol('HALLAZGO_REPOSITORY');
export interface HallazgoRepositoryPort {
  obtener(empresaId: EmpresaId, id: string): Promise<Hallazgo | null>; // null = no existe O es de otra empresa
}

// infrastructure/hallazgo-kysely.adapter.ts — siempre conTenant
export class HallazgoKysely implements HallazgoRepositoryPort {
  constructor(private readonly db: Kysely<unknown>) {}
  obtener(empresaId: EmpresaId, id: string) {
    return conTenant(this.db as Kysely<Bd>, empresaId, async (trx) => /* select ... where id = ${id} */);
  }
}
```

## Terminado cuando

- `pnpm lint` no marca imports prohibidos entre capas, y `pnpm test` incluye dominio, caso de uso y aislamiento.
- Cobertura ≥ 80 % en `domain` y `application`.
- El módulo tiene `CLAUDE.md`, `index.ts` como única API y está compuesto en `apps/api`.
