-- 0016 — La aplicación solo crea solicitudes PENDIENTES (revisión del hito M7, ADR 036).
-- La 0015 le dio `insert` sobre TODA la tabla `solicitud_acceso`: un fallo en cualquier módulo habría podido insertar una solicitud ya
-- «aprobada», con `resuelta_en` y `resuelta_por`. Ahora solo puede fijar los datos de una solicitud nueva; el estado nace «pendiente» y
-- las columnas de resolución solo se llenan con el `update` por columnas de la 0015 (estado, resuelta_en, resuelta_por).
revoke insert on solicitud_acceso from sigiso_app;
grant insert (id, empresa_id, usuario_id, codigo, creada_en, vence_en) on solicitud_acceso to sigiso_app;
