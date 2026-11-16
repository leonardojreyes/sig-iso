-- 0015 — Personas: solicitud de acceso, baja y cambio de rol (ADR 036, MVP M7).
--
-- 1) `usuario` gana `baja_en` (una baja deja el rol en nulo y anota cuándo; la fila NO se borra: la autoría la referencia) y `version`
--    (concurrencia optimista al cambiar rol o dar de baja).
-- 2) `solicitud_acceso`: una persona autenticada que aún no tiene rol pide acceso y recibe un código corto. Sin nombre ni correo del
--    token: los escribe el administrador al aprobar. Una solicitud vigente por persona y empresa; el código no se repite entre las
--    vigentes de una empresa.
-- 3) La aplicación ya podía insertar usuarios sin `rol` (0005 le quitó asignar roles hasta que existiera la pantalla). Ahora puede fijar
--    `rol`, `baja_en` y `version`; QUIÉN puede hacerlo lo decide la autorización por rol (permiso `personas.gestionar`, solo el
--    administrador SIG), no la base. La plataforma sigue leyendo solo `id`, `empresa_id` y `rol` (0012): un rol nulo no pertenece.

alter table usuario add column baja_en timestamptz;
alter table usuario add column version integer not null default 1 check (version >= 1);
alter table usuario add constraint usuario_baja_sin_rol check (baja_en is null or rol is null);

create table solicitud_acceso (
  id           uuid primary key,
  empresa_id   uuid not null references empresa (id),
  -- El `sub` del token. Sin clave foránea: la persona todavía no tiene fila en `usuario` (eso es justo lo que se pide).
  usuario_id   uuid not null,
  -- Ocho caracteres `XXXX-XXXX` de un alfabeto sin ambiguos (sin 0, O, 1, I ni L).
  codigo       text not null check (codigo ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'descartada', 'vencida')),
  creada_en    timestamptz not null default now(),
  vence_en     timestamptz not null,
  resuelta_en  timestamptz,
  resuelta_por uuid,
  constraint solicitud_acceso_vence_despues check (vence_en > creada_en),
  -- Pendiente = sin resolver; cualquier otro estado la resolvió alguien o el tiempo.
  constraint solicitud_acceso_resuelta_coherente check ((estado = 'pendiente') = (resuelta_en is null)),
  constraint solicitud_acceso_resuelta_por_empresa
    foreign key (empresa_id, resuelta_por) references usuario (empresa_id, id)
);
create index solicitud_acceso_empresa_idx on solicitud_acceso (empresa_id, estado);
create unique index solicitud_acceso_una_vigente on solicitud_acceso (empresa_id, usuario_id) where estado = 'pendiente';
create unique index solicitud_acceso_codigo_vigente on solicitud_acceso (empresa_id, codigo) where estado = 'pendiente';

alter table solicitud_acceso enable row level security;
alter table solicitud_acceso force row level security;

create policy solicitud_acceso_propias on solicitud_acceso
  for all to sigiso_app
  using (empresa_id = (select app_tenant_id()))
  with check (empresa_id = (select app_tenant_id()));

-- El dueño solo mantiene datos DENTRO del contexto de una empresa (siembra, mantenimiento).
create policy solicitud_acceso_mantenimiento on solicitud_acceso
  for all to sigiso_owner
  using (empresa_id = (select app_tenant_id()))
  with check (empresa_id = (select app_tenant_id()));

-- Sin DELETE: una solicitud se resuelve (aprobada, descartada o vencida), no se borra.
grant select, insert on solicitud_acceso to sigiso_app;
grant update (estado, resuelta_en, resuelta_por) on solicitud_acceso to sigiso_app;

-- usuario: de `nombre` y `correo` (0001) se pasa a poder fijar también `rol`, `baja_en` y `version`.
grant insert (rol) on usuario to sigiso_app;
grant update (rol, baja_en, version) on usuario to sigiso_app;
