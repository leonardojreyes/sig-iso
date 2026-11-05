-- 0004 — Encadenado por huellas de la bitácora (H6.6, ADR 028).
-- Cada empresa tiene su cadena (y la plataforma, la suya): secuencia 1, 2, 3... sin huecos, y cada huella depende de la anterior.
-- Una huella válida no basta: quien reescribiera TODO el final recalcularía las huellas. Por eso se guarda un ANCLA (última
-- secuencia y huella de cada cadena) en una tabla aparte; la verificación exige que cada ancla siga existiendo en su cadena.
-- LÍMITE: lo borrado o reescrito entre dos anclas no se detecta. Se ancla de forma periódica y, para una garantía real, el ancla
-- debe copiarse además a un lugar que el dueño de la base no controle (decisión abierta del ADR 028).

-- Esta migración se niega a convivir con registros sin huella: no reescribe una bitácora que se declara inmutable.
do $$
begin
  if exists (select 1 from bitacora where hash is null) then
    raise exception 'Hay registros de bitácora sin huella; no se reescriben. Solo es posible en entornos de prueba: vacíe la tabla antes de migrar.';
  end if;
end $$;

-- Huella de un registro: SHA-256 de sus campos, cada uno con su longitud por delante (sin ambigüedad) y la huella previa.
create function bitacora_campo(valor text) returns text
  language sql immutable
  set search_path = pg_catalog
as $$ select case when valor is null then '-' else char_length(valor)::text || ':' || valor end $$;

create function bitacora_huella(r public.bitacora) returns text
  language sql immutable
  set search_path = pg_catalog, public
