-- 0022 — Control documental: distribución, lecturas confirmadas, vínculos con las normas y controles, y retención por tipo (ADR 039).
-- Las lecturas son datos personales seudonimizados (identificador de la persona y fecha); todo lleva empresa_id y RLS forzado.

-- Destinatarios del documento (configuración editable). «Todas las personas de un rol» se resuelve al agregar, sin guardar el rol.
create table documento_destinatario (
  empresa_id   uuid not null references empresa (id),
  documento_id uuid not null,
  usuario_id   uuid not null,
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  primary key (empresa_id, documento_id, usuario_id),
  foreign key (empresa_id, documento_id) references documento (empresa_id, id),
  foreign key (empresa_id, usuario_id) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);

-- Una lectura pendiente por destinatario y versión, creada al aprobar. Solo se confirma una vez (la fecha no se reescribe).
create table documento_lectura (
  empresa_id    uuid not null references empresa (id),
  version_id    uuid not null,
  usuario_id    uuid not null,
  confirmada_en timestamptz,
  creado_en     timestamptz not null default now(),
  primary key (empresa_id, version_id, usuario_id),
  foreign key (empresa_id, version_id) references documento_version (empresa_id, id),
  foreign key (empresa_id, usuario_id) references usuario (empresa_id, id)
);
create index documento_lectura_persona on documento_lectura (empresa_id, usuario_id) where confirmada_en is null;

-- Documento que respalda un control de la empresa (muchos a muchos).
create table documento_control (
  empresa_id   uuid not null references empresa (id),
  documento_id uuid not null,
  control_id   uuid not null,
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  primary key (empresa_id, documento_id, control_id),
  foreign key (empresa_id, documento_id) references documento (empresa_id, id),
  foreign key (empresa_id, control_id) references control (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
create index documento_control_control on documento_control (empresa_id, control_id);

-- Documento que respalda una entrada de una librería adoptada. Por (código de librería, id estable), sin clave foránea (igual que
-- `control_mapeo`): el caso de uso comprueba que esté adoptada.
create table documento_entrada (
  empresa_id      uuid not null references empresa (id),
  documento_id    uuid not null,
  libreria_codigo text not null check (libreria_codigo ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  id_estable      text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  primary key (empresa_id, documento_id, libreria_codigo, id_estable),
  foreign key (empresa_id, documento_id) references documento (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
create index documento_entrada_entrada on documento_entrada (empresa_id, libreria_codigo, id_estable);

-- Período de conservación de las versiones obsoletas por tipo (años y motivo breve: ley o política de la empresa). Sin valor por omisión.
create table retencion_tipo (
  empresa_id      uuid not null references empresa (id),
  tipo            text not null check (tipo in ('politica', 'procedimiento', 'instructivo', 'formato', 'manual', 'externo', 'otro')),
  anios           smallint not null check (anios between 1 and 100),
  motivo          text not null check (char_length(btrim(motivo)) between 1 and 200),
  version         integer not null default 1 check (version >= 1),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  primary key (empresa_id, tipo),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);

alter table documento_destinatario enable row level security;
alter table documento_destinatario force row level security;
alter table documento_lectura enable row level security;
alter table documento_lectura force row level security;
alter table documento_control enable row level security;
alter table documento_control force row level security;
alter table documento_entrada enable row level security;
alter table documento_entrada force row level security;
alter table retencion_tipo enable row level security;
alter table retencion_tipo force row level security;

create policy documento_destinatario_propio on documento_destinatario for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_destinatario_mantenimiento on documento_destinatario for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_lectura_propia on documento_lectura for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_lectura_mantenimiento on documento_lectura for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_control_propio on documento_control for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_control_mantenimiento on documento_control for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_entrada_propia on documento_entrada for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_entrada_mantenimiento on documento_entrada for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy retencion_tipo_propia on retencion_tipo for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy retencion_tipo_mantenimiento on retencion_tipo for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

grant select, insert, delete on documento_destinatario to sigiso_app;
grant select, insert on documento_lectura to sigiso_app;
grant update (confirmada_en) on documento_lectura to sigiso_app;
grant select, insert, delete on documento_control to sigiso_app;
grant select, insert, delete on documento_entrada to sigiso_app;
grant select, insert on retencion_tipo to sigiso_app;
grant update (anios, motivo, version, actualizado_por, actualizado_en) on retencion_tipo to sigiso_app;
grant select, insert, update, delete on documento_destinatario to sigiso_owner;
grant select, insert, update, delete on documento_lectura to sigiso_owner;
grant select, insert, update, delete on documento_control to sigiso_owner;
grant select, insert, update, delete on documento_entrada to sigiso_owner;
grant select, insert, update, delete on retencion_tipo to sigiso_owner;
