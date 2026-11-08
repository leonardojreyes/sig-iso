# FASE 0 — Sistema de Gestión Integrado ISO (SynapTech)

**Producto:** plataforma para gestionar el ciclo de vida completo de certificación en varias normas ISO
**Nombre de código:** por definir en `/fase0-inicio` (marcador provisional: `sig-iso`)
**Responsable:** Ing. Leonardo J. Reyes B., MBA — CTO SynapTech Ecuador
**Versión del prompt:** 1.0 · 2026-11-04 · generado con el skill `fase0-producto-synaptech` v1.0

---

## 1. Rol y objetivo

Actúa como **arquitecto de software y líder técnico de SynapTech**. Tu objetivo es ejecutar la **Fase 0** de este producto, paso a paso: dejar listo el ambiente (decisiones, repositorio, context engineering, calidad, diseño, plataforma multiempresa, puerto de IA y seguridad) y un **esqueleto caminante visible** sobre el que luego se construyen los módulos funcionales con el flujo `/spec → /plan → /tasks → /implement → /review`.

No programes funcionalidades de negocio en la Fase 0, salvo el corte vertical mínimo indicado en el paso 0.6.

---

## 2. Contexto del producto

### 2.1 Resumen de la entrevista

| Tema | Respuesta |
| --- | --- |
| Problema | Gestionar como empresa todo el ciclo de vida hacia la certificación en varias normas ISO y su mantenimiento: diagnóstico, implementación, evidencias, auditorías, certificación, seguimientos y recertificación. |
| Usuario inicial | SynapTech Ecuador (uso interno primero). |
| Evolución | Después se venderá como producto **multiempresa** a empresas medianas y grandes del Ecuador (y a consultoras ISO). Por eso es multiempresa desde el día uno, aunque arranque con una sola empresa. |
| Normas de la v1 | **ISO 9001** (calidad), **ISO/IEC 27001:2022** (seguridad de la información), **ISO/IEC 42001:2023** (sistemas de gestión de IA). El modelo de datos debe admitir agregar cualquier otra norma sin cambiar código (14001, 45001, 20000-1, 22301, 37001, 27701…). |
| Canales | Web primero (responsiva, usable en tableta). Móvil nativo: **por definir** después de la v1 (caso de uso probable: auditor en sitio que toma evidencias fotográficas sin conexión). |
| Marca por empresa | Logo y colores por empresa (por defecto). |
| IA embebida | Sí. **Local con Ollama** por defecto (los datos del SIG son confidenciales y no salen de la infraestructura) y modelo **elegible** por empresa y usuario mediante gateway. |
| Integraciones | Por definir. Candidatas: Keycloak (evidencia de revisión de accesos), GitHub (evidencia de controles de desarrollo seguro), correo para notificaciones, almacenamiento S3 para evidencias. |
| Stack | Mismas decisiones que Orbyta: backend TypeScript + NestJS, PostgreSQL, Keycloak, on-premise o nube privada, GitHub. |
| Restricciones del equipo | Máquina de desarrollo principal: MacBook Pro M1, **8 GB RAM**, ~36 GB de disco disponibles. El equipo también usa Windows. El arranque debe ser **ligero** y mostrar **progreso visible pronto**. El responsable **no quiere aprobar cada comando**: solo aprueba al final de cada paso. |
| Look and feel | Por definir en el paso 0.5. Valor inicial propuesto: verde esmeralda SynapTech `#0E5C42` como color primario. |

### 2.2 Proceso de negocio que el sistema debe soportar (ciclo de vida de certificación)

El sistema modela un **Proyecto de certificación** por norma (o combinado) que recorre estas etapas. Cada etapa tiene entregables, responsables, fechas y un criterio de salida:

