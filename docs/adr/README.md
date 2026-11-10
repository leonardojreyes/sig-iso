# Índice de ADRs

Formato MADR breve. Se crean con el comando `/adr`. Aprobados el 2026-11-04 (paso 0.1).

| ADR                                          | Tema                       | Decisión                                                                   | Estado    |
| -------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- | --------- |
| [001](001-estilo-arquitectonico.md)          | Estilo                     | monolito modular + hexagonal (DDD)                                         | Aprobado  |
| [002](002-backend.md)                        | Backend                    | TypeScript + NestJS sobre Node.js LTS                                      | Aprobado  |
| [003](003-monorepo.md)                       | Monorepo                   | Nx + pnpm                                                                  | Aprobado  |
| [004](004-web.md)                            | Web                        | React + Next.js                                                            | Aprobado  |
| [005](005-movil.md)                          | Móvil                      | diferido; v1 web responsiva/PWA                                            | Aprobado  |
| [006](006-base-de-datos.md)                  | Base de datos              | PostgreSQL con Row-Level Security + Kysely (ADR 024)                       | Aprobado  |
| [007](007-identidad.md)                      | Identidad                  | Keycloak autogestionado                                                    | Aprobado  |
| [008](008-autorizacion.md)                   | Autorización               | RBAC + atributos con OpenFGA                                               | Aprobado  |
| [009](009-eventos-y-tareas.md)               | Eventos y tareas           | outbox en PostgreSQL + cola sobre Valkey                                   | Aprobado  |
| [010](010-observabilidad.md)                 | Observabilidad             | OpenTelemetry + Prometheus, Grafana, Loki, Tempo                           | Aprobado  |
| [011](011-ejecucion.md)                      | Ejecución                  | Docker Compose en desarrollo; Kubernetes + Helm en servidores              | Aprobado  |
| [012](012-iac.md)                            | IaC                        | OpenTofu + Helm + Argo CD                                                  | Aprobado  |
| [013](013-feature-flags.md)                  | Feature flags              | OpenFeature + flagd                                                        | Aprobado  |
| [014](014-ia.md)                             | IA                         | LiteLLM como gateway; Ollama local por defecto                             | Aprobado  |
| [015](015-codigo-y-cicd.md)                  | Código y CI/CD             | GitHub + GitHub Actions                                                    | Aprobado  |
| [016](016-secretos.md)                       | Secretos                   | OpenBao; en desarrollo `.env` fuera de git                                 | Aprobado  |
| [017](017-archivos-evidencias.md)            | Archivos (evidencias)      | almacenamiento compatible S3 con hash SHA-256                              | Aprobado  |
| [018](018-entorno-desarrollo.md)             | Entorno de desarrollo      | nativo + servicios en Docker; Dev Container opcional                       | Aprobado  |
| [019](019-sistema-de-diseno.md)              | Sistema de diseño          | tokens W3C + Style Dictionary; Tailwind + shadcn/ui                        | Aprobado  |
| [020](020-librerias-de-normas.md)            | Librerías de normas        | formato abierto propio (YAML con esquema JSON)                             | Aprobado  |
| [021](021-documentos-y-reportes.md)          | Documentos y reportes      | PDF/DOCX desde plantillas                                                  | Aprobado  |
| [022](022-sin-docker-en-desarrollo-local.md) | Desarrollo local           | Sin Docker: PostgreSQL nativo                                              | Aprobado  |
| [023](023-look-and-feel.md)                  | Look and feel              | tokens semánticos; tema por empresa con contraste automático               | Aprobado  |
| [024](024-acceso-a-datos-kysely-y-roles.md)  | Acceso a datos             | Kysely + migraciones SQL; roles y alcance de RLS                           | Aprobado  |
| [025](025-keycloak-y-openfga-nativos.md) | Keycloak y OpenFGA nativos | versiones fijadas, JRE descargado con huella verificada, solo en 127.0.0.1 | Aprobado |
| [026](026-libreria-global-y-adopcion.md)     | Librería global y adopción | catálogo global inmutable; adopción por empresa; esquema v2 con `aplica_a` | Aprobado  |
| [027](027-sesion-web-y-empresa-desde-el-token.md) | Sesión web y empresa | BFF con OIDC (código + PKCE); la empresa sale solo del token verificado | Aprobado  |
| [028](028-privacidad-y-bitacora.md)          | Privacidad y bitácora      | identificador opaco; pseudonimización; retención y derechos provisionales  | Aprobado (provisional; falta asesor legal) |
| [029](029-autorizacion-por-rol-en-la-base.md) | Autorización por rol en la base | rol en `usuario` y matriz en código; OpenFGA pospuesto con disparadores | Aprobado |
| [031](031-ruta-mvp-se-difiere-el-0-8-y-se-reduce-el-0-9.md) | Ruta MVP | se difiere el paso 0.8 hasta tener servidor; el 0.9 se reduce a STRIDE, clasificación de datos y política de IA | Aprobado |
