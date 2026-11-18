import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../application/catalogo-lectura.port.js';
import { AvisoRetiroRiesgoUseCase } from '../application/aviso-retiro-riesgo.use-case.js';
import { CambiarControlUseCase, CrearControlUseCase, RetirarControlUseCase } from '../application/controles.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, ParametroInvalidoError } from '../application/errores.js';
import { EvaluarEntradaUseCase } from '../application/evaluar-entrada.use-case.js';
import { GuardarReferenciaUseCase, ListarMotivosUseCase, ListarReferenciasUseCase, QuitarMotivoUseCase, QuitarReferenciaUseCase, RegistrarMotivoUseCase } from '../application/motivos.use-cases.js';
import { CambiarRiesgoUseCase, CrearRiesgoUseCase, ListarRiesgosUseCase, ObtenerRiesgoUseCase, RetirarRiesgoUseCase } from '../application/riesgos.use-cases.js';
import type { ContextoCertificacion } from '../application/contexto.js';
import { DesvincularRiesgoControlUseCase, PreverTratamientoUseCase, QuitarTratamientoPrevistoUseCase, RiesgosDeUnControlUseCase, VincularRiesgoControlUseCase } from '../application/vinculos-riesgo.use-cases.js';
import { MotivoKysely } from './motivo-kysely.adapter.js';
import { ReferenciaKysely } from './referencia-kysely.adapter.js';
import { RiesgoKysely } from './riesgo-kysely.adapter.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';
import { VinculoRiesgoKysely } from './vinculo-riesgo-kysely.adapter.js';

// Con PostgreSQL real: riesgos, vínculos, motivos y referencias (ADR 037): el hecho de bitácora y el cambio en UNA transacción,
// concurrencia optimista, el código correlativo bajo carrera, el aviso previo al retiro y el AISLAMIENTO entre empresas (regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000b1');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000b2');
const UA = 'a1a1a1a1-0000-4000-8000-0000000000b1';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000b2';
const LIB = 'c0c0c0c0-0000-4000-8000-0000000000b3';
const CODIGO_LIB = 'prueba-rsg-anexo-a';
const P1 = 'a27-5-1';
const P2 = 'a27-5-2';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;
const entrada = (id: string): EntradaCatalogo => ({
  libreriaCodigo: CODIGO_LIB, libreriaId: LIB, idEstable: id, tipo: 'control', capitulo: null, grupo: 'Organizacionales', titulo: `Control ${id}`, guia: 'Guía de prueba breve.',
  aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }], orden: 1,
});

