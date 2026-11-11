-- 0009 — Evidencias con archivo (MVP, M4). Datos «Confidenciales de la empresa»: todo lleva empresa_id y RLS forzado.
-- La evidencia cuelga de un control de la empresa; las entradas de las normas quedan respaldadas a través de los mapeos (M3).
-- Los datos del archivo (tipo, tamaño, huella) NO se pueden modificar una vez guardados: la aplicación solo actualiza el estado
-- y quién y cuándo. Reemplazar crea una evidencia nueva y marca la anterior; eliminar marca la fila. Nada se borra (ADR 032).

create table evidencia (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa (id),
  control_id      uuid not null,
  tipo            text not null check (tipo in ('documento', 'registro')),
  titulo          text not null check (char_length(titulo) between 1 and 120),
  fecha_hecho     date not null,
  vigente_hasta   date,
  estado          text not null default 'activa' check (estado in ('activa', 'reemplazada', 'eliminada')),
  reemplaza_id    uuid,
  archivo_id      uuid not null,
  archivo_nombre  text not null check (char_length(archivo_nombre) between 1 and 120),
  archivo_tipo    text not null check (archivo_tipo in (
                    'application/pdf', 'image/png', 'image/jpeg', 'text/plain',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  archivo_bytes   bigint not null check (archivo_bytes between 1 and 26214400),
  archivo_sha256  text not null check (archivo_sha256 ~ '^[0-9a-f]{64}$'),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  check (vigente_hasta is null or vigente_hasta >= fecha_hecho),
  check (reemplaza_id is null or reemplaza_id <> id),
  unique (empresa_id, id),
  unique (empresa_id, archivo_id),
  foreign key (empresa_id, control_id) references control (empresa_id, id),
  foreign key (empresa_id, reemplaza_id) references evidencia (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);

create index evidencia_control on evidencia (empresa_id, control_id, estado);

alter table evidencia enable row level security;
alter table evidencia force row level security;

create policy evidencia_propia on evidencia for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy evidencia_mantenimiento on evidencia for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Sin DELETE para la aplicación y sin UPDATE de los datos del archivo: solo el estado y quién y cuándo.
grant select, insert on evidencia to sigiso_app;
grant update (estado, actualizado_por, actualizado_en) on evidencia to sigiso_app;
grant select, insert, update, delete on evidencia to sigiso_owner;
