-- 0023 — Auditoría interna: procesos y personas relacionadas (ADR 040). La independencia del auditor se comprueba por proceso, así
-- que el proceso es una entidad mínima: código correlativo, dueña, importancia y frecuencia previstas. Datos «Internos», salvo la
-- relación persona–proceso (identificador y rol laboral: datos personales, ADR 028). Todo lleva empresa_id y RLS forzado, con claves
-- foráneas compuestas. Un proceso nunca se borra (se retira); el código no se reutiliza.
-- Esta migración usa el 0023; las de «Gestión de riesgos completa» se renumeran a partir del 0026.

create table proceso (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references empresa (id),
  -- Correlativo por empresa; el código («PR-001») se deriva y no se reutiliza.
  numero            integer not null check (numero >= 1),
  codigo            text generated always as ('PR-' || lpad(numero::text, 3, '0')) stored,
  nombre            text not null check (char_length(btrim(nombre)) between 1 and 120),
  descripcion       text check (descripcion is null or char_length(btrim(descripcion)) between 1 and 300),
  duena_id          uuid not null,
  importancia       text not null default 'media' check (importancia in ('alta', 'media', 'baja')),
  frecuencia        text not null default 'anual' check (frecuencia in ('semestral', 'anual', 'cada_dos_anios', 'cada_tres_anios')),
  -- «Gestión del SIG»: proceso transversal que entra al alcance de toda auditoría que cubra las cláusulas 4 a 10. No se cambia después.
  transversal       boolean not null default false,
  -- Marca manual del administrador como ayuda para decidir el programa (cambió, hubo un incidente); es informativa.
  cambio_relevante  text check (cambio_relevante is null or cambio_relevante in ('cambio', 'incidente')),
  estado            text not null default 'vigente' check (estado in ('vigente', 'retirado')),
  version           integer not null default 1 check (version >= 1),
  creado_por        uuid not null,
  creado_en         timestamptz not null default now(),
  actualizado_por   uuid not null,
  actualizado_en    timestamptz not null default now(),
  unique (empresa_id, numero),
  unique (empresa_id, id),
  foreign key (empresa_id, duena_id) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);
create index proceso_estado on proceso (empresa_id, estado);
-- A lo sumo un proceso transversal vigente por empresa: lo garantiza la base, no solo la aplicación.
create unique index proceso_transversal_unico on proceso (empresa_id) where transversal and estado = 'vigente';

create table persona_proceso (
  empresa_id  uuid not null references empresa (id),
  proceso_id  uuid not null,
  usuario_id  uuid not null,
  relacion    text not null check (relacion in ('duena', 'participa', 'diseno', 'supervisa')),
  creado_por  uuid not null,
  creado_en   timestamptz not null default now(),
  primary key (empresa_id, proceso_id, usuario_id, relacion),
  foreign key (empresa_id, proceso_id) references proceso (empresa_id, id),
  foreign key (empresa_id, usuario_id) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
create index persona_proceso_usuario on persona_proceso (empresa_id, usuario_id);

alter table proceso enable row level security;
alter table proceso force row level security;
alter table persona_proceso enable row level security;
alter table persona_proceso force row level security;

create policy proceso_propio on proceso for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy proceso_mantenimiento on proceso for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy persona_proceso_propia on persona_proceso for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy persona_proceso_mantenimiento on persona_proceso for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Sin DELETE de procesos para la aplicación; UPDATE solo por columnas (nunca el código, la marca transversal ni la autoría).
grant select, insert on proceso to sigiso_app;
grant update (nombre, descripcion, duena_id, importancia, frecuencia, cambio_relevante, estado, version, actualizado_por, actualizado_en)
  on proceso to sigiso_app;
-- Las relaciones sí se pueden quitar (con rastro en la bitácora); no se editan.
grant select, insert, delete on persona_proceso to sigiso_app;
grant select, insert, update, delete on proceso to sigiso_owner;
grant select, insert, update, delete on persona_proceso to sigiso_owner;