describe.skipIf(!hayBase)('riesgos, vínculos, motivos y referencias sobre PostgreSQL real', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 10 });
  const owner = () => pools.db('owner');
  const unidad = () => crearUnidadDeTrabajoCertificacion(pools.db('app'));
  const permitir: AutorizacionPort = { puede: async () => true };
  const catalogo: CatalogoLecturaPort = { listarEntradasVigentes: async () => [entrada(P1), entrada(P2)] };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 17, 12, 0, t++));
  const nuevoId = () => crypto.randomUUID();
  const yo = { empresaId: A, usuarioId: UA };
  const yoB = { empresaId: B, usuarioId: UB };

  const crearRiesgo = () => new CrearRiesgoUseCase(unidad(), permitir, reloj, nuevoId);
  const cambiarRiesgo = () => new CambiarRiesgoUseCase(unidad(), permitir, reloj);
  const retirarRiesgo = () => new RetirarRiesgoUseCase(unidad(), permitir, reloj);
  const listarRiesgos = () => new ListarRiesgosUseCase(unidad(), permitir);
  const obtenerRiesgo = () => new ObtenerRiesgoUseCase(unidad(), permitir, catalogo);
  const crearControl = () => new CrearControlUseCase(unidad(), permitir, reloj, nuevoId);
  const vincular = () => new VincularRiesgoControlUseCase(unidad(), permitir, reloj);
  const desvincular = () => new DesvincularRiesgoControlUseCase(unidad(), permitir);
  const prever = () => new PreverTratamientoUseCase(unidad(), permitir, catalogo, reloj);
  const quitarPrevisto = () => new QuitarTratamientoPrevistoUseCase(unidad(), permitir);
  const motivo = () => new RegistrarMotivoUseCase(unidad(), permitir, catalogo, reloj);
  const guardarRef = () => new GuardarReferenciaUseCase(unidad(), permitir, reloj);
  const riesgo = { titulo: 'TITULO-RIESGO Pérdida de portátiles', descripcion: 'DESCRIPCION-PRIVADA', probabilidad: 3, impacto: 4, decision: 'mitigar' as const };

  const TABLAS = ['declaracion_fila_riesgo', 'declaracion_motivo', 'declaracion_referencia', 'declaracion_riesgo', 'declaracion_fila', 'declaracion_version', 'motivo_inclusion', 'referencia_tratamiento', 'riesgo_entrada', 'riesgo_control', 'riesgo', 'control_mapeo', 'control', 'evaluacion'];
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const tabla of TABLAS) await sql`delete from ${sql.table(tabla)} where empresa_id = ${id}`.execute(trx);
      await sql`delete from usuario where empresa_id = ${id}`.execute(trx);
      await sql`delete from empresa where id = ${id}`.execute(trx);
    });
  };
  const sembrar = async (id: typeof A, slug: string, usuario: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(trx);
      await sql`insert into usuario (id, empresa_id, nombre, correo) values (${usuario}, ${id}, ${'Persona ' + slug}, ${slug + '@example.test'}) on conflict do nothing`.execute(trx);
    });
  };
  // La bitácora es inmutable: no se limpia. Cada ejecución mide solo los hechos posteriores a este punto de partida.
  let base = '0';
  const hechos = (empresa: typeof A) =>
    conTenant(owner(), empresa, async (trx) =>
      (await sql<{ accion: string; objeto: string; usuario_id: string; antes: unknown; despues: unknown }>`select accion, objeto, usuario_id, antes, despues from bitacora
        where empresa_id = ${empresa} and id > ${base}::bigint and (accion like 'riesgo.%' or accion like 'vinculo.%' or accion like 'motivo.%' or accion like 'referencia.%') order by id`.execute(trx)).rows,
    );
  /** La misma unidad de trabajo, pero con una bitácora que falla: la acción entera debe revertirse. */
  const conBitacoraCaida = () => ({
    ejecutar: <T>(empresa: typeof A, fn: (c: ContextoCertificacion) => Promise<T>) =>
      unidad().ejecutar(empresa, async (c) => fn({ ...c, bitacora: { registrar: async () => { throw new Error('bitácora caída'); } } })),
  });
  const contar = (tabla: string, empresa = A) => conTenant(owner(), empresa, async (trx) => Number((await sql<{ n: string }>`select count(*) as n from ${sql.table(tabla)} where empresa_id = ${empresa}`.execute(trx)).rows[0]?.n));

  beforeAll(async () => {
    base = (await sql<{ m: string }>`select coalesce(max(id), 0)::text as m from bitacora`.execute(owner())).rows[0]!.m;
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, async (trx) => {
      await sql`delete from libreria where id = ${LIB}`.execute(trx);
      await sql`insert into libreria (id, codigo, nombre, version, hash, es_ejemplo, fuente) values (${LIB}, ${CODIGO_LIB}, 'Prueba', '1.0.0', ${'3'.repeat(64)}, true, 'prueba')`.execute(trx);
    });
    await sembrar(A, 'rsg-a', UA);
    await sembrar(B, 'rsg-b', UB);
  });
  afterAll(async () => {
    await limpiar(A);
    await limpiar(B);
    await conTenant(owner(), A, (trx) => sql`delete from libreria where id = ${LIB}`.execute(trx)).catch(() => undefined);
    await pools.cerrar();
  });

  it('crea, cambia y retira un riesgo, con el hecho de cada paso en la bitácora (sin texto ni valores)', async () => {
    const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    expect(r).toMatchObject({ codigo: 'R-001', puntaje: 12, nivel: 'alto', estado: 'vigente', version: 1 });
    const c = await cambiarRiesgo().ejecutar({ ...yo, id: r.id, versionEsperada: 1, probabilidad: 5, impacto: 5, titulo: 'TITULO-NUEVO' });
    expect(c).toMatchObject({ puntaje: 25, nivel: 'critico', version: 2 });
    expect((await obtenerRiesgo().ejecutar({ ...yo, id: r.id })).titulo).toBe('TITULO-NUEVO');
    await retirarRiesgo().ejecutar({ ...yo, id: r.id, versionEsperada: 2 });
    expect((await listarRiesgos().ejecutar(yo)).map((x) => x.codigo)).toEqual([]);
    expect((await listarRiesgos().ejecutar({ ...yo, incluirRetirados: true })).map((x) => [x.codigo, x.estado])).toEqual([['R-001', 'retirado']]);
    const h = await hechos(A);
    expect(h.map((x) => [x.accion, x.objeto, x.usuario_id])).toEqual([['riesgo.creado', 'riesgo:R-001', UA], ['riesgo.cambiado', 'riesgo:R-001', UA], ['riesgo.retirado', 'riesgo:R-001', UA]]);
    expect(JSON.stringify(h)).not.toMatch(/TITULO|DESCRIPCION|portátiles/);
  });

  it('el código es correlativo y no se reutiliza al retirar; cada empresa lleva el suyo', async () => {
    const r2 = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    expect(r2.codigo).toBe('R-002'); // R-001 sigue existiendo (retirado)
    expect((await crearRiesgo().ejecutar({ ...yoB, ...riesgo })).codigo).toBe('R-001');
    expect((await crearRiesgo().ejecutar({ ...yoB, ...riesgo })).codigo).toBe('R-002');
  });

  it('CARRERA: varias creaciones a la vez no repiten código ni dejan huecos de hechos', async () => {
    const antes = (await hechos(A)).filter((x) => x.accion === 'riesgo.creado').length;
    const r = await Promise.allSettled(Array.from({ length: 4 }, () => crearRiesgo().ejecutar({ ...yo, ...riesgo })));
    const ok = r.flatMap((x) => (x.status === 'fulfilled' ? [x.value.codigo] : []));
    for (const x of r) if (x.status === 'rejected') expect(x.reason).toBeInstanceOf(ConflictoError);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok).size).toBe(ok.length);
    const todos = (await listarRiesgos().ejecutar({ ...yo, incluirRetirados: true })).map((x) => x.codigo);
    expect(new Set(todos).size).toBe(todos.length);
    expect((await hechos(A)).filter((x) => x.accion === 'riesgo.creado').length).toBe(antes + ok.length); // un hecho por riesgo creado
  });

  it('una versión vieja no pisa lo guardado; dos cambios simultáneos: gana uno y el otro recibe conflicto', async () => {
    const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    await cambiarRiesgo().ejecutar({ ...yo, id: r.id, versionEsperada: 1, impacto: 5 });
    await expect(cambiarRiesgo().ejecutar({ ...yo, id: r.id, versionEsperada: 1, impacto: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
    const res = await Promise.allSettled([
      cambiarRiesgo().ejecutar({ ...yo, id: r.id, versionEsperada: 2, probabilidad: 1 }),
      cambiarRiesgo().ejecutar({ ...yo, id: r.id, versionEsperada: 2, probabilidad: 2 }),
    ]);
    expect(res.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    for (const x of res) if (x.status === 'rejected') expect(x.reason).toBeInstanceOf(ConflictoDeVersionError);
    expect((await obtenerRiesgo().ejecutar({ ...yo, id: r.id })).version).toBe(3);
  });

  it('un responsable de otra empresa o «aceptar» sin responsable se rechazan y no dejan nada a medias', async () => {
    const antes = (await hechos(A)).length;
    await expect(crearRiesgo().ejecutar({ ...yo, ...riesgo, decision: 'aceptar', responsableId: UB })).rejects.toBeInstanceOf(ParametroInvalidoError);
    await expect(crearRiesgo().ejecutar({ ...yo, ...riesgo, decision: 'aceptar' })).rejects.toBeInstanceOf(ParametroInvalidoError);
    const ok = await crearRiesgo().ejecutar({ ...yo, ...riesgo, decision: 'aceptar', responsableId: UA });
    expect(ok).toMatchObject({ decision: 'aceptar', responsableId: UA });
    await expect(cambiarRiesgo().ejecutar({ ...yo, id: ok.id, versionEsperada: 1, responsableId: UB })).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect((await hechos(A)).length).toBe(antes + 1); // solo la creación válida
  });

  it('si falla la bitácora, no queda el riesgo ni el cambio ni el retiro (una sola transacción)', async () => {
    const antes = await contar('riesgo');
    await expect(new CrearRiesgoUseCase(conBitacoraCaida(), permitir, reloj, nuevoId).ejecutar({ ...yo, ...riesgo })).rejects.toThrow('bitácora caída');
    expect(await contar('riesgo')).toBe(antes);
    const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    await expect(new CambiarRiesgoUseCase(conBitacoraCaida(), permitir, reloj).ejecutar({ ...yo, id: r.id, versionEsperada: 1, impacto: 1 })).rejects.toThrow('bitácora caída');
    await expect(new RetirarRiesgoUseCase(conBitacoraCaida(), permitir, reloj).ejecutar({ ...yo, id: r.id, versionEsperada: 1 })).rejects.toThrow('bitácora caída');
    expect(await obtenerRiesgo().ejecutar({ ...yo, id: r.id })).toMatchObject({ version: 1, estado: 'vigente', impacto: 4 });
  });

  describe('vínculos', () => {
    it('vincula con un control de la empresa y con un control del Anexo A (previsto), repetir no es error, y quita con rastro', async () => {
      const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
      const c = await crearControl().ejecutar({ ...yo, codigo: 'C-100', nombre: 'Cifrado de discos' });
      expect(await vincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).toEqual({ creado: true });
      expect(await vincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).toEqual({ creado: false });
      expect(await prever().ejecutar({ ...yo, riesgoId: r.id, libreriaCodigo: CODIGO_LIB, idEstable: P1 })).toEqual({ creado: true });
      expect(await prever().ejecutar({ ...yo, riesgoId: r.id, libreriaCodigo: CODIGO_LIB, idEstable: P1 })).toEqual({ creado: false });
      const d = await obtenerRiesgo().ejecutar({ ...yo, id: r.id });
      expect(d.controles).toEqual([expect.objectContaining({ codigo: 'C-100', estado: 'vigente' })]);
      expect(d.tratamientosPrevistos).toEqual([{ libreriaCodigo: CODIGO_LIB, idEstable: P1, titulo: `Control ${P1}` }]);
      expect((await new RiesgosDeUnControlUseCase(unidad(), permitir).ejecutar({ ...yo, controlId: c.id })).map((x) => x.id)).toEqual([r.id]);
      const lista = (await listarRiesgos().ejecutar(yo)).find((x) => x.id === r.id);
      expect(lista).toMatchObject({ controles: 1, tratamientosPrevistos: 1, sinTratamiento: false });
      await desvincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
      await quitarPrevisto().ejecutar({ ...yo, riesgoId: r.id, libreriaCodigo: CODIGO_LIB, idEstable: P1 });
      await expect(desvincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
      const h = (await hechos(A)).filter((x) => x.accion.startsWith('vinculo.'));
      expect(h.slice(-4).map((x) => [x.accion, x.objeto])).toEqual([['vinculo.creado', `vinculo:${d.codigo}.C-100`], ['vinculo.creado', `vinculo:${d.codigo}.${P1}`], ['vinculo.eliminado', `vinculo:${d.codigo}.C-100`], ['vinculo.eliminado', `vinculo:${d.codigo}.${P1}`]]);
    });

    it('un control retirado no recibe vínculos nuevos, conserva el existente (avisado) y se puede desvincular', async () => {
      const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
      const c = await crearControl().ejecutar({ ...yo, codigo: 'C-101', nombre: 'Copias' });
      await vincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
      await new RetirarControlUseCase(unidad(), permitir, reloj).ejecutar({ ...yo, id: c.id, versionEsperada: 1 });
      expect((await obtenerRiesgo().ejecutar({ ...yo, id: r.id })).controles).toEqual([expect.objectContaining({ codigo: 'C-101', estado: 'retirado' })]);
      expect((await listarRiesgos().ejecutar(yo)).find((x) => x.id === r.id)).toMatchObject({ controles: 0, sinTratamiento: true });
      const otro = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
      await expect(vincular().ejecutar({ ...yo, riesgoId: otro.id, controlId: c.id })).rejects.toMatchObject({ motivo: 'control_retirado' });
      await desvincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    });

    it('un riesgo retirado no recibe ni pierde vínculos', async () => {
      const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
      const c = await crearControl().ejecutar({ ...yo, codigo: 'C-102', nombre: 'Accesos' });
      await vincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
      await retirarRiesgo().ejecutar({ ...yo, id: r.id, versionEsperada: 1 });
      await expect(vincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).rejects.toMatchObject({ motivo: 'riesgo_retirado' });
      await expect(desvincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id })).rejects.toMatchObject({ motivo: 'riesgo_retirado' });
      expect(await contar('riesgo_control')).toBeGreaterThanOrEqual(1);
    });

    it('si falla la bitácora, no queda el vínculo', async () => {
      const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
      const antes = await contar('riesgo_entrada');
      await expect(new PreverTratamientoUseCase(conBitacoraCaida(), permitir, catalogo, reloj).ejecutar({ ...yo, riesgoId: r.id, libreriaCodigo: CODIGO_LIB, idEstable: P2 })).rejects.toThrow('bitácora caída');
      expect(await contar('riesgo_entrada')).toBe(antes);
    });
  });

  describe('motivos y referencias', () => {
    it('registra, cambia con la versión vista y quita un motivo, con rastro y sin la nota en la bitácora', async () => {
      const m = await motivo().ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'legal', nota: 'NOTA-PRIVADA Ley de datos' });
      expect(m).toMatchObject({ version: 1, tipo: 'legal' });
      await expect(motivo().ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'legal', nota: 'otra' })).rejects.toBeInstanceOf(ConflictoDeVersionError); // ya existe y no dijo la versión
      expect(await motivo().ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'legal', nota: 'NOTA-NUEVA', versionEsperada: 1 })).toMatchObject({ version: 2, nota: 'NOTA-NUEVA' });
      await expect(motivo().ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'legal', nota: 'vieja', versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
      await expect(new QuitarMotivoUseCase(unidad(), permitir).ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'legal', versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoDeVersionError);
      await new QuitarMotivoUseCase(unidad(), permitir).ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'legal', versionEsperada: 2 });
      expect(await new ListarMotivosUseCase(unidad(), permitir).ejecutar(yo)).toEqual([]);
      const h = (await hechos(A)).filter((x) => x.accion.startsWith('motivo.'));
      expect(h.slice(-3).map((x) => [x.accion, x.objeto])).toEqual([['motivo.creado', `motivo:${P1}.legal`], ['motivo.cambiado', `motivo:${P1}.legal`], ['motivo.eliminado', `motivo:${P1}.legal`]]);
      expect(JSON.stringify(h)).not.toMatch(/NOTA/);
    });

    it('CARRERA: dos personas crean el mismo motivo a la vez: una gana y la otra recibe conflicto', async () => {
      const r = await Promise.allSettled([
        motivo().ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P2, tipo: 'otro', nota: 'Primera' }),
        motivo().ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P2, tipo: 'otro', nota: 'Segunda' }),
      ]);
      expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      for (const x of r) if (x.status === 'rejected') expect(x.reason).toBeInstanceOf(ConflictoDeVersionError);
      expect(await new ListarMotivosUseCase(unidad(), permitir).ejecutar(yo)).toHaveLength(1);
    });

    it('la referencia conserva la fecha sin desplazarla, cambia con la versión vista y se quita', async () => {
      const ref = { tipo: 'plan' as const, titulo: 'TITULO-REF Plan 2026', versionDoc: '1.0', fecha: '2026-11-01', ubicacion: 'UBICACION-REF SIG-PL-004' };
      expect(await guardarRef().ejecutar({ ...yo, ...ref })).toMatchObject({ fecha: '2026-11-01', version: 1 });
      const lista = await new ListarReferenciasUseCase(unidad(), permitir).ejecutar(yo);
      expect(lista).toEqual([expect.objectContaining({ tipo: 'plan', fecha: '2026-11-01', ubicacion: 'UBICACION-REF SIG-PL-004' })]);
      await expect(guardarRef().ejecutar({ ...yo, ...ref, versionDoc: '2.0' })).rejects.toBeInstanceOf(ConflictoDeVersionError);
      expect(await guardarRef().ejecutar({ ...yo, ...ref, versionDoc: '2.0', fecha: '2026-12-31', versionEsperada: 1 })).toMatchObject({ version: 2, fecha: '2026-12-31' });
      await new QuitarReferenciaUseCase(unidad(), permitir).ejecutar({ ...yo, tipo: 'plan', versionEsperada: 2 });
      expect(await new ListarReferenciasUseCase(unidad(), permitir).ejecutar(yo)).toEqual([]);
      expect(JSON.stringify((await hechos(A)).filter((x) => x.accion.startsWith('referencia.')))).not.toMatch(/TITULO-REF|SIG-PL-004|2026-1/);
    });

    it('si falla la bitácora, no queda el motivo ni la referencia', async () => {
      const motivos = await contar('motivo_inclusion');
      await expect(new RegistrarMotivoUseCase(conBitacoraCaida(), permitir, catalogo, reloj).ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'negocio', nota: 'x' })).rejects.toThrow('bitácora caída');
      await expect(new GuardarReferenciaUseCase(conBitacoraCaida(), permitir, reloj).ejecutar({ ...yo, tipo: 'analisis', titulo: 'x', versionDoc: '1', fecha: '2026-11-01', ubicacion: 'x' })).rejects.toThrow('bitácora caída');
      expect(await contar('motivo_inclusion')).toBe(motivos);
      expect(await new ListarReferenciasUseCase(unidad(), permitir).ejecutar(yo)).toEqual([]);
    });
  });

  it('el aviso previo al retiro usa la base real: lista los controles que quedarían sin motivo', async () => {
    const evaluar = (id: string) => new EvaluarEntradaUseCase(unidad(), permitir, catalogo, reloj).ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: id, estado: 'cumple' });
    await evaluar(P1);
    await evaluar(P2);
    const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    await prever().ejecutar({ ...yo, riesgoId: r.id, libreriaCodigo: CODIGO_LIB, idEstable: P1 });
    await motivo().ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P2, tipo: 'legal', nota: 'Ley' });
    const aviso = await new AvisoRetiroRiesgoUseCase(unidad(), permitir, catalogo).ejecutar({ ...yo, id: r.id });
    expect(aviso.controlesSinMotivo.map((x) => x.idEstable)).toContain(P1);
    expect(aviso.controlesSinMotivo.map((x) => x.idEstable)).not.toContain(P2);
    expect((await obtenerRiesgo().ejecutar({ ...yo, id: r.id })).estado).toBe('vigente'); // avisar no cambia nada
  });

  it('un cambio de nombre de un control no toca los riesgos que lo usan', async () => {
    const r = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    const c = await crearControl().ejecutar({ ...yo, codigo: 'C-110', nombre: 'Antes' });
    await vincular().ejecutar({ ...yo, riesgoId: r.id, controlId: c.id });
    await new CambiarControlUseCase(unidad(), permitir, reloj).ejecutar({ ...yo, id: c.id, versionEsperada: 1, nombre: 'Después' });
    const d = await obtenerRiesgo().ejecutar({ ...yo, id: r.id });
    expect(d).toMatchObject({ version: 1 });
    expect(d.controles[0]).toMatchObject({ codigo: 'C-110', nombre: 'Después' });
  });

  it('AISLAMIENTO: B no ve ni toca los riesgos, vínculos, motivos ni referencias de A', async () => {
    const rA = await crearRiesgo().ejecutar({ ...yo, ...riesgo });
    const cA = await crearControl().ejecutar({ ...yo, codigo: 'C-120', nombre: 'De A' });
    await vincular().ejecutar({ ...yo, riesgoId: rA.id, controlId: cA.id });
    await motivo().ejecutar({ ...yo, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'contractual', nota: 'Contrato de A' });
    await guardarRef().ejecutar({ ...yo, tipo: 'analisis', titulo: 'Análisis de A', versionDoc: '1', fecha: '2026-11-01', ubicacion: 'A' });
    // Por los casos de uso: la lista de B no trae nada de A, y lo de A es 404 indistinguible de inexistente.
    expect((await listarRiesgos().ejecutar({ ...yoB, incluirRetirados: true })).every((x) => x.id !== rA.id)).toBe(true);
    await expect(obtenerRiesgo().ejecutar({ ...yoB, id: rA.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(cambiarRiesgo().ejecutar({ ...yoB, id: rA.id, versionEsperada: 1, impacto: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(retirarRiesgo().ejecutar({ ...yoB, id: rA.id, versionEsperada: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    const rB = await crearRiesgo().ejecutar({ ...yoB, ...riesgo });
    const cB = await crearControl().ejecutar({ ...yoB, codigo: 'C-120', nombre: 'De B' }); // el mismo código se puede usar en B
    await expect(vincular().ejecutar({ ...yoB, riesgoId: rA.id, controlId: cB.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(vincular().ejecutar({ ...yoB, riesgoId: rB.id, controlId: cA.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(new RiesgosDeUnControlUseCase(unidad(), permitir).ejecutar({ ...yoB, controlId: cA.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(await new ListarMotivosUseCase(unidad(), permitir).ejecutar(yoB)).toEqual([]);
    expect(await new ListarReferenciasUseCase(unidad(), permitir).ejecutar(yoB)).toEqual([]);
    await expect(new QuitarMotivoUseCase(unidad(), permitir).ejecutar({ ...yoB, libreriaCodigo: CODIGO_LIB, idEstable: P1, tipo: 'contractual', versionEsperada: 1 })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    // Lo de A sigue intacto.
    expect((await obtenerRiesgo().ejecutar({ ...yo, id: rA.id })).controles).toHaveLength(1);
    expect((await new ListarMotivosUseCase(unidad(), permitir).ejecutar(yo)).some((m) => m.tipo === 'contractual' && m.nota === 'Contrato de A')).toBe(true);
  });

  it('AISLAMIENTO: los repositorios, aun con la empresa mal puesta, no cruzan datos (RLS y claves compuestas)', async () => {
    const rA = (await listarRiesgos().ejecutar(yo))[0]!;
    // Sesión de B con un repositorio que cree ser de A: la RLS no deja ver nada de A.
    await conTenant(pools.db('app'), B, async (trx) => {
      expect(await new RiesgoKysely(trx, A).obtener(rA.id)).toBeNull();
      expect(await new RiesgoKysely(trx, A).listar()).toEqual([]);
      expect(await new VinculoRiesgoKysely(trx, A).listarControles()).toEqual([]);
      expect(await new VinculoRiesgoKysely(trx, A).listarEntradas()).toEqual([]);
      expect(await new MotivoKysely(trx, A).listar()).toEqual([]);
      expect(await new ReferenciaKysely(trx, A).listar('ISO/IEC 27001')).toEqual([]);
    });
    // Y no puede escribir en nombre de A: la política y las claves foráneas compuestas lo rechazan.
    await expect(conTenant(pools.db('app'), B, (trx) => new VinculoRiesgoKysely(trx, A).agregarEntrada(rA.id, CODIGO_LIB, P2, UB, new Date()))).rejects.toThrow();
    await expect(conTenant(pools.db('app'), B, (trx) => new VinculoRiesgoKysely(trx, B).agregarEntrada(rA.id, CODIGO_LIB, P2, UB, new Date()))).rejects.toThrow(); // riesgo de A con empresa B
    await expect(conTenant(pools.db('app'), A, (trx) => new VinculoRiesgoKysely(trx, A).agregarEntrada(rA.id, CODIGO_LIB, P2, UB, new Date()))).rejects.toThrow(); // autor de B
  });
});
