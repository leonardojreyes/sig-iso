# Revisión de calidad — Fase 0 (pasos 0.1 a 0.6 en curso)

**Fecha:** 2026-11-08 · **Revisor:** Claude (revisión externa, independiente de las sesiones de Claude Code) · **Alcance:** repositorio en la rama `feature/paso-0-6-adopcion` (commit `8e8e1c9`)

## Cómo se revisó

- Lectura de `CLAUDE.md`, `docs/fase0/estado.md`, ADRs (índice), modelo de dominio, capa `.claude/` (settings, hooks, subagentes, comandos, skills), migraciones 0001–0005, `conTenant`, guardia de la API, sesión web, workflows de CI y configuración de ESLint.
- Verificación de tipos (`tsc --noEmit`) en 9 proyectos: `modules/normas`, `modules/empresas`, `platform/{db,auditoria,tenancy,autenticacion,autorizacion}`, `packages/{normas-schema,contracts}` → **todos sin errores**.
- **No verificado:** no se ejecutaron las pruebas (el entorno de revisión no tenía pnpm ni acceso al registro de npm); se toma como evidencia lo registrado en `estado.md` y el CI. No se revisó la interfaz web visualmente ni se leyó todo el código línea por línea.

## Veredicto general

**Calidad alta, por encima de lo habitual en una Fase 0.** La arquitectura hexagonal se cumple y se hace cumplir con lint; el aislamiento multiempresa está resuelto en la base de datos con defensa en profundidad; la bitácora es realmente inmutable y encadenada; hay 101 archivos de prueba (incluidas pruebas de aislamiento e integración en CI con PostgreSQL); el pipeline de seguridad bloquea secretos y licencias no permitidas; los ADRs están al día (29). Los hallazgos de abajo no invalidan el trabajo: dos son importantes para el futuro del producto y el resto son ajustes.

| Área | Puntaje (1–5) | Comentario |
| --- | --- | --- |
| Arquitectura y límites | 5 | Capas y dependencias forzadas con `@nx/enforce-module-boundaries` y `no-restricted-imports`. |
| Multiempresa y base de datos | 4,5 | RLS con `FORCE`, `app_tenant_id()` que falla sin empresa, roles mínimos, `set_config(..., true)` por transacción. Un detalle de FK (M2). |
| Seguridad de la aplicación | 4,5 | Guardia cerrada por omisión, OIDC + PKCE, cookie `HttpOnly`/`SameSite`, 404 indistinguible entre empresas, límite de frecuencia. |
| Trazabilidad (bitácora) | 5 | Solo-inserción por permisos y disparadores, columnas que el actor no puede fijar, cadena de huellas y anclas. |
| Pruebas | 4,5 | Amplias y bien orientadas (aislamiento, privilegios, contrato). No ejecutadas en esta revisión. |
| CI/CD y cadena de suministro | 4 | gitleaks, Semgrep, OSV, Trivy, SBOM, licencias, matriz macOS/Windows. Acciones sin fijar por SHA. |
| Capa de Claude Code | 4 | Completa (8 subagentes, 4 skills, 8 comandos, 4 hooks), concisa. Permisos con huecos (M1). |
| Modelo de dominio ISO | 3,5 | Correcto en lo esencial; faltan entidades que la certificación real necesita (A2, M3, M4). |
| Documentación | 4,5 | ADRs, specs y estado detallados; algunos ADRs reemplazados sin marcar (B3). |
| Gobierno del repositorio | 2,5 | Repositorio público para un producto comercial de seguridad (A1). |

## Hallazgos

### Alta

**A1. El repositorio de GitHub es público.**
Expone todo el código y la arquitectura de seguridad de un producto que se venderá y que gestiona ISO 27001, además del correo del autor en los commits. Un certificador o un cliente corporativo lo cuestionará (control de acceso al código fuente). *Corrección:* pasar a privado; para mantener la protección de ramas, usar GitHub Team u otra alternativa. Registrar la decisión en un ADR.

**A2. El esquema de librerías está limitado a la Estructura Armonizada.**
`libreria_entrada` exige `capitulo between 4 and 10` y `nivel in (1, 2)` (migración 0002) y el esquema JSON `packages/normas-schema/libreria-norma.schema.json` tiene la misma restricción (`minimum: 4`, `maximum: 10`, `nivel: [1, 2]`). Así no se pueden cargar los controles del **Anexo A de ISO/IEC 27001** (A.5–A.8, 93 controles) ni del **Anexo A de ISO/IEC 42001** (A.2–A.10), que son la base de la Declaración de Aplicabilidad y la mayor parte del valor del producto. Contradice el principio P14 (normas como datos). *Corrección:* antes de crecer el catálogo, generalizar el esquema (tipo de entrada `clausula | control | objetivo`, sección/tema libre, jerarquía de profundidad variable con `padre_id`, atributos propios de cada norma como temas de 27001:2022) con una migración y un ADR; agregar una librería de prueba con controles de Anexo A.

### Media

**M1. Los permisos de Claude Code dejan pasar la lectura de secretos y SQL destructivo.**
- `Bash(cat:*)` está permitido y el hook solo bloquea `.env` seguido de espacio o fin: `cat .env.local`, `head .env.local` o `grep . .env.local` pasan (y `.env.local` tiene las claves de la base local).
- `Bash(node:*)` permite `node -e` con cualquier código, lo que evita todas las reglas de denegación.
- `Bash(psql:*)` + el hook bloquean `DROP`/`TRUNCATE`, pero no `DELETE`, `UPDATE`, `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` ni `ALTER ROLE`.
- `Bash(git checkout:*)` permite `git checkout .` (el hook solo bloquea `checkout -- .`).
*Corrección:* ajustar la regex del hook a `\.env(\.[\w-]+)?` y cubrir `head|tail|less|more|grep|sed|awk|bat`; restringir `node` a `node scripts/*` y `node .claude/hooks/*`; en `psql` bloquear también `DELETE|UPDATE|ALTER|GRANT|REVOKE|CREATE ROLE` salvo contra `sigiso_test`; bloquear `git checkout .` y `git restore`. Agregar pruebas de los hooks.

