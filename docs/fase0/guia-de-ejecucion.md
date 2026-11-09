# Guía de ejecución local — sig-iso

Cómo levantar, probar y apagar el sistema en el Mac (sin Docker, ADR 022). Los nombres de variables están en `variables-de-entorno.md`; el acceso a la base, en `acceso-a-la-base-de-datos.md`.

## Requisitos

- macOS, Node 22 LTS, pnpm (ADR 003), PostgreSQL 16 de Homebrew en marcha (`pg_isready`).
- Keycloak 26.8.2 y su JRE viven en `.local/` (ignorado por git). OpenFGA está instalado pero **pospuesto** (ADR 029): no hace falta arrancarlo.

## Primera vez

```
pnpm install
pnpm db:init          # roles y bases sigiso, sigiso_test, openfga; genera .env.local
pnpm db:migrate       # migraciones 0001–0005
pnpm db:seed          # empresas A y B y cuatro cuentas de prueba
pnpm libraries:load   # librería de ejemplo 0.1.0 (borrador)
pnpm keycloak:install # pide confirmación antes de descargar
```

Las contraseñas de las cuentas de prueba las genera el realm y quedan en `.local/secretos-keycloak.json` (ignorado). Nunca se escriben en archivos versionados.

## Uso diario

```
pnpm keycloak:start   # http://127.0.0.1:8080/realms/sigiso
pnpm dev              # web http://localhost:3000 · API http://localhost:3001/docs
```

Ingreso: `http://localhost:3000/e/a/ingreso` (empresa A, verde) o `/e/b/ingreso` (empresa B, azul). La aplicación no pide contraseña: redirige a Keycloak.

Para apagar: `Ctrl+C` en `pnpm dev` y `pnpm keycloak:stop`.

## Verificaciones

| Comando                            | Qué comprueba                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm keycloak:verify`             | Realm, mensaje genérico de credenciales inválidas, clientes deshabilitados          |
| `pnpm web:verify-login`            | Ingreso OIDC real con PKCE, `state`, emisor e `id_token` (Keycloak y web en marcha) |
| `pnpm web:verify-listado`          | Listado real de requisitos y aislamiento entre empresas (todo en marcha)            |
| `pnpm lint` · `typecheck` · `test` | Controles del CI, incluidos los límites de módulos y capas                          |
| `pnpm test:hooks`                  | Reglas del hook de Bash de Claude Code                                              |
| `pnpm ram:report`                  | Memoria de la pila (ver la advertencia de abajo)                                    |

## Consumo de memoria (medido 2026-11-09, Mac de 8 GB)

Pila completa en marcha (PostgreSQL, Keycloak, API y web), tras ejecutar `web:verify-login` y `web:verify-listado`, con `pnpm ram:report`:

| Componente    |  Procesos |       MB |
| ------------- | --------: | -------: |
| PostgreSQL    |        10 |    248,5 |
| Keycloak (JVM)|         1 |    444,0 |
| API (NestJS)  |         5 |    119,9 |
| Web (Next.js) |         6 |    618,0 |
| **Total**     |           | **1.430** |

Presupuesto del ADR 007: ~4 GB. La pila usa el 35 % y cabe con holgura (OpenFGA, cuando se use, suma ~53 MB). Es medición en modo desarrollo; `next dev` pesa más que una compilación de producción.

En macOS `ram:report` mide la **huella real** (`footprint`, `phys_footprint`), que incluye la memoria comprimida. El RSS subestima a los procesos inactivos: en la primera medición la JVM de Keycloak aparecía con 14 MB y su huella real es de ~440 MB. En otras plataformas se mide RSS, que es una cota superior (cuenta varias veces la memoria compartida).

## Problemas conocidos

- `GITHUB_TOKEN` inválido en `~/.zshrc`: usa `env -u GITHUB_TOKEN gh …` y `env -u GITHUB_TOKEN git push …`.
- Si `gh` o `git` fallan con errores de TLS, revisa VPN, proxy, antivirus y el reloj del sistema.
- El hook de Bash de Claude Code evalúa el texto completo del comando y puede dar falsos positivos (registrado como B6).