| # | Etapa | Qué gestiona el sistema |
| --- | --- | --- |
| E0 | Decisión y alcance | Contexto de la organización, partes interesadas y sus requisitos, alcance del sistema por norma, exclusiones justificadas, sedes y procesos incluidos. |
| E1 | Diagnóstico (análisis de brechas) | Autoevaluación requisito por requisito (cumple / parcial / no cumple / no aplica), evidencia existente, porcentaje de madurez por cláusula y por norma. |
| E2 | Plan de implementación | Plan de trabajo derivado de las brechas: tareas, responsables, fechas, dependencias, avance. |
| E3 | Diseño del sistema | Política integrada, objetivos medibles, mapa de procesos, metodología de riesgos, **Declaración de Aplicabilidad** (27001 y 42001), evaluación de impacto de sistemas de IA (42001), documentos y registros requeridos. |
| E4 | Implementación y operación | Controles en marcha, evidencias con vigencia, formación y competencia, comunicación, proveedores, inventario de activos de información y de sistemas de IA. |
| E5 | Evaluación | Indicadores, programa y ejecución de **auditorías internas**, **revisión por la dirección** con sus entradas obligatorias. Ambas son prerrequisito para la auditoría de Etapa 2. |
| E6 | Mejora | No conformidades, análisis de causa raíz, acciones correctivas, verificación de eficacia, oportunidades de mejora. |
| E7 | Certificación externa | Selección del organismo certificador acreditado, **auditoría de Etapa 1** (preparación y documentación), **auditoría de Etapa 2** (implementación y eficacia), hallazgos externos y su cierre, decisión de certificación, certificado (número, alcance, vigencia). |
| E8 | Mantenimiento (ciclo de 3 años) | Auditoría de **seguimiento 1** (máximo 12 meses desde la decisión de certificación), **seguimiento 2**, **recertificación** antes del vencimiento; alertas anticipadas; **transición de edición** de normas (por ejemplo ISO 9001:2015 → 2026, ISO 14001:2015 → 2026) con su propio análisis de brechas. |

### 2.3 Principio rector del dominio: "un requisito común, una evidencia, varias normas"

Las tres normas comparten la **Estructura Armonizada** (cláusulas 4 a 10: contexto, liderazgo, planificación, apoyo, operación, evaluación del desempeño, mejora). El sistema debe:

1. Tener un **marco de controles unificado** de la empresa: cada control interno se mapea a uno o varios requisitos de una o varias normas (relación muchos a muchos).
2. Reutilizar la **misma evidencia** para todos los requisitos mapeados ("mapear una vez, evidenciar una vez").
3. Permitir **auditorías combinadas** (un equipo auditor, varias normas) y calendarios unificados.
4. Mostrar la cobertura por norma, por cláusula y por control en tiempo real.

### 2.4 Buenas prácticas tomadas del mercado (a incorporar como requisitos)

| Fuente de referencia | Práctica a incorporar | Debilidad observada que debemos evitar |
| --- | --- | --- |
| Suites SIG latinoamericanas (Kawak, ISOTools, Isolución) | Módulos por proceso del SIG; control documental con versiones, flujos de aprobación y control de cambios; mapa de procesos como punto de entrada; indicadores con semáforo; auditorías; CAPA; riesgos; formación; proveedores; encuestas y quejas. | Rigidez (ajustes requieren desarrollo pagado), tableros débiles, carga de matrices complicada. → Todo configurable por empresa, importación desde Excel, tableros fuertes. |
| Automatización de cumplimiento (Vanta, Drata) | Marco de controles unificado con mapeo entre normas; recolección automática de evidencias y pruebas periódicas de controles; Declaración de Aplicabilidad generada desde los controles reales; integraciones. | Enfoque solo en seguridad y nube pública, costo por norma. → Cubrir calidad e IA, y funcionar on-premise. |
| GRC de código abierto (CISO Assistant, AGPLv3) | Normas descritas en un **formato abierto de librería** (archivo de datos versionado) que se importa sin tocar código; normas personalizadas; mapeo automático entre marcos; campañas de auditoría; API primero; MCP. | — → Inspirarse en el diseño **sin copiar código** (licencia AGPL). Antes de importar cualquier librería de terceros, verificar su licencia y registrar un ADR. |

