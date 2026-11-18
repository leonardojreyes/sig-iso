-- 0020 — Mínimo privilegio por columnas en los riesgos, los motivos y las referencias (revisión del hito de la Declaración justificada).
-- La 0017 y la 0018 daban a la aplicación UPDATE sobre la tabla entera: podría reescribir la autoría (`creado_por`, `creado_en`) o el
-- correlativo (`numero`) de un riesgo, o la autoría de un motivo. Ahora solo puede cambiar lo que la aplicación realmente cambia.
-- DELETE de los motivos y las referencias sigue permitido (se quitan con rastro en la bitácora); el de los riesgos nunca lo tuvo.

revoke update on riesgo from sigiso_app;
grant update (titulo, descripcion, probabilidad, impacto, decision, responsable_id, estado, version, actualizado_por, actualizado_en) on riesgo to sigiso_app;

revoke update on motivo_inclusion from sigiso_app;
grant update (nota, version, actualizado_por, actualizado_en) on motivo_inclusion to sigiso_app;

revoke update on referencia_tratamiento from sigiso_app;
grant update (titulo, version_doc, fecha, ubicacion, version, actualizado_por, actualizado_en) on referencia_tratamiento to sigiso_app;
