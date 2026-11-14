-- 0011 — Librerías de normas PROPIAS de la empresa, subidas desde la interfaz (ADR 034, MVP M6a).
-- `libreria.empresa_id` nulo = catálogo global (lo carga `pnpm libraries:load`); con valor = librería de esa empresa.
-- Los códigos propios llevan el prefijo reservado `propia-` y los globales no pueden usarlo: así una referencia por código
-- (evaluaciones, mapeos) nunca es ambigua entre el catálogo y una librería de empresa.
-- Lo subido es inmutable: la aplicación solo inserta. Sin texto de normas (regla 3): los mismos límites de columnas de 0002.

alter table libreria add column empresa_id uuid references empresa (id);

alter table libreria drop constraint libreria_codigo_version_key;
create unique index libreria_global_codigo_version_uq on libreria (codigo, version) where empresa_id is null;
create unique index libreria_propia_codigo_version_uq on libreria (empresa_id, codigo, version) where empresa_id is not null;
create index libreria_empresa_idx on libreria (empresa_id) where empresa_id is not null;

alter table libreria add constraint libreria_codigo_segun_origen check (
  (empresa_id is null and codigo !~ '^propia-') or (empresa_id is not null and codigo ~ '^propia-[a-z0-9-]{1,57}$')
);
-- Una librería propia nunca es de ejemplo (el ejemplo es del catálogo).
alter table libreria add constraint libreria_propia_no_ejemplo check (empresa_id is null or es_ejemplo = false);

-- Metadatos: antes públicos; ahora la empresa ve el catálogo global y lo suyo, nunca lo de otra.
alter table libreria enable row level security;
alter table libreria force row level security;

create policy libreria_visible on libreria
  for select to sigiso_app
  using (empresa_id is null or empresa_id = (select app_tenant_id()));
create policy libreria_propia_alta on libreria
  for insert to sigiso_app
  with check (empresa_id = (select app_tenant_id()));

create policy libreria_catalogo_lectura on libreria for select to sigiso_catalogo using (empresa_id is null);
create policy libreria_catalogo_carga on libreria for insert to sigiso_catalogo with check (empresa_id is null);
create policy libreria_mantenimiento on libreria for all to sigiso_owner using (true) with check (true);

-- Entradas y normas de una librería propia: la empresa las inserta solo en una librería suya (y las ve si la adopta).
create policy entrada_propia_alta on libreria_entrada
  for insert to sigiso_app
  with check (exists (
    select 1 from libreria l where l.id = libreria_entrada.libreria_id and l.empresa_id = (select app_tenant_id())
  ));
create policy entrada_norma_propia_alta on libreria_entrada_norma
  for insert to sigiso_app
  with check (exists (
    select 1 from libreria l where l.id = libreria_entrada_norma.libreria_id and l.empresa_id = (select app_tenant_id())
  ));

-- El catálogo global sigue siendo solo del rol del catálogo: no ve ni toca lo de las empresas.
drop policy entrada_catalogo_lectura on libreria_entrada;
drop policy entrada_catalogo_carga on libreria_entrada;
drop policy entrada_norma_catalogo_lectura on libreria_entrada_norma;
drop policy entrada_norma_catalogo_carga on libreria_entrada_norma;
create policy entrada_catalogo_lectura on libreria_entrada for select to sigiso_catalogo
  using (exists (select 1 from libreria l where l.id = libreria_entrada.libreria_id and l.empresa_id is null));
create policy entrada_catalogo_carga on libreria_entrada for insert to sigiso_catalogo
  with check (exists (select 1 from libreria l where l.id = libreria_entrada.libreria_id and l.empresa_id is null));
create policy entrada_norma_catalogo_lectura on libreria_entrada_norma for select to sigiso_catalogo
  using (exists (select 1 from libreria l where l.id = libreria_entrada_norma.libreria_id and l.empresa_id is null));
create policy entrada_norma_catalogo_carga on libreria_entrada_norma for insert to sigiso_catalogo
  with check (exists (select 1 from libreria l where l.id = libreria_entrada_norma.libreria_id and l.empresa_id is null));

-- Adopción: solo del catálogo global o de una librería propia (la RLS de `libreria` oculta las de otras empresas).
drop policy adopcion_propia on empresa_libreria;
create policy adopcion_propia on empresa_libreria
  for select to sigiso_app
  using (empresa_id = (select app_tenant_id()));
create policy adopcion_alta on empresa_libreria
  for insert to sigiso_app
  with check (
    empresa_id = (select app_tenant_id())
    and exists (select 1 from libreria l where l.id = libreria_id and (l.empresa_id is null or l.empresa_id = (select app_tenant_id())))
  );

grant insert on libreria, libreria_entrada, libreria_entrada_norma to sigiso_app;
