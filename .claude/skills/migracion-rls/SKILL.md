---
name: migracion-rls
description: Escribe una migración de PostgreSQL en platform/db/migrations con su política de seguridad por fila (RLS) por empresa, los permisos mínimos por rol y la prueba que demuestra que una empresa no ve ni toca datos de otra. Úsalo siempre que agregues o cambies una tabla de negocio (regla 2, ADR 024).
---

# Skill: migración con RLS por empresa

## Cuándo usarlo

- Una tabla nueva de negocio (lleva `empresa_id`), o un cambio de columnas, permisos o políticas de una existente.
- **No** edites una migración ya aplicada: se crea siempre una nueva (`0006_…`, `0007_…`).

## Reglas del proyecto (ADR 024)

- Archivo `platform/db/migrations/NNNN_nombre_en_minusculas.sql` (cuatro dígitos; el ejecutor rechaza otro formato y aplica cada archivo una sola vez, en orden).
- Roles: `sigiso_owner` (solo migraciones, dueño del esquema), `sigiso_app` (la API; sin superusuario ni BYPASSRLS, no dueño), `sigiso_catalogo` (carga del catálogo), `sigiso_plataforma` (hechos sin empresa).
- RLS **siempre** con `enable` + `force`; las políticas usan `(select app_tenant_id())`, que **falla** si no hay empresa en el contexto (nunca devuelve datos de todas).
- Toda consulta pasa por `conTenant(db, empresaId, fn)` de `@sig/db` (`set_config('app.tenant_id', $1, true)` solo dentro de la transacción).
- Mínimo privilegio: da a `sigiso_app` solo lo que usa, **por columnas** cuando una columna no debe poder fijarla la aplicación (ejemplo: `usuario.rol`, migración 0005).
- Nada de texto de normas ni datos personales de más: columnas mínimas, con `check` de formato y longitud.

## Pasos

1. **Crear `platform/db/migrations/NNNN_nombre.sql`** (siguiente número libre). Plantilla:

```sql
-- NNNN — <qué cambia y por qué> (ADR 024).
create table hallazgo (
  id         uuid primary key,
  empresa_id uuid not null references empresa (id),
  titulo     text not null check (char_length(titulo) between 3 and 120),
  creada_en  timestamptz not null default now()
);
create index hallazgo_empresa_idx on hallazgo (empresa_id);

alter table hallazgo enable row level security;
alter table hallazgo force row level security;

create policy hallazgo_propios on hallazgo
  for all to sigiso_app
  using (empresa_id = (select app_tenant_id()))
  with check (empresa_id = (select app_tenant_id()));

-- El dueño solo mantiene datos DENTRO del contexto de una empresa (siembra, mantenimiento).
create policy hallazgo_mantenimiento on hallazgo
  for all to sigiso_owner
  using (empresa_id = (select app_tenant_id()))
  with check (empresa_id = (select app_tenant_id()));

grant select, insert on hallazgo to sigiso_app;           -- solo lo necesario
grant update (titulo) on hallazgo to sigiso_app;           -- por columnas, no la tabla entera
```

2. **Si la tabla es de hechos inmutables** (como `bitacora`): sin `update`, `delete` ni vaciado para la aplicación y con triggers que lo impidan; sigue el patrón de `0003_bitacora.sql` y `0004_bitacora_cadena.sql`.
3. **Prueba de aislamiento (primero, en rojo):** en el módulo dueño de la tabla, `src/infrastructure/<x>-kysely.integration.test.ts` con dos empresas, o en `platform/db/src/*.integration.test.ts` si es transversal. Patrón: `platform/db/src/aislamiento.integration.test.ts`. Comprueba con el rol `sigiso_app`: A no lee, no lista, no actualiza ni borra lo de B; sin empresa falla; con un `tenant_id` inválido falla.
4. **Actualizar `platform/db/src/privilegios.integration.test.ts`:** la matriz `ESPERADO` (privilegios de tabla por rol), las columnas con `INSERT` y `UPDATE` permitidos y la lista de tablas con RLS `enable` + `force`. Esa prueba existe para que **nadie amplíe permisos sin querer**.
5. **Aplicar:** `pnpm db:migrate` (base `sigiso`); las pruebas migran `sigiso_test` solas (`globalSetup`). Usa empresas con UUID aleatorio y borra lo que creaste en `afterAll` para no chocar con otras pruebas.
6. **Datos de prueba:** si el esquema nuevo cambia la siembra, actualiza `scripts/lib/siembra.ts` (idempotente, sin pisar lo cambiado a mano) y su prueba de integración.
7. **Cierre:** `pnpm lint && pnpm typecheck && pnpm test` (con base) y `SIGISO_SIN_BASE=1 PGPORT=1 pnpm test` (simula el CI sin base: las integraciones se omiten). `/review` con `revisor-multiempresa` y `revisor-seguridad`. Registra el cambio en `docs/specs/<funcionalidad>/tasks.md` y `docs/fase0/estado.md`.

## Terminado cuando

- La migración se aplica en una base nueva y en `sigiso_test`.
- La prueba de aislamiento falla sin las políticas y pasa con ellas (comprueba una mutación: quita `force row level security` y debe fallar).
- `privilegios.integration.test.ts` refleja exactamente los permisos nuevos.
