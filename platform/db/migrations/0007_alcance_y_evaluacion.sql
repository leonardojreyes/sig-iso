-- 0007 — Alcance y diagnóstico (MVP, M2). Primeros datos «Confidenciales de la empresa»: todo lleva empresa_id y RLS forzado.
-- Una evaluación se identifica por (empresa, código de librería, id estable de la entrada): la versión de la librería usada se fija
-- aparte (`libreria_id`), de modo que una versión nueva de la librería no deja huérfana la evaluación. «Sin evaluar» = no hay fila.

-- Claves foráneas compuestas (empresa_id, id): una fila no puede apuntar a una persona de otra empresa (lección de M2 de la revisión).
alter table usuario add constraint usuario_empresa_id_id_key unique (empresa_id, id);

create table alcance (
  empresa_id      uuid not null references empresa (id),
  norma           text not null check (char_length(norma) between 1 and 60),
  texto           text not null check (char_length(texto) between 1 and 4000),
  aprobado_por    uuid,
  aprobado_en     timestamptz,
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  primary key (empresa_id, norma),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, aprobado_por) references usuario (empresa_id, id),
  check ((aprobado_por is null) = (aprobado_en is null))
);

create table evaluacion (
  empresa_id      uuid not null references empresa (id),
  libreria_codigo text not null check (libreria_codigo ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  id_estable      text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  libreria_id     uuid not null references libreria (id),
  estado          text not null check (estado in ('cumple', 'parcial', 'no_cumple', 'no_aplica')),
  comentario      text check (comentario is null or char_length(comentario) <= 1000),
  responsable_id  uuid,
  fecha_objetivo  date,
  version         integer not null default 1 check (version >= 1),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  primary key (empresa_id, libreria_codigo, id_estable),
  foreign key (empresa_id, responsable_id) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);

alter table alcance enable row level security;
alter table alcance force row level security;
alter table evaluacion enable row level security;
alter table evaluacion force row level security;

create policy alcance_propio on alcance for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy alcance_mantenimiento on alcance for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy evaluacion_propia on evaluacion for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy evaluacion_mantenimiento on evaluacion for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Sin DELETE para la aplicación: lo evaluado no desaparece en silencio (cambia de estado y queda en la bitácora).
grant select, insert, update on alcance, evaluacion to sigiso_app;
grant select, insert, update, delete on alcance, evaluacion to sigiso_owner;
