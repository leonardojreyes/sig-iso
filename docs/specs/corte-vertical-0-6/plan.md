# Plan — Corte vertical 0.6: ingreso por empresa, aislamiento, librería de ejemplo y bitácora

- **Estado:** Aprobado por el responsable (2026-11-04)
- **Spec:** [spec.md](spec.md)

Revisado por `arquitecto` y `revisor-cumplimiento`; sus hallazgos están incorporados (v2 de este plan).

## Contexto

Hoy el producto solo tiene pantallas con datos de ejemplo: no hay sesión, base de datos, empresa real ni bitácora. Este corte demuestra de punta a punta que (1) una persona entra y queda ligada a una empresa, (2) ve solo lo de su empresa, (3) una librería se carga como datos y se consulta, (4) todo hecho relevante queda en una bitácora inmutable. Es el cimiento de todos los módulos.

Estado verificado: PostgreSQL 16 nativo corre, sin base ni rol `sigiso`; sin ORM, auth, OpenFGA ni OpenTelemetry; `modules/normas` es una plantilla en memoria sin prueba de aislamiento; `libraries/normas/` vacía; `pnpm-workspace.yaml` no incluye `platform/*` y la carpeta no existe; Keycloak sin fórmula de Homebrew y sin JDK; no existe `.env.example`.

## Decisiones del responsable

- **ORM:** Kysely + migraciones SQL (completa ADR 006).
- **Keycloak:** nativo en esta Mac (JDK por Homebrew + zip oficial), realm de desarrollo desde archivo.
- **Supuestos del spec:** Q1 la empresa _adopta_ una librería global; Q3 no se registra IP; Q4 sesión de 30 min de inactividad; Q5 sin borrado de bitácora.

## Cambios al spec (primera tarea, solo documentación)

1. **H4.2 y H4.3** pasan a aplicar a la **carga del catálogo** (operación de plataforma). La **adopción** por la empresa solo puede ser rechazada por: sin permiso, librería inexistente o ya adoptada.
2. **§5**: agregar columnas _base de tratamiento_, _finalidad_ y _retención_, y filas para claims del token, cookie de sesión, eventos de Keycloak y trazas. Anotar el rol de SynapTech frente a la empresa cliente.
3. **§7**: ampliar el catálogo de eventos (ver «Bitácora»).
4. **H6.6**: «ni por la aplicación ni por sus roles; la manipulación directa por el dueño de la base de datos es **detectable**».
5. **H5.x**: la guía se limita a 280 caracteres y 2 frases (antes 600).

## ADR nuevos (cada uno se crea con `/adr` al inicio de la fase que lo usa)

| ADR | Tema                                                                                                                                                                                                                                   | Fase |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 024 | Kysely + migraciones SQL; alcance de RLS (protege de omisión de contexto, no de SQL inyectado); roles y bases; actualiza ADR 006 y amplía 022                                                                                          | 1    |
| 025 | Keycloak y OpenFGA nativos en macOS (excepción a 022): versión y licencia fijadas; JDK solo herramienta local; sondeo del worker como excepción temporal a la cola Valkey (ADR 009); OTel/flags mínimos, sin flagd (desvío de ADR 013) | 8    |
| 026 | Librería global + adopción por empresa; esquema de librería v2 (`aplica_a`, guía ≤ 280); catálogo inmutable                                                                                                                            | 4    |
| 027 | Sesión web (BFF) con OIDC; empresa solo desde el token (decisión consciente frente a ADR 007; el cambio de empresa del consultor llega después)                                                                                        | 10   |
| 028 | Privacidad y bitácora: LOPDP, bases, finalidad, retención, identificador opaco, procedimiento para derechos del titular y su responsable                                                                                               | 3    |

## Arquitectura

Reglas Nx de `type:platform` **ya existen** en `eslint.config.mjs`; lo que falta es `platform/*` en `pnpm-workspace.yaml` y la etiqueta `"nx":{"tags":["type:platform"]}` en cada `package.json`. Sí se **extiende** `no-restricted-imports` en `domain` y `application` con `kysely`, `jose`, `ajv`, `yaml`, `node:*` para que el lint detecte fugas.

