# modules/asistente — puerto de IA (paso 0.7)

Explica con palabras propias qué ejemplos de evidencia suelen respaldar un requisito, con el modelo que la empresa permite.
Spec, plan y tareas: `docs/specs/puerto-ia-0-7/`. ADR 030 (modelo por defecto, Ollama directo).

- **Capas:** `domain` (modelo, política efectiva) · `application` (casos de uso y puertos) · `infrastructure` (adaptador del gateway y Kysely). Los controladores viven en `apps/api`.
- **No importa `modules/normas`:** el requisito llega por `RequisitoPort`, cuyo adaptador se arma en `apps/api`. Los puertos de autorización, flags y unidad de trabajo se redeclaran aquí.
- **La IA entra solo por `AsistentePort`** (regla 5). La llamada al modelo va **fuera de toda transacción**.
- **Prompts:** `@sig/prompts`. La respuesta se revisa con `revisarRespuestaIa` de `@sig/normas-schema` (cero coincidencias).
- **Permiso:** `ia.usar`. **Bitácora:** `ia.consulta` (nunca el texto enviado ni el recibido); la falta de permiso va como `acceso.denegado`.
- **Multiempresa:** política y modelos permitidos son datos de empresa (RLS); el catálogo de modelos es global y de solo lectura.
- Recorte aprobado: sin preferencia por persona, sin consumo por empresa y sin LiteLLM (Fase 1).
