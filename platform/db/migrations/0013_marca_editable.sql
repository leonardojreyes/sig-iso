-- 0013 — La empresa edita su marca: color y logo (ADR 035, MVP M6b-2).
-- La aplicación solo podía LEER `empresa`. Ahora puede actualizar SOLO `color_primario` y `logo_url` de SU empresa (política por
-- empresa + permiso por columnas): ni el nombre, ni el slug, ni el identificador. Las reglas de forma ya están en la tabla (0001):
-- color `#RRGGBB` y logo `https://…` o ruta propia.

create policy empresa_marca_edicion on empresa
  for update to sigiso_app
  using (id = (select app_tenant_id()))
  with check (id = (select app_tenant_id()));

grant update (color_primario, logo_url) on empresa to sigiso_app;