```
platform/
  tenancy/        EmpresaId (tipo puro, sin Node); contexto con AsyncLocalStorage en archivo aparte
  db/             pool, conTenant(empresaId, fn), migraciones, tres pools por rol
  auditoria/      BitacoraPort, RegistrarIntentoFallido (caso de uso), adaptadores
  autenticacion/  TokenVerifierPort (JWKS), guard, claims
  autorizacion/   AutorizacionPort + adaptador OpenFGA + modelo .fga
modules/normas/    catálogo, adopción, requisitos (extiende la plantilla)
modules/empresas/  empresa y marca (nuevo; sigue la plantilla)
apps/api           solo composición + OpenAPI
apps/web           OIDC (BFF), middleware, pantallas reales
apps/worker        sondeo de eventos de Keycloak → caso de uso RegistrarIntentoFallido
scripts/           db-init, db-migrate, libraries-load, keycloak-dev, openfga-dev, ram-report
```

- **Puertos nuevos:** `UnidadDeTrabajoPort` (ejecuta `fn` en una transacción con tenant; adaptador Kysely en `infrastructure`), `LibreriaFuentePort`, `CatalogoRepositoryPort`, `AdopcionRepositoryPort`, `EmpresaRepositoryPort`, `BitacoraPort`, `AutorizacionPort`, `TokenVerifierPort`.
- **Empresa:** sale **solo** del claim `empresa_id` del token verificado. `/e/[empresa]` en web se compara con la sesión; si no coincide, 404.
- **Módulo `empresas`:** `MarcaEmpresa` con reglas de dominio reutilizando `@sig/tokens` (contraste AA con ajuste y aviso, H3.2) y validación de logo (solo ruta propia o `https:`, si no monograma, H3.3).
- **Autorización:** `AutorizacionPort.puede(usuario, acción, empresa)`; roles de ADR 008 en el modelo OpenFGA, el corte usa `administrador_sig` y `colaborador`. El adaptador OpenFGA es lo último en construirse; todo se prueba antes con un fake.
- **Eventos:** sin outbox en 0.6 (sin consumidores). **OTel:** API con atributo `empresa_id`, exportador a consola. **Flags:** OpenFeature con proveedor en memoria.

## Modelo de datos (PostgreSQL 16)

**Roles** (creados por `scripts/db-init.mjs`, contraseñas generadas y guardadas en `.env.local`):

| Rol                 | Uso                                  | Permisos                                              |
| ------------------- | ------------------------------------ | ----------------------------------------------------- |
| `sigiso_owner`      | solo migraciones, nunca en ejecución | dueño del esquema                                     |
| `sigiso_app`        | API en ejecución                     | sin superusuario, sin BYPASSRLS, no dueño; ver tablas |
| `sigiso_catalogo`   | script `libraries:load`              | INSERT solo en las 3 tablas de catálogo               |
| `sigiso_plataforma` | worker y eventos sin empresa         | INSERT en `bitacora` solo con `empresa_id IS NULL`    |

Bases: `sigiso`, `sigiso_test`, `openfga`. Keycloak en local usa su almacén de archivo; PostgreSQL en CI/despliegue.

| Tabla                                                                            | empresa_id             | Acceso y RLS                                                                |
| -------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| `empresa` (id, slug, nombre, color_primario, logo_url)                           | = id                   | `app`: SELECT solo la propia                                                |
| `usuario` (id opaco = sub, empresa_id, nombre, correo)                           | sí                     | mutable y anonimizable; RLS                                                 |
| `libreria` (metadatos: nombre, versión, hash, `es_ejemplo`, fuente)              | no                     | `app`: SELECT (solo metadatos)                                              |
| `libreria_entrada`, `libreria_entrada_norma`                                     | no                     | `app`: SELECT **solo si** `EXISTS` adopción de su empresa para esa librería |
| `empresa_libreria` (empresa, librería, adoptada_por, adoptada_en; único por par) | sí                     | `app`: SELECT/INSERT con RLS                                                |
| `bitacora`                                                                       | sí o NULL (plataforma) | ver abajo                                                                   |

