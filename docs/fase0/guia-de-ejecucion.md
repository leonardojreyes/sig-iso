# Guía de ejecución local — sig-iso

Cómo levantar, probar y apagar el sistema en el Mac (sin Docker, ADR 022) y qué puede hacer cada cuenta de prueba. Los nombres de variables están en `variables-de-entorno.md`; el acceso a la base, en `acceso-a-la-base-de-datos.md`. El estado del proyecto, en `estado.md`.

## Requisitos

- macOS, Node 22 LTS, pnpm (ADR 003), PostgreSQL 16 de Homebrew en marcha (`pg_isready`).
- Keycloak 26.8.2 y su JRE viven en `.local/` (ignorado por git). OpenFGA está instalado pero **pospuesto** (ADR 029): no hace falta arrancarlo.

## Primera vez

```
pnpm install
pnpm db:init           # roles y bases sigiso, sigiso_test, openfga; genera el archivo de entorno local
pnpm db:migrate        # migraciones 0001–0013
pnpm db:seed           # empresas A y B, cinco cuentas y la pertenencia del consultor a B
pnpm libraries:load    # librería de ejemplo y Anexo A de ISO/IEC 27001:2022 (v1.0.0) en el catálogo global
pnpm keycloak:install  # pide confirmación antes de descargar
pnpm keycloak:realm    # genera el realm y las contraseñas (ver abajo)
```

Las contraseñas de las cuentas de prueba las genera `pnpm keycloak:realm` y quedan en `.local/secretos-keycloak.json` (ignorado). Nunca se escriben en archivos versionados.

## Uso diario

```
pnpm keycloak:start    # http://127.0.0.1:8080/realms/sigiso
pnpm dev               # web http://localhost:3000 · API http://localhost:3001/docs
```

Se ingresa por `http://localhost:3000/e/empresa-a/ingreso` (Empresa A) o `/e/empresa-b/ingreso` (Empresa B). La aplicación no pide contraseña: redirige a Keycloak. Para apagar: `Ctrl+C` en `pnpm dev` y `pnpm keycloak:stop`.

## Cuentas de prueba

| Cuenta      | Empresa de origen | Rol                                                     |
| ----------- | ----------------- | ------------------------------------------------------- |
| `admin-a`   | A                 | administrador SIG                                       |
| `colab-a`   | A                 | colaborador                                             |
| `admin-b`   | B                 | administrador SIG                                       |
| `colab-b`   | B                 | colaborador                                             |
| `consultor` | A                 | **administrador SIG en A y colaborador en B** (ADR 035) |

**Entrar y salir:** al ingresar, el consultor ve una pantalla «¿Con qué empresa va a trabajar?» y elige; las demás cuentas entran directo a su empresa. En la cabecera de cada pantalla hay un botón **«Cerrar sesión»** (si la cuenta tiene varias empresas, también el selector para cambiar). Para cambiar de cuenta, cierra sesión y vuelve a ingresar.

El consultor es **una sola cuenta** que pertenece a las dos empresas y cambia entre ellas con el selector de la cabecera. En cada empresa manda **su** rol: en B no puede subir librerías ni aprobar la declaración. Si el consultor aún no existe en tu Keycloak, créalo **sin borrar nada**: `pnpm keycloak:realm`, `pnpm keycloak:cuentas` y `pnpm db:seed`. (`pnpm keycloak:reset` borra la base de Keycloak: solo si de verdad quieres empezar de cero.)

## Qué hay en cada pantalla (`/e/<empresa>/…`)

| Ruta          | Qué hace                                                                                              | Quién cambia datos        |
| ------------- | ----------------------------------------------------------------------------------------------------- | ------------------------- |
| `requisitos`  | Requisitos de las librerías adoptadas; adoptar una librería                                           | administrador SIG adopta  |
| `normas`      | Subir **librerías propias** (YAML) con archivos o carpeta, plantilla descargable, errores explicados  | administrador SIG         |
| `marca`       | Color y logo de la empresa (se ajusta solo si no cumple el contraste AA)                              | administrador SIG         |
| `alcance`     | Alcance por norma, con aprobación                                                                     | según permiso             |
| `diagnostico` | Estado por cláusula y control, madurez                                                                | según permiso             |
| `controles`   | Controles de la empresa, mapeos con las normas y **evidencias con archivo**                           | según permiso             |
| `cobertura`   | Qué entradas de la norma cubren los controles y las evidencias vigentes                               | solo lectura              |
| `declaracion` | **Declaración de Aplicabilidad**: borrador, aprobar (versión congelada), historial y descarga en Word | administrador SIG aprueba |

La librería de una empresa (`normas`) se sube como YAML con el esquema v3, sin texto de la norma, con un código que empiece por `propia-`; cada versión es inmutable. Pide la plantilla con el botón «Descargar plantilla».

## Verificaciones

Con los servicios en marcha (Keycloak, `pnpm dev`). Cada una usa cuentas reales y comprueba permisos, `Origin`, sesión y aislamiento entre empresas.

