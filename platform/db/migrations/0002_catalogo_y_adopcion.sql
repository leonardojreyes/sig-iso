-- 0002 — Catálogo global de librerías de normas y adopción por empresa (ADR 024, ADR 026).
-- El catálogo es GLOBAL y de solo lectura para las empresas: lo carga `pnpm libraries:load` con el rol `sigiso_catalogo`.
-- Una empresa ve las ENTRADAS de una librería solo si la adoptó (`empresa_libreria`). Los metadatos de la librería son públicos.
-- Sin texto de normas (regla 3): solo identificador, título breve, guía propia y mapeos, con los límites de longitud en la base.

create table libreria (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null check (codigo ~ '^[a-z0-9-]{1,64}$'),
  nombre      text not null check (char_length(nombre) between 1 and 120),
  version     text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  hash        text not null check (hash ~ '^[0-9a-f]{64}$'),
  es_ejemplo  boolean not null,
  fuente      text not null check (char_length(fuente) between 1 and 200),
  publicada_en timestamptz not null default now(),
  unique (codigo, version)
);

create table libreria_entrada (
  id            uuid primary key default gen_random_uuid(),
  libreria_id   uuid not null references libreria (id),
  id_estable    text not null check (id_estable ~ '^[a-z0-9][a-z0-9.-]{0,40}$'),
  capitulo      smallint not null check (capitulo between 4 and 10),
  nivel         smallint not null check (nivel in (1, 2)),
  titulo        text not null check (char_length(titulo) between 2 and 80),
  guia          text not null check (char_length(guia) between 10 and 280),
  alcance_comun text not null check (alcance_comun in ('comun', 'parcial', 'especifico')),
  orden         smallint not null,
  unique (libreria_id, id_estable),
  unique (id, libreria_id)
);

-- A qué norma, edición y cláusula corresponde cada entrada (el identificador puede diferir entre normas).
create table libreria_entrada_norma (
  entrada_id  uuid not null,
  libreria_id uuid not null,
  norma       text not null check (char_length(norma) between 1 and 60),
  edicion     text not null check (edicion ~ '^[0-9]{4}$'),
  clausula    text not null check (clausula ~ '^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$'),
  primary key (entrada_id, norma, edicion),
  foreign key (entrada_id, libreria_id) references libreria_entrada (id, libreria_id)
);

create index libreria_entrada_libreria_idx on libreria_entrada (libreria_id, orden);

-- Adopción: la empresa elige una librería del catálogo. No hay "desadopción" en este corte.
create table empresa_libreria (
  empresa_id  uuid not null references empresa (id),
  libreria_id uuid not null references libreria (id),
  adoptada_por uuid not null references usuario (id),
  adoptada_en timestamptz not null default now(),
  primary key (empresa_id, libreria_id)
);

-- Adopciones: cada empresa ve y crea solo las suyas.
alter table empresa_libreria enable row level security;
alter table empresa_libreria force row level security;

create policy adopcion_propia on empresa_libreria
  for all to sigiso_app
  using (empresa_id = (select app_tenant_id()))
  with check (empresa_id = (select app_tenant_id()));

create policy adopcion_mantenimiento on empresa_libreria
  for all to sigiso_owner
  using (empresa_id = (select app_tenant_id()))
  with check (empresa_id = (select app_tenant_id()));

-- Entradas y normas: visibles para una empresa solo si adoptó la librería.
alter table libreria_entrada enable row level security;
alter table libreria_entrada force row level security;
alter table libreria_entrada_norma enable row level security;
alter table libreria_entrada_norma force row level security;

create policy entrada_adoptada on libreria_entrada
  for select to sigiso_app
  using (exists (
    select 1 from empresa_libreria el
    where el.libreria_id = libreria_entrada.libreria_id and el.empresa_id = (select app_tenant_id())
  ));

create policy entrada_norma_adoptada on libreria_entrada_norma
  for select to sigiso_app
  using (exists (
    select 1 from empresa_libreria el
    where el.libreria_id = libreria_entrada_norma.libreria_id and el.empresa_id = (select app_tenant_id())
  ));

-- El rol del catálogo carga y lee (no hay datos de empresas aquí). El dueño mantiene el catálogo (migraciones, limpieza de pruebas).
create policy entrada_catalogo_lectura on libreria_entrada for select to sigiso_catalogo using (true);
create policy entrada_catalogo_carga on libreria_entrada for insert to sigiso_catalogo with check (true);
create policy entrada_mantenimiento on libreria_entrada for all to sigiso_owner using (true) with check (true);

create policy entrada_norma_catalogo_lectura on libreria_entrada_norma for select to sigiso_catalogo using (true);
create policy entrada_norma_catalogo_carga on libreria_entrada_norma for insert to sigiso_catalogo with check (true);
create policy entrada_norma_mantenimiento on libreria_entrada_norma for all to sigiso_owner using (true) with check (true);

-- Permisos mínimos. Nadie, salvo el dueño, actualiza ni borra el catálogo; la aplicación no escribe en él.
grant select on libreria, libreria_entrada, libreria_entrada_norma to sigiso_app;
grant select, insert on empresa_libreria to sigiso_app;
grant select, insert on libreria, libreria_entrada, libreria_entrada_norma to sigiso_catalogo;
