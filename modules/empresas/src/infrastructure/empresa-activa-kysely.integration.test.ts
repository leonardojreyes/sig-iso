import { randomUUID } from 'node:crypto';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EmpresaActivaKysely } from './empresa-activa-kysely.adapter.js';

// Una persona en varias empresas (ADR 035) con PostgreSQL real y el rol de PLATAFORMA. Cada ejecución usa empresas y personas propias.
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('empresa activa y pertenencias (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 6 });
  const owner = () => pools.db('owner');
  const adaptador = () => new EmpresaActivaKysely(pools.db('plataforma'));
  const sufijo = randomUUID().slice(0, 6);
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const C = crearEmpresaId(randomUUID());
  const CONSULTOR = randomUUID();
  const SOLO_A = randomUUID();
  const sid = (n: string) => `sid-${sufijo}-${n}`;
  const AHORA = new Date('2026-11-15T10:00:00Z');
  const MAS = (ms: number) => new Date(AHORA.getTime() + ms);
  const sembrar = (empresa: typeof A, slug: string, nombre: string, personas: [string, string | null][]) =>
    conTenant(owner(), empresa, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${empresa}, ${slug}, ${nombre}, '#0b5fff')`.execute(trx);
      for (const [id, rol] of personas)
        await sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${id}, ${empresa}, ${'Persona ' + id.slice(0, 4)}, ${id.slice(0, 8) + '@example.test'}, ${rol})`.execute(trx);
    });

  beforeAll(async () => {
    await sembrar(A, `av-a-${sufijo}`, `Alfa ${sufijo}`, [[CONSULTOR, 'administrador_sig'], [SOLO_A, 'colaborador']]);
    await sembrar(B, `av-b-${sufijo}`, `Beta ${sufijo}`, [[CONSULTOR, 'colaborador']]);
    await sembrar(C, `av-c-${sufijo}`, `Gamma ${sufijo}`, [[randomUUID(), 'administrador_sig']]);
  });
  afterAll(async () => {
    for (const e of [A, B, C])
      await conTenant(owner(), e, async (trx) => {
        await sql`delete from empresa_activa where empresa_id = ${e}`.execute(trx);
        await sql`delete from usuario where empresa_id = ${e}`.execute(trx);
        await sql`delete from empresa where id = ${e}`.execute(trx);
      });
    await pools.cerrar();
  });

  it('la misma cuenta tiene una fila por empresa, con su propio rol', async () => {
    const roles = await sql<{ empresa_id: string; rol: string }>`select empresa_id, rol from usuario where id = ${CONSULTOR}`.execute(pools.db('plataforma'));
    expect(roles.rows.map((f) => [f.empresa_id, f.rol]).sort()).toEqual([[A, 'administrador_sig'], [B, 'colaborador']].sort());
  });

  it('lista las empresas del consultor (solo las suyas) y las de una persona de una sola empresa', async () => {
    expect((await adaptador().empresasDe(CONSULTOR)).map((e) => e.slug)).toEqual([`av-a-${sufijo}`, `av-b-${sufijo}`]); // por nombre: Alfa, Beta
    expect((await adaptador().empresasDe(SOLO_A)).map((e) => e.slug)).toEqual([`av-a-${sufijo}`]);
    expect(await adaptador().empresasDe(randomUUID())).toEqual([]);
  });

  it('una pertenencia sin rol NO cuenta como pertenencia', async () => {
    const sinRol = randomUUID();
    await conTenant(owner(), C, (trx) => sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${sinRol}, ${C}, 'Sin rol', ${sinRol.slice(0, 8) + '@example.test'}, null)`.execute(trx));
    expect(await adaptador().empresasDe(sinRol)).toEqual([]);
  });

  it('fija y lee la empresa activa de una sesión; vence; y se olvida al cerrar', async () => {
    const a = adaptador();
    expect(await a.activaDe(sid('1'), CONSULTOR, AHORA)).toEqual({ tipo: 'sin_eleccion' });
    await a.fijar(sid('1'), CONSULTOR, B, AHORA, MAS(3600_000));
    expect(await a.activaDe(sid('1'), CONSULTOR, AHORA)).toEqual({ tipo: 'activa', empresaId: B });
    expect(await a.activaDe(sid('1'), CONSULTOR, MAS(3600_000))).toEqual({ tipo: 'invalida' }); // venció: hay elección, pero ya no vale
    await a.fijar(sid('1'), CONSULTOR, A, AHORA, MAS(3600_000)); // cambiar de nuevo
    expect(await a.activaDe(sid('1'), CONSULTOR, AHORA)).toEqual({ tipo: 'activa', empresaId: A });
    await a.limpiar(sid('1'));
    expect(await a.activaDe(sid('1'), CONSULTOR, AHORA)).toEqual({ tipo: 'sin_eleccion' });
  });

  it('la elección de una sesión no la ve otra persona ni otra sesión', async () => {
    const a = adaptador();
    await a.fijar(sid('2'), CONSULTOR, B, AHORA, MAS(3600_000));
    expect(await a.activaDe(sid('2'), SOLO_A, AHORA)).toEqual({ tipo: 'sin_eleccion' });
    expect(await a.activaDe(sid('otra'), CONSULTOR, AHORA)).toEqual({ tipo: 'sin_eleccion' });
  });

  it('otra persona NO puede pisar la sesión de alguien más (mismo identificador de sesión)', async () => {
    const a = adaptador();
    await a.fijar(sid('3'), CONSULTOR, B, AHORA, MAS(3600_000));
    await expect(a.fijar(sid('3'), SOLO_A, A, AHORA, MAS(3600_000))).rejects.toThrow(/otra persona/);
    expect(await a.activaDe(sid('3'), CONSULTOR, AHORA)).toEqual({ tipo: 'activa', empresaId: B });
  });

  it('la base impide activar una empresa a la que la persona no pertenece (clave foránea compuesta)', async () => {
    await expect(adaptador().fijar(sid('4'), SOLO_A, B, AHORA, MAS(3600_000))).rejects.toThrow();
    await expect(adaptador().fijar(sid('4'), CONSULTOR, C, AHORA, MAS(3600_000))).rejects.toThrow();
    expect(await adaptador().activaDe(sid('4'), SOLO_A, AHORA)).toEqual({ tipo: 'sin_eleccion' });
  });

  it('si a la persona se le quita el rol en esa empresa, la elección deja de valer enseguida', async () => {
    const a = adaptador();
    await a.fijar(sid('5'), CONSULTOR, B, AHORA, MAS(3600_000));
    expect(await a.activaDe(sid('5'), CONSULTOR, AHORA)).toEqual({ tipo: 'activa', empresaId: B });
    await conTenant(owner(), B, (trx) => sql`update usuario set rol = null where id = ${CONSULTOR}`.execute(trx));
    expect(await a.activaDe(sid('5'), CONSULTOR, AHORA)).toEqual({ tipo: 'invalida' }); // hay elección, pero ya no vale
    expect((await a.empresasDe(CONSULTOR)).map((e) => e.slug)).toEqual([`av-a-${sufijo}`]);
    await conTenant(owner(), B, (trx) => sql`update usuario set rol = 'colaborador' where id = ${CONSULTOR}`.execute(trx));
  });

  it('al fijar se borra lo vencido', async () => {
    const a = adaptador();
    await a.fijar(sid('6'), SOLO_A, A, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T08:00:00Z'));
    await a.fijar(sid('7'), SOLO_A, A, AHORA, MAS(3600_000));
    const r = await sql`select 1 from empresa_activa where sid = ${sid('6')}`.execute(owner());
    expect(r.rows).toEqual([]);
  });

  describe('permisos del rol de la aplicación y del de plataforma', () => {
    it('la aplicación del negocio no puede leer ni escribir la empresa activa', async () => {
      await expect(sql`select * from empresa_activa`.execute(pools.db('app'))).rejects.toThrow(/permission denied|permiso/i);
      await expect(sql`insert into empresa_activa (sid, usuario_id, empresa_id, expira_en) values ('x', ${CONSULTOR}, ${A}, now())`.execute(pools.db('app'))).rejects.toThrow(/permission denied|permiso/i);
    });
    it('la plataforma no ve correos ni nombres de las personas ni la marca de las empresas', async () => {
      await expect(sql`select correo from usuario`.execute(pools.db('plataforma'))).rejects.toThrow(/permission denied|permiso/i);
      await expect(sql`select nombre from usuario`.execute(pools.db('plataforma'))).rejects.toThrow(/permission denied|permiso/i);
      await expect(sql`select color_primario from empresa`.execute(pools.db('plataforma'))).rejects.toThrow(/permission denied|permiso/i);
    });
    it('la plataforma no puede cambiar roles ni crear personas', async () => {
      await expect(sql`update usuario set rol = 'administrador_sig'`.execute(pools.db('plataforma'))).rejects.toThrow(/permission denied|permiso/i);
      await expect(sql`insert into usuario (id, empresa_id, nombre, correo) values (${randomUUID()}, ${A}, 'x', 'x@example.test')`.execute(pools.db('plataforma'))).rejects.toThrow(/permission denied|permiso|row-level/i);
    });
  });
});