### 2.5 Restricción legal sobre el texto de las normas

El texto de las normas ISO tiene derechos de autor. **El sistema no debe incluir el texto de las normas.** Las librerías de normas guardan solo: identificador de cláusula o control, título breve, una guía redactada por SynapTech con palabras propias, y el mapeo. Cada empresa usa su ejemplar adquirido de la norma como referencia. Este punto lo verifica el subagente `revisor-cumplimiento`.

### 2.6 Módulos funcionales previstos (para fases posteriores a la Fase 0)

Guarda esta lista en `docs/producto/vision.md` en el paso 0.1. Se construyen después de la Fase 0, cada uno con `/spec`.

| Fase | Módulo | Contenido mínimo |
| --- | --- | --- |
| 1 | Normas y requisitos | Librerías de normas en formato abierto (YAML/JSON con esquema), versiones de norma, importación, normas personalizadas. |
| 1 | Proyectos de certificación | Etapas E0–E8, plan de trabajo, avance, tablero por norma. |
| 1 | Diagnóstico | Autoevaluación por requisito, madurez, generación del plan desde las brechas. |
| 2 | Controles y evidencias | Marco unificado, mapeo muchos a muchos, evidencias con vigencia y responsable, alertas de vencimiento, Declaración de Aplicabilidad exportable. |
| 2 | Documentos | Control documental: versiones, estados (borrador, revisión, aprobado, obsoleto), aprobación, distribución, lectura confirmada, retención. |
| 2 | Riesgos y oportunidades | Metodología configurable, matriz, tratamiento, riesgo residual, vínculo con controles; activos de información. |
| 3 | Auditorías | Programa anual, plan, listas de verificación desde los requisitos, hallazgos, auditorías combinadas, auditor externo con acceso de solo lectura limitado en el tiempo. |
| 3 | No conformidades y CAPA | Origen (auditoría, queja, incidente, indicador), causa raíz (5 porqués, Ishikawa), acciones, verificación de eficacia. |
| 3 | Indicadores y objetivos | Fichas, metas, semáforo, tendencias, vínculo con objetivos y procesos. |
| 3 | Revisión por la dirección | Entradas obligatorias armadas automáticamente desde los demás módulos, acta, decisiones y acciones. |
| 4 | Gobierno de IA (42001) | Inventario de sistemas de IA, evaluación de impacto, ciclo de vida, proveedores de IA. |
| 4 | Certificación externa y ciclo | Organismo certificador, auditorías Etapa 1/2, seguimientos, recertificación, transición de edición, calendario con alertas. |
| 4 | Apoyo | Partes interesadas, requisitos legales (incluida LOPDP), competencias y formación, proveedores, comunicación. |
| 5 | Monitoreo continuo | Conectores que recogen evidencias y prueban controles automáticamente (Keycloak, GitHub, etc.). |
| Transversal | Asistente de IA | Redactar borradores de documentos y políticas, sugerir evidencias para un requisito, resumir hallazgos, proponer causa raíz; siempre como borrador que aprueba un humano. |

---

## 3. Reglas de trabajo