**Catálogo:** se carga con `pnpm libraries:load` (rol `sigiso_catalogo`), nunca desde la API. Inmutable: misma norma+versión con otro hash se rechaza. No existe función `SECURITY DEFINER`.

**RLS:** `ENABLE` + `FORCE`; las políticas llaman `(select app_tenant_id())`, función que **lanza error** si `app.tenant_id` falta, está vacío o no es UUID válido. `conTenant` abre transacción y usa `set_config('app.tenant_id', $1, true)` (alcance de transacción, nunca de sesión). Fuera de `conTenant` el pool falla.

### Bitácora (P15)

- Campos: id, empresa_id (NULL=plataforma), `actor_tipo` (usuario/sistema/worker), `usuario_id` opaco, acción, objeto, `objeto_version`/hash, resultado, motivo/código, `trace_id`, `origen_id` (idempotencia), `antes`/`despues` (lista blanca de claves por acción, sin datos personales), `creada_en DEFAULT now()` del servidor, `hash_previo`, `hash`.
- Solo añadir: sin UPDATE/DELETE/TRUNCATE (permisos + triggers `BEFORE UPDATE/DELETE/TRUNCATE`).
- **Encadenado por hash** por empresa (trigger con bloqueo consultivo) y función de verificación; una prueba altera una fila como dueño y la verificación lo detecta. Límite documentado: el dueño de la base puede reescribir toda la cadena; el encadenado da evidencia, no prevención absoluta.
- Escritura en la **misma transacción** que la acción (H6.8). Si falla el registro de un rechazo, se responde 500 y no se traga el error.
- **Eventos del corte:** `login.ok`, `login.fallido`, `logout`, `sesion.expirada`, `libreria.adoptada`, `libreria.rechazada`, `acceso.denegado` (403), `acceso.cruzado` (404 por empresa distinta), `token.invalido`, `catalogo.cargado` (plataforma), `rol.cambiado` y `usuario.alta/baja` (desde eventos de administración de Keycloak y desde la siembra de OpenFGA, que escribe tuplas solo mediante un puerto que registra).

## Flujos clave

- **Ingreso (H1):** web → Keycloak (código + PKCE) → `/auth/callback` valida → llama `POST /sesion/inicio` (el hecho se deriva del token verificado, nunca de datos del cliente) → **solo si se registró** emite la cookie. Retorno solo a rutas relativas propias. `Cache-Control: no-store` en páginas internas (H1.4). `POST /sesion/cierre` registra y revoca con `id_token_hint`.
- **Sesión (ADR 027):** cookie `httpOnly`, `Secure`, `SameSite=Lax` con el refresh token sellado (< 3 KB, prueba de tamaño) y access token en memoria del servidor; la inactividad de 30 min la impone Keycloak (SSO idle) y se prueba. POST con verificación de `Origin`.
- **Intentos fallidos (H6.2):** `LOGIN_ERROR` es evento de **usuario** de Keycloak. El worker lee `/events` (cuenta de servicio con `view-events`), copia **solo** tipo, fecha, código de error y `userId` si existe — **nunca** `ipAddress`, `username` ni `details` — con clave idempotente `hash(time,type,userId,clientId,error)`, punto de control del último leído y alerta si hay hueco. El realm importado habilita eventos y fija la expiración por encima de la tolerancia. Los eventos de **administración** alimentan `rol.cambiado` y alta/baja.
- **Adopción (H4):** en una transacción: autorizar → insertar `empresa_libreria` → insertar bitácora; cualquier error revierte todo. El 403 y el rechazo se registran vía un filtro que escribe en su propia transacción.
- **Control de texto copiado (H4.3):** al cargar el catálogo y en `pnpm libraries:validate`/CI: guía ≤ **280 caracteres y 2 frases**, título ≤ 80, patrones **estructurales** (no frases de normas), `fuente` obligatoria. Pruebas con fixtures sintéticos. **Límite honesto:** no se puede comparar contra el texto de la norma; la garantía real es la revisión de `revisor-cumplimiento`.
- **Marca (H3):** `GET /empresa/marca` solo devuelve la de la sesión; el CSS de otra empresa nunca viaja.

