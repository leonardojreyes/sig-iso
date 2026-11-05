# ADR 024 — Acceso a datos: Kysely con migraciones SQL; roles y alcance de RLS

- **Estado:** Propuesto (pendiente de aprobación del responsable)
- **Fecha:** 2026-11-05
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

El ADR 006 fijó PostgreSQL con RLS y dejó pendiente la capa de acceso a datos. El paso 0.6 es el primero que usa la base: guarda empresas, adopciones de librerías y la bitácora inmutable. Criterios de elección: soportar `empresa_id` por transacción (RLS), consumo bajo de memoria (equipo de 8 GB), migraciones auditables y tipado.

## Decisión

1. **Kysely** (constructor de consultas tipado, no ORM) con el controlador **`pg`**. Los tipos de las tablas se escriben a mano en cada módulo.
2. **Migraciones en SQL**, numeradas, ejecutadas con el Migrator de Kysely y el rol dueño. Las políticas RLS, los permisos, los triggers y las funciones se escriben en SQL de migración, que es lo que se audita.
3. **Aislamiento por transacción:** `conTenant(empresaId, fn)` abre una transacción y ejecuta `set_config('app.tenant_id', $1, true)` (equivale al `SET LOCAL` del ADR 006; el valor vive solo en esa transacción y nunca en la sesión). La función `app_tenant_id()` **lanza error** si el valor falta, está vacío o no es un UUID. Las tablas con empresa usan `ENABLE` y `FORCE ROW LEVEL SECURITY`. Fuera de `conTenant`, el pool de ejecución falla.
4. **Roles** (creados por `pnpm db:init`, con claves generadas en `.env.local`; ninguno es superusuario ni `BYPASSRLS`):

   | Rol                 | Uso                                                                     |
   | ------------------- | ----------------------------------------------------------------------- |
   | `sigiso_owner`      | Migraciones. Nunca en ejecución                                         |
   | `sigiso_app`        | API en ejecución; no es dueño de las tablas                             |
   | `sigiso_catalogo`   | Carga del catálogo de librerías (solo `INSERT` en sus tablas)           |
   | `sigiso_plataforma` | Hechos sin empresa en la bitácora (solo `INSERT` con `empresa_id` nulo) |
   | `sigiso_openfga`    | Dueño de la base `openfga`; sin acceso a las demás                      |

5. **Bases:** `sigiso`, `sigiso_test` (pruebas de integración) y `openfga`. `PUBLIC` no puede conectarse a ellas.
6. **Variables:** una URL por rol (`DATABASE_URL_OWNER`, `_APP`, `_CATALOGO`, `_PLATAFORMA`, `_TEST`). `DATABASE_URL` se conserva solo para Docker Compose.

### Alcance de la garantía de RLS

RLS protege contra la **omisión del contexto de empresa** (una consulta sin empresa falla, no devuelve todo) y contra errores de la aplicación que olviden filtrar. **No** protege contra SQL arbitrario ejecutado por el propio rol de la aplicación, que podría cambiar `app.tenant_id` dentro de su transacción. Por eso:

- todas las consultas son parametrizadas y no se arma SQL con datos de usuario;
- el rol de ejecución no puede alterar tablas, políticas ni desactivar RLS (lo verifica una prueba);
- el aislamiento se prueba contra PostgreSQL real con dos empresas, no con dobles.

## Alternativas consideradas

- **Prisma:** motor binario y mayor consumo de memoria; soporte de RLS indirecto. Descartado por el límite de 8 GB.
- **Drizzle:** esquema en TypeScript y migraciones generadas; buena opción. Descartado porque la RLS, los permisos y la bitácora igual se escriben en SQL, y se prefiere un solo camino de migraciones SQL, explícito y auditable.

## Estándar y licencia

- Estándar: SQL
- Licencias: Kysely MIT (0.29.8, verificada en npm), `pg` MIT (verificada en el paquete instalado), PostgreSQL License

## Consecuencias

- Hay que escribir más SQL y mantener los tipos a mano; el riesgo de desfase se cubre con las pruebas de integración contra la base real.
- Sin relaciones automáticas ni generación de cliente: más control y menos memoria.
- En esta etapa las migraciones solo avanzan (sin deshacer); se revisa al acercarse a producción.
- Amplía el ADR 022: de «una base y un rol `sigiso`» a cinco roles y tres bases.
- Cada módulo con datos trae su prueba de aislamiento entre empresas.

## Criterio de tecnología mayoritaria (P12)

Se prioriza tecnología con soporte largo y talento disponible; las excepciones se justifican arriba.
