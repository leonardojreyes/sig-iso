-- 0017 — Riesgos mínimos y sus vínculos con controles (Declaración justificada, ADR 037). Datos «Confidenciales de la empresa»:
-- todo lleva empresa_id y RLS forzado. El nivel inicial NO se guarda: se calcula de la probabilidad y el impacto.

create table riesgo (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa (id),
  -- Correlativo por empresa; el código «R-001» se deriva y no se reutiliza (el riesgo se retira, no se borra).
  numero          integer not null check (numero >= 1),
  codigo          text generated always as ('R-' || lpad(numero::text, 3, '0')) stored,
  titulo          text not null check (char_length(titulo) between 1 and 120),
  descripcion     text check (descripcion is null or char_length(descripcion) <= 1000),
  probabilidad    smallint not null check (probabilidad between 1 and 5),
  impacto         smallint not null check (impacto between 1 and 5),
  decision        text not null check (decision in ('mitigar', 'aceptar', 'transferir', 'evitar')),
  responsable_id  uuid,
  estado          text not null default 'vigente' check (estado in ('vigente', 'retirado')),
  version         integer not null default 1 check (version >= 1),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  -- Aceptar un riesgo exige que alguien responda por él (regla 4 del spec; también la comprueba el dominio).
  check (decision <> 'aceptar' or responsable_id is not null),
  unique (empresa_id, numero),
  unique (empresa_id, id),
  foreign key (empresa_id, responsable_id) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);

-- Riesgo tratado con un control de la empresa (muchos a muchos).
create table riesgo_control (
  empresa_id uuid not null references empresa (id),
  riesgo_id  uuid not null,
  control_id uuid not null,
  creado_por uuid not null,
  creado_en  timestamptz not null default now(),
  primary key (empresa_id, riesgo_id, control_id),
  foreign key (empresa_id, riesgo_id) references riesgo (empresa_id, id),
  foreign key (empresa_id, control_id) references control (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
create index riesgo_control_control on riesgo_control (empresa_id, control_id);

-- «Tratamiento previsto»: el riesgo se vincula directo a un control del Anexo A cuando la empresa aún no tiene el control propio.
-- La entrada se referencia por (código de librería, id estable), sin clave foránea (igual que `control_mapeo`): el caso de uso
-- comprueba que esté en una librería adoptada.
create table riesgo_entrada (
  empresa_id      uuid not null references empresa (id),
  riesgo_id       uuid not null,
  libreria_codigo text not null check (libreria_codigo ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  id_estable      text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  primary key (empresa_id, riesgo_id, libreria_codigo, id_estable),
  foreign key (empresa_id, riesgo_id) references riesgo (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
create index riesgo_entrada_entrada on riesgo_entrada (empresa_id, libreria_codigo, id_estable);

alter table riesgo enable row level security;
alter table riesgo force row level security;
alter table riesgo_control enable row level security;
alter table riesgo_control force row level security;
alter table riesgo_entrada enable row level security;
alter table riesgo_entrada force row level security;

create policy riesgo_propio on riesgo for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy riesgo_mantenimiento on riesgo for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy riesgo_control_propio on riesgo_control for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy riesgo_control_mantenimiento on riesgo_control for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy riesgo_entrada_propio on riesgo_entrada for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy riesgo_entrada_mantenimiento on riesgo_entrada for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Un riesgo no se borra: se retira (estado) y queda en la bitácora. Un vínculo sí se puede quitar (no se actualiza), con rastro.
grant select, insert, update on riesgo to sigiso_app;
grant select, insert, update, delete on riesgo to sigiso_owner;
grant select, insert, delete on riesgo_control to sigiso_app;
grant select, insert, update, delete on riesgo_control to sigiso_owner;
grant select, insert, delete on riesgo_entrada to sigiso_app;
grant select, insert, update, delete on riesgo_entrada to sigiso_owner;
