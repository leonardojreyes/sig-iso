// Adaptador de CatalogoRepositoryPort sobre PostgreSQL. Debe recibir la TRANSACCIÓN de una unidad de trabajo con el rol de la
// aplicación: la RLS deja ver las entradas solo a la empresa que adoptó la librería (ADR 024, 026). No filtra por empresa a mano.
import { sql, type Kysely } from 'kysely';
import type { CatalogoRepositoryPort } from '../application/catalogo-repository.port.js';
import { EntradaLibreria } from '../domain/entrada-libreria.js';
import { Libreria } from '../domain/libreria.js';

interface FilaLibreria {
  id: string;
  codigo: string;
  nombre: string;
  version: string;
  es_ejemplo: boolean;
  fuente: string;
}

interface FilaEntrada {
  id: string;
  libreria_id: string;
  id_estable: string;
  capitulo: number | null;
  nivel: number;
  tipo: string;
  grupo: string | null;
  titulo: string;
  guia: string;
  alcance_comun: string;
  orden: number;
  es_ejemplo: boolean;
  aplica_a: { norma: string; edicion: string; clausula: string }[];
}

const aLibreria = (f: FilaLibreria): Libreria =>
  Libreria.crear({ id: f.id, codigo: f.codigo, nombre: f.nombre, version: f.version, esEjemplo: f.es_ejemplo, fuente: f.fuente });

const aEntrada = (f: FilaEntrada): EntradaLibreria =>
  EntradaLibreria.crear({
    id: f.id,
    libreriaId: f.libreria_id,
    idEstable: f.id_estable,
    capitulo: f.capitulo,
    nivel: f.nivel as 1 | 2,
    tipo: f.tipo as 'clausula' | 'control',
    grupo: f.grupo,
    titulo: f.titulo,
    guia: f.guia,
    alcanceComun: f.alcance_comun as 'comun' | 'parcial' | 'especifico',
    aplicaA: f.aplica_a,
    esEjemplo: f.es_ejemplo,
    orden: f.orden,
  });

// `aplica_a` sale ordenado por norma y edición para que el resultado sea estable.
const SELECT_ENTRADA = sql`
  select e.id, e.libreria_id, e.id_estable, e.capitulo, e.nivel, e.tipo, e.grupo, e.titulo, e.guia, e.alcance_comun, e.orden, l.es_ejemplo,
         coalesce((select jsonb_agg(jsonb_build_object('norma', n.norma, 'edicion', n.edicion, 'clausula', n.clausula) order by n.norma, n.edicion)
                     from libreria_entrada_norma n where n.entrada_id = e.id), '[]'::jsonb) as aplica_a
    from libreria_entrada e
    join libreria l on l.id = e.libreria_id`;

export class CatalogoKysely implements CatalogoRepositoryPort {
  constructor(private readonly db: Kysely<unknown>) {}

  async obtenerLibreria(libreriaId: string): Promise<Libreria | null> {
    const { rows } = await sql<FilaLibreria>`select id, codigo, nombre, version, es_ejemplo, fuente from libreria where id = ${libreriaId}`.execute(this.db);
    return rows[0] ? aLibreria(rows[0]) : null;
  }

  async listarLibrerias(): Promise<Libreria[]> {
    const { rows } = await sql<FilaLibreria>`select id, codigo, nombre, version, es_ejemplo, fuente from libreria order by codigo, publicada_en`.execute(this.db);
    return rows.map(aLibreria);
  }

  async contarEntradas(libreriaId: string): Promise<number> {
    const { rows } = await sql<{ n: string }>`select count(*)::text as n from libreria_entrada where libreria_id = ${libreriaId}`.execute(this.db);
    return Number(rows[0]!.n);
  }

  async listarEntradas(): Promise<EntradaLibreria[]> {
    const { rows } = await sql<FilaEntrada>`${SELECT_ENTRADA} order by l.codigo, e.orden`.execute(this.db);
    return rows.map(aEntrada);
  }

  async obtenerEntrada(id: string): Promise<EntradaLibreria | null> {
    const { rows } = await sql<FilaEntrada>`${SELECT_ENTRADA} where e.id = ${id}`.execute(this.db);
    return rows[0] ? aEntrada(rows[0]) : null;
  }
}