## Contrato (OpenAPI 3.1, antes de los controladores)

`GET /me`, `GET /empresa/marca`, `POST /sesion/inicio`, `POST /sesion/cierre`, `GET /librerias` (con `adoptada`), `POST /librerias/{id}/adopcion` (201 / 200 «ya adoptada» / 403 / 404), `GET /requisitos?q&capitulo&norma`, `GET /requisitos/{id}` (404 indistinguible entre «no existe», «es de otra empresa» y «librería no adoptada»). Tipos en `packages/contracts`.

## Librería de ejemplo y esquema

- `libraries/normas/ejemplo-estructura-armonizada.yaml`: 21 entradas de primer nivel (spec §11), capítulo 10 por tema con identificador por norma, `es_ejemplo: true`, fuente «elaboración propia SynapTech».
- `packages/normas-schema` v2: `capitulo`, `nivel`, `aplica_a[{norma, edicion, clausula}]`, `alcance_comun`, `es_ejemplo`, `fuente` obligatoria, guía ≤ 280.
- Antes de fijar numeraciones: el responsable las verifica con sus ejemplares (Q7).

## Pruebas

| Nivel                                                        | Qué                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominio                                                      | reglas de entrada, de adopción y de marca (cobertura ≥ 80 %)                                                                                                                                                                                                                                                                                                                                                                                                           |
| Caso de uso                                                  | puertos falsos: permisos, idempotencia, rollback, bitácora invocada                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Aislamiento (obligatoria, PostgreSQL real, dos empresas)** | leer por id, listar, entradas de una librería **solo adoptada por A** → B recibe 404; marca de B desde A falla; sin empresa → error; `tenant_id` inválido → error; fuera de `conTenant` → error; el tenant no se filtra entre dos usos del mismo cliente del pool; `sigiso_app` no es superusuario ni BYPASSRLS, no puede UPDATE/DELETE/TRUNCATE bitácora ni insertar `NULL` ni deshabilitar RLS; `sigiso_plataforma` solo inserta `NULL`; `REVOKE EXECUTE` verificado |
| Bitácora                                                     | encadenado detecta alteración; falla de escritura aborta la acción; lista blanca de `antes/despues`                                                                                                                                                                                                                                                                                                                                                                    |
| API                                                          | token firmado en prueba (`jose`) + JWKS local: 401 sin token, 404 cruzado, 403 colaborador, la empresa del token manda aunque se envíe otra; H3.1–H3.3                                                                                                                                                                                                                                                                                                                 |
| Web                                                          | axe; redirección sin sesión; URL de otra empresa → 404; redirección abierta rechazada; `no-store`; mensaje de error genérico en español (tema/locale `es` en el realm)                                                                                                                                                                                                                                                                                                 |
| Worker                                                       | idempotencia, lista blanca de campos, punto de control, hueco → alerta                                                                                                                                                                                                                                                                                                                                                                                                 |

La suite de integración corre en el PostgreSQL local (`sigiso_test`) y en CI en un trabajo `integracion` (ubuntu, servicio PostgreSQL 16) **desde la fase 2**. Agregar ese check a la protección de rama requiere tu aprobación.

## Fases (insumo de `/tasks`; una por sesión, TDD)

