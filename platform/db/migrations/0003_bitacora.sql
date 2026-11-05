-- 0003 — Bitácora inmutable (P15, ADR 028).
-- Solo se añade: nadie modifica, borra ni vacía. No guarda datos que identifiquen a la persona (solo el identificador opaco de la
-- cuenta), ni dirección de red, ni texto libre: el motivo es un código y antes/despues admiten solo objetos acotados.
-- Sin claves foráneas a propósito: el registro debe poder sobrevivir a la empresa o a la persona a la que se refiere.

create table bitacora (
  id             bigint generated always as identity primary key,
  empresa_id     uuid,   -- NULL = hecho de plataforma (sin empresa)
  actor_tipo     text not null check (actor_tipo in ('usuario', 'sistema', 'proceso', 'plataforma')),
  usuario_id     uuid,   -- identificador opaco de la cuenta; NULL si no existe (p. ej. intento fallido de una cuenta inexistente)
  accion         text not null check (accion ~ '^[a-z_]+(\.[a-z_]+)*$'),
  objeto         text check (objeto is null or char_length(objeto) <= 200),
  objeto_version text check (objeto_version is null or char_length(objeto_version) <= 100),
  resultado      text not null check (resultado in ('ok', 'rechazado', 'error')),
  motivo         text check (motivo is null or motivo ~ '^[a-z0-9_]{1,60}$'),  -- código de una lista cerrada, nunca texto libre
  trace_id       text check (trace_id is null or trace_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  origen_id      text check (origen_id is null or char_length(origen_id) between 1 and 200),  -- evita repetir eventos externos
  antes          jsonb check (antes is null or (jsonb_typeof(antes) = 'object' and pg_column_size(antes) <= 4096)),
  despues        jsonb check (despues is null or (jsonb_typeof(despues) = 'object' and pg_column_size(despues) <= 4096)),
  creada_en      timestamptz not null default clock_timestamp(),  -- la fija el servidor: quien actúa no puede elegirla
  secuencia      bigint,  -- las llena el encadenado por huellas (tarea 3.3)
  hash_previo    text,
  hash           text
);

create unique index bitacora_origen_idx on bitacora (origen_id) where origen_id is not null;
create index bitacora_empresa_idx on bitacora (empresa_id, id);

alter table bitacora enable row level security;
alter table bitacora force row level security;

-- Cada empresa escribe y lee SOLO lo suyo.
create policy bitacora_empresa_inserta on bitacora
  for insert to sigiso_app
  with check (empresa_id = (select app_tenant_id()));

create policy bitacora_empresa_lee on bitacora
  for select to sigiso_app
  using (empresa_id = (select app_tenant_id()));

-- Los hechos de plataforma (sin empresa) solo los escribe el rol de plataforma, y solo sin empresa. No puede leerlos.
create policy bitacora_plataforma_inserta on bitacora
  for insert to sigiso_plataforma
  with check (empresa_id is null);

-- Atención de solicitudes de las personas (ADR 028): el dueño de la base consulta todo, de forma manual. No escribe.
create policy bitacora_dueno_lee on bitacora
  for select to sigiso_owner
  using (true);

-- Permisos mínimos. INSERT por columna: quien actúa no puede fijar id, fecha ni columnas del encadenado.
grant select on bitacora to sigiso_app;
grant insert (empresa_id, actor_tipo, usuario_id, accion, objeto, objeto_version, resultado, motivo, trace_id, origen_id, antes, despues)
  on bitacora to sigiso_app, sigiso_plataforma;

-- Inmutabilidad: ni siquiera el dueño tiene permisos de modificar, borrar o vaciar...
revoke update, delete, truncate on bitacora from sigiso_owner;

-- ...y, si alguien se los otorgara de nuevo, los disparadores lo impiden.
create function bitacora_inmutable() returns trigger
  language plpgsql
  set search_path = pg_catalog
as $$
begin
  raise exception 'La bitácora es de solo añadir: no se puede % ningún registro', lower(tg_op)
    using errcode = '42501';
end;
$$;

create trigger bitacora_sin_modificar before update or delete on bitacora
  for each row execute function bitacora_inmutable();

create trigger bitacora_sin_vaciar before truncate on bitacora
  for each statement execute function bitacora_inmutable();
