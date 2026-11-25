import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { CriteriosRepositoryPort, DatosCriterios, FilaCriterios } from '../application/criterios.port.js';
import type { DescripcionesEscala, NivelAceptacion } from '../domain/criterios.js';

interface Fila {
  version: number;
  probabilidad_1: string;
  probabilidad_2: string;
  probabilidad_3: string;
  probabilidad_4: string;
  probabilidad_5: string;
  impacto_1: string;
  impacto_2: string;
  impacto_3: string;
  impacto_4: string;
  impacto_5: string;
  nivel_aceptacion: string;
  creado_por: string;
  creado_en: Date;
}

/**
 * Criterios de evaluación sobre PostgreSQL. Recibe la TRANSACCIÓN de la unidad de trabajo (empresa fijada, RLS) y además filtra por
 * `empresa_id` (defensa en profundidad). La aplicación solo puede leer e insertar: cada cambio es una versión nueva (migración 0027).
 */
export class CriteriosKysely implements CriteriosRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async vigente(): Promise<FilaCriterios | null> {
    const r = await sql<Fila>`select version, probabilidad_1, probabilidad_2, probabilidad_3, probabilidad_4, probabilidad_5, impacto_1, impacto_2, impacto_3,
                                impacto_4, impacto_5, nivel_aceptacion, creado_por, creado_en
                              from criterios_version where empresa_id = ${this.empresaId} order by version desc limit 1`.execute(this.db);
    const f = r.rows[0];
    if (!f) return null;
    return {
      version: f.version,
      probabilidad: [f.probabilidad_1, f.probabilidad_2, f.probabilidad_3, f.probabilidad_4, f.probabilidad_5] as unknown as DescripcionesEscala,
      impacto: [f.impacto_1, f.impacto_2, f.impacto_3, f.impacto_4, f.impacto_5] as unknown as DescripcionesEscala,
      nivelAceptacion: f.nivel_aceptacion as NivelAceptacion,
      creadoPor: f.creado_por,
      creadoEn: f.creado_en,
    };
  }

  async crear(version: number, d: DatosCriterios, usuarioId: string, ahora: Date): Promise<boolean> {
    const p = d.probabilidad;
    const i = d.impacto;
    const r = await sql`insert into criterios_version (empresa_id, version, probabilidad_1, probabilidad_2, probabilidad_3, probabilidad_4, probabilidad_5,
                          impacto_1, impacto_2, impacto_3, impacto_4, impacto_5, nivel_aceptacion, creado_por, creado_en)
                        values (${this.empresaId}, ${version}, ${p[0]}, ${p[1]}, ${p[2]}, ${p[3]}, ${p[4]}, ${i[0]}, ${i[1]}, ${i[2]}, ${i[3]}, ${i[4]},
                          ${d.nivelAceptacion}, ${usuarioId}, ${ahora})
                        on conflict (empresa_id, version) do nothing`.execute(this.db);
    return (r.numAffectedRows ?? 0n) === 1n;
  }
}
