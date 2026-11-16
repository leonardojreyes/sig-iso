import { randomUUID } from 'node:crypto';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conTenant } from './con-tenant';
import { leerUrls, ROLES_BD } from './configuracion';
import { GestorPools } from './pools';

// AISLAMIENTO ENTRE EMPRESAS (regla 2) de las personas (MVP, M7, ADR 036): solicitudes de acceso, rol y baja. Con la sesión de A se
// intenta leer, crear y cambiar lo de B y no debe pasar nada. PostgreSQL real, con el rol `sigiso_app` (sin BYPASSRLS).
const A = crearEmpresaId(randomUUID());
const B = crearEmpresaId(randomUUID());
const sufijo = randomUUID().slice(0, 6);
const PERSONA = randomUUID(); // la misma cuenta (un consultor) pide acceso en las dos empresas
const ADMIN_A = randomUUID();
const ADMIN_B = randomUUID();
const SOLICITUD_A = randomUUID();
const SOLICITUD_B = randomUUID();

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;
const enUnaSemana = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

describe.skipIf(!hayBase)('aislamiento entre empresas: personas y solicitudes de acceso (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 4 });
  const app = () => pools.db('app');
  const owner = () => pools.db('owner');

  const pedir = (empresa: typeof A, id: string, persona: string, codigo: string) =>
    conTenant(app(), empresa, (trx) =>
      sql`insert into solicitud_acceso (id, empresa_id, usuario_id, codigo, vence_en) values (${id}, ${empresa}, ${persona}, ${codigo}, ${enUnaSemana()})`.execute(
        trx,
      ),
    );
  const vigentesDe = (empresa: typeof A) =>
    conTenant(app(), empresa, async (trx) =>
      (await sql<{ id: string }>`select id from solicitud_acceso order by id`.execute(trx)).rows.map((r) => r.id),
    );
  const usuarioDe = (empresa: typeof A, id: string) =>
    conTenant(
      owner(),
      empresa,
      async (trx) =>
        (
          await sql<{
            rol: string | null;
            baja_en: Date | null;
            version: number;
          }>`select rol, baja_en, version from usuario where id = ${id}`.execute(trx)
        ).rows[0],
    );

  beforeAll(async () => {
    for (const [id, n, admin] of [
      [A, 'a', ADMIN_A],
      [B, 'b', ADMIN_B],
    ] as const)
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${`per-${n}-${sufijo}`}, ${`Empresa ${n}`}, '#0b5fff')`.execute(
          trx,
        );
        await sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${admin}, ${id}, ${`Admin ${n}`}, ${`admin-${n}-${sufijo}@example.test`}, 'administrador_sig')`.execute(
          trx,
        );
      });
  });
  afterAll(async () => {
    for (const id of [A, B])
      await conTenant(owner(), id, async (trx) => {
        await sql`delete from solicitud_acceso where empresa_id = ${id}`.execute(trx);
        await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
        await sql`delete from empresa where id = ${id}`.execute(trx);
      });
    await pools.cerrar();
  });

  describe('solicitud_acceso', () => {
    it('la misma persona puede pedir acceso en dos empresas, y cada una ve solo la suya', async () => {
      await pedir(A, SOLICITUD_A, PERSONA, 'K7F2-9QXM');
      await pedir(B, SOLICITUD_B, PERSONA, 'K7F2-9QXM'); // el mismo código en otra empresa no choca
      expect(await vigentesDe(A)).toEqual([SOLICITUD_A]);
      expect(await vigentesDe(B)).toEqual([SOLICITUD_B]);
    });

    it('A no puede crear una solicitud con la empresa de B', async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`insert into solicitud_acceso (id, empresa_id, usuario_id, codigo, vence_en) values (${randomUUID()}, ${B}, ${randomUUID()}, 'AAAA-BBBB', ${enUnaSemana()})`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow();
    });

    it('A no ve, no resuelve ni borra la solicitud de B', async () => {
      const leida = await conTenant(
        app(),
        A,
        async (trx) => (await sql`select id from solicitud_acceso where id = ${SOLICITUD_B}`.execute(trx)).rows,
      );
      expect(leida).toEqual([]);
      const r = await conTenant(app(), A, (trx) =>
        sql`update solicitud_acceso set estado = 'descartada', resuelta_en = now(), resuelta_por = ${ADMIN_A} where id = ${SOLICITUD_B}`.execute(
          trx,
        ),
      );
      expect(Number(r.numAffectedRows)).toBe(0);
      await expect(conTenant(app(), A, (trx) => sql`delete from solicitud_acceso where id = ${SOLICITUD_B}`.execute(trx))).rejects.toThrow(
        /permission denied/i,
      );
      expect(await vigentesDe(B)).toEqual([SOLICITUD_B]);
    });

    it('sin empresa en el contexto no se lee nada (falla, no devuelve todo)', async () => {
      await expect(sql`select id from solicitud_acceso`.execute(app())).rejects.toThrow();
    });

    it('una sola solicitud vigente por persona y empresa; el código no se repite entre las vigentes', async () => {
      await expect(pedir(A, randomUUID(), PERSONA, 'BBBB-CCCC')).rejects.toThrow(/solicitud_acceso_una_vigente/);
      await expect(pedir(A, randomUUID(), randomUUID(), 'K7F2-9QXM')).rejects.toThrow(/solicitud_acceso_codigo_vigente/);
    });

    it('al resolverse, el código y la persona quedan libres para una solicitud nueva', async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`update solicitud_acceso set estado = 'descartada', resuelta_en = now(), resuelta_por = ${ADMIN_A} where id = ${SOLICITUD_A}`.execute(
          trx,
        ),
      );
      expect(Number(r.numAffectedRows)).toBe(1);
      await pedir(A, randomUUID(), PERSONA, 'K7F2-9QXM');
    });

    it('el código tiene la forma y el alfabeto permitidos (sin 0, O, 1, I ni L)', async () => {
      for (const malo of ['0000-0000', 'ABCD1234', 'abcd-efgh', 'AAAA-BBBI', 'AAAA-BBBL', 'AAAA-BBB', 'AAAA-BBBBB'])
        await expect(pedir(A, randomUUID(), randomUUID(), malo), malo).rejects.toThrow(/solicitud_acceso_codigo_check|check/);
    });

    it('la resolución es coherente: pendiente sin fecha de resolución; resuelta, con ella', async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`insert into solicitud_acceso (id, empresa_id, usuario_id, codigo, estado, vence_en) values (${randomUUID()}, ${A}, ${randomUUID()}, 'CCCC-DDDD', 'aprobada', ${enUnaSemana()})`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow(/solicitud_acceso_resuelta_coherente/);
    });

    it('quien resuelve debe ser una persona de la MISMA empresa', async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`update solicitud_acceso set estado = 'descartada', resuelta_en = now(), resuelta_por = ${ADMIN_B} where empresa_id = ${A} and estado = 'pendiente'`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow(/solicitud_acceso_resuelta_por_empresa/);
    });
  });

  describe('usuario: rol y baja', () => {
    it('A da de alta con rol y cambia el rol de una persona de SU empresa', async () => {
      const nueva = randomUUID();
      await conTenant(app(), A, (trx) =>
        sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${nueva}, ${A}, 'Persona Nueva', ${`nueva-${sufijo}@example.test`}, 'colaborador')`.execute(
          trx,
        ),
      );
      expect(await usuarioDe(A, nueva)).toMatchObject({ rol: 'colaborador', baja_en: null, version: 1 });
      const r = await conTenant(app(), A, (trx) =>
        sql`update usuario set rol = 'auditor_interno', version = version + 1 where id = ${nueva}`.execute(trx),
      );
      expect(Number(r.numAffectedRows)).toBe(1);
      expect(await usuarioDe(A, nueva)).toMatchObject({ rol: 'auditor_interno', version: 2 });
    });

    it('A no cambia el rol ni da de baja a una persona de B', async () => {
      const r = await conTenant(app(), A, (trx) =>
        sql`update usuario set rol = 'colaborador', version = version + 1 where id = ${ADMIN_B}`.execute(trx),
      );
      expect(Number(r.numAffectedRows)).toBe(0);
      const baja = await conTenant(app(), A, (trx) =>
        sql`update usuario set rol = null, baja_en = now() where id = ${ADMIN_B}`.execute(trx),
      );
      expect(Number(baja.numAffectedRows)).toBe(0);
      expect(await usuarioDe(B, ADMIN_B)).toMatchObject({ rol: 'administrador_sig', baja_en: null, version: 1 });
    });

    it('A no crea una persona con la empresa de B', async () => {
      await expect(
        conTenant(app(), A, (trx) =>
          sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${randomUUID()}, ${B}, 'Intrusa', ${`intrusa-${sufijo}@example.test`}, 'administrador_sig')`.execute(
            trx,
          ),
        ),
      ).rejects.toThrow();
    });

    it('una baja deja el rol en nulo y anota cuándo; con rol y baja a la vez, no', async () => {
      const p = randomUUID();
      await conTenant(owner(), A, (trx) =>
        sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${p}, ${A}, 'Para baja', ${`baja-${sufijo}@example.test`}, 'colaborador')`.execute(
          trx,
        ),
      );
      await expect(conTenant(app(), A, (trx) => sql`update usuario set baja_en = now() where id = ${p}`.execute(trx))).rejects.toThrow(
        /usuario_baja_sin_rol/,
      );
      await conTenant(app(), A, (trx) =>
        sql`update usuario set rol = null, baja_en = now(), version = version + 1 where id = ${p}`.execute(trx),
      );
      const u = await usuarioDe(A, p);
      expect(u?.rol).toBeNull();
      expect(u?.baja_en).toBeInstanceOf(Date);
    });

    it('la aplicación sigue sin poder borrar personas ni cambiar su identificador o empresa', async () => {
      await expect(conTenant(app(), A, (trx) => sql`delete from usuario where id = ${ADMIN_A}`.execute(trx))).rejects.toThrow(
        /permission denied/i,
      );
      await expect(
        conTenant(app(), A, (trx) => sql`update usuario set empresa_id = ${B} where id = ${ADMIN_A}`.execute(trx)),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        conTenant(app(), A, (trx) => sql`update usuario set id = ${randomUUID()} where id = ${ADMIN_A}`.execute(trx)),
      ).rejects.toThrow(/permission denied/i);
    });
  });
});
