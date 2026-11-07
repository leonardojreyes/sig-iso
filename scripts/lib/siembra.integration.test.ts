import { randomBytes, randomUUID } from 'node:crypto';
import { conTenant, GestorPools, leerUrls } from '@sig/db';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATOS_SIEMBRA, type DatosSiembra } from './datos-siembra.js';
import { sembrar } from './siembra.js';

// Integración con PostgreSQL real (sigiso_test). Usa una COPIA de los datos con identificadores y alias propios de esta
// ejecución: no toca las empresas de la siembra real ni choca con las de otras pruebas. La bitácora no se puede borrar.
const hayBase = Boolean(process.env.DATABASE_URL_OWNER && process.env.DATABASE_URL_APP && process.env.DATABASE_URL_PLATAFORMA && process.env.DATABASE_URL_TEST);

describe.skipIf(!hayBase)('sembrar (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ['owner', 'app', 'plataforma'], { prueba: true }) : {}, { max: 6 });
  const destinos = () => ({ owner: pools.db('owner'), app: pools.db('app'), plataforma: pools.db('plataforma') });
  const sufijo = randomBytes(4).toString('hex');
  const origenId = `siembra:prueba:${sufijo}`;

  const mapa = new Map<string, string>();
  const nuevo = (id: string) => (mapa.has(id) ? mapa.get(id)! : (mapa.set(id, randomUUID()), mapa.get(id)!));
  const datos: DatosSiembra = {
    empresas: DATOS_SIEMBRA.empresas.map((e) => ({ ...e, id: nuevo(e.id), slug: `${e.slug}-${sufijo}` })),
    usuarios: DATOS_SIEMBRA.usuarios.map((u) => ({ ...u, id: nuevo(u.id), empresaId: nuevo(u.empresaId) })),
  };
  const A = datos.empresas[0]!.id;
  const B = datos.empresas[1]!.id;

  const personasDe = (empresa: string) =>
    conTenant(pools.db('owner'), empresa as never, async (trx) => (await sql<{ id: string; correo: string; nombre: string }>`select id, correo, nombre from usuario order by correo`.execute(trx)).rows);
  const empresaDe = (empresa: string) =>
    conTenant(pools.db('owner'), empresa as never, async (trx) => (await sql<{ id: string; slug: string; nombre: string; color_primario: string }>`select id, slug, nombre, color_primario from empresa`.execute(trx)).rows);
  const eventos = async () =>
    (await sql<{ accion: string; empresa_id: string | null; actor_tipo: string; motivo: string; despues: Record<string, number>; resultado: string }>`
      select accion, empresa_id, actor_tipo, motivo, despues, resultado from bitacora where origen_id = ${origenId}`.execute(pools.db('owner'))).rows;

  beforeAll(() => {
    // Una corrida limpia de datos: las empresas de esta ejecución no existen todavía.
  });

  afterAll(async () => {
    for (const e of datos.empresas) {
      await conTenant(pools.db('owner'), e.id as never, async (trx) => {
        await sql`delete from usuario where empresa_id = ${e.id}`.execute(trx);
        await sql`delete from empresa where id = ${e.id}`.execute(trx);
      });
    }
    await pools.cerrar();
  });

  it('la primera corrida crea las dos empresas y las cuatro personas y registra UN hecho de plataforma', async () => {
    const r = await sembrar(destinos(), datos, origenId);
    expect(r).toEqual({ empresasNuevas: 2, usuariosNuevos: 4, evento: 'registrado' });
    expect((await empresaDe(A))[0]).toMatchObject({ id: A, nombre: 'Empresa A (prueba)', color_primario: datos.empresas[0]!.colorPrimario });
    expect((await personasDe(A)).map((p) => p.correo)).toEqual(['admin-a@example.test', 'colab-a@example.test']);
    expect((await personasDe(B)).map((p) => p.correo)).toEqual(['admin-b@example.test', 'colab-b@example.test']);
    expect(await eventos()).toEqual([{ accion: 'datos_iniciales.cargados', empresa_id: null, actor_tipo: 'plataforma', motivo: 'carga_inicial', despues: { empresas: 2, usuarios: 4 }, resultado: 'ok' }]);
  });

  it('una segunda corrida deja el MISMO estado: nada nuevo y ningún hecho más', async () => {
    const antes = { a: await personasDe(A), b: await personasDe(B), ea: await empresaDe(A), eb: await empresaDe(B) };
    const r = await sembrar(destinos(), datos, origenId);
    expect(r).toEqual({ empresasNuevas: 0, usuariosNuevos: 0, evento: 'ya_existia' });
    expect({ a: await personasDe(A), b: await personasDe(B), ea: await empresaDe(A), eb: await empresaDe(B) }).toEqual(antes);
    expect(await eventos()).toHaveLength(1);
  });

  it('completa lo que falte sin tocar lo demás (recuperación tras una corrida a medias)', async () => {
    const quitada = datos.usuarios[1]!;
    await conTenant(pools.db('owner'), A as never, (trx) => sql`delete from usuario where id = ${quitada.id}`.execute(trx));
    const r = await sembrar(destinos(), datos, origenId);
    expect(r).toMatchObject({ empresasNuevas: 0, usuariosNuevos: 1, evento: 'ya_existia' });
    expect((await personasDe(A)).map((p) => p.correo)).toEqual(['admin-a@example.test', 'colab-a@example.test']);
    expect(await eventos()).toHaveLength(1);
  });

  it('no pisa lo que se cambió a mano después de sembrar', async () => {
    await conTenant(pools.db('owner'), A as never, (trx) => sql`update empresa set nombre = 'Nombre cambiado' where id = ${A}`.execute(trx));
    await sembrar(destinos(), datos, origenId);
    expect((await empresaDe(A))[0]!.nombre).toBe('Nombre cambiado');
  });

  it('A y B quedan aisladas: con el rol de la aplicación cada una ve solo lo suyo', async () => {
    const deA = await conTenant(pools.db('app'), A as never, async (trx) => (await sql<{ correo: string }>`select correo from usuario order by correo`.execute(trx)).rows.map((f) => f.correo));
    const deB = await conTenant(pools.db('app'), B as never, async (trx) => (await sql<{ correo: string }>`select correo from usuario order by correo`.execute(trx)).rows.map((f) => f.correo));
    expect(deA).toEqual(['admin-a@example.test', 'colab-a@example.test']);
    expect(deB).toEqual(['admin-b@example.test', 'colab-b@example.test']);
  });

  it('un conflicto real (mismo correo con otro identificador) falla y no deja esa empresa a medias', async () => {
    const sufijo2 = randomBytes(3).toString('hex');
    const idEmpresa = randomUUID();
    const conflictivo: DatosSiembra = {
      empresas: [{ id: idEmpresa, slug: `conf-${sufijo2}`, nombre: 'Conflictiva', colorPrimario: '#0b5fff', logoUrl: null }],
      usuarios: [
        { alias: 'u1', id: randomUUID(), empresaId: idEmpresa, nombre: 'Uno', correo: 'mismo@example.test', rol: 'colaborador' },
        { alias: 'u2', id: randomUUID(), empresaId: idEmpresa, nombre: 'Dos', correo: 'mismo@example.test', rol: 'colaborador' },
      ],
    };
    // La validación ya lo rechaza antes de tocar la base…
    await expect(sembrar(destinos(), conflictivo, `siembra:prueba:${sufijo2}`)).rejects.toThrow(/repetid/i);
    expect(await conTenant(pools.db('owner'), idEmpresa as never, async (trx) => (await sql`select 1 from empresa`.execute(trx)).rows)).toEqual([]);
    expect((await sql`select 1 from bitacora where origen_id = ${`siembra:prueba:${sufijo2}`}`.execute(pools.db('owner'))).rows).toEqual([]);
  });

  it('un choque en la base (correo ya usado por otra persona) revierte la empresa entera y no registra el hecho', async () => {
    const sufijo3 = randomBytes(3).toString('hex');
    const idEmpresa = randomUUID();
    const base = (idUsuario: string): DatosSiembra => ({
      empresas: [{ id: idEmpresa, slug: `choque-${sufijo3}`, nombre: 'Choque', colorPrimario: '#0b5fff', logoUrl: null }],
      usuarios: [{ alias: 'x', id: idUsuario, empresaId: idEmpresa, nombre: 'Equis', correo: 'x@example.test', rol: 'colaborador' }],
    });
    const origen = `siembra:prueba:${sufijo3}`;
    try {
      await sembrar(destinos(), base(randomUUID()), origen);
      // Misma empresa y mismo correo, pero con OTRO identificador de persona: choca con la restricción única.
      await expect(sembrar(destinos(), base(randomUUID()), `${origen}:2`)).rejects.toThrow(/unique|duplicate|duplicad/i);
      expect((await conTenant(pools.db('owner'), idEmpresa as never, async (trx) => (await sql`select 1 from usuario`.execute(trx)).rows)).length).toBe(1);
      expect((await sql`select 1 from bitacora where origen_id = ${`${origen}:2`}`.execute(pools.db('owner'))).rows).toEqual([]);
    } finally {
      await conTenant(pools.db('owner'), idEmpresa as never, async (trx) => {
        await sql`delete from usuario where empresa_id = ${idEmpresa}`.execute(trx);
        await sql`delete from empresa where id = ${idEmpresa}`.execute(trx);
      });
    }
  });
});
