-- 0025 — Auditoría interna: lista de verificación, hallazgos e informe congelado (ADR 040). Todo lleva empresa_id y RLS forzado, con
-- claves foráneas compuestas. Las entradas de las normas se referencian por (código de librería, versión, id estable), sin clave
-- foránea, y la versión queda fijada al generar la lista. Los textos libres (nota, evidencia, enunciado, conclusión) son de la empresa y
-- NO van a la bitácora. Un hallazgo no se borra (se anula) y el informe emitido es inmutable: la aplicación solo lo lee e inserta.

create table auditoria_item (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa (id),
  auditoria_id    uuid not null,
  libreria_codigo text not null check (char_length(libreria_codigo) between 1 and 80),
  libreria_version text not null check (char_length(libreria_version) between 1 and 40),
  id_estable      text not null check (char_length(id_estable) between 1 and 80),
  resultado       text not null default 'por_evaluar' check (resultado in
                    ('por_evaluar', 'conforme', 'no_conforme', 'observacion', 'oportunidad', 'no_aplica', 'no_verificado')),
  -- Evidencia objetiva observada (qué se vio, dónde, qué se esperaba) o justificación; texto de la empresa.
  nota            text check (nota is null or char_length(btrim(nota)) between 1 and 500),
  evaluado_por    uuid,
  evaluado_en     timestamptz,
  version         integer not null default 1 check (version >= 1),
  creado_por      uuid not null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid not null,
  actualizado_en  timestamptz not null default now(),
  -- Un resultado distinto de «conforme» y «no verificado» exige la nota; «por evaluar» no puede traer evaluador.
  check (resultado in ('por_evaluar', 'conforme', 'no_verificado') or nota is not null),
  check ((resultado = 'por_evaluar') = (evaluado_por is null and evaluado_en is null)),
  unique (empresa_id, auditoria_id, libreria_codigo, id_estable),
  unique (empresa_id, id),
  foreign key (empresa_id, auditoria_id) references auditoria (empresa_id, id),
  foreign key (empresa_id, evaluado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);
create index auditoria_item_auditoria on auditoria_item (empresa_id, auditoria_id, resultado);

-- Preguntas propias del equipo para una fila (hasta 5 por fila: la regla es del dominio).
create table auditoria_pregunta (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  item_id    uuid not null,
  texto      text not null check (char_length(btrim(texto)) between 1 and 300),
  creado_por uuid not null,
  creado_en  timestamptz not null default now(),
  foreign key (empresa_id, item_id) references auditoria_item (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id)
);
create index auditoria_pregunta_item on auditoria_pregunta (empresa_id, item_id);

create table hallazgo (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references empresa (id),
  auditoria_id          uuid not null,
  -- Fila de la que sale; nulo si es un hallazgo transversal.
  item_id               uuid,
  -- Correlativo por auditoría; el código («H-001») se deriva.
  numero                integer not null check (numero >= 1),
  codigo                text generated always as ('H-' || lpad(numero::text, 3, '0')) stored,
  tipo                  text not null check (tipo in ('nc_mayor', 'nc_menor', 'observacion', 'oportunidad')),
  proceso_id            uuid,
  -- Requisito incumplido (entrada de la norma): obligatorio en una NC.
  libreria_codigo       text check (libreria_codigo is null or char_length(libreria_codigo) between 1 and 80),
  id_estable            text check (id_estable is null or char_length(id_estable) between 1 and 80),
  enunciado             text not null check (char_length(btrim(enunciado)) between 1 and 500),
  evidencia             text not null check (char_length(btrim(evidencia)) between 1 and 1000),
  -- Criterio del auditor líder para una NC mayor.
  justificacion_gravedad text check (justificacion_gravedad is null or char_length(btrim(justificacion_gravedad)) between 1 and 500),
  -- El tratamiento (causa raíz, acciones, verificación) es de otro módulo: aquí solo «abierto» o «anulado».
  estado                text not null default 'abierto' check (estado in ('abierto', 'anulado')),
  anulacion_motivo      text check (anulacion_motivo is null or anulacion_motivo in ('duplicado', 'error_de_registro', 'otro')),
  anulado_por           uuid,
  anulado_en            timestamptz,
  registrado_por        uuid not null,
  version               integer not null default 1 check (version >= 1),
  creado_por            uuid not null,
  creado_en             timestamptz not null default now(),
  actualizado_por       uuid not null,
  actualizado_en        timestamptz not null default now(),
  check ((libreria_codigo is null) = (id_estable is null)),
  check (tipo not in ('nc_mayor', 'nc_menor') or (proceso_id is not null and libreria_codigo is not null)),
  check (tipo <> 'nc_mayor' or justificacion_gravedad is not null),
  check ((estado = 'anulado') = (anulacion_motivo is not null and anulado_por is not null and anulado_en is not null)),
  unique (empresa_id, auditoria_id, numero),
  unique (empresa_id, id),
  foreign key (empresa_id, auditoria_id) references auditoria (empresa_id, id),
  foreign key (empresa_id, item_id) references auditoria_item (empresa_id, id),
  foreign key (empresa_id, proceso_id) references proceso (empresa_id, id),
  foreign key (empresa_id, anulado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, registrado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, creado_por) references usuario (empresa_id, id),
  foreign key (empresa_id, actualizado_por) references usuario (empresa_id, id)
);
create index hallazgo_auditoria on hallazgo (empresa_id, auditoria_id, estado);

-- Informe emitido: copia congelada e inmutable (equipo con sus excepciones, conteos, hallazgos, cobertura, conclusión y limitaciones).
-- Una auditoría tiene a lo sumo un informe; un error se corrige con una auditoría complementaria. Puede contener datos personales de un
-- texto libre sin vía de rectificación (ADR 028, insumo para el asesor legal).
create table auditoria_informe (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa (id),
  auditoria_id uuid not null,
  contenido    jsonb not null check (jsonb_typeof(contenido) = 'object'),
  huella       text not null check (huella ~ '^[0-9a-f]{64}$'),
  emitido_por  uuid not null,
  emitido_en   timestamptz not null default now(),
  unique (empresa_id, auditoria_id),
  unique (empresa_id, id),
  foreign key (empresa_id, auditoria_id) references auditoria (empresa_id, id),
  foreign key (empresa_id, emitido_por) references usuario (empresa_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['auditoria_item', 'auditoria_pregunta', 'hallazgo', 'auditoria_informe']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy %I on %I for all to sigiso_app using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()))', t || '_propio', t);
    execute format('create policy %I on %I for all to sigiso_owner using (empresa_id = (select app_tenant_id())) with check (empresa_id = (select app_tenant_id()))', t || '_mantenimiento', t);
    execute format('grant select, insert, update, delete on %I to sigiso_owner', t);
  end loop;
end $$;

-- Las filas se generan y se quitan al regenerar la lista (el dominio solo quita las «por evaluar»); el resultado cambia por columnas.
grant select, insert, delete on auditoria_item to sigiso_app;
grant update (resultado, nota, evaluado_por, evaluado_en, version, actualizado_por, actualizado_en) on auditoria_item to sigiso_app;
grant select, insert, delete on auditoria_pregunta to sigiso_app;
-- Un hallazgo no se borra (se anula); nunca cambian el correlativo, la auditoría, la fila ni quién lo registró.
grant select, insert on hallazgo to sigiso_app;
grant update (tipo, proceso_id, libreria_codigo, id_estable, enunciado, evidencia, justificacion_gravedad, estado, anulacion_motivo,
              anulado_por, anulado_en, version, actualizado_por, actualizado_en) on hallazgo to sigiso_app;
-- El informe emitido es inmutable: solo se lee e inserta.
grant select, insert on auditoria_informe to sigiso_app;
