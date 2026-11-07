import { randomUUID } from 'node:crypto';
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SinPermisoError } from '@sig/normas';
import { AccesoCruzadoException } from './excepciones-acceso.js';
import { Controller, Get, crearArnes, type Arnes } from './prueba/arnes.js';

// API + PostgreSQL REAL: los hechos de acceso denegado y cruzado quedan en la bitácora inmutable, escritos en su propia
// transacción con el rol de la aplicación, y solo los ve la empresa a la que pertenecen. Cada ejecución usa empresas propias.
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

@Controller('prueba')
class Rutas {
  @Get('sin-permiso') sinPermiso(): never { throw new SinPermisoError('librerias.adoptar'); }
  @Get('cruzado') cruzado(): never { throw new AccesoCruzadoException('libreria:de-otra-empresa'); }
}

describe.skipIf(!hayBase)('acceso denegado y cruzado en la bitácora (API + PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 4 });
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const USUARIO = randomUUID();
  let arnes: Arnes;
  let token = '';
  let poolsCerrados = false;

  const registros = (empresa: typeof A) =>
    conTenant(pools.db('app'), empresa, async (trx) =>
      (await sql<{ accion: string; resultado: string; motivo: string; objeto: string | null; actor_tipo: string; usuario_id: string; empresa_id: string; secuencia: string }>`
        select accion, resultado, motivo, objeto, actor_tipo, usuario_id, empresa_id, secuencia::text from bitacora order by secuencia`.execute(trx)).rows,
    );

  beforeAll(async () => {
    const bitacora = new Bitacora(new BitacoraKysely({ app: pools.db('app'), plataforma: pools.db('plataforma') }));
    arnes = await crearArnes({ controladores: [Rutas], hechos: { registrar: (e) => bitacora.registrar(e) } });
    token = await arnes.firmar(A, USUARIO);
  });

  afterAll(async () => {
    await arnes?.cerrar();
    if (!poolsCerrados) await pools.cerrar();
  });

  it('un 403 deja UN registro acceso.denegado con quién, empresa y qué se intentó', async () => {
    const r = await arnes.pedir('/prueba/sin-permiso', token);
    expect(r.status).toBe(403);
    expect(await registros(A)).toEqual([
      { accion: 'acceso.denegado', resultado: 'rechazado', motivo: 'sin_permiso', objeto: 'accion:librerias.adoptar', actor_tipo: 'usuario', usuario_id: USUARIO, empresa_id: A, secuencia: '1' },
    ]);
  });

  it('un 404 cruzado deja UN registro acceso.cruzado y responde como un 404 normal', async () => {
    const r = await arnes.pedir('/prueba/cruzado', token);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ type: 'about:blank', title: 'No encontrado', status: 404, codigo: 'no_encontrado' });
    const filas = await registros(A);
    expect(filas.map((f) => [f.secuencia, f.accion, f.motivo, f.objeto])).toEqual([
      ['1', 'acceso.denegado', 'sin_permiso', 'accion:librerias.adoptar'],
      ['2', 'acceso.cruzado', 'empresa_distinta', 'libreria:de-otra-empresa'],
    ]);
  });

  it('los registros de A no los ve B (H6.7) y la cadena de A queda íntegra', async () => {
    expect(await registros(B)).toEqual([]);
    const problemas = await sql`select * from bitacora_verificar(${A})`.execute(pools.db('owner'));
    expect(problemas.rows).toEqual([]);
  });

  it('si la base de datos cae, el rechazo no se da por bueno: responde 500', async () => {
    await pools.cerrar();
    poolsCerrados = true;
    const r = await arnes.pedir('/prueba/sin-permiso', token);
    expect(r.status).toBe(500);
    expect(((await r.json()) as { codigo: string }).codigo).toBe('error_interno');
  });
});
