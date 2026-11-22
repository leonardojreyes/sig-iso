-- 0026 — Activos de información y su liga con riesgos (Gestión de riesgos completa, ADR 038). Datos «Confidenciales de la empresa»:
-- todo lleva empresa_id y RLS forzado, con claves foráneas compuestas. Un activo nunca se borra (se retira); el código no se reutiliza.
-- Que un activo retirado no se pueda ligar de nuevo lo comprueba el caso de uso; la base garantiza empresa, forma y autoría.

create table activo (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa (id),
  -- Correlativo por empresa; el código («A-001») se deriva y no se reutiliza.
  numero          integer not null check (numero >= 1),
  codigo          text generated always as ('A-' || lpad(numero::text, 3, '0')) stored,
  nombre          text not null check (char_length(btrim(nombre)) between 1 and 120),
  descripcion     text check (descripcion is null or char_length(btrim(descripcion)) between 1 and 500),
  tipo            text not null check (tipo in ('informacion', 'aplicacion_sistema', 'infraestructura', 'persona', 'servicio_terceros', 'instalacion')),
  clasificacion   text not null check (clasificacion in ('publica', 'interna', 'confidencial', 'restringida')),
  responsable_id  uuid not null,
  estado          text not null default 'vigente' check (estado in ('vigente', 'retirado')),
  version         integer not null default 1 check (version >= 1),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, numero),
  unique (empresa_id, id),
  foreign key (empresa_id, responsable_id) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);
create index activo_estado on activo (empresa_id, estado);
create index activo_responsable on activo (empresa_id, responsable_id);

-- Riesgo ligado a un activo (muchos a muchos). Se quita con rastro en la bitácora; no se actualiza.
create table riesgo_activo (
  empresa_id uuid not null references empresa (id),
  riesgo_id  uuid not null,
  activo_id  uuid not null,
  creado_por uuid not null,
  creado_en  timestamptz not null default now(),
  primary key (empresa_id, riesgo_id, activo_id),
  foreign key (empresa_id, riesgo_id) references riesgo (empresa_id, id),
  foreign key (empresa_id, activo_id) references activo (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
create index riesgo_activo_activo on riesgo_activo (empresa_id, activo_id);

alter table activo enable row level security;
alter table activo force row level security;
alter table riesgo_activo enable row level security;
alter table riesgo_activo force row level security;

create policy activo_propio on activo for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy activo_mantenimiento on activo for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy riesgo_activo_propio on riesgo_activo for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy riesgo_activo_mantenimiento on riesgo_activo for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Sin DELETE de activos para la aplicación; UPDATE solo por columnas (nunca el código, el correlativo ni la autoría).
grant select, insert on activo to sigiso_app;
grant update (nombre, descripcion, tipo, clasificacion, responsable_id, estado, version, actualizado_por, actualizado_en) on activo to sigiso_app;
grant select, insert, delete on riesgo_activo to sigiso_app;
grant select, insert, update, delete on activo to sigiso_owner;
grant select, insert, update, delete on riesgo_activo to sigiso_owner;
