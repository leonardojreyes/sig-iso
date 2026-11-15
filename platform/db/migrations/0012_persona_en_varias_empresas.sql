-- 0012 — Una persona en varias empresas y empresa activa por sesión (ADR 035, MVP M6b-1).
-- La clave de `usuario` pasa a ser (empresa_id, id): el mismo `id` (la cuenta) puede tener una fila por empresa, cada una con su rol.
-- Todas las claves foráneas que ya eran compuestas (empresa_id, id) siguen valiendo; la de `empresa_libreria.adoptada_por` pasa a compuesta.

-- Validar la clave foránea nueva recorre las dos tablas con RLS forzada y el dueño no tiene empresa en contexto: se quita el `force`
-- SOLO mientras dura esta transacción (la migración es atómica) y se vuelve a poner antes de terminar.
alter table empresa_libreria no force row level security;
alter table usuario no force row level security;
alter table empresa_libreria drop constraint empresa_libreria_adoptada_por_fkey;
alter table usuario drop constraint usuario_pkey;
alter table usuario add constraint usuario_pkey primary key (empresa_id, id);
alter table empresa_libreria add foreign key (empresa_id, adoptada_por) references usuario (empresa_id, id);
alter table usuario force row level security;
alter table empresa_libreria force row level security;

-- Empresa activa de una sesión. NO lleva RLS por empresa: la guardia la consulta ANTES de saber la empresa. Solo la toca el rol de
-- plataforma (la aplicación del negocio no). La clave foránea compuesta garantiza que la persona pertenece a esa empresa.
create table empresa_activa (
  sid         text primary key check (char_length(sid) between 1 and 200),
  usuario_id  uuid not null,
  empresa_id  uuid not null,
  cambiada_en timestamptz not null default now(),
  expira_en   timestamptz not null,
  foreign key (empresa_id, usuario_id) references usuario (empresa_id, id)
);
create index empresa_activa_expira_idx on empresa_activa (expira_en);

alter table empresa_activa enable row level security;
alter table empresa_activa force row level security;
create policy empresa_activa_plataforma on empresa_activa for all to sigiso_plataforma using (true) with check (true);
create policy empresa_activa_mantenimiento on empresa_activa for all to sigiso_owner using (true) with check (true);

grant select, insert, delete on empresa_activa to sigiso_plataforma;
grant update (empresa_id, cambiada_en, expira_en) on empresa_activa to sigiso_plataforma;

-- Para saber a qué empresas pertenece una persona, la plataforma lee SOLO identificador, empresa y rol de `usuario`, y
-- identificador, slug y nombre de `empresa`. No ve correos ni nombres de personas.
create policy usuario_plataforma_lee on usuario for select to sigiso_plataforma using (true);
grant select (id, empresa_id, rol) on usuario to sigiso_plataforma;
create policy empresa_plataforma_lee on empresa for select to sigiso_plataforma using (true);
grant select (id, slug, nombre) on empresa to sigiso_plataforma;
