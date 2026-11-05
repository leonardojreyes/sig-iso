# Base técnica — sig-iso

> Extraído de FASE0.md, sección 5. `CLAUDE.md` enlaza aquí en lugar de repetirlo.

### 5.1 Decisiones fijas

| Tema | Decisión |
| --- | --- |
| Infraestructura | On-premise o cualquier nube privada. Kubernetes portable, sin servicios gestionados de nube pública. En la Fase 0 basta Docker Compose + chart Helm validado; el clúster se monta cuando exista el servidor destino. |
| Identidad | Keycloak autogestionado (OIDC, OAuth2, SAML, SCIM). |
| Código y CI/CD | GitHub + GitHub Actions. Análisis con herramientas abiertas (no CodeQL). |
| Equipos | Windows y macOS: Dev Containers opcionales (en 8 GB se permite desarrollo nativo con Node LTS + servicios en Docker), scripts en Node (no bash), `.gitattributes` con finales de línea normalizados, hooks probados en ambos sistemas. |
| Backend | TypeScript + NestJS sobre Node.js LTS. |
| Base de datos | PostgreSQL con Row-Level Security. |
| Mercado | Uso interno de SynapTech primero; luego empresas medianas y grandes del Ecuador. Debe resistir una due diligence de un cliente corporativo. |

### 5.2 Principios de arquitectura

| # | Principio | Cómo se hace cumplir |
| --- | --- | --- |
| P1 | Monolito modular primero | Límites entre módulos en el monorepo (`@nx/enforce-module-boundaries`) |
| P2 | Arquitectura limpia (hexagonal): el dominio no conoce frameworks, BD ni proveedores de IA | Linter de dependencias + subagente `arquitecto` |
| P3 | Multiempresa desde el día uno; aislamiento garantizado por la base de datos | RLS + pruebas de aislamiento obligatorias |
| P4 | Contrato primero (OpenAPI 3.1) | Clientes generados + prueba de compatibilidad en CI |
| P5 | Estándares abiertos antes que productos | ADR obligatorio para dependencias propietarias |
| P6 | Seguro por defecto: OWASP ASVS nivel 2 | Escaneos de seguridad, secretos y dependencias en cada PR |
| P7 | Privacidad por diseño (LOPDP) | Clasificación de datos + subagente `revisor-cumplimiento` |
| P8 | IA desacoplada y gobernada; modelo elegible por empresa y usuario | Puerto de IA + gateway único |
| P9 | Observable desde el inicio, etiquetado por empresa | OpenTelemetry en la plantilla de módulo |
| P10 | Todo como código | OpenTofu, Helm, GitOps (Argo CD cuando haya clúster) |
| P11 | Decisiones escritas en ADRs que Claude lee antes de proponer cambios | `docs/adr` + comando `/adr` |
| P12 | Tecnología mayoritaria, con soporte largo y talento disponible | Criterio explícito en cada ADR de stack |
| P13 | **El producto se usa a sí mismo**: el propio desarrollo del producto genera evidencias para ISO 27001 y 42001 de SynapTech (ADRs, PR revisados, escaneos, SBOM) | Las salidas del pipeline se guardan con fecha en `docs/security/evidencias/` |
| P14 | **Normas como datos**: agregar o actualizar una norma es cargar una librería, no cambiar código | Esquema JSON de librería validado en CI |
| P15 | **Trazabilidad auditable**: toda creación, cambio, aprobación y eliminación queda en una bitácora inmutable (quién, qué, cuándo, antes/después) | Tabla de auditoría solo-inserción + prueba automatizada |

### 5.3 Stack y ADRs iniciales