1. Cambios al spec · `.env.example` · `platform/*` en el workspace · lint ampliado · `db-init` (roles, bases) · **ADR 024**.
2. `platform/db` + `tenancy` + migración 0001 (tablas, RLS, `app_tenant_id`) + **prueba de aislamiento (rojo → verde)** + trabajo CI `integracion` y solicitud del check.
3. **ADR 028** · `platform/auditoria`: bitácora inmutable con encadenado, `sigiso_plataforma`, pruebas.
4. **ADR 026** · esquema v2 · YAML de ejemplo · validador y control de texto en CI · `libraries:load` (revisión de `revisor-cumplimiento`).
5. **Contrato OpenAPI y tipos** · módulo `empresas` (marca) · módulo `normas` (dominio, casos de uso, repos, `UnidadDeTrabajoPort`).
6. `platform/autenticacion` + `autorizacion` (puertos, fakes, guard, filtro de 403/404 cruzado) · controladores y pruebas de API.
7. Siembra de datos de prueba (dos empresas, usuarios `@example.test`) y `ram-report`.
8. **ADR 025** · Keycloak nativo: `scripts/keycloak-dev.mjs` (descarga con **hash fijado en el repo**, realm desde plantilla con marcadores, realm resuelto en carpeta ignorada, contraseñas generadas, escucha en 127.0.0.1, mapper `empresa_id` con atributo no editable por el usuario, eventos habilitados, locale `es`). **Antes de descargar informo el tamaño y espero tu «ok».**
9. OpenFGA nativo (Homebrew; verificar versión y licencia): base `openfga`, modelo, siembra de tuplas por el puerto que registra; adaptador.
10. **ADR 027** · Web: OIDC, sesión, middleware, marca real, pantallas de adopción y listado.
11. Worker: sondeo de eventos de usuario y de administración.
12. OTel/flags mínimos · `ram-report` final · guía de ejecución · actualizar `estado.md`.

## Riesgos

| Riesgo                                              | Mitigación                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| RAM (8 GB): PostgreSQL + JVM + OpenFGA + Next + API | Medir al final; heap de Keycloak acotado; adaptador OpenFGA al final (el fake ya funciona); apagar lo que no se use                             |
| RLS evadida (rol dueño, pool, SQL inyectado)        | `FORCE`, rol no dueño, `set_config` local; el ADR 024 declara el alcance; pruebas                                                               |
| Catálogo envenenado                                 | Solo se carga con script y rol propio, inmutable por hash, validación en CI                                                                     |
| Inmutabilidad frente al dueño de la base            | Encadenado de hash detectable; límite documentado                                                                                               |
| Eventos de Keycloak perdidos o con datos sensibles  | Lista blanca, punto de control, alerta de hueco, sin `username`/IP                                                                              |
| Datos personales (LOPDP)                            | ADR 028; identificador opaco en bitácora; tabla `usuario` anonimizable; sin IP                                                                  |
| Secretos                                            | `.env.example`; contraseñas generadas en `.env.local`; realm resuelto ignorado; escucha local; hash del zip fijado; correos de prueba ficticios |
| Redirección abierta, CSRF, sesión fijada            | Solo rutas relativas; `Origin`; nueva sesión en cada login                                                                                      |
| Heurística de texto copiado                         | Revisión humana de `revisor-cumplimiento`; ningún texto de norma en el repo                                                                     |
| Licencias                                           | Registrar en ADR 024/025; `pnpm check-licenses` tras instalar; JDK (GPLv2+Classpath) solo como herramienta local, no distribuida                |
| No se prueba en Windows                             | Se documenta; la vía Compose cubre Windows y CI                                                                                                 |
| Numeraciones ISO sin verificar                      | Verificación del responsable (Q7); capítulo 10 por tema                                                                                         |

## Verificación de extremo a extremo

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` y la suite de integración en verde, incluida la de aislamiento.
2. `pnpm db:init && pnpm db:migrate && pnpm libraries:load`; levantar PostgreSQL, Keycloak, OpenFGA, API, worker y web.
3. En el navegador: `admin-a` ingresa → ve la marca de A → adopta la librería → ve 21 entradas; `colab-a` no ve el botón. `admin-b` ve «no cargada» y ninguna entrada de A.
4. `/e/b/...` con la sesión de A → 404. Con el token de A, pedir por API una entrada de una librería adoptada solo por B → 404.
5. Consultar la bitácora como `sigiso_owner`: ingreso, intento fallido, adopción (éxito y rechazo), 403, 404 cruzado; verificar la cadena; intentar `UPDATE`/`DELETE` como `sigiso_app` → error.
6. `scripts/ram-report.mjs` y registrar el consumo en `estado.md`.

## Fuera de este plan

Edición de marca por la empresa, evaluación de cumplimiento, pantalla de consulta de bitácora, alta de empresas/usuarios por interfaz, recuperación de contraseña/2FA, librerías propias por empresa, cambio de empresa del consultor, móvil.
