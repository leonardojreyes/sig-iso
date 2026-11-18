-- 0018 — Motivos de inclusión y referencias al tratamiento de riesgos (Declaración justificada, ADR 037). Datos «Confidenciales de
-- la empresa»: todo lleva empresa_id y RLS forzado. El motivo «riesgo» NO se guarda: siempre se deriva de los riesgos vigentes.

-- Motivo registrado de incluir un control del Anexo A: a lo sumo uno por tipo y control, siempre con una nota en palabras propias.
-- El control se referencia por (código de librería, id estable), sin clave foránea (igual que `evaluacion`).
create table motivo_inclusion (
  empresa_id      uuid not null references empresa (id),
  libreria_codigo text not null check (libreria_codigo ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  id_estable      text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  tipo            text not null check (tipo in ('legal', 'contractual', 'negocio', 'otro')),
  nota            text not null check (char_length(btrim(nota)) between 1 and 500),
  version         integer not null default 1 check (version >= 1),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  primary key (empresa_id, libreria_codigo, id_estable, tipo),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);

-- Referencia al análisis de riesgos o al plan de tratamiento de la empresa, por norma (una Declaración por norma). Solo se NOMBRA el
-- documento: el producto no lo guarda. Opcional: sin fila, no hay referencia.
create table referencia_tratamiento (
  empresa_id      uuid not null references empresa (id),
  norma           text not null check (char_length(norma) between 1 and 60),
  tipo            text not null check (tipo in ('analisis', 'plan')),
  titulo          text not null check (char_length(btrim(titulo)) between 1 and 120),
  version_doc     text not null check (char_length(btrim(version_doc)) between 1 and 40),
  fecha           date not null,
  ubicacion       text not null check (char_length(btrim(ubicacion)) between 1 and 200),
  version         integer not null default 1 check (version >= 1),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  primary key (empresa_id, norma, tipo),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);

alter table motivo_inclusion enable row level security;
alter table motivo_inclusion force row level security;
alter table referencia_tratamiento enable row level security;
alter table referencia_tratamiento force row level security;

create policy motivo_inclusion_propio on motivo_inclusion for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy motivo_inclusion_mantenimiento on motivo_inclusion for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy referencia_tratamiento_propia on referencia_tratamiento for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy referencia_tratamiento_mantenimiento on referencia_tratamiento for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Cambiar y quitar un motivo o una referencia es legítimo mientras la Declaración es borrador (con rastro en la bitácora); lo que
-- queda de una versión aprobada vive en su copia congelada (0019), que sí es inmutable.
grant select, insert, update, delete on motivo_inclusion to sigiso_app;
grant select, insert, update, delete on referencia_tratamiento to sigiso_app;
grant select, insert, update, delete on motivo_inclusion to sigiso_owner;
grant select, insert, update, delete on referencia_tratamiento to sigiso_owner;
