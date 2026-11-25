-- 0027 — Criterios de evaluación de riesgos de la empresa, versionados (Gestión de riesgos completa, ADR 038). Datos «Confidenciales de la
-- empresa»: todo lleva empresa_id y RLS forzado. Cada cambio de criterios crea una VERSIÓN NUEVA; las anteriores no se tocan ni se borran,
-- porque respaldan las evaluaciones y las versiones aprobadas de la Declaración. La aplicación solo puede insertar y leer.
-- Sin ninguna fila rige la escala por omisión de la herramienta (se rotula así en pantalla y en el Word). Los cortes del nivel son fijos.

create table criterios_version (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresa (id),
  version          integer not null check (version >= 1),
  -- Descripción propia, en palabras de la empresa, de qué significa cada valor de la escala (1 a 5).
  probabilidad_1   text not null check (char_length(btrim(probabilidad_1)) between 1 and 200),
  probabilidad_2   text not null check (char_length(btrim(probabilidad_2)) between 1 and 200),
  probabilidad_3   text not null check (char_length(btrim(probabilidad_3)) between 1 and 200),
  probabilidad_4   text not null check (char_length(btrim(probabilidad_4)) between 1 and 200),
  probabilidad_5   text not null check (char_length(btrim(probabilidad_5)) between 1 and 200),
  impacto_1        text not null check (char_length(btrim(impacto_1)) between 1 and 200),
  impacto_2        text not null check (char_length(btrim(impacto_2)) between 1 and 200),
  impacto_3        text not null check (char_length(btrim(impacto_3)) between 1 and 200),
  impacto_4        text not null check (char_length(btrim(impacto_4)) between 1 and 200),
  impacto_5        text not null check (char_length(btrim(impacto_5)) between 1 and 200),
  -- Hasta qué nivel de riesgo residual puede aceptarlo su responsable sin escalarlo.
  nivel_aceptacion text not null check (nivel_aceptacion in ('bajo', 'medio', 'alto', 'critico')),
  creado_por       uuid not null,
  creado_en        timestamptz not null default now(),
  unique (empresa_id, version),
  unique (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);

alter table criterios_version enable row level security;
alter table criterios_version force row level security;

create policy criterios_version_propia on criterios_version for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy criterios_version_mantenimiento on criterios_version for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Inmutable para la aplicación: ni UPDATE ni DELETE.
grant select, insert on criterios_version to sigiso_app;
grant select, insert, update, delete on criterios_version to sigiso_owner;
