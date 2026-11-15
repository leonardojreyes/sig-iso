import { randomUUID } from 'node:crypto';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ActualizarMarcaUseCase } from '../application/actualizar-marca.use-case.js';
import { crearUnidadDeTrabajoMarca } from './unidad-de-trabajo-marca.js';

// Editar la marca con PostgreSQL real y dos empresas: el cambio y el hecho van en la MISMA transacción, A no toca B, y la base
// rechaza lo inválido. Cada ejecución usa empresas y personas propias (la bitácora no se puede borrar).
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('edición de la marca (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 6 });
  const owner = () => pools.db('owner');
  const sufijo = randomUUID().slice(0, 6);
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const UA = randomUUID();
  // El permiso depende de la persona Y de la empresa (en B, esta persona no tiene ninguno).
  const permisos = { puede: async (u: string, _p: 'marca.editar', e: string) => u === UA && e === A };
  // Perezoso: `describe.skipIf` ejecuta igual el cuerpo sin base.
  const caso = () => new ActualizarMarcaUseCase(crearUnidadDeTrabajoMarca(pools.db('app')), permisos);
  const marcaDe = (id: typeof A) =>
    conTenant(owner(), id, async (trx) => (await sql<{ color_primario: string; logo_url: string | null }>`select color_primario, logo_url from empresa where id = ${id}`.execute(trx)).rows[0]);
  const hechos = (id: typeof A) =>
    conTenant(owner(), id, async (trx) => (await sql<{ resultado: string; objeto: string; despues: unknown; usuario_id: string }>`select resultado, objeto, despues, usuario_id from bitacora where accion = 'marca.cambiada' and empresa_id = ${id} order by secuencia`.execute(trx)).rows);

  beforeAll(async () => {
    for (const [id, n] of [[A, 'a'], [B, 'b']] as const)
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${`mk-${n}-${sufijo}`}, ${`Empresa ${n}`}, '#0b5fff')`.execute(trx);
        if (id === A) await sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${UA}, ${id}, 'Admin A', ${UA.slice(0, 8) + '@example.test'}, 'administrador_sig')`.execute(trx);
      });
  });
  afterAll(async () => {
    await conTenant(owner(), A, async (trx) => {
      await sql`delete from usuario where empresa_id = ${A}`.execute(trx);
    });
    for (const id of [A, B]) await conTenant(owner(), id, (trx) => sql`delete from empresa where id = ${id}`.execute(trx));
    await pools.cerrar();
  });

  it('cambia el color y el logo de A, deja el hecho en la bitácora con quién lo hizo y NO toca a B', async () => {
    const m = await caso().ejecutar({ empresaId: A, usuarioId: UA, colorPrimario: '#0E5C42', logoUrl: 'https://cdn.example.test/a.png' });
    expect(m).toMatchObject({ colorOriginal: '#0e5c42', logoUrl: 'https://cdn.example.test/a.png' });
    expect(await marcaDe(A)).toEqual({ color_primario: '#0e5c42', logo_url: 'https://cdn.example.test/a.png' });
    expect(await marcaDe(B)).toEqual({ color_primario: '#0b5fff', logo_url: null });
    expect(await hechos(A)).toEqual([{ resultado: 'ok', objeto: `empresa:mk-a-${sufijo}`, despues: { color_cambiado: true, logo_cambiado: true }, usuario_id: UA }]);
    expect(await hechos(B)).toEqual([]);
  });

  it('repetir lo mismo no cambia nada ni deja otro hecho', async () => {
    await caso().ejecutar({ empresaId: A, usuarioId: UA, colorPrimario: '#0e5c42', logoUrl: 'https://cdn.example.test/a.png' });
    expect((await hechos(A)).length).toBe(1);
  });

  it('quitar el logo es un cambio de logo', async () => {
    await caso().ejecutar({ empresaId: A, usuarioId: UA, colorPrimario: '#0e5c42', logoUrl: null });
    expect((await marcaDe(A))?.logo_url).toBeNull();
    expect((await hechos(A)).at(-1)?.despues).toEqual({ color_cambiado: false, logo_cambiado: true });
  });

  it('con la identidad de A no se puede editar la marca de B (no tiene permiso allí) y B queda intacta', async () => {
    await expect(caso().ejecutar({ empresaId: B, usuarioId: UA, colorPrimario: '#112233', logoUrl: null })).rejects.toThrow(/permiso/i);
    expect(await marcaDe(B)).toEqual({ color_primario: '#0b5fff', logo_url: null });
    expect(await hechos(B)).toEqual([]);
  });

  it('si el hecho no se puede registrar, el cambio se revierte (misma transacción)', async () => {
    const antes = await marcaDe(A);
    // Se fuerza el fallo del registro con un `traceId` inválido: el cambio ya hecho en la misma transacción debe revertirse.
    await expect(caso().ejecutar({ empresaId: A, usuarioId: UA, colorPrimario: '#445566', logoUrl: null, traceId: 'no válido: con espacios y signos <>' })).rejects.toThrow();
    expect(await marcaDe(A)).toEqual(antes);
  });
});
