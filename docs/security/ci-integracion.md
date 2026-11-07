# Trabajo de CI `integracion`

Corre en cada pull request (`.github/workflows/ci.yml`). Ejecuta las pruebas que necesitan **PostgreSQL 16 real**: aislamiento entre empresas (regla 2), RLS, privilegios de los roles y migraciones.

## Qué hace

1. Levanta PostgreSQL 16 como servicio efímero del runner (sin contraseña; no es accesible desde fuera).
2. `pnpm db:init` crea los roles y las bases; `pnpm db:migrate` y `pnpm db:migrate:test` aplican las migraciones.
3. Corre las pruebas de `platform/db` con cobertura (umbral del 80 %) y las de `scripts`.
4. **Falla si alguna prueba quedó omitida**, para que un PostgreSQL ausente no produzca un «verde» falso.

En macOS y Windows (`verificar`) no hay PostgreSQL: allí las pruebas de integración se omiten y el umbral de cobertura de `platform/db` no se exige; se exige en este trabajo.

## Reproducirlo en local sin tocar tu base

Pruebas unitarias solamente, como en macOS y Windows:

```
SIGISO_SIN_BASE=1 PGPORT=1 pnpm test:cov
```

## Agregarlo como check obligatorio (acción del responsable)

Primero debe haberse ejecutado al menos una vez en un PR. El comando **agrega** el check sin quitar los existentes:

```
env -u GITHUB_TOKEN gh api -X POST repos/leonardojreyes/sig-iso/branches/main/protection/required_status_checks/contexts -f 'contexts[]=integracion'
```

Para comprobarlo:

```
env -u GITHUB_TOKEN gh api repos/leonardojreyes/sig-iso/branches/main/protection/required_status_checks --jq '.contexts'
```

Debe incluir `integracion` junto a `verificar (macos-latest)`, `verificar (windows-latest)`, `gitleaks`, `semgrep`, `osv-scanner y licencias` y `trivy y SBOM CycloneDX`.