| Comando                                      | Qué comprueba                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm keycloak:verify`                       | Realm, mensaje genérico de credenciales inválidas, clientes deshabilitados             |
| `pnpm web:verify-login`                      | Ingreso OIDC real con PKCE, `state`, emisor e `id_token`                               |
| `pnpm web:verify-aislamiento`                | Aislamiento por URL y por API; bitácora encadenada e inmutable                         |
| `pnpm web:verify-diagnostico`                | Alcance y diagnóstico de punta a punta                                                 |
| `pnpm web:verify-controles`                  | Controles y mapeos                                                                     |
| `pnpm web:verify-evidencias`                 | Evidencias con archivo y cobertura                                                     |
| `pnpm web:verify-declaracion`                | Declaración: derivar, aprobar, versión congelada y Word                                |
| `pnpm web:verify-normas`                     | Subir librerías propias, rechazos explicados, adopción, aislamiento                    |
| `pnpm web:verify-multiempresa`               | Una cuenta en dos empresas: selector, cambio, rol por empresa, sesiones independientes |
| `pnpm web:verify-marca`                      | Editar color y logo; **restaura** la marca de A al terminar                            |
| `pnpm lint` · `typecheck` · `test` · `build` | Controles del CI, incluidos los límites de módulos y capas                             |
| `pnpm licenses:check`                        | Licencias de las dependencias (MIT/Apache/BSD/MPL)                                     |
| `pnpm test:hooks`                            | Reglas del hook de Bash de Claude Code                                                 |
| `pnpm ram:report`                            | Memoria de la pila (ver abajo)                                                         |

**Antes de correr varias verificaciones seguidas:** la API limita las peticiones por persona (120 por minuto) y por empresa (600). Si encadenas varias con las mismas cuentas sin esperar, algunas pantallas devuelven 503 y los ingresos no emiten sesión; **espera un minuto entre una y otra**. Casi todas **escriben en tu base de desarrollo** y no se puede deshacer (quedan controles `VERIF-…`, librerías `propia-verif-…`, versiones aprobadas y la bitácora, que es inmutable); `web:verify-marca` es la única que restaura lo que cambia.

Estado de las verificaciones: `web:verify-listado` espera exactamente 21 entradas y A tiene 114 desde que adoptó el Anexo A; el script está desactualizado y falla por eso (no por un defecto del sistema).

### Pruebas automáticas

`pnpm test` corre todo con la base de desarrollo si existe (las pruebas con PostgreSQL real crean y borran sus propios datos en `sigiso_test`). El CI no tiene base: `SIGISO_SIN_BASE=1 PGPORT=1 pnpm test` lo simula, pero **ojo**: `nx` carga el archivo de entorno local, así que en tu equipo esas pruebas pueden correr igualmente contra la base de pruebas. Si una prueba deja datos sin limpiar, el catálogo de `sigiso_test` crece hasta su tope de 200 librerías y otras pruebas fallan con «El catálogo supera el tope»; ya ocurrió una vez (corregido en `normas-bitacora.integration.test.ts`).

## Consumo de memoria (medido 2026-11-09, Mac de 8 GB)

Pila completa en marcha (PostgreSQL, Keycloak, API y web), con `pnpm ram:report`:

| Componente     | Procesos |        MB |
| -------------- | -------: | --------: |
| PostgreSQL     |       10 |     248,5 |
| Keycloak (JVM) |        1 |     444,0 |
| API (NestJS)   |        5 |     119,9 |
| Web (Next.js)  |        6 |     618,0 |
| **Total**      |          | **1.430** |

Presupuesto del ADR 007: ~4 GB. La pila usa el 35 % y cabe con holgura (OpenFGA, cuando se use, suma ~53 MB). Es medición en modo desarrollo; `next dev` pesa más que una compilación de producción. No se volvió a medir tras el MVP completo.

En macOS `ram:report` mide la **huella real** (`footprint`, `phys_footprint`), que incluye la memoria comprimida. El RSS subestima a los procesos inactivos. En otras plataformas se mide RSS, que es una cota superior.

## Problemas conocidos

- Si `gh` o `git` fallan con errores de TLS, revisa VPN, proxy, antivirus y el reloj del sistema.
- El hook de Bash de Claude Code evalúa el texto completo del comando y puede dar falsos positivos (registrado como B6): por ejemplo, un comando que mencione el archivo de entorno o contenga ciertas sentencias SQL de ejemplo.
- Crear una cuenta de Keycloak con la API de administración normal **ignora el identificador** que se le da (el `sub` del token ya no coincide con la persona de la base): usa `pnpm keycloak:cuentas`, que usa la importación parcial y lo respeta.
- Un `POST` multipart que el proxy de Next reescribe a «no encontrado» (otra empresa) responde 409 («Server Action unavailable»), sin datos; es una rareza de Next, no una fuga.
- Una pestaña abierta en la empresa anterior de un consultor da 404 después de cambiar de empresa en otra pestaña (la sesión ya está en la otra).
