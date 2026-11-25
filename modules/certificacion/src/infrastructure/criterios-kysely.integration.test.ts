import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import { GuardarCriteriosUseCase, ObtenerCriteriosUseCase } from '../application/criterios.use-cases.js';
import { ConflictoDeVersionError } from '../application/errores.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real: versiones inmutables, carrera entre dos personas, matriz con los riesgos reales y aislamiento (regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-00000000c7a1');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-00000000c7b2');
const UA = 'a1a1a1a1-0000-4000-8000-00000000c7a1';
const UB = 'b1b1b1b1-0000-4000-8000-00000000c7b2';
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;
const cinco = (p: string) => [`${p}1`, `${p}2`, `${p}3`, `${p}4`, `${p}5`];
const datos = { probabilidad: cinco('p'), impacto: cinco('i'), nivelAceptacion: 'medio' };

describe.skipIf(!hayBase)('criterios de evaluación sobre PostgreSQL real', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 6 });
  const owner = () => pools.db('owner');
  const permitir: AutorizacionPort = { puede: async () => true };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 25, 15, 0, t++));
  const casos = () => {
    const u = crearUnidadDeTrabajoCertificacion(pools.db('app'));
    return { guardar: new GuardarCriteriosUseCase(u, permitir, reloj), obtener: new ObtenerCriteriosUseCase(u, permitir) };
  };
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const tabla of ['criterios_version', 'riesgo', 'usuario']) await sql`delete from ${sql.table(tabla)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };
  const sembrar = async (id: typeof A, slug: string, usuario: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}, 'administrador_sig') on conflict do nothing`.execute(trx);
      for (const [n, p, i, estado] of [[1, 3, 4, 'vigente'], [2, 3, 4, 'vigente'], [3, 1, 1, 'retirado']] as const)
        await sql`insert into riesgo (empresa_id, numero, titulo, probabilidad, impacto, decision, estado, creado_por, actualizado_por)
          values (${id}, ${n}, ${'R' + n}, ${p}, ${i}, 'mitigar', ${estado}, ${usuario}, ${usuario}) on conflict do nothing`.execute(trx);
    });
  };

  beforeAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'crint-a', UA);
    await sembrar(B, 'crint-b', UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  it('flujo: por omisión → versión 1 → versión 2; las versiones anteriores quedan intactas y la matriz usa los riesgos reales', async () => {
    const c = casos();
    expect(await c.obtener.ejecutar({ empresaId: A, usuarioId: UA })).toMatchObject({ origen: 'omision', version: 0, riesgosVigentes: 2 });
    const v1 = await c.guardar.ejecutar({ empresaId: A, usuarioId: UA, ...datos, versionEsperada: 0 });
    expect(v1).toMatchObject({ origen: 'empresa', version: 1, nivelAceptacion: 'medio' });
    expect(v1.matriz.find((x) => x.probabilidad === 3 && x.impacto === 4)?.cantidad).toBe(2);
    const v2 = await c.guardar.ejecutar({ empresaId: A, usuarioId: UA, ...datos, nivelAceptacion: 'alto', versionEsperada: 1 });
    expect(v2.version).toBe(2);
    const filas = await conTenant(owner(), A, (trx) => sql<{ version: number; nivel_aceptacion: string }>`select version, nivel_aceptacion from criterios_version order by version`.execute(trx));
    expect(filas.rows).toEqual([{ version: 1, nivel_aceptacion: 'medio' }, { version: 2, nivel_aceptacion: 'alto' }]);
    expect((await c.guardar.ejecutar({ empresaId: A, usuarioId: UA, ...datos, nivelAceptacion: 'alto', versionEsperada: 2 })).version).toBe(2); // lo mismo: sin versión nueva
  });

  it('dos personas guardando a la vez la misma versión: solo una prospera', async () => {
    const c = casos();
    const actual = (await c.obtener.ejecutar({ empresaId: A, usuarioId: UA })).version;
    const r = await Promise.allSettled([
      c.guardar.ejecutar({ empresaId: A, usuarioId: UA, ...datos, nivelAceptacion: 'bajo', versionEsperada: actual }),
      c.guardar.ejecutar({ empresaId: A, usuarioId: UA, ...datos, nivelAceptacion: 'critico', versionEsperada: actual }),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictoDeVersionError);
  });

  it('aislamiento: B no ve ni cambia los criterios de A y tiene su propia secuencia', async () => {
    const c = casos();
    expect(await c.obtener.ejecutar({ empresaId: B, usuarioId: UB })).toMatchObject({ origen: 'omision', version: 0 });
    expect(await c.guardar.ejecutar({ empresaId: B, usuarioId: UB, ...datos, nivelAceptacion: 'bajo', versionEsperada: 0 })).toMatchObject({ version: 1, nivelAceptacion: 'bajo' });
    // Lo de A no cambió por lo que hizo B: su versión sigue su propio camino.
    expect((await c.obtener.ejecutar({ empresaId: A, usuarioId: UA })).version).toBeGreaterThanOrEqual(2);
    expect((await c.obtener.ejecutar({ empresaId: B, usuarioId: UB })).version).toBe(1);
  });
});