| ADR | Decisión | Propuesta | Alternativa | Estándar | Licencia |
| --- | --- | --- | --- | --- | --- |
| 001 | Estilo | Monolito modular + hexagonal (DDD) | Microservicios (descartado) | — | — |
| 002 | Backend | TypeScript + NestJS (Node.js LTS) | — (decidido) | OpenAPI 3.1 | MIT |
| 003 | Monorepo | Nx + pnpm | Turborepo | — | MIT |
| 004 | Web | React + Next.js | Angular | WCAG 2.2 AA | MIT |
| 005 | Móvil | **Diferido.** v1 = web responsiva/PWA. Si se aprueba app: React Native + Expo | Flutter | OWASP MASVS | MIT |
| 006 | Base de datos | PostgreSQL con RLS; ORM/migraciones a elegir en el ADR (Prisma, Drizzle o Kysely) | — | SQL | PostgreSQL |
| 007 | Identidad | Keycloak autogestionado | — | OIDC, OAuth2, SAML, SCIM | Apache 2.0 |
| 008 | Autorización | RBAC + atributos con OpenFGA (roles: administrador SIG, dueño de proceso, auditor interno, auditor externo temporal, colaborador, alta dirección) | Cerbos | Zanzibar | Apache 2.0 |
| 009 | Eventos y tareas | Outbox en PostgreSQL + cola sobre Valkey (alertas de vencimiento, recordatorios) | NATS, Kafka | AsyncAPI, CloudEvents | BSD / Apache 2.0 |
| 010 | Observabilidad | OpenTelemetry + Prometheus, Grafana, Loki, Tempo (perfil `obs`, apagado por defecto) | Plataforma del cliente | OpenTelemetry | Apache 2.0 / AGPL |
| 011 | Ejecución | Docker Compose en desarrollo; Kubernetes conforme a CNCF + Helm en servidores | — | OCI | Apache 2.0 |
| 012 | IaC | OpenTofu + Helm + Argo CD | Terraform (BSL, descartado) | HCL | MPL 2.0 / Apache 2.0 |
| 013 | Feature flags | OpenFeature + flagd | — | OpenFeature | Apache 2.0 |
| 014 | IA | LiteLLM autogestionado como gateway; Ollama local por defecto | SDKs directos (descartado) | API compatible OpenAI, MCP | MIT |
| 015 | Código y CI/CD | GitHub + GitHub Actions | — | — | Servicio |
| 016 | Secretos | OpenBao (en desarrollo: `.env` fuera de git + plantilla `.env.example`) | HashiCorp Vault (BSL, descartado) | — | MPL 2.0 |
| 017 | Archivos (evidencias) | Almacenamiento compatible S3 (SeaweedFS en desarrollo por su bajo consumo) con hash SHA-256 por archivo | Ceph | API S3 | Apache 2.0 |
| 018 | Entorno de desarrollo | Nativo (Node LTS + pnpm) + servicios en Docker; Dev Container disponible para quien lo prefiera | Solo Dev Containers | Dev Container spec | — |
| 019 | Sistema de diseño | Tokens W3C + Style Dictionary; Tailwind + shadcn/ui; Storybook (perfil aparte); Penpot o Figma | — | W3C Design Tokens | Apache 2.0 / MIT / MPL 2.0 |
| 020 | Librerías de normas | Formato abierto propio (YAML con esquema JSON): norma, edición, cláusulas/controles, títulos breves, guía propia, mapeos. Sin texto de las normas | Importar librerías de terceros (requiere revisar licencia) | JSON Schema | Propia |
| 021 | Documentos y reportes | Generación de PDF/DOCX de Declaración de Aplicabilidad, actas e informes desde plantillas (librería abierta a elegir en el ADR) | — | — | Abierta |

### 5.4 Multiempresa

- Modelo híbrido: **compartido** (misma BD, RLS por empresa) por defecto; **base dedicada** para grandes empresas; **despliegue dedicado** para reguladas. Mismo código en los tres.
- La empresa se resuelve en un solo lugar (token OIDC, subdominio o encabezado) y viaja en el contexto de cada petición, evento y tarea.
- Cada transacción fija la empresa en PostgreSQL (`SET LOCAL app.tenant_id`); sin empresa, la consulta falla.
- Archivos (evidencias), caché, colas y logs separados por empresa.
- Todo módulo nuevo trae una prueba que intenta leer datos de otra empresa y debe fallar.
- Configuración por empresa: logo, colores, idioma, normas activas, módulos activos, SSO propio, modelos de IA permitidos.
- **Librerías de normas globales** (publicadas por SynapTech, solo lectura para las empresas) + **librerías propias** de cada empresa.
- Caso especial: **consultor** que atiende varias empresas cliente con un solo usuario y cambio explícito de empresa (por defecto, sin acceso cruzado).

### 5.5 IA embebida multimodelo

1. La IA es un **puerto del dominio** (`AsistentePort`), nunca un SDK de proveedor. Todo pasa por LiteLLM con API compatible OpenAI.
2. **Por defecto, local con Ollama**: los datos del SIG (riesgos, hallazgos, vulnerabilidades) no salen de la infraestructura. Modelo inicial pequeño (~3B parámetros) en la máquina de desarrollo; el modelo real se define por empresa.
3. Catálogo de modelos publicado por SynapTech (locales y, solo si la empresa lo habilita, Claude, GPT, Gemini).
4. Política por empresa: modelos permitidos, predeterminado, clave propia (BYOK) o de SynapTech, y si se permite enviar datos fuera.
5. El usuario elige entre los modelos que su empresa permite.
6. Límites de uso por empresa y usuario, medición, registro de llamadas sin datos sensibles, respaldo automático a otro modelo permitido.
7. Controles del OWASP Top 10 para LLM, prompts versionados en `packages/prompts`, evaluaciones antes de cambiar prompt o modelo.
8. **Coherencia con ISO 42001:** el propio asistente es un sistema de IA de la empresa: queda registrado en el inventario de sistemas de IA y todo lo que genera se marca como "borrador generado por IA" hasta que un humano lo aprueba.
9. Herramientas expuestas con MCP (fase posterior). Claves en OpenBao.

