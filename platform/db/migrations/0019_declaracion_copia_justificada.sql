-- 0019 — Copia congelada de lo que justifica una Declaración aprobada (Declaración justificada, ADR 037): motivos con sus notas,
-- riesgos (tal como estaban), referencias al tratamiento y la escala y los cortes del nivel. Todo INMUTABLE: la aplicación solo lee
-- e inserta (ni UPDATE ni DELETE); cambiar un riesgo o un motivo después NO altera una versión ya aprobada.
-- Las versiones aprobadas antes de esta migración quedan con las columnas nuevas en nulo: se siguen leyendo y exportando como
-- estaban, sin motivos ni riesgos, y lo dicen.

alter table declaracion_version
  add column escala_max       smallint check (escala_max between 2 and 10),
  add column corte_medio      smallint,
  add column corte_alto       smallint,
  add column corte_critico    smallint,
  add column con_motivo       integer check (con_motivo >= 0),
  add column riesgos_vigentes integer check (riesgos_vigentes >= 0),
  -- Todo o nada: o es una versión con justificación (escala, cortes y conteos) o una anterior a esta funcionalidad.
  add check ((escala_max is null) = (corte_medio is null) and (escala_max is null) = (corte_alto is null)
         and (escala_max is null) = (corte_critico is null) and (escala_max is null) = (con_motivo is null)
         and (escala_max is null) = (riesgos_vigentes is null)),
  add check (escala_max is null or (corte_medio > 1 and corte_medio < corte_alto and corte_alto < corte_critico
         and corte_critico <= escala_max * escala_max)),
  add check (con_motivo is null or con_motivo <= aplican);

-- Motivo registrado de una fila que aplica (el motivo «riesgo» no se copia aquí: se deriva de declaracion_fila_riesgo).
create table declaracion_motivo (
  empresa_id      uuid not null references empresa (id),
  version_id      uuid not null,
  libreria_codigo text not null check (libreria_codigo ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  id_estable      text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  tipo            text not null check (tipo in ('legal', 'contractual', 'negocio', 'otro')),
  nota            text not null check (char_length(btrim(nota)) between 1 and 500),
  primary key (empresa_id, version_id, libreria_codigo, id_estable, tipo),
  foreign key (empresa_id, version_id, libreria_codigo, id_estable) references declaracion_fila (empresa_id, version_id, libreria_codigo, id_estable)
);

-- Riesgo vigente al aprobar, con los datos que tenía (el título puede cambiar después; la versión no).
create table declaracion_riesgo (
  empresa_id     uuid not null references empresa (id),
  version_id     uuid not null,
  codigo         text not null check (codigo ~ '^R-[0-9]{3,6}$'),
  titulo         text not null check (char_length(titulo) between 1 and 120),
  probabilidad   smallint not null check (probabilidad between 1 and 10),
  impacto        smallint not null check (impacto between 1 and 10),
  nivel          text not null check (nivel in ('bajo', 'medio', 'alto', 'critico')),
  decision       text not null check (decision in ('mitigar', 'aceptar', 'transferir', 'evitar')),
  responsable_id uuid,
  controles      text[] not null default '{}' check (cardinality(controles) <= 50),
  primary key (empresa_id, version_id, codigo),
  foreign key (empresa_id, version_id) references declaracion_version (empresa_id, id),
  foreign key (empresa_id, responsable_id) references usuario (empresa_id, id)
);

-- Qué riesgos justifican cada fila y de qué manera: por un control de la empresa o como tratamiento previsto (sin control propio).
create table declaracion_fila_riesgo (
  empresa_id      uuid not null references empresa (id),
  version_id      uuid not null,
  libreria_codigo text not null check (libreria_codigo ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  id_estable      text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  riesgo_codigo   text not null check (riesgo_codigo ~ '^R-[0-9]{3,6}$'),
  via             text not null check (via in ('control', 'previsto')),
  primary key (empresa_id, version_id, libreria_codigo, id_estable, riesgo_codigo, via),
  foreign key (empresa_id, version_id, libreria_codigo, id_estable) references declaracion_fila (empresa_id, version_id, libreria_codigo, id_estable),
  foreign key (empresa_id, version_id, riesgo_codigo) references declaracion_riesgo (empresa_id, version_id, codigo)
);

-- Referencia al análisis o al plan de tratamiento tal como estaba al aprobar.
create table declaracion_referencia (
  empresa_id  uuid not null references empresa (id),
  version_id  uuid not null,
  tipo        text not null check (tipo in ('analisis', 'plan')),
  titulo      text not null check (char_length(btrim(titulo)) between 1 and 120),
  version_doc text not null check (char_length(btrim(version_doc)) between 1 and 40),
  fecha       date not null,
  ubicacion   text not null check (char_length(btrim(ubicacion)) between 1 and 200),
  primary key (empresa_id, version_id, tipo),
  foreign key (empresa_id, version_id) references declaracion_version (empresa_id, id)
);

alter table declaracion_motivo enable row level security;
alter table declaracion_motivo force row level security;
alter table declaracion_riesgo enable row level security;
alter table declaracion_riesgo force row level security;
alter table declaracion_fila_riesgo enable row level security;
alter table declaracion_fila_riesgo force row level security;
alter table declaracion_referencia enable row level security;
alter table declaracion_referencia force row level security;

create policy declaracion_motivo_propio on declaracion_motivo for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_motivo_mantenimiento on declaracion_motivo for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_riesgo_propio on declaracion_riesgo for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_riesgo_mantenimiento on declaracion_riesgo for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_fila_riesgo_propio on declaracion_fila_riesgo for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_fila_riesgo_mantenimiento on declaracion_fila_riesgo for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_referencia_propia on declaracion_referencia for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy declaracion_referencia_mantenimiento on declaracion_referencia for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Inmutable para la aplicación: solo leer e insertar. El dueño conserva todo para mantenimiento y pruebas.
grant select, insert on declaracion_motivo, declaracion_riesgo, declaracion_fila_riesgo, declaracion_referencia to sigiso_app;
grant select, insert, update, delete on declaracion_motivo, declaracion_riesgo, declaracion_fila_riesgo, declaracion_referencia to sigiso_owner;
