-- Controles del Anexo A en las librerías (MVP): cada entrada es una cláusula (capítulo 4–10) o un control, que se agrupa por tema.
-- Cambio aditivo: las entradas existentes quedan como cláusulas. El catálogo sigue siendo solo-inserción y global.

alter table libreria_entrada add column tipo text not null default 'clausula' check (tipo in ('clausula', 'control'));
alter table libreria_entrada add column grupo text check (grupo is null or char_length(grupo) between 2 and 60);

-- El capítulo pasa a ser opcional (los controles no tienen capítulo) sin perder su rango para las cláusulas.
alter table libreria_entrada alter column capitulo drop not null;
alter table libreria_entrada drop constraint libreria_entrada_capitulo_check;
alter table libreria_entrada add constraint libreria_entrada_capitulo_check check (capitulo is null or capitulo between 4 and 10);

-- Coherencia: una cláusula lleva capítulo y no lleva grupo; un control lleva grupo y no lleva capítulo.
alter table libreria_entrada add constraint libreria_entrada_tipo_coherente check (
  (tipo = 'clausula' and capitulo is not null and grupo is null) or (tipo = 'control' and capitulo is null and grupo is not null)
);
