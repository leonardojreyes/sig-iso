-- 0010 — Declaración de Aplicabilidad de ISO/IEC 27001 (MVP, M5). Datos «Confidenciales de la empresa»: todo lleva empresa_id y
-- RLS forzado. Solo se guarda la VERSIÓN APROBADA (congelada): el borrador se deriva cada vez del diagnóstico y de los controles.
-- La versión y sus filas son INMUTABLES: la aplicación solo puede leer e insertar (ni UPDATE ni DELETE). Una aprobación nueva crea
-- la versión siguiente. Sin texto de las normas: título breve propio, justificación y códigos de controles de la empresa.

create table declaracion_version (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresa (id),
  numero        integer not null check (numero >= 1),
  alcance_texto text check (alcance_texto is null or char_length(alcance_texto) between 1 and 4000),
  total         integer not null check (total >= 0),
  aplican       integer not null check (aplican >= 0),
  no_aplican    integer not null check (no_aplican >= 0),
  sin_control   integer not null check (sin_control >= 0 and sin_control <= aplican),
  aprobada_por  uuid not null,
  aprobada_en   timestamptz not null default now(),
  check (total = aplican + no_aplican),
  unique (empresa_id, numero),
  unique (empresa_id, id),
  foreign key (empresa_id, aprobada_por) references usuario (empresa_id, id)
);

create table declaracion_fila (
  empresa_id      uuid not null references empresa (id),
  version_id      uuid not null,
  libreria_codigo text not null check (libreria_codigo ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  id_estable      text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  orden           integer not null check (orden >= 0),
  titulo          text not null check (char_length(titulo) between 1 and 200),
  grupo           text check (grupo is null or char_length(grupo) between 1 and 80),
  aplicabilidad   text not null check (aplicabilidad in ('aplica', 'no_aplica')),
  implementacion  text check (implementacion in ('implementado', 'parcial', 'no_implementado')),
  justificacion   text check (justificacion is null or char_length(justificacion) between 1 and 1000),
  controles       text[] not null default '{}' check (cardinality(controles) <= 50),
  cobertura       text not null check (cobertura in ('cubierta', 'evidencia_vencida', 'sin_evidencia', 'sin_control', 'no_aplica')),
  primary key (empresa_id, version_id, libreria_codigo, id_estable),
  foreign key (empresa_id, version_id) references declaracion_version (empresa_id, id),
  -- Una fila que aplica dice cómo está implementada; una que no aplica trae su justificación y nada de implementación.
  check ((aplicabilidad = 'aplica' and implementacion is not null)
      or (aplicabilidad = 'no_aplica' and implementacion is null and justificacion is not null))
);

create index declaracion_fila_version on declaracion_fila (empresa_id, version_id, orden);

alter table declaracion_version enable row level security;
alter table declaracion_version force row level security;
alter table declaracion_fila enable row level security;
alter table declaracion_fila force row level security;

create policy declaracion_version_propia on declaracion_version for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_version_mantenimiento on declaracion_version for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_fila_propia on declaracion_fila for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_fila_mantenimiento on declaracion_fila for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Inmutable para la aplicación: solo leer e insertar. El dueño conserva todo para mantenimiento y pruebas.
grant select, insert on declaracion_version to sigiso_app;
grant select, insert on declaracion_fila to sigiso_app;
grant select, insert, update, delete on declaracion_version to sigiso_owner;
grant select, insert, update, delete on declaracion_fila to sigiso_owner;
