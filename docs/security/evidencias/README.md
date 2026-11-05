# Evidencias del pipeline (principio P13)

Cada ejecución de `seguridad.yml` sube sus resultados (gitleaks, Semgrep, OSV, Trivy, SBOM CycloneDX) como artefactos `evidencia-*` con retención de 90 días. Para archivar una ejecución como evidencia permanente del SIG de SynapTech:

```
gh run download <id-de-ejecucion> -D docs/security/evidencias/AAAA-MM-DD
```

Luego se versiona por PR. Mapeo a controles: ver `docs/security/mapeo-controles-fase0.md` (paso 0.9).
