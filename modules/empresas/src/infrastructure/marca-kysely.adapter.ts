// Adaptador de MarcaRepositoryPort sobre PostgreSQL. Recibe la TRANSACCIÓN de una unidad de trabajo con la empresa fijada: la RLS de
// `empresa` (migración 0013) solo deja ver y actualizar la fila de ESA empresa, y la aplicación solo puede cambiar color y logo.
import type { EmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import type { CambioMarca } from '../domain/marca-empresa.js';
import type { DatosEmpresa } from '../application/empresa-repository.port.js';
import type { MarcaRepositoryPort } from '../application/marca-repository.port.js';

export class MarcaKysely implements MarcaRepositoryPort {
  constructor(
    private readonly db: Kysely<unknown>,
    private readonly empresaId: EmpresaId,
  ) {}

  async obtener(): Promise<DatosEmpresa | null> {
    const { rows } = await sql<{ slug: string; nombre: string; color_primario: string; logo_url: string | null }>`
      select slug, nombre, color_primario, logo_url from empresa where id = ${this.empresaId}`.execute(this.db);
    const f = rows[0];
    return f ? { id: this.empresaId, slug: f.slug, nombre: f.nombre, colorPrimario: f.color_primario, logoUrl: f.logo_url } : null;
  }

  async actualizar(cambio: CambioMarca): Promise<void> {
    const r = await sql`update empresa set color_primario = ${cambio.colorPrimario}, logo_url = ${cambio.logoUrl} where id = ${this.empresaId}`.execute(this.db);
    if (Number(r.numAffectedRows ?? 0) !== 1) throw new Error('No se pudo actualizar la marca de la empresa');
  }
}