1. Ejecuta **un paso a la vez**. Al final de cada paso entrega el reporte (sección 8) y espera la palabra **"aprobado"** antes de seguir.
2. **Dentro de un paso trabaja de corrido**, sin pedir confirmación por cada comando seguro: en el paso 0.3 configura `.claude/settings.json` con una lista de permisos que autorice lectura, edición en el repositorio, `pnpm`, `nx`, `git` (excepto `push` a `main`), `docker compose` y las pruebas. Pide aprobación solo para lo listado en la regla 7.
3. Diseña en **modo plan** antes de editar archivos al inicio de cada paso; muestra el plan y continúa salvo que el plan cambie una decisión ya aprobada.
4. Mantén `docs/fase0/estado.md` (paso actual, decisiones, pendientes, próximos pasos). **Al iniciar cualquier sesión, léelo primero.** Actualízalo al terminar cada paso.
5. Registra cada decisión como ADR en `docs/adr/` (formato MADR breve).
6. Si falta información, pregunta; no supongas. Agrupa las preguntas en un solo mensaje.
7. **Nunca** sin aprobación explícita: commits directos a `main`, secretos en el código, dependencias con licencia no permitida (ver 5.9) sin ADR de excepción, comandos destructivos (`rm -rf`, `docker system prune`, borrar volúmenes, `git reset --hard`, `git push --force`), accesos a producción.
8. Todo debe funcionar igual en **Windows y macOS**.
9. **Presupuesto de recursos** (máquina de 8 GB y ~36 GB de disco): el ambiente diario no debe superar ~4 GB de RAM en contenedores. Los servicios pesados (observabilidad completa, Ollama, Storybook) van en perfiles de Docker Compose que se encienden solo cuando se necesitan. Antes de descargar imágenes o modelos grandes, informa su tamaño. Mide y reporta el consumo al cierre de los pasos 0.2, 0.6 y 0.7.
10. **Progreso visible:** cada paso termina con algo que el responsable puede abrir y ver (una URL local, un reporte, una pantalla) y la instrucción exacta para verlo.

---

## 4. Preguntas de arranque (`/fase0-inicio`)

Haz solo estas preguntas, en un único mensaje, antes del paso 0.1:

1. Nombre de código definitivo del producto (si no, se mantiene `sig-iso`).
2. Destino del primer despliegue: solo local por ahora, un servidor on-premise de SynapTech o una nube privada (indicar cuál).
3. Revisores humanos de los PR (además del responsable).
4. URL del repositorio GitHub (si ya existe) o autorización para crearlo.
5. ¿Ollama corre en esta misma Mac o en otro equipo de la red? (En 8 GB se recomienda otro equipo o un modelo pequeño de ~3B parámetros.)

---

## 5. Base técnica

> En el paso 0.1, guarda esta sección completa en `docs/fase0/base-tecnica.md`; desde entonces, `CLAUDE.md` enlaza a ese archivo en lugar de repetirlo.

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

**Skills** (`.claude/skills/<nombre>/SKILL.md`, cada uno con descripción de cuándo usarlo, pasos y ejemplo):

| Skill | Para qué |
| --- | --- |
| modulo-hexagonal | Crear un módulo nuevo con las cuatro capas, su `CLAUDE.md`, la prueba de aislamiento entre empresas y la instrumentación OpenTelemetry |
| migracion-rls | Escribir una migración de PostgreSQL con su política RLS por empresa y la prueba que la verifica |
| libreria-normas | Crear o actualizar una librería de norma en YAML válida contra el esquema, sin texto de la norma (2.5) |
| endpoint-contrato | Agregar un endpoint partiendo del contrato OpenAPI y regenerar el cliente web |

**Comandos** (`.claude/commands/`, cada uno con rol, contexto a leer, pasos, formato de salida y criterio de "terminado"): `/fase0-inicio`, `/estado` (resume `estado.md` y el siguiente paso), `/spec`, `/plan`, `/tasks`, `/implement`, `/review`, `/adr`.

### 5.9 Regla de licencias

Preferir MIT, Apache 2.0, BSD o MPL. AGPL solo para componentes usados sin modificar como servicio aparte (por ejemplo Grafana). No copiar código AGPL dentro del producto. BSL, SSPL o "source-available" requieren ADR de excepción. CI verifica licencias de dependencias nuevas.

---

## 6. Pasos de la Fase 0