as $$
  select encode(
    sha256(convert_to(
      bitacora_campo(r.hash_previo) || '|' ||
      bitacora_campo(r.secuencia::text) || '|' ||
      bitacora_campo(r.empresa_id::text) || '|' ||
      bitacora_campo(r.actor_tipo) || '|' ||
      bitacora_campo(r.usuario_id::text) || '|' ||
      bitacora_campo(r.accion) || '|' ||
      bitacora_campo(r.objeto) || '|' ||
      bitacora_campo(r.objeto_version) || '|' ||
      bitacora_campo(r.resultado) || '|' ||
      bitacora_campo(r.motivo) || '|' ||
      bitacora_campo(r.trace_id) || '|' ||
      bitacora_campo(r.origen_id) || '|' ||
      bitacora_campo(r.antes::text) || '|' ||
      bitacora_campo(r.despues::text) || '|' ||
      bitacora_campo(to_char(r.creada_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
      'UTF8')),
    'hex')
$$;

-- Asigna secuencia y huellas al insertar. Corre con los permisos del dueño porque el rol de plataforma no puede leer la tabla.
-- El bloqueo consultivo serializa las inserciones de UNA cadena: la secuencia sale de la última fila, así que ni un
-- INSERT revertido ni uno concurrente dejan huecos.
create function bitacora_encadenar() returns trigger
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $$
declare
  ultima record;
  clave  text := coalesce(new.empresa_id::text, 'plataforma');
begin
  perform pg_advisory_xact_lock(hashtextextended('bitacora:' || clave, 0));
  select b.secuencia, b.hash into ultima
    from public.bitacora b
   where coalesce(b.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(new.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
   order by b.secuencia desc
   limit 1;
  new.secuencia   := coalesce(ultima.secuencia, 0) + 1;
  new.hash_previo := coalesce(ultima.hash, repeat('0', 64));
  new.hash        := public.bitacora_huella(new);
  return new;
end;
$$;

create trigger bitacora_encadenar before insert on bitacora
  for each row execute function bitacora_encadenar();

alter table bitacora alter column secuencia set not null;
alter table bitacora alter column hash_previo set not null;
alter table bitacora alter column hash set not null;
alter table bitacora add constraint bitacora_huellas_check
  check (hash ~ '^[0-9a-f]{64}$' and hash_previo ~ '^[0-9a-f]{64}$' and secuencia >= 1);

-- Aunque se saltara el disparador, no puede haber dos registros con la misma secuencia en una cadena.
create unique index bitacora_cadena_idx
  on bitacora (coalesce(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), secuencia);

-- Anclas: tabla aparte, también de solo añadir.
create table bitacora_ancla (
  id         bigint generated always as identity primary key,
  clave      text not null check (clave = 'plataforma' or clave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  secuencia  bigint not null check (secuencia >= 1),
  hash       text not null check (hash ~ '^[0-9a-f]{64}$'),
  anclada_en timestamptz not null default clock_timestamp(),
  unique (clave, secuencia)
);

revoke update, delete, truncate on bitacora_ancla from sigiso_owner;

create trigger bitacora_ancla_sin_modificar before update or delete on bitacora_ancla
  for each row execute function bitacora_inmutable();
create trigger bitacora_ancla_sin_vaciar before truncate on bitacora_ancla
  for each statement execute function bitacora_inmutable();

-- Ancla la última fila de cada cadena. Idempotente: no repite lo ya anclado. Devuelve cuántas anclas nuevas añadió.
create function bitacora_anclar() returns integer
  language plpgsql
  set search_path = pg_catalog, public
as $$
declare
  nuevas integer;
begin
  insert into public.bitacora_ancla (clave, secuencia, hash)
  select u.clave, u.secuencia, u.hash
    from (
      select distinct on (coalesce(b.empresa_id::text, 'plataforma'))
             coalesce(b.empresa_id::text, 'plataforma') as clave, b.secuencia, b.hash
        from public.bitacora b
       order by coalesce(b.empresa_id::text, 'plataforma'), b.secuencia desc
    ) u
  on conflict (clave, secuencia) do nothing;
  get diagnostics nuevas = row_count;
  return nuevas;
end;
$$;

-- Verifica las cadenas. No devuelve filas si todo está bien. `p_clave` limita a una cadena (UUID de empresa o 'plataforma').
create function bitacora_verificar(p_clave text default null)
  returns table (clave text, secuencia bigint, problema text)
  language sql stable
  set search_path = pg_catalog, public
as $$
  with filas as (
    select coalesce(b.empresa_id::text, 'plataforma') as clave,
           b.secuencia,
           b.hash,
           b.hash_previo,
           public.bitacora_huella(b) as huella_calculada,
           row_number() over w as posicion,
           lag(b.hash) over w as hash_anterior
      from public.bitacora b
     where p_clave is null or coalesce(b.empresa_id::text, 'plataforma') = p_clave
    window w as (partition by coalesce(b.empresa_id::text, 'plataforma') order by b.secuencia)
  )
  select f.clave, f.secuencia, 'hueco_en_la_secuencia'::text from filas f where f.secuencia <> f.posicion
  union all
  select f.clave, f.secuencia, 'enlace_roto'::text from filas f where f.hash_previo is distinct from coalesce(f.hash_anterior, repeat('0', 64))
  union all
  select f.clave, f.secuencia, 'huella_invalida'::text from filas f where f.hash is distinct from f.huella_calculada
  union all
  select a.clave, a.secuencia, 'ancla_perdida'::text
    from public.bitacora_ancla a
   where (p_clave is null or a.clave = p_clave)
     and not exists (
       select 1 from public.bitacora b
        where coalesce(b.empresa_id::text, 'plataforma') = a.clave and b.secuencia = a.secuencia and b.hash = a.hash
     )
$$;

-- Solo el dueño de la base verifica y ancla (de forma manual o desde un proceso de mantenimiento).
-- (bitacora_inmutable es de la migración 0003; una función de disparador no se llama directamente, pero se le quita PUBLIC igualmente.)
revoke all on function bitacora_inmutable() from public;
revoke all on function bitacora_campo(text) from public;
revoke all on function bitacora_huella(public.bitacora) from public;
revoke all on function bitacora_encadenar() from public;
revoke all on function bitacora_anclar() from public;
revoke all on function bitacora_verificar(text) from public;
grant execute on function bitacora_campo(text), bitacora_huella(public.bitacora), bitacora_anclar(), bitacora_verificar(text) to sigiso_owner;
