import { randomBytes, randomUUID } from 'node:crypto';
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { AutorizacionFake } from '@sig/autorizacion';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { EmpresaKysely, ObtenerIdentidadUseCase, ObtenerMarcaUseCase } from '@sig/empresas';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearArnes, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { EmpresaSesionModule } from './empresa-sesion.module.js';

// API + PostgreSQL REAL con los adaptadores de producción: la identidad y la marca salen de la base (con RLS), y el inicio y el
// cierre de sesión quedan en la bitácora inmutable, una sola vez por sesión. Cada ejecución usa empresas y personas propias.
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('empresa y sesión (API + PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 6 });
  const sufijo = randomBytes(4).toString('hex');
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const ADMIN_A = randomUUID();
  const ADMIN_B = randomUUID();
  const SIN_ROL_A = randomUUID();
  let arnes: Arnes;
  let cerrados = false;

  const registrosDe = async (origen: string) =>
    (await sql<{ accion: string; empresa_id: string; usuario_id: string; resultado: string; origen_id: string }>`
      select accion, empresa_id, usuario_id, resultado, origen_id from bitacora where origen_id = ${origen}`.execute(pools.db('owner'))).rows;

  beforeAll(async () => {
    const owner = pools.db('owner');
    const sembrar = (e: typeof A, n: string, color: string, logo: string | null, personas: [string, string][]) =>
      conTenant(owner, e, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario, logo_url) values (${e}, ${`s-${sufijo}-${n}`}, ${`Empresa ${n}`}, ${color}, ${logo})`.execute(trx);
        for (const [id, nombre] of personas) await sql`insert into usuario (id, empresa_id, nombre, correo) values (${id}, ${e}, ${nombre}, ${`${id}@example.test`})`.execute(trx);
      });
    await sembrar(A, 'a', '#0b5fff', 'https://cdn.a.example.test/logo.png', [[ADMIN_A, 'Administradora A'], [SIN_ROL_A, 'Sin rol A']]);
    await sembrar(B, 'b', '#ffe066', '//evil.example.test/logo.png', [[ADMIN_B, 'Administrador B']]);

    const autorizacion = new AutorizacionFake();
    autorizacion.asignar(A, ADMIN_A, 'administrador_sig');
    autorizacion.asignar(B, ADMIN_B, 'administrador_sig');
    const repo = new EmpresaKysely(pools.db('app'));
    const bitacora = new Bitacora(new BitacoraKysely({ app: pools.db('app'), plataforma: pools.db('plataforma') }));
    const hechos = { registrar: (e: Parameters<Bitacora['registrar']>[0]) => bitacora.registrar(e), registrarUnaVez: (e: Parameters<Bitacora['registrarUnaVez']>[0]) => bitacora.registrarUnaVez(e) };
    arnes = await crearArnes({
      hechos,
      modulos: [EmpresaSesionModule.register({ identidades: new ObtenerIdentidadUseCase(repo, autorizacion), marcas: new ObtenerMarcaUseCase(repo), hechos })],
    });
  });

  afterAll(async () => {
    await arnes?.cerrar();
    if (cerrados) return;
    const owner = pools.db('owner');
    for (const [e, personas] of [[A, [ADMIN_A, SIN_ROL_A]], [B, [ADMIN_B]]] as const) {
      await conTenant(owner, e, async (trx) => {
        for (const p of personas) await sql`delete from usuario where id = ${p}`.execute(trx);
        await sql`delete from empresa where id = ${e}`.execute(trx);
      });
    }
    await pools.cerrar();
  });

  it('GET /me lee la persona y la empresa de la base, conforme al contrato', async () => {
    const r = await arnes.pedir('/me', await arnes.firmar(A, ADMIN_A));
    expect(r.status).toBe(200);
    const c = await r.json();
    expect(c).toEqual({ usuarioId: ADMIN_A, nombre: 'Administradora A', roles: ['administrador_sig'], empresa: { slug: `s-${sufijo}-a`, nombre: 'Empresa a' } });
    expect(erroresDeEsquema('Identidad', c)).toEqual([]);
  });

  it('una persona de A con el token de B (o al revés) no existe en esa empresa: 401', async () => {
    expect((await arnes.pedir('/me', await arnes.firmar(B, ADMIN_A))).status).toBe(401);
    expect((await arnes.pedir('/me', await arnes.firmar(A, ADMIN_B))).status).toBe(401);
  });

  it('una persona sin ningún rol (cuenta desactivada) → 401', async () => {
    expect((await arnes.pedir('/me', await arnes.firmar(A, SIN_ROL_A))).status).toBe(401);
  });

  it('GET /empresa/marca: cada empresa recibe la suya; B ve el color ajustado y el logo descartado (H3.1–H3.3)', async () => {
    const deA = await (await arnes.pedir('/empresa/marca', await arnes.firmar(A, ADMIN_A))).json();
    const deB = await (await arnes.pedir('/empresa/marca', await arnes.firmar(B, ADMIN_B))).json();
    expect(deA).toEqual({ nombre: 'Empresa a', colorPrimario: '#0b5fff', colorOriginal: '#0b5fff', ajustadoPorContraste: false, logoUrl: 'https://cdn.a.example.test/logo.png' });
    expect(deB).toMatchObject({ nombre: 'Empresa b', colorOriginal: '#ffe066', ajustadoPorContraste: true, logoUrl: null });
    expect(erroresDeEsquema('Marca', deA)).toEqual([]);
    expect(erroresDeEsquema('Marca', deB)).toEqual([]);
    expect(JSON.stringify(deA)).not.toMatch(/Empresa b|ffe066|evil/);
  });

  it('POST /sesion/inicio deja UN registro login.ok en la bitácora y repetirlo no escribe otro (H6.1)', async () => {
    const t = await arnes.firmar(A, ADMIN_A, { sid: `sesion-${sufijo}` });
    expect((await arnes.pedir('/sesion/inicio', t, 'POST')).status).toBe(204);
    expect((await arnes.pedir('/sesion/inicio', t, 'POST')).status).toBe(204);
    expect(await registrosDe(`login:sesion-${sufijo}`)).toEqual([{ accion: 'login.ok', empresa_id: A, usuario_id: ADMIN_A, resultado: 'ok', origen_id: `login:sesion-${sufijo}` }]);
  });

  it('POST /sesion/cierre deja UN registro logout y es idempotente (H6.3)', async () => {
    const t = await arnes.firmar(A, ADMIN_A, { sid: `sesion-${sufijo}` });
    expect((await arnes.pedir('/sesion/cierre', t, 'POST')).status).toBe(204);
    expect((await arnes.pedir('/sesion/cierre', t, 'POST')).status).toBe(204);
    expect(await registrosDe(`logout:sesion-${sufijo}`)).toEqual([{ accion: 'logout', empresa_id: A, usuario_id: ADMIN_A, resultado: 'ok', origen_id: `logout:sesion-${sufijo}` }]);
  });

  it('una cuenta sin roles no inicia sesión: 401 y nada en la bitácora', async () => {
    const sid = `sin-rol-${sufijo}`;
    expect((await arnes.pedir('/sesion/inicio', await arnes.firmar(A, SIN_ROL_A, { sid }), 'POST')).status).toBe(401);
    expect(await registrosDe(`login:${sid}`)).toEqual([]);
  });

  it('con la base de datos caída, el inicio de sesión responde 500 (no hay sesión sin rastro)', async () => {
    await pools.cerrar();
    cerrados = true;
    const r = await arnes.pedir('/sesion/inicio', await arnes.firmar(A, ADMIN_A, { sid: `caida-${sufijo}` }), 'POST');
    expect(r.status).toBe(500);
    expect(((await r.json()) as { codigo: string }).codigo).toBe('error_interno');
  });
});