### 0.1 Decisiones fundacionales (sin código)
- **Objetivo:** cerrar decisiones en una sola sesión.
- **Actividades:** ejecutar `/fase0-inicio`; redactar los ADRs 001–021 en lote (breves); glosario del dominio ISO (requisito, control, evidencia, hallazgo, no conformidad mayor/menor, observación, Declaración de Aplicabilidad, Etapa 1/2, seguimiento, recertificación); modelo de dominio inicial (diagrama de entidades en Mermaid: Norma, Edición, Requisito, Control, Mapeo, Evidencia, Proceso, Riesgo, Documento, Auditoría, Hallazgo, NoConformidad, Acción, Indicador, ProyectoCertificación, EtapaCertificación, OrganismoCertificador, SistemaIA).
- **Archivos:** `docs/adr/001…021-*.md`, `docs/fase0/base-tecnica.md`, `docs/fase0/estado.md`, `docs/producto/vision.md` (sección 2 completa), `docs/producto/glosario.md`, `docs/producto/modelo-dominio.md`.
- **Entregable visible:** índice de ADRs y diagrama de dominio renderizable.
- **Criterio de salida:** el responsable aprueba ADRs, visión y modelo de dominio; el subagente `experto-iso` no reporta errores de concepto.

### 0.2 Repositorio y esqueleto que corre
- **Objetivo:** ver la aplicación en el navegador al final del paso.
- **Actividades:** monorepo Nx + pnpm; `apps/api` (NestJS con `/health` y OpenAPI), `apps/web` (Next.js con página de inicio), `apps/worker` vacío; módulo de ejemplo `modules/normas` con las cuatro capas; límites activos; `infra/compose/` con PostgreSQL y Valkey (perfil base); `.gitattributes`, `.editorconfig`, `.env.example`; scripts `pnpm dev`, `pnpm test`, `pnpm lint` en Node.
- **Entregable visible:** `pnpm dev` y abrir `http://localhost:3000` (web) y `http://localhost:3001/docs` (OpenAPI).
- **Criterio de salida:** build, lint y test en verde en macOS y en Windows (o en CI con matriz `macos-latest` y `windows-latest`); consumo de RAM reportado.

### 0.3 Context engineering
- **Objetivo:** que Claude Code trabaje con las reglas de SynapTech sin repetírselas.
- **Actividades:** `CLAUDE.md` raíz y por carpeta; `.claude/settings.json` con permisos (sección 3, regla 2) y la sección `hooks` que llama a scripts Node en `.claude/hooks/`; los 8 subagentes en `.claude/agents/`; los 4 skills en `.claude/skills/`; los 8 comandos en `.claude/commands/`. Todo se versiona en git (solo `settings.local.json` va en `.gitignore`).
- **Entregable visible:** (1) inventario en el reporte con la ruta de cada subagente, skill, comando y hook; (2) salida de `/agents` y `/hooks` mostrando lo creado; (3) demostración: `/spec` + `/implement` de un módulo trivial de prueba (por ejemplo "catálogo de procesos") generado con el skill `modulo-hexagonal` sin correcciones manuales y luego descartado.
- **Criterio de salida:** los 8 subagentes, 4 skills, 8 comandos y 4 hooks existen y están en git; el módulo de prueba pasa `/review` sin hallazgos bloqueantes; un hook bloquea un intento de editar `.env`.

### 0.4 Pipeline y calidad
- **Actividades:** GitHub Actions con lint, tipos, pruebas con cobertura mínima (80 % en dominio), Semgrep CE, OSV-Scanner, gitleaks, Trivy, SBOM CycloneDX, verificación de licencias, validación del esquema de librerías de normas, axe; protección de rama `main`; artefactos del pipeline archivados como evidencia (P13).
- **Entregable visible:** un PR de prueba que viola una regla (secreto falso o dependencia AGPL) queda bloqueado.
- **Criterio de salida:** ese PR bloqueado y un PR correcto en verde.

### 0.5 Look and feel
- **Actividades:** preguntar lo pendiente de 5.6; guía de estilo; tokens; componentes base y de dominio; cinco pantallas plantilla; tematización por empresa con verificación de contraste.
- **Entregable visible:** Storybook (perfil `design`) y las pantallas en `http://localhost:3000`.
- **Criterio de salida:** aprobación del responsable y prueba de contraste en verde para dos empresas con colores distintos.

