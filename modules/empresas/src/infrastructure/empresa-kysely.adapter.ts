// Adaptador de EmpresaRepositoryPort sobre PostgreSQL (Kysely). Debe recibir el pool del rol de la aplicación: la RLS de
// `empresa` solo deja ver la fila de la empresa fijada por `conTenant` (ADR 024), y el filtro por id es una segunda barrera.
import { conTenant } from '@sig/db';
import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { DatosEmpresa, DatosPersona, EmpresaRepositoryPort } from '../application/empresa-repository.port.js';

interface FilaEmpresa {
  id: string;
  slug: string;
  nombre: string;
  color_primario: string;
  logo_url: string | null;
}

export class EmpresaKysely implements EmpresaRepositoryPort {
  constructor(private readonly db: Kysely<unknown>) {}

  async obtenerPropia(empresaId: EmpresaId): Promise<DatosEmpresa | null> {
    const filas = await conTenant(this.db, empresaId, async (trx) =>
      (await sql<FilaEmpresa>`select id, slug, nombre, color_primario, logo_url from empresa where id = ${empresaId}`.execute(trx)).rows,
    );
    const fila = filas[0];
    if (!fila) return null;
    return { id: empresaId, slug: fila.slug, nombre: fila.nombre, colorPrimario: fila.color_primario, logoUrl: fila.logo_url };
  }

  async obtenerPersona(empresaId: EmpresaId, usuarioId: string): Promise<DatosPersona | null> {
    const filas = await conTenant(this.db, empresaId, async (trx) =>
      (await sql<{ id: string; nombre: string }>`select id, nombre from usuario where id = ${usuarioId}`.execute(trx)).rows,
    );
    return filas[0] ? { id: filas[0].id, nombre: filas[0].nombre } : null;
  }
}
