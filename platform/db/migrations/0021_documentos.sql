-- 0021 — Control documental: documentos y sus versiones (ADR 039). Datos «Confidenciales de la empresa»: todo lleva empresa_id y RLS
-- forzado, con claves foráneas compuestas. Un documento nunca se borra (se retira) y las versiones guardan UN archivo (ADR 032) cuyos
-- datos (archivo, tipo, tamaño, huella, nota, número, autor) NO se pueden modificar: la aplicación solo cambia el estado del flujo.
-- Los números de migración de «Gestión de riesgos completa» se renumeran después de esta (el módulo aún no tiene migraciones).

create table documento (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references empresa (id),
  tipo                text not null check (tipo in ('politica', 'procedimiento', 'instructivo', 'formato', 'manual', 'externo', 'otro')),
  -- Correlativo por empresa y tipo; el código («POL-001») se deriva y no se reutiliza (el documento se retira, no se borra).
  numero              integer not null check (numero >= 1),
  codigo              text generated always as (
                        case tipo when 'politica' then 'POL' when 'procedimiento' then 'PRO' when 'instructivo' then 'INS'
                                  when 'formato' then 'FOR' when 'manual' then 'MAN' when 'externo' then 'EXT' else 'OTR' end
                        || '-' || lpad(numero::text, 3, '0')) stored,
  titulo              text not null check (char_length(btrim(titulo)) between 1 and 120),
  area                text check (area is null or char_length(btrim(area)) between 1 and 60),
  clasificacion       text not null check (clasificacion in ('publica', 'interna', 'confidencial', 'restringida')),
  responsable_id      uuid not null,
  -- Solo los documentos de origen externo (norma, reglamento, contrato) llevan emisor y edición de la fuente.
  emisor              text check (emisor is null or char_length(btrim(emisor)) between 1 and 120),
  edicion_fuente      text check (edicion_fuente is null or char_length(btrim(edicion_fuente)) between 1 and 60),
  estado              text not null default 'activo' check (estado in ('activo', 'retirado')),
  proxima_revision    date,
  ultima_revision_en  timestamptz,
  ultima_revision_por uuid,
  version             integer not null default 1 check (version >= 1),
  creado_por          uuid not null,
  creado_en           timestamptz not null default now(),
  actualizado_por     uuid not null,
  actualizado_en      timestamptz not null default now(),
  check (tipo = 'externo' or (emisor is null and edicion_fuente is null)),
  unique (empresa_id, tipo, numero),
  unique (empresa_id, id),
  foreign key (empresa_id, responsable_id) references usuario (empresa_id, id),
  foreign key (empresa_id, ultima_revision_por) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);
create index documento_estado on documento (empresa_id, estado, tipo);

create table documento_version (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references empresa (id),
  documento_id      uuid not null,
  numero            integer not null check (numero >= 1),
  estado            text not null default 'borrador' check (estado in ('borrador', 'en_revision', 'aprobada', 'obsoleta', 'descartada')),
  nota              text not null check (char_length(btrim(nota)) between 1 and 500),
  archivo_id        uuid not null,
  archivo_nombre    text not null check (char_length(archivo_nombre) between 1 and 120),
  archivo_tipo      text not null check (archivo_tipo in (
                      'application/pdf', 'image/png', 'image/jpeg', 'text/plain',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  archivo_bytes     bigint not null check (archivo_bytes between 1 and 26214400),
  archivo_sha256    text not null check (archivo_sha256 ~ '^[0-9a-f]{64}$'),
  autor_id          uuid not null,
  aprobador_id      uuid,
  enviada_en        timestamptz,
  aprobada_por      uuid,
  aprobada_en       timestamptz,
  -- Excepción del único administrador: aprobó su propia versión, con motivo obligatorio (texto de la empresa; NO va a la bitácora).
  por_su_autor      boolean not null default false,
  motivo_excepcion  text check (motivo_excepcion is null or char_length(btrim(motivo_excepcion)) between 1 and 300),
  requiere_lectura  boolean not null default false,
  devuelta_motivo   text check (devuelta_motivo is null or devuelta_motivo in ('incompleta', 'incorrecta', 'otro')),
  devuelta_nota     text check (devuelta_nota is null or char_length(btrim(devuelta_nota)) between 1 and 300),
  obsoleta_en       timestamptz,
  version           integer not null default 1 check (version >= 1),
  creado_por        uuid not null,
  creado_en         timestamptz not null default now(),
  actualizado_por   uuid not null,
  actualizado_en    timestamptz not null default now(),
  check (por_su_autor = (motivo_excepcion is not null)),
  check (estado not in ('aprobada', 'obsoleta') or (aprobada_por is not null and aprobada_en is not null)),
  check (estado <> 'en_revision' or aprobador_id is not null),
  unique (empresa_id, documento_id, numero),
  unique (empresa_id, id),
  unique (empresa_id, archivo_id),
  foreign key (empresa_id, documento_id) references documento (empresa_id, id),
  foreign key (empresa_id, autor_id) references usuario (empresa_id, id),
  foreign key (empresa_id, aprobador_id) references usuario (empresa_id, id),
  foreign key (empresa_id, aprobada_por) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);
-- Una sola versión aprobada (vigente) por documento: lo garantiza la base, no solo la aplicación.
create unique index documento_version_unica_vigente on documento_version (empresa_id, documento_id) where estado = 'aprobada';
create index documento_version_documento on documento_version (empresa_id, documento_id, estado);

alter table documento enable row level security;
alter table documento force row level security;
alter table documento_version enable row level security;
alter table documento_version force row level security;

create policy documento_propio on documento for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_mantenimiento on documento for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_version_propia on documento_version for all to sigiso_app
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));
create policy documento_version_mantenimiento on documento_version for all to sigiso_owner
  using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()));

-- Sin DELETE para la aplicación; UPDATE solo por columnas (nunca el código, el tipo, el archivo, la huella, la nota ni la autoría).
grant select, insert on documento to sigiso_app;
grant update (titulo, area, clasificacion, responsable_id, emisor, edicion_fuente, estado, proxima_revision, ultima_revision_en,
              ultima_revision_por, version, actualizado_por, actualizado_en) on documento to sigiso_app;
grant select, insert on documento_version to sigiso_app;
grant update (estado, aprobador_id, enviada_en, aprobada_por, aprobada_en, por_su_autor, motivo_excepcion, requiere_lectura,
              devuelta_motivo, devuelta_nota, obsoleta_en, version, actualizado_por, actualizado_en) on documento_version to sigiso_app;
grant select, insert, update, delete on documento to sigiso_owner;
grant select, insert, update, delete on documento_version to sigiso_owner;
