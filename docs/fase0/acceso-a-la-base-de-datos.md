# Acceso a la base de datos de desarrollo

PostgreSQL 16 nativo (ADR 022). Las URLs de conexión las escribe `pnpm db:init` en `.env.local` (fuera de git). **No pegues una URL ni su contraseña en el chat, en commits ni en issues.**

## Entrar con `psql`

```
set -a; source .env.local; set +a      # carga las variables en esa terminal, sin imprimirlas
psql "$DATABASE_URL_OWNER"             # dueño: para mirar y mantener
psql "$DATABASE_URL_APP"               # como la API: con la RLS aplicada
```

| Variable | Rol | Para qué |
| --- | --- | --- |
| `DATABASE_URL_OWNER` | `sigiso_owner` | migraciones, siembra, revisar datos |
| `DATABASE_URL_APP` | `sigiso_app` | lo que usa la API; sirve para comprobar el aislamiento |
| `DATABASE_URL_CATALOGO` | `sigiso_catalogo` | cargar el catálogo de librerías |
| `DATABASE_URL_PLATAFORMA` | `sigiso_plataforma` | hechos de plataforma en la bitácora |
| `DATABASE_URL_TEST` | (base `sigiso_test`) | pruebas |

Bases: `sigiso` (desarrollo), `sigiso_test` (pruebas), `openfga`.

## Las tablas con `empresa_id` exigen indicar la empresa

Sin empresa en la sesión, la consulta falla con «app.tenant_id no está definido» (es a propósito, ADR 024). Con la siembra (`pnpm db:seed`):

```sql
select set_config('app.tenant_id', 'a5eed000-0000-4000-8000-00000000000a', false);  -- Empresa A
select id, slug, nombre from empresa;
select correo from usuario;
select secuencia, accion, resultado, creada_en from bitacora order by secuencia desc limit 10;
```

La empresa B es `b5eed000-0000-4000-8000-00000000000b`. Con el rol `app` cada una ve solo lo suyo.

## Comandos útiles

- `\dt` lista tablas; `\d bitacora` describe una; `\q` sale.
- `select * from bitacora_verificar();` revisa la cadena de la bitácora: no debe devolver filas.
- Catálogo de librerías: `select codigo, version, es_ejemplo from libreria;` (los metadatos son públicos).

## Con interfaz gráfica

TablePlus, DBeaver o la extensión de PostgreSQL de VS Code: host `127.0.0.1`, puerto `5432`, base `sigiso`, usuario `sigiso_owner` y la contraseña que va dentro de la URL de `.env.local`.

## Datos de prueba

`pnpm db:seed` crea la Empresa A y la Empresa B, cada una con un administrador SIG y un colaborador (correos `@example.test`). Es idempotente, solo corre contra una base local y registra un hecho de plataforma. Las contraseñas las genera `keycloak-dev` (fase 8) y los roles se aplican en OpenFGA (fase 9).
