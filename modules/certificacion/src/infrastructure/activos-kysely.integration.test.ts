import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActivosDeUnRiesgoUseCase,
  AvisoRetiroActivoUseCase,
  CambiarActivoUseCase,
  CrearActivoUseCase,
  DesligarActivoUseCase,
  LigarActivoUseCase,
  ListarActivosUseCase,
  ObtenerActivoUseCase,
  RetirarActivoUseCase,
} from '../application/activos.use-cases.js';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import type { ContextoCertificacion } from '../application/contexto.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from '../application/errores.js';
import { CrearRiesgoUseCase, RetirarRiesgoUseCase } from '../application/riesgos.use-cases.js';
import { ActivoKysely, RiesgoActivoKysely } from './activo-kysely.adapter.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real: activos y su liga con riesgos (ADR 038): el hecho de bitácora y el cambio en UNA transacción, concurrencia
// optimista, el código correlativo bajo carrera y el AISLAMIENTO entre empresas (regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-000000000010');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-000000000011');
const UA = 'a1a1a1a1-0000-4000-8000-000000000010';
const UA2 = 'a2a2a2a2-0000-4000-8000-000000000010';
const UBAJA = 'a3a3a3a3-0000-4000-8000-000000000010';
const UB = 'b1b1b1b1-0000-4000-8000-000000000011';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('activos sobre PostgreSQL real', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 10 });
  const owner = () => pools.db('owner');
  const unidad = () => crearUnidadDeTrabajoCertificacion(pools.db('app'));
  const permitir: AutorizacionPort = { puede: async () => true };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 22, 12, 0, t++));
  const nuevoId = () => crypto.randomUUID();
  const yo = { empresaId: A, usuarioId: UA };
  const yoB = { empresaId: B, usuarioId: UB };

  const crear = () => new CrearActivoUseCase(unidad(), permitir, reloj, nuevoId);
  const cambiar = () => new CambiarActivoUseCase(unidad(), permitir, reloj);
  const retirar = () => new RetirarActivoUseCase(unidad(), permitir, reloj);
  const aviso = () => new AvisoRetiroActivoUseCase(unidad(), permitir);
  const listar = () => new ListarActivosUseCase(unidad(), permitir);
  const obtener = () => new ObtenerActivoUseCase(unidad(), permitir);
  const deRiesgo = () => new ActivosDeUnRiesgoUseCase(unidad(), permitir);
  const ligar = () => new LigarActivoUseCase(unidad(), permitir, reloj);
  const desligar = () => new DesligarActivoUseCase(unidad(), permitir);
  const crearRiesgo = () => new CrearRiesgoUseCase(unidad(), permitir, reloj, nuevoId);
  const retirarRiesgo = () => new RetirarRiesgoUseCase(unidad(), permitir, reloj);
  const activo = { nombre: 'NOMBRE-ACTIVO Base de clientes', descripcion: 'DESCRIPCION-PRIVADA', tipo: 'informacion' as const, clasificacion: 'confidencial' as const, responsableId: UA2 };
  const riesgo = { titulo: 'Pérdida de portátiles', probabilidad: 3, impacto: 4, decision: 'mitigar' as const };

  const TABLAS = ['riesgo_activo', 'activo', 'riesgo_entrada', 'riesgo_control', 'riesgo'];
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const tabla of TABLAS) await sql`delete from ${sql.table(tabla)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };
  const sembrar = async (id: typeof A, slug: string, personas: Array<[string, string | null, boolean]>) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      for (const [uid, rol, baja] of personas)
        await sql`insert into usuario (id, empresa_id, nombre, correo, rol, baja_en) values (${uid}, ${id}, ${'Persona ' + uid.slice(0, 2)}, ${uid + '@example.test'}, ${rol}, ${baja ? new Date() : null}) on conflict do nothing`.execute(trx);
    });
  };
  // La bitácora es inmutable: no se limpia. Cada ejecución mide solo los hechos posteriores a este punto de partida.
  let base = '0';
  const hechos = (empresa: typeof A) =>
    conTenant(owner(), empresa, async (trx) =>
      (await sql<{ accion: string; objeto: string; usuario_id: string; antes: unknown; despues: unknown }>`select accion, objeto, usuario_id, antes, despues from bitacora
        where empresa_id = ${empresa} and id > ${base}::bigint and accion like 'activo.%' order by id`.execute(trx)).rows,
    );
  /** La misma unidad de trabajo, pero con una bitácora que falla: la acción entera debe revertirse. */
  const conBitacoraCaida = () => ({
    ejecutar: <T>(empresa: typeof A, fn: (c: ContextoCertificacion) => Promise<T>) =>
      unidad().ejecutar(empresa, async (c) =>
        fn({
          ...c,
          bitacora: {
            registrar: async () => {
              throw new Error('bitácora caída');
            },
          },
        }),
      ),
  });
  const contar = (tabla: string, empresa = A) =>
    conTenant(owner(), empresa, async (trx) => Number((await sql<{ n: string }>`select count(*) as n from ${sql.table(tabla)} where empresa_id = ${empresa}`.execute(trx)).rows[0]!.n));

  beforeAll(async () => {
    base = (await sql<{ m: string }>`select coalesce(max(id), 0)::text as m from bitacora`.execute(owner())).rows[0]!.m;
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'act-int-a', [[UA, 'administrador_sig', false], [UA2, 'colaborador', false], [UBAJA, null, true]]);
    await sembrar(B, 'act-int-b', [[UB, 'administrador_sig', false]]);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await pools.cerrar();
  });

  it('crea, cambia y retira un activo, con el hecho de cada paso en la bitácora (sin nombre, texto ni valores)', async () => {
    const a = await crear().ejecutar({ ...yo, ...activo });
    expect(a).toMatchObject({ codigo: 'A-001', estado: 'vigente', version: 1, responsableId: UA2 });
    const c = await cambiar().ejecutar({ ...yo, id: a.id, versionEsperada: 1, nombre: 'NOMBRE-NUEVO', clasificacion: 'restringida' });
    expect(c).toMatchObject({ version: 2, clasificacion: 'restringida' });
    expect((await obtener().ejecutar({ ...yo, id: a.id })).nombre).toBe('NOMBRE-NUEVO');
    await retirar().ejecutar({ ...yo, id: a.id, versionEsperada: 2 });
    expect((await listar().ejecutar(yo)).map((x) => x.codigo)).toEqual([]);
    expect((await listar().ejecutar({ ...yo, incluirRetirados: true })).map((x) => [x.codigo, x.estado])).toEqual([['A-001', 'retirado']]);
    const h = await hechos(A);
    expect(h.map((x) => [x.accion, x.objeto, x.usuario_id])).toEqual([['activo.creado', 'activo:A-001', UA], ['activo.cambiado', 'activo:A-001', UA], ['activo.retirado', 'activo:A-001', UA]]);
    expect(JSON.stringify(h)).not.toMatch(/NOMBRE|DESCRIPCION|clientes|confidencial|restringida/);
  });

  it('el código es correlativo y no se reutiliza al retirar; cada empresa lleva el suyo', async () => {
    expect((await crear().ejecutar({ ...yo, ...activo })).codigo).toBe('A-002'); // A-001 sigue existiendo (retirado)
    expect((await crear().ejecutar({ ...yoB, ...activo, responsableId: UB })).codigo).toBe('A-001');
  });

  it('CARRERA: varias creaciones a la vez no repiten código ni dejan huecos de hechos', async () => {
    const antes = (await hechos(A)).filter((x) => x.accion === 'activo.creado').length;
    const r = await Promise.allSettled(Array.from({ length: 4 }, () => crear().ejecutar({ ...yo, ...activo })));
    const ok = r.flatMap((x) => (x.status === 'fulfilled' ? [x.value.codigo] : []));
    for (const x of r) if (x.status === 'rejected') expect(x.reason).toBeInstanceOf(ConflictoError);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok).size).toBe(ok.length);
    const todos = (await listar().ejecutar({ ...yo, incluirRetirados: true })).map((x) => x.codigo);
    expect(new Set(todos).size).toBe(todos.length);
    expect((await hechos(A)).filter((x) => x.accion === 'activo.creado').length).toBe(antes + ok.length);
  });

  it('una versión vieja no pisa lo guardado; dos cambios simultáneos: gana uno y el otro recibe conflicto', async () => {
    const a = await crear().ejecutar({ ...yo, ...activo });
    await cambiar().ejecutar({ ...yo, id: a.id, versionEsperada: 1, nombre: 'uno' });
    await expect(cambiar().ejecutar({ ...yo, id: a.id, versionEsperada: 1, nombre: 'dos' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    const res = await Promise.allSettled([
      cambiar().ejecutar({ ...yo, id: a.id, versionEsperada: 2, nombre: 'tres' }),
      cambiar().ejecutar({ ...yo, id: a.id, versionEsperada: 2, nombre: 'cuatro' }),
    ]);
    expect(res.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    for (const x of res) if (x.status === 'rejected') expect(x.reason).toBeInstanceOf(ConflictoDeVersionError);
    expect((await obtener().ejecutar({ ...yo, id: a.id })).version).toBe(3);
  });

  it('un responsable de baja, de otra empresa o inexistente se rechaza y no deja nada a medias', async () => {
    const antes = (await hechos(A)).length;
    const n = await contar('activo');
    for (const responsableId of [UBAJA, UB, crypto.randomUUID()])
      await expect(crear().ejecutar({ ...yo, ...activo, responsableId })).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect(await contar('activo')).toBe(n);
    expect((await hechos(A)).length).toBe(antes);
  });

  it('si falla la bitácora, no queda el activo ni el cambio ni el retiro ni la liga (una sola transacción)', async () => {
    const a = await crear().ejecutar({ ...yo, ...activo });
    const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    const n = await contar('activo');
    const caida = conBitacoraCaida();
    await expect(new CrearActivoUseCase(caida, permitir, reloj, nuevoId).ejecutar({ ...yo, ...activo })).rejects.toThrow('bitácora caída');
    expect(await contar('activo')).toBe(n);
    await expect(new CambiarActivoUseCase(caida, permitir, reloj).ejecutar({ ...yo, id: a.id, versionEsperada: a.version, nombre: 'NO-DEBE-QUEDAR' })).rejects.toThrow('bitácora caída');
    expect((await obtener().ejecutar({ ...yo, id: a.id })).nombre).not.toBe('NO-DEBE-QUEDAR');
    await expect(new RetirarActivoUseCase(caida, permitir, reloj).ejecutar({ ...yo, id: a.id, versionEsperada: a.version })).rejects.toThrow('bitácora caída');
    expect((await obtener().ejecutar({ ...yo, id: a.id })).estado).toBe('vigente');
    await expect(new LigarActivoUseCase(caida, permitir, reloj).ejecutar({ ...yo, riesgoId: r.id, activoId: a.id })).rejects.toThrow('bitácora caída');
    expect(await contar('riesgo_activo')).toBe(0);
  });

  describe('ligas con riesgos', () => {
    it('liga, repetir no es error, quita con rastro; el detalle y el aviso usan la base real', async () => {
      const a = await crear().ejecutar({ ...yo, ...activo });
      const r1 = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
      const r2 = await crearRiesgo().ejecutar({ ...yo, ...riesgo, probabilidad: 5, impacto: 5 });
      expect(await ligar().ejecutar({ ...yo, riesgoId: r1.id, activoId: a.id })).toEqual({ creado: true });
      expect(await ligar().ejecutar({ ...yo, riesgoId: r1.id, activoId: a.id })).toEqual({ creado: false });
      await ligar().ejecutar({ ...yo, riesgoId: r2.id, activoId: a.id });
      const d = await obtener().ejecutar({ ...yo, id: a.id });
      expect(d.riesgos).toHaveLength(2);
      expect(d.nivelMasAlto).toBe('critico');
      expect((await deRiesgo().ejecutar({ ...yo, riesgoId: r1.id })).map((x) => x.id)).toEqual([a.id]);
      expect((await listar().ejecutar(yo)).find((x) => x.id === a.id)).toMatchObject({ riesgos: 2, sinRiesgos: false });
      // el aviso: ambos riesgos quedarían sin activo si se retira este
      expect((await aviso().ejecutar({ ...yo, id: a.id })).riesgosSinActivo.map((x) => x.codigo).sort()).toEqual([r1.codigo, r2.codigo].sort());
      await desligar().ejecutar({ ...yo, riesgoId: r2.id, activoId: a.id });
      await expect(desligar().ejecutar({ ...yo, riesgoId: r2.id, activoId: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
      const h = await hechos(A);
      expect(h.filter((x) => x.accion === 'activo.ligado' || x.accion === 'activo.desligado').map((x) => [x.accion, x.objeto])).toEqual(
        expect.arrayContaining([['activo.ligado', `vinculo:${r1.codigo}.${a.codigo}`], ['activo.desligado', `vinculo:${r2.codigo}.${a.codigo}`]]),
      );
    });

    it('un activo retirado o un riesgo retirado no reciben ligas nuevas (409) y las existentes se conservan', async () => {
      const a = await crear().ejecutar({ ...yo, ...activo });
      const b = await crear().ejecutar({ ...yo, ...activo });
      const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
      await ligar().ejecutar({ ...yo, riesgoId: r.id, activoId: a.id });
      await retirar().ejecutar({ ...yo, id: a.id, versionEsperada: 1 });
      await expect(ligar().ejecutar({ ...yo, riesgoId: r.id, activoId: a.id })).rejects.toBeInstanceOf(ConflictoError);
      expect((await deRiesgo().ejecutar({ ...yo, riesgoId: r.id })).map((x) => x.id)).toContain(a.id); // la liga se conserva
      await retirarRiesgo().ejecutar({ ...yo, id: r.id, versionEsperada: 1 });
      await expect(ligar().ejecutar({ ...yo, riesgoId: r.id, activoId: b.id })).rejects.toBeInstanceOf(ConflictoError);
    });
  });

  it('AISLAMIENTO: B no ve ni toca los activos ni las ligas de A', async () => {
    const aA = (await listar().ejecutar(yo))[0]!;
    const rA = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    await expect(obtener().ejecutar({ ...yoB, id: aA.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(cambiar().ejecutar({ ...yoB, id: aA.id, versionEsperada: aA.version, nombre: 'x' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(retirar().ejecutar({ ...yoB, id: aA.id, versionEsperada: aA.version })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(aviso().ejecutar({ ...yoB, id: aA.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(ligar().ejecutar({ ...yoB, riesgoId: rA.id, activoId: aA.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(deRiesgo().ejecutar({ ...yoB, riesgoId: rA.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect((await listar().ejecutar({ ...yoB, incluirRetirados: true })).map((x) => x.id)).not.toContain(aA.id);
  });

  it('AISLAMIENTO: los repositorios, aun con la empresa mal puesta, no cruzan datos (RLS y claves compuestas)', async () => {
    const aA = (await listar().ejecutar(yo))[0]!;
    const rA = (await crearRiesgo().ejecutar({ ...yo, ...riesgo })).id;
    await conTenant(pools.db('app'), B, async (trx) => {
      expect(await new ActivoKysely(trx, A).obtener(aA.id)).toBeNull();
      expect(await new ActivoKysely(trx, A).listar()).toEqual([]);
      expect(await new RiesgoActivoKysely(trx, A).listar()).toEqual([]);
    });
    await expect(conTenant(pools.db('app'), B, (trx) => new RiesgoActivoKysely(trx, A).agregar(rA, aA.id, UB, new Date()))).rejects.toThrow(); // empresa A bajo sesión de B
    await expect(conTenant(pools.db('app'), B, (trx) => new RiesgoActivoKysely(trx, B).agregar(rA, aA.id, UB, new Date()))).rejects.toThrow(); // riesgo y activo de A con empresa B
    await expect(conTenant(pools.db('app'), A, (trx) => new RiesgoActivoKysely(trx, A).agregar(rA, aA.id, UB, new Date()))).rejects.toThrow(); // autor de B
  });
});