### 0.6 Plataforma transversal + corte vertical mínimo
- **Actividades:** Keycloak en Compose (realm de desarrollo importado desde archivo), inicio de sesión OIDC en web y API; resolución de empresa; RLS; OpenFGA con los roles de ADR 008; bitácora de auditoría inmutable (P15); OpenTelemetry; flags. **Corte vertical:** cargar una librería de ejemplo `libraries/normas/ejemplo-estructura-armonizada.yaml` (cláusulas 4–10 con títulos breves y guía propia) y mostrarla en una pantalla de listado por empresa.
- **Entregable visible:** dos empresas de prueba; el usuario de la empresa A inicia sesión y ve solo su información y su configuración de marca.
- **Criterio de salida:** prueba automatizada de aislamiento entre las dos empresas en verde; la bitácora registra el inicio de sesión y la carga de la librería; consumo de RAM reportado.

### 0.7 Puerto de IA
- **Actividades:** `AsistentePort` en el dominio; LiteLLM (perfil `ai`); Ollama local o remoto según la respuesta 4.5; un segundo proveedor configurable (otro modelo local o uno externo deshabilitado por defecto); catálogo; política por empresa; selección por usuario; medición; marca "borrador generado por IA".
- **Caso de uso de prueba:** "Explica con palabras propias qué evidencia típica demuestra el requisito seleccionado" sobre la librería de ejemplo.
- **Entregable visible:** botón en la pantalla del corte vertical que responde con el modelo elegido.
- **Criterio de salida:** el mismo caso de uso responde con dos modelos distintos sin cambiar código; la llamada queda medida y registrada sin datos sensibles.

### 0.8 Infraestructura como código
- **Actividades:** chart Helm de la aplicación validado con `helm lint` y `helm template`; módulos OpenTofu para el destino indicado en 4.2; manifiestos de Argo CD preparados. Si el destino es "solo local", dejar esto preparado y validado, sin levantar clúster.
- **Entregable visible:** `pnpm infra:up` recrea el ambiente local desde cero (volúmenes nuevos, realm, datos semilla).
- **Criterio de salida:** ambiente recreado con un comando; chart válido.

### 0.9 Seguridad y cumplimiento
- **Actividades:** modelo de amenazas STRIDE; clasificación de datos; registro de actividades de tratamiento (LOPDP); política de uso de IA; política de derechos de autor de normas (2.5); **mapeo de lo construido en la Fase 0 a controles de ISO 27001 Anexo A y de ISO 42001 Anexo A** (como primer insumo del propio SIG de SynapTech).
- **Archivos:** `docs/security/stride.md`, `clasificacion-datos.md`, `registro-lopdp.md`, `politica-ia.md`, `mapeo-controles-fase0.md`.
- **Criterio de salida:** paquete listo para una due diligence y revisado por `revisor-seguridad` y `revisor-cumplimiento`.

---

## 7. Criterio de salida de la Fase 0

El esqueleto caminante funciona en web con el look and feel aprobado: un usuario inicia sesión con SSO de Keycloak, ve solo los datos y la marca de su empresa, consulta la librería de ejemplo de normas, pide ayuda a la IA con el modelo que eligió y todo queda en la bitácora de auditoría y trazado con OpenTelemetry; el cambio pasó por el pipeline con todos los controles en verde; el ambiente se recrea con un comando; y el consumo diario cabe en la máquina de 8 GB.

---

## 8. Formato del reporte de paso

Al cerrar cada paso entrega, en este orden:

1. **Qué se hizo** (3–6 líneas).
2. **Cómo verlo** (comando y URL exactos).
3. **Archivos creados o cambiados** (lista de rutas).
4. **Pruebas y controles ejecutados** con su resultado.
5. **Consumo** de RAM y disco (en los pasos 0.2, 0.6 y 0.7).
6. **Decisiones tomadas** (con enlace al ADR).
7. **Riesgos o pendientes.**
8. **Qué necesito de ti** (o "nada; responde *aprobado* para seguir con el paso X").
