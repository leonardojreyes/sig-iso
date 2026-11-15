-- 0014 — El logo de la empresa solo puede ser una dirección https o un archivo de imagen bajo /logos/ (revisión de seguridad H3).
-- Antes valía cualquier ruta del propio sitio (por ejemplo la descarga de un documento): como el navegador pide el logo con la sesión de
-- cada persona, una ruta así provocaría descargas registradas a nombre de otras personas. La aplicación ya lo rechaza; esto lo
-- garantiza también la base.
alter table empresa drop constraint empresa_logo_url_check;
alter table empresa add constraint empresa_logo_url_check
  check (logo_url is null or logo_url ~ '^https://' or logo_url ~ '^/logos/[A-Za-z0-9._-]{1,100}\.(png|svg|jpe?g|webp)$');
