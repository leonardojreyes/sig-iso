-- 0001 — Contexto de empresa y tablas `empresa` y `usuario` con seguridad por fila (ADR 024).
-- Regla 2: toda consulta lleva la empresa. `app_tenant_id()` LANZA ERROR si no hay empresa o no es válida,
-- así una consulta sin contexto falla en lugar de devolver datos de todas las empresas.

revoke create on schema public from public;

-- Empresa de la transacción en curso (la fija `conTenant` con set_config(..., true)).
create function app_tenant_id() returns uuid
  language plpgsql
  stable
  set search_path = pg_catalog
as $$
declare
  valor text := current_setting('app.tenant_id', true);
begin
  if valor is null or valor = '' then
    raise exception 'app.tenant_id no está definido: no hay empresa en el contexto de esta consulta'
      using errcode = '42501';
  end if;
  if valor !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'app.tenant_id no es un UUID válido'
      using errcode = '42501';
  end if;
  if valor = '00000000-0000-0000-0000-000000000000' then
    raise exception 'app.tenant_id no puede ser el UUID nulo'
      using errcode = '42501';
  end if;
  return valor::uuid;
end;
$$;

revoke all on function app_tenant_id() from public;
grant execute on function app_tenant_id() to sigiso_owner, sigiso_app, sigiso_catalogo, sigiso_plataforma;

-- Empresa: la aplicación solo lee la suya (la marca es de solo lectura en este corte).
create table empresa (
  id             uuid primary key,
  slug           text not null unique check (slug ~ '^[a-z0-9-]{1,32}$'),
  nombre         text not null check (char_length(nombre) between 1 and 120),
  color_primario text not null check (color_primario ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url       text check (logo_url is null or logo_url ~ '^(https://|/)'),
  creada_en      timestamptz not null default now()
);

alter table empresa enable row level security;
alter table empresa force row level security;

create policy empresa_lectura on empresa
  for select to sigiso_app
  using (id = (select app_tenant_id()));

-- El dueño solo mantiene datos DENTRO del contexto de una empresa (siembra, mantenimiento).
create policy empresa_mantenimiento on empresa
  for all to sigiso_owner
  using (id = (select app_tenant_id()))
  with check (id = (select app_tenant_id()));

grant select on empresa to sigiso_app;

-- Usuario: datos de identificación mínimos. El identificador es el de la cuenta (opaco) y es lo único que va a la bitácora.
create table usuario (
  id         uuid primary key,
  empresa_id uuid not null references empresa (id),
  nombre     text not null check (char_length(nombre) between 1 and 120),
  correo     text not null check (char_length(correo) between 3 and 254),
  creada_en  timestamptz not null default now(),
  unique (empresa_id, correo)
);

create index usuario_empresa_idx on usuario (empresa_id);

alter table usuario enable row level security;
alter table usuario force row level security;

create policy usuario_propios on usuario
  for all to sigiso_app
  using (empresa_id = (select app_tenant_id()))
  with check (empresa_id = (select app_tenant_id()));

create policy usuario_mantenimiento on usuario
  for all to sigiso_owner
  using (empresa_id = (select app_tenant_id()))
  with check (empresa_id = (select app_tenant_id()));

-- La aplicación crea y actualiza datos de identificación; no cambia la empresa ni borra.
grant select, insert on usuario to sigiso_app;
grant update (nombre, correo) on usuario to sigiso_app;
