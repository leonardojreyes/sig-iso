-- 0008 — Controles de la empresa y mapeos a las entradas de las normas (MVP, M3). Datos «Confidenciales de la empresa»: todo
-- lleva empresa_id y RLS forzado. Un control es una medida PROPIA de la organización, no un control del Anexo A.

create table control (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa (id),
  codigo          text not null check (codigo ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$'),
  nombre          text not null check (char_length(nombre) between 1 and 120),
  descripcion     text check (descripcion is null or char_length(descripcion) <= 1000),
  responsable_id  uuid,
  estado          text not null default 'vigente' check (estado in ('vigente', 'retirado')),
  version         integer not null default 1 check (version >= 1),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, codigo),
  unique (empresa_id, id),
  foreign key (empresa_id, responsable_id) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);

-- La entrada de la norma se referencia por (código de librería, id estable), sin clave foránea: el catálogo es por versión y el
-- caso de uso comprueba que la entrada esté en las librerías que la empresa adoptó (igual que `evaluacion`).
create table control_mapeo (
  empresa_id      uuid not null references empresa (id),
  control_id      uuid not null,
  libreria_codigo text not null check (libreria_codigo ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  id_estable      text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  primary key (empresa_id, control_id, libreria_codigo, id_estable),
  foreign key (empresa_id, control_id) references control (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);

create index control_mapeo_entrada on control_mapeo (empresa_id, libreria_codigo, id_estable);

alter table control enable row level security;
alter table control force row level security;
alter table control_mapeo enable row level security;
alter table control_mapeo force row level security;

create policy control_propio on control for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy control_mantenimiento on control for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy control_mapeo_propio on control_mapeo for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy control_mapeo_mantenimiento on control_mapeo for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Un control no se borra: se retira (estado) y queda en la bitácora. Un mapeo sí se puede quitar (no se actualiza), también con rastro.
grant select, insert, update on control to sigiso_app;
grant select, insert, update, delete on control to sigiso_owner;
grant select, insert, delete on control_mapeo to sigiso_app;
grant select, insert, update, delete on control_mapeo to sigiso_owner;
