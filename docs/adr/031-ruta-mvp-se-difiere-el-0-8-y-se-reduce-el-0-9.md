# ADR 031 — Ruta MVP: se difiere el paso 0.8 y se reduce el 0.9

- **Estado:** Aprobado (2026-11-09) por el responsable, al decidir el cambio de plan hacia un MVP
- **Fecha:** 2026-11-09
- **Decide:** Ing. Leonardo J. Reyes B.
- **Relación:** matiza los ADR 011 y 012 (quedan «Parcialmente reemplazados»: su decisión de fondo no cambia, solo el momento) y la nota de `infra:up` del ADR 022.

## Contexto

El paso 0.8 (chart Helm, módulos OpenTofu, manifiestos de Argo CD, `pnpm infra:up`) solo se puede validar de verdad con un servidor o clúster, y hoy el destino es solo local (respuesta 2 de arranque). Hoy `infra:up/down` es un `docker compose` que no se usa (ADR 022) y `infra/` no tiene `helm/` ni `opentofu/`. El paso 0.9 pide un paquete de seguridad y cumplimiento pensado para una due diligence, que hoy no tiene cliente que lo exija. El objetivo inmediato es un MVP usable por SynapTech.

## Decisión

1. **Se difiere el paso 0.8 completo** hasta el primer despliegue en servidor: Helm, OpenTofu, Argo CD y `infra:up`. Ningún código lo necesita. Los ADR 011 y 012 siguen vigentes como dirección futura.
2. **Se reduce el paso 0.9 a tres documentos breves:** STRIDE (`docs/security/stride.md`), clasificación de datos (`clasificacion-datos.md`) y política de uso de IA (`politica-ia.md`), revisados por `revisor-seguridad` y `revisor-cumplimiento`.
3. **Se difiere hasta antes del primer cliente externo:** el registro de actividades de tratamiento (LOPDP), la política de derechos de autor de las normas, el mapeo de lo construido a los controles del Anexo A de 27001 y 42001, la revisión de due diligence y la validación del asesor legal del ADR 028. La regla 3 (sin texto de normas) sigue aplicándose con el validador de contenido y `revisor-cumplimiento`.
4. **Criterio de salida de la Fase 0, enmendado:** se quita «el ambiente se recrea con un comando». Se mantiene el resto: ingreso con SSO, datos y marca solo de su empresa, consulta de la librería de ejemplo, ayuda de IA con el modelo elegido, todo en la bitácora y trazado, pipeline con todos los controles en verde y consumo dentro de la máquina de 8 GB.
5. El paso 0.7 termina en API y botón básico (recorte aprobado el 2026-11-09, ver `docs/specs/puerto-ia-0-7/`).

## Cuándo se retoma

- **0.8:** cuando haya un servidor o clúster donde desplegar (primer despliegue fuera de la Mac).
- **Lo diferido del 0.9, la muestra de calidad de la IA (ADR 030) y la ficha del asistente (42001):** antes del primer cliente externo y, en todo caso, antes de usar datos de personas reales.

## Alternativas consideradas

| Alternativa | Por qué no |
| --- | --- |
| Hacer el 0.8 «sin levantar clúster» (solo `helm lint` y `helm template`) | Validaría archivos que no se pueden probar de verdad, con costo de mantenimiento y sin cliente. |
| Hacer el 0.9 completo ahora | Es un paquete de due diligence sin cliente que lo pida; retrasa el MVP. |
| Borrar el 0.8 y el 0.9 | Se perdería el compromiso; se difieren con fecha de retoma. |

## Consecuencias

- Los scripts `infra:*` y las reglas de los hooks sobre `kubectl`, `helm` y `tofu` quedan inertes, sin cambios.
- La Fase 0 se cierra con el criterio enmendado, válido para uso interno de SynapTech. Antes de un cliente externo hay que cerrar lo diferido; queda escrito en `docs/fase0/estado.md`.

## Estándar y licencia

Sin tecnología nueva: no aplica.
