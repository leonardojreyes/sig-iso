import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { conTenant } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql, type Kysely } from 'kysely';
import { validarDatosSiembra, type DatosSiembra } from './datos-siembra.js';

export interface DestinosSiembra {
  /** Rol dueño: es el único que inserta empresas y personas (dentro del contexto de cada empresa). */
  readonly owner: Kysely<unknown>;
  readonly app: Kysely<unknown>;
  /** Rol de plataforma: registra el hecho sin empresa. */
  readonly plataforma: Kysely<unknown>;
}

export interface ResultadoSiembra {
  readonly empresasNuevas: number;
  readonly usuariosNuevos: number;
  readonly evento: 'registrado' | 'ya_existia';
}

/**
 * Siembra idempotente: inserta lo que falte (por identificador) y no toca lo que ya existe. Cada empresa y sus personas van en
 * UNA transacción: si algo choca, esa empresa no queda a medias. El hecho de plataforma se registra una sola vez por
 * `origenId`, después de los datos (si la corrida se interrumpe, la siguiente completa y lo registra).
 */
export const sembrar = async (destinos: DestinosSiembra, datos: DatosSiembra, origenId: string): Promise<ResultadoSiembra> => {
  validarDatosSiembra(datos);
  let empresasNuevas = 0;
  let usuariosNuevos = 0;

  for (const empresa of datos.empresas) {
    const empresaId = crearEmpresaId(empresa.id);
    await conTenant(destinos.owner, empresaId, async (trx) => {
      const e = await sql`insert into empresa (id, slug, nombre, color_primario, logo_url)
        values (${empresa.id}, ${empresa.slug}, ${empresa.nombre}, ${empresa.colorPrimario}, ${empresa.logoUrl})
        on conflict (id) do nothing returning 1`.execute(trx);
      empresasNuevas += e.rows.length;
      for (const u of datos.usuarios.filter((x) => x.empresaId === empresa.id)) {
        const r = await sql`insert into usuario (id, empresa_id, nombre, correo)
          values (${u.id}, ${u.empresaId}, ${u.nombre}, ${u.correo})
          on conflict (id) do nothing returning 1`.execute(trx);
        usuariosNuevos += r.rows.length;
      }
    });
  }

  const bitacora = new Bitacora(new BitacoraKysely({ app: destinos.app, plataforma: destinos.plataforma }));
  const evento = await bitacora.registrarUnaVez({
    empresaId: null,
    actor: { tipo: 'plataforma' },
    accion: 'datos_iniciales.cargados',
    resultado: 'ok',
    motivo: 'carga_inicial',
    origenId,
    despues: { empresas: datos.empresas.length, usuarios: datos.usuarios.length },
  });
  return { empresasNuevas, usuariosNuevos, evento };
};
