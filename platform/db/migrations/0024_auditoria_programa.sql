-- 0024 — Auditoría interna: programa anual, auditoría y equipo (ADR 040). Todo lleva empresa_id y RLS forzado, con claves foráneas
-- compuestas. Nada se borra: una auditoría se cancela (no se reabre) y un programa solo se aprueba. Las normas se identifican por el
-- código de su librería, sin clave foránea (como los mapeos), así una versión nueva de la librería no deja nada huérfano.
-- Los textos libres (objetivo, motivos, medidas) son de la empresa y NO van a la bitácora.

create table programa_auditoria (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa (id),
  anio            integer not null check (anio between 2000 and 2100),
  objetivo        text not null check (char_length(btrim(objetivo)) between 1 and 500),
  estado          text not null default 'sin_aprobar' check (estado in ('sin_aprobar', 'aprobado')),
  aprobado_por    uuid,
  aprobado_en     timestamptz,
  version         integer not null default 1 check (version >= 1),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  check (estado = 'sin_aprobar' or (aprobado_por is not null and aprobado_en is not null)),
  unique (empresa_id, anio),
  unique (empresa_id, id),
  foreign key (empresa_id, aprobado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);

create table programa_norma (
  empresa_id      uuid not null references empresa (id),
  programa_id     uuid not null,
  libreria_codigo text not null check (char_length(libreria_codigo) between 1 and 80),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  primary key (empresa_id, programa_id, libreria_codigo),
  foreign key (empresa_id, programa_id) references programa_auditoria (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);

-- Lo que NO entra en el programa del año, con su motivo: un proceso, o un capítulo (o tema) de una norma.
create table programa_exclusion (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa (id),
  programa_id     uuid not null,
  tipo            text not null check (tipo in ('proceso', 'capitulo')),
  proceso_id      uuid,
  libreria_codigo text check (libreria_codigo is null or char_length(libreria_codigo) between 1 and 80),
  capitulo        text check (capitulo is null or char_length(btrim(capitulo)) between 1 and 60),
  motivo          text not null check (char_length(btrim(motivo)) between 1 and 300),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  check ((tipo = 'proceso' and proceso_id is not null and libreria_codigo is null and capitulo is null)
      or (tipo = 'capitulo' and proceso_id is null and libreria_codigo is not null and capitulo is not null)),
  foreign key (empresa_id, programa_id) references programa_auditoria (empresa_id, id),
  foreign key (empresa_id, proceso_id) references proceso (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
create unique index programa_exclusion_proceso on programa_exclusion (empresa_id, programa_id, proceso_id) where tipo = 'proceso';
create unique index programa_exclusion_capitulo on programa_exclusion (empresa_id, programa_id, libreria_codigo, capitulo) where tipo = 'capitulo';

create table auditoria (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references empresa (id),
  programa_id           uuid not null,
  anio                  integer not null check (anio between 2000 and 2100),
  -- Correlativo por empresa y año; el código («AI-2027-01») se deriva y no se reutiliza (una auditoría se cancela, no se borra).
  numero                integer not null check (numero >= 1),
  codigo                text generated always as ('AI-' || anio::text || '-' || lpad(numero::text, 2, '0')) stored,
  objetivo              text not null check (char_length(btrim(objetivo)) between 1 and 500),
  estado                text not null default 'planificada' check (estado in
                          ('planificada', 'en_preparacion', 'en_ejecucion', 'informe_emitido', 'cerrada', 'cancelada')),
  inicio                date not null,
  fin                   date not null,
  reunion_apertura      date,
  reunion_cierre        date,
  reprogramaciones      integer not null default 0 check (reprogramaciones >= 0),
  cancelacion_motivo    text check (cancelacion_motivo is null or cancelacion_motivo in ('sin_recursos', 'cambio_de_alcance', 'reprogramada', 'otro')),
  cancelacion_nota      text check (cancelacion_nota is null or char_length(btrim(cancelacion_nota)) between 1 and 300),
  informe_emitido_por   uuid,
  informe_emitido_en    timestamptz,
  cerrada_por           uuid,
  cerrada_en            timestamptz,
  version               integer not null default 1 check (version >= 1),
  creado_por            uuid not null,
  creado_en             timestamptz not null default now(),
  actualizado_por       uuid not null,
  actualizado_en        timestamptz not null default now(),
  check (fin >= inicio),
  check ((estado = 'cancelada') = (cancelacion_motivo is not null)),
  check (estado not in ('informe_emitido', 'cerrada') or (informe_emitido_por is not null and informe_emitido_en is not null)),
  check (estado <> 'cerrada' or (cerrada_por is not null and cerrada_en is not null)),
  unique (empresa_id, anio, numero),
  unique (empresa_id, id),
  foreign key (empresa_id, programa_id) references programa_auditoria (empresa_id, id),
  foreign key (empresa_id, informe_emitido_por) references usuario (empresa_id, id),
  foreign key (empresa_id, cerrada_por) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);
create index auditoria_programa on auditoria (empresa_id, programa_id, estado);

-- Criterios (normas adoptadas), alcance (procesos y capítulos o temas) y equipo de la auditoría.
create table auditoria_norma (
  empresa_id      uuid not null references empresa (id),
  auditoria_id    uuid not null,
  libreria_codigo text not null check (char_length(libreria_codigo) between 1 and 80),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  primary key (empresa_id, auditoria_id, libreria_codigo),
  foreign key (empresa_id, auditoria_id) references auditoria (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);

create table auditoria_proceso (
  empresa_id   uuid not null references empresa (id),
  auditoria_id uuid not null,
  proceso_id   uuid not null,
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  primary key (empresa_id, auditoria_id, proceso_id),
  foreign key (empresa_id, auditoria_id) references auditoria (empresa_id, id),
  foreign key (empresa_id, proceso_id) references proceso (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);

create table auditoria_capitulo (
  empresa_id      uuid not null references empresa (id),
  auditoria_id    uuid not null,
  libreria_codigo text not null check (char_length(libreria_codigo) between 1 and 80),
  capitulo        text not null check (char_length(btrim(capitulo)) between 1 and 60),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  primary key (empresa_id, auditoria_id, libreria_codigo, capitulo),
  foreign key (empresa_id, auditoria_id) references auditoria (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);

create table auditoria_equipo (
  empresa_id               uuid not null references empresa (id),
  auditoria_id             uuid not null,
  usuario_id               uuid not null,
  rol                      text not null check (rol in ('lider', 'auditor')),
  -- Excepción de independencia: motivo y medida compensatoria obligatorios, con quién la autorizó (el texto NO va a la bitácora).
  excepcion                boolean not null default false,
  excepcion_motivo         text check (excepcion_motivo is null or char_length(btrim(excepcion_motivo)) between 1 and 300),
  excepcion_medida         text check (excepcion_medida is null or char_length(btrim(excepcion_medida)) between 1 and 300),
  excepcion_autorizada_por uuid,
  -- Solo cuando la empresa tiene un único administrador activo: la autorizó la misma persona designada.
  autoautorizada           boolean not null default false,
  creado_por               uuid not null,
  creado_en                timestamptz not null default now(),
  primary key (empresa_id, auditoria_id, usuario_id),
  check (excepcion = (excepcion_motivo is not null and excepcion_medida is not null and excepcion_autorizada_por is not null)),
  check (not autoautorizada or excepcion),
  foreign key (empresa_id, auditoria_id) references auditoria (empresa_id, id),
  foreign key (empresa_id, usuario_id) references usuario (empresa_id, id),
  foreign key (empresa_id, excepcion_autorizada_por) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
-- Un solo líder por auditoría: lo garantiza la base.
create unique index auditoria_equipo_lider on auditoria_equipo (empresa_id, auditoria_id) where rol = 'lider';
create index auditoria_equipo_usuario on auditoria_equipo (empresa_id, usuario_id);

do $$
declare t text;
begin
  foreach t in array array['programa_auditoria', 'programa_norma', 'programa_exclusion', 'auditoria', 'auditoria_norma',
                           'auditoria_proceso', 'auditoria_capitulo', 'auditoria_equipo']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy %I on %I for all to sigiso_app using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()))', t || '_propio', t);
    execute format('create policy %I on %I for all to sigiso_owner using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()))', t || '_mantenimiento', t);
    execute format('grant select, insert, update, delete on %I to sigiso_owner', t);
  end loop;
end $$;

-- Sin DELETE de programas ni de auditorías; UPDATE solo por columnas (nunca el código, el año, el correlativo ni la autoría).
grant select, insert on programa_auditoria to sigiso_app;
grant update (objetivo, estado, aprobado_por, aprobado_en, version, actualizado_por, actualizado_en) on programa_auditoria to sigiso_app;
grant select, insert on auditoria to sigiso_app;
grant update (objetivo, estado, inicio, fin, reunion_apertura, reunion_cierre, reprogramaciones, cancelacion_motivo, cancelacion_nota,
              informe_emitido_por, informe_emitido_en, cerrada_por, cerrada_en, version, actualizado_por, actualizado_en) on auditoria to sigiso_app;
-- Normas, exclusiones, alcance y equipo son configuración editable mientras la auditoría no avanza (la regla es del dominio): se quitan
-- con rastro en la bitácora; no se editan.
grant select, insert, delete on programa_norma to sigiso_app;
grant select, insert, delete on programa_exclusion to sigiso_app;
grant select, insert, delete on auditoria_norma to sigiso_app;
grant select, insert, delete on auditoria_proceso to sigiso_app;
grant select, insert, delete on auditoria_capitulo to sigiso_app;
grant select, insert, delete on auditoria_equipo to sigiso_app;
