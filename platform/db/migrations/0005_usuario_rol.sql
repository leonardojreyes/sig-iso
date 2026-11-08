-- 0005 — Rol de la persona dentro de su empresa (ADR 029: autorización por rol desde la base).
-- Un rol por persona y empresa. Nulo = sin permisos (cerrado por defecto). Los valores son los del catálogo de
-- `platform/autorizacion` (ADR 008); los permisos de cada rol viven en la matriz del código, no aquí.

alter table usuario
  add column rol text
  check (rol is null or rol in ('administrador_sig', 'dueno_proceso', 'auditor_interno', 'auditor_externo', 'colaborador', 'alta_direccion'));

-- La aplicación no puede asignarse ni cambiar roles: el INSERT pasa a ser por columnas (sin `rol`) y el UPDATE ya era
-- solo de nombre y correo. Quien asigna roles es el dueño (siembra y mantenimiento) hasta que exista la pantalla de
-- administración, que lo hará con un permiso propio y dejando `rol.cambiado` en la bitácora (regla 4).
revoke insert on usuario from sigiso_app;
grant insert (id, empresa_id, nombre, correo) on usuario to sigiso_app;