### 5.6 Look and feel y sistema de diseño

- **Por definir en el paso 0.5** (ese paso lo pregunta): referencias visuales, tono, colores, tipografía, iconos, densidad, claro/oscuro. Valor inicial propuesto: primario `#0E5C42` (verde esmeralda SynapTech), estilo sobrio y profesional, densidad media, modo claro y oscuro.
- Un único sistema de diseño basado en tokens (ADR 019). Ningún valor visual se escribe a mano en una pantalla.
- Al aplicar los colores de una empresa se verifica automáticamente el contraste WCAG 2.2 AA.
- Español de Ecuador por defecto, textos externalizados (i18n).
- Componentes propios del dominio además de los base: **semáforo de cumplimiento**, **barra de madurez por cláusula**, **matriz de riesgos**, **línea de tiempo del ciclo de certificación**.
- Entregables mínimos: guía de estilo, tokens, unos 15 componentes base + los 4 de dominio, y cinco pantallas plantilla (inicio de sesión, panel, listado con filtros, formulario, detalle).

### 5.7 Context engineering

**Capas:** `CLAUDE.md` raíz (máximo ~150 líneas: propósito, mapa, comandos, reglas, enlaces) → `CLAUDE.md` por carpeta → `docs/` (ADRs, specs, arquitectura, seguridad, producto) → skills y subagentes.

**Estructura del repositorio:**

```
<nombre>/
├── CLAUDE.md
├── FASE0.md                      # este prompt
├── .claude/ (settings.json, agents/, commands/, skills/)
├── .devcontainer/
├── apps/ (api, worker, web)
├── modules/<modulo>/ (domain, application, infrastructure, interface)
├── platform/ (tenancy, auth, ia-gateway, auditoria, observabilidad)
├── packages/ (contracts, ui, tokens, prompts, normas-schema)
├── libraries/normas/             # librerías de normas en YAML (sin texto ISO)
├── infra/ (compose/, opentofu/, helm/)
└── docs/ (fase0/, adr/, specs/, producto/, security/, design/)
```

**Hooks (`.claude/settings.json`, scripts en Node):**
- Antes de editar: bloquear `.env*`, migraciones ya aplicadas, `infra/` de producción.
- Después de editar: formatear, verificar tipos y lint del archivo tocado.
- Antes de ejecutar: bloquear comandos destructivos y accesos a producción.
- Al terminar: pruebas del módulo afectado y escaneo de secretos.

**Flujo spec-driven por funcionalidad:** `/spec` → `/plan` (modo plan) → `/tasks` → `/implement` (una tarea por sesión, TDD) → `/review` (subagentes en paralelo) → PR con controles en verde y aprobación humana.

**Ahorro de tokens:** los subagentes leen solo lo que su tarea necesita; `estado.md` resume la sesión anterior; nada de pegar archivos completos en el chat cuando basta una ruta.

### 5.8 Subagentes y comandos

| Subagente | Responsabilidad | Herramientas | Se activa en |
| --- | --- | --- | --- |
| arquitecto | Arquitectura limpia, límites, coherencia con ADRs | Solo lectura | /plan, /review |
| revisor-multiempresa | Ningún cruce de datos entre empresas | Solo lectura | /review, siempre |
| revisor-seguridad | ASVS, OWASP LLM, secretos, dependencias, licencias | Solo lectura + escáneres | /review, siempre |
| ingeniero-pruebas | Pruebas unitarias, de integración y de aislamiento | Escritura solo en pruebas | /implement |
| auditor-accesibilidad | WCAG 2.2 AA y coherencia con el sistema de diseño | Solo lectura + axe | /review con cambios de interfaz |
| revisor-cumplimiento | LOPDP; **que no se incluya texto de normas ISO**; trazabilidad (P15) | Solo lectura | /plan, /review con datos personales o librerías de normas |
| experto-iso | Correcta interpretación del ciclo de certificación, la Estructura Armonizada y los mapeos entre 9001, 27001 y 42001; señala cuando una regla de negocio no refleja la práctica de auditoría | Solo lectura | /spec, /plan de módulos de dominio |
| documentador | ADRs, OpenAPI, README, notas de versión | Escritura solo en `docs/` | /adr, cierre de funcionalidad |

**Comandos** (`.claude/commands/`, cada uno con rol, contexto a leer, pasos, formato de salida y criterio de "terminado"): `/fase0-inicio`, `/estado` (resume `estado.md` y el siguiente paso), `/spec`, `/plan`, `/tasks`, `/implement`, `/review`, `/adr`.

### 5.9 Regla de licencias

Preferir MIT, Apache 2.0, BSD o MPL. AGPL solo para componentes usados sin modificar como servicio aparte (por ejemplo Grafana). No copiar código AGPL dentro del producto. BSL, SSPL o "source-available" requieren ADR de excepción. CI verifica licencias de dependencias nuevas.