**M2. `empresa_libreria.adoptada_por` no está amarrado a la misma empresa.**
La FK apunta a `usuario(id)`; las FK no aplican RLS, así que técnicamente se podría registrar como autor de la adopción a una persona de otra empresa. Hoy el riesgo es bajo (el valor sale del token), pero el patrón se repetirá en cada tabla con autor. *Corrección:* FK compuesta `(empresa_id, adoptada_por) → usuario(empresa_id, id)` (con `unique (empresa_id, id)` en `usuario`) y anotarlo en el skill `migracion-rls` como regla general.

**M3. Un solo rol por persona.**
En la práctica ISO una persona suele ser a la vez dueño de proceso y auditor interno, y la norma exige que el auditor **no audite su propio trabajo** (imparcialidad). Además, el auditor externo debe tener acceso limitado en el tiempo. *Corrección:* antes del módulo de auditorías, pasar a roles múltiples (tabla `usuario_rol` con vigencia opcional) y modelar la relación persona–proceso para validar la independencia del auditor.

**M4. Al modelo de dominio le faltan entidades de la certificación real.**
- **Certificado** (número, organismo, alcance, emisión, vencimiento, estado: vigente, suspendido, retirado).
- **Alcance** del sistema por norma, con **sedes** y **exclusiones justificadas**.
- **Activo de información** (necesario para el análisis de riesgos de 27001).
- **Evaluación de impacto de sistemas de IA** (42001), distinta del riesgo de la empresa.
- Orígenes de la **No conformidad** además de hallazgo e indicador: queja, incidente, revisión por la dirección.
- Clasificación de hallazgos de auditoría externa (NC mayor, NC menor, observación, oportunidad de mejora) y plazos de cierre.
*Corrección:* actualizar `docs/producto/modelo-dominio.md` y pasarlo por `experto-iso` antes de la Fase 1.

**M5. El alcance de la Fase 0 creció.**
El paso 0.6 tiene 68 tareas e incluye funcionalidad de negocio (catálogo, adopción, listado) que el prompt dejaba para después de la Fase 0. La calidad es buena, pero alarga la Fase 0 y consume tokens. *Recomendación:* cerrar 0.6 con lo mínimo pendiente (pantalla de ingreso real, prueba de aislamiento de extremo a extremo); diferir 11.1–11.3 (intentos fallidos desde Keycloak) a la Fase 1; mantener 0.7, 0.8 y 0.9 estrictamente en su criterio de salida.

### Baja

- **B1.** `modules/empresas/src/domain/marca-empresa.ts` importa `derivarTema` de `@sig/tokens`: la derivación del tema visual es lógica de presentación dentro del dominio. Moverla a la capa de aplicación o interfaz, y dejar en el dominio solo la validación del color.
- **B2.** `AdoptarLibreria` usa por defecto `TODO_HABILITADO` como `FlagsPort`: si la composición olvida inyectar los flags, la función queda encendida (falla abierta). Hacer el parámetro obligatorio o usar un valor por defecto cerrado.
- **B3.** ADR 011 y 018 (Docker) y ADR 008 (OpenFGA) están reemplazados en la práctica por los ADR 022 y 029, pero el índice los muestra como «Aprobado». Marcarlos «Reemplazado por 022/029».
- **B4.** En `seguridad.yml`, `mv ... || true` oculta un fallo de Trivy/SBOM; y las acciones no están fijadas por SHA (ya registrado como pendiente antes de producción).
- **B5.** `docs/fase0/estado.md` desactualizado: dice que el PR #5 está abierto (ya integrado, igual que #6 y #7) y la línea de próximos pasos empieza en 0.4.
- **B6.** Hooks no probados en Windows real (registrado); el hook de Bash evalúa el texto completo y puede dar falsos positivos (registrado).

## Fortalezas a mantener

1. `app_tenant_id()` que **lanza error** sin empresa (no devuelve vacío) y `FORCE ROW LEVEL SECURITY` en todas las tablas de negocio.
2. `conTenant` que revalida el identificador en ejecución y prohíbe anidar transacciones.
3. Bitácora: `INSERT` por columnas, fecha fijada por el servidor, disparadores contra `UPDATE/DELETE/TRUNCATE`, cadena de huellas y sin datos personales.
4. Política de "sin texto de normas" aplicada en la base (límites de longitud) y en CI (validador de contenido).
5. Pruebas de aislamiento y de privilegios en integración con PostgreSQL real en CI.
6. Demostraciones verificables de los controles (PR #2 bloqueado por secretos y licencia AGPL).
7. Registro honesto de defectos propios (hooks con ruta relativa) en `estado.md`.

## Orden sugerido de corrección

1. A1 (decisión del responsable, 15 minutos).
2. M1 y B5 (una sesión corta de Claude Code).
3. Terminar 0.6 con el alcance reducido (M5).
4. A2, M3 y M4 **antes de empezar la Fase 1** (un `/spec` de "modelo de dominio v2 y esquema de librerías v3" con `experto-iso`).
5. M2, B1–B4 al pasar por esos archivos.
