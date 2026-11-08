# Variables de entorno — sig-iso

Fuente de verdad de los **nombres**. La plantilla es `.env.example` (sin valores secretos). Los valores reales viven en `.env.local`, que **no** se versiona (regla 9). Los secretos de desarrollo los **genera** `pnpm db:init` y `scripts/keycloak-dev.mjs`; nunca se escriben a mano en archivos versionados.

## Reglas

- Un secreto jamás va en el código, en una plantilla ni en un ADR.
- Los valores por defecto de esta tabla son **no secretos** (puertos, anfitriones locales). Una variable marcada _secreto_ va vacía en `.env.example`.
- Todo servicio escucha solo en `127.0.0.1` en desarrollo.

## Aplicación

| Variable     | Secreto | Por defecto             | Uso                                                | Tarea     |
| ------------ | ------- | ----------------------- | -------------------------------------------------- | --------- |
| `API_PORT`   | no      | `3001`                  | Puerto de la API                                   | existente |
| `WEB_PORT`   | no      | `3000`                  | Puerto de la web                                   | existente |
| `WEB_ORIGIN` | no      | `http://localhost:3000` | Origen permitido (CORS y verificación de `Origin`) | 6.x, 10.4 |

## Base de datos (PostgreSQL 16)

Una URL por rol; cada rol tiene un permiso distinto (plan, «Modelo de datos»).

| Variable                  | Secreto | Uso                                              | Tarea    |
| ------------------------- | ------- | ------------------------------------------------ | -------- |
| `DATABASE_URL_OWNER`      | sí      | Migraciones (`sigiso_owner`); nunca en ejecución | 1.5, 2.4 |
| `DATABASE_URL_APP`        | sí      | API en ejecución (`sigiso_app`)                  | 1.5, 2.2 |
| `DATABASE_URL_CATALOGO`   | sí      | Carga del catálogo (`sigiso_catalogo`)           | 1.5, 4.5 |
| `DATABASE_URL_PLATAFORMA` | sí      | Hechos sin empresa (`sigiso_plataforma`)         | 1.5, 3.5 |
| `DATABASE_URL_TEST`       | sí      | Base `sigiso_test` para pruebas de integración   | 1.5, 2.3 |

> `DATABASE_URL_TEST` usa `sigiso_owner` sobre `sigiso_test`. Los cuatro roles tienen la misma clave en `sigiso` y en `sigiso_test`, así que las pruebas derivan la URL de `sigiso_app` cambiando solo la base. `pnpm db:init` crea además `sigiso_openfga` (dueño de la base `openfga`, ver `OPENFGA_DATASTORE_URI`).

| `PGHOST` / `PGPORT`       | no      | `127.0.0.1` / `5432`                             | 1.5      |

## Identidad (Keycloak)

| Variable                                                      | Secreto | Por defecto                           | Uso                                                 | Tarea     |
| ------------------------------------------------------------- | ------- | ------------------------------------- | --------------------------------------------------- | --------- |
| `OIDC_ISSUER_URL`                                             | no      | `http://127.0.0.1:8080/realms/sigiso` | Emisor de los tokens                                | 6.1, 6.2, 10.2 |
| `OIDC_CLIENT_ID`                                              | no      | `sigiso-web`                          | Cliente confidencial de la web                      | 10.2      |
| `OIDC_AUDIENCE`                                               | no      | `sigiso-api`                          | Audiencia propia de la API (mapper en Keycloak)     | 6.2, 8.4  |
| `OIDC_JWKS_URL`                                               | no      | `<emisor>/protocol/openid-connect/certs` | Claves públicas para verificar la firma           | 6.2       |
| `CORS_ORIGINS`                                                | no      | vacío (ningún origen)                 | Orígenes exactos que pueden llamar a la API desde un navegador, separados por comas; la web llama desde su servidor (ADR 027) | 6.2       |
| `RATE_LIMIT_PERSONA`                                          | no      | `120`                                 | Solicitudes por minuto de cada persona (1 a 100000) | 6.8       |
| `RATE_LIMIT_EMPRESA`                                          | no      | `600`                                 | Solicitudes por minuto de cada empresa, sumadas todas sus personas; no puede ser menor que el de una persona | 6.8       |
| `OTEL_TRACES_EXPORTER`                                        | no      | `console`                             | Exportador de trazas de la API: `console` o `none` (nombre estándar de OpenTelemetry) | 12.1      |
| `FEATURE_ADOPCION_HABILITADA`                                 | no      | `true`                                | Interruptor (flag de OpenFeature) de la adopción de librerías: `true` o `false`; apagado, la adopción responde 404 | 12.2      |
| `OIDC_CLIENT_SECRET`                                          | sí      | —                                     | Secreto del cliente (lo genera `keycloak-dev`)      | 8.3 |
| `OIDC_REDIRECT_URI`                                           | no      | `http://localhost:3000/auth/callback` | Retorno del flujo de código                         | 10.2      |
| `SESSION_SEALING_KEY`                                         | sí      | —                                     | Clave (32 bytes en base64url) que sella las cookies de la web; la genera `pnpm keycloak:realm` una vez | 10.2, 10.3 |
| `SESSION_SEALING_KEY_PREVIOUS`                                | no      | —                                     | Clave anterior, solo para abrir sellos viejos al rotar | 10.2      |
| `API_URL`                                                    | no      | `http://127.0.0.1:3001`               | Dirección de la API que usa el servidor de la web (registro de inicio y cierre de sesión) | 10.3      |
| `SESSION_IDLE_MINUTES`                                        | no      | `30`                                  | Inactividad máxima (Q4, provisional)                | 10.4      |
| `KEYCLOAK_PORT`                                              | no      | `8080`                                | Puerto local de Keycloak (siempre en 127.0.0.1)     | 8.4       |
| `KEYCLOAK_HOME`                                               | no      | `.local/keycloak`                     | Carpeta ignorada con la instalación                 | 8.2       |
| `KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD`             | sí      | —                                     | Administrador inicial (generado)                    | 8.4       |
| `KEYCLOAK_EVENTS_CLIENT_ID` / `KEYCLOAK_EVENTS_CLIENT_SECRET` | sí      | —                                     | Cuenta de servicio con `view-events` para el worker | 11.1      |

## Autorización (OpenFGA)

| Variable                                | Secreto | Por defecto             | Uso                                               | Tarea |
| --------------------------------------- | ------- | ----------------------- | ------------------------------------------------- | ----- |
| `OPENFGA_API_URL`                       | no      | `http://127.0.0.1:8081` | API de OpenFGA                                    | 9.3   |
| `OPENFGA_STORE_ID` / `OPENFGA_MODEL_ID` | no      | —                       | Identificadores tras crear el almacén y el modelo | 9.2   |
| `OPENFGA_DATASTORE_URI`                 | sí      | —                       | Base `openfga`                                    | 9.1   |

## Observabilidad y flags

| Variable        | Secreto | Por defecto | Uso                                       | Tarea |
| --------------- | ------- | ----------- | ----------------------------------------- | ----- |
| `OTEL_EXPORTER` | no      | `console`   | Exportador de trazas (`console` o `none`) | 12.1  |

## Pendiente de definir

- Ubicación del **ancla** del último valor de la cadena de la bitácora (H6.6): se define en la tarea 3.3.
