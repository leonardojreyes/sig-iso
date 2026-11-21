import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../application/catalogo-lectura.port.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError } from '../application/errores.js';
import { CrearProcesoUseCase } from '../application/procesos.use-cases.js';
import {
  AgregarExclusionUseCase,
  AprobarProgramaUseCase,
  CambiarProgramaUseCase,
  CrearProgramaUseCase,
  ListarProgramasUseCase,
  ObtenerProgramaUseCase,
  QuitarExclusionUseCase,
} from '../application/programas.use-cases.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real: programa anual, normas, motivos de exclusión, aprobación, ayudas y aislamiento entre empresas (ADR 040, regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e3');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000e4');
const ADMIN = 'a1a1a1a1-0000-4000-8000-0000000000e3';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000e4';
const LIB = 'c0c0c0c0-0000-4000-8000-0000000000e5';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;
const entrada = (
  codigo: string,
  id: string,
  tipo: 'clausula' | 'control',
  capitulo: number | null,
  grupo: string | null,
): EntradaCatalogo => ({
  libreriaCodigo: codigo,
  libreriaId: LIB,
  idEstable: id,
  tipo,
  capitulo,
  grupo,
  titulo: `Entrada ${id}`,
  guia: 'Guía breve.',
  aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: id }],
  orden: 1,
});

describe.skipIf(!hayBase)('programa anual de auditoría sobre PostgreSQL real', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const permitir: AutorizacionPort = { puede: async () => true };
  const catalogo: CatalogoLecturaPort = {
    listarEntradasVigentes: async () => [
      entrada('prog-ha', 'c4-1', 'clausula', 4, null),
      entrada('prog-anexo-a', 'a5-1', 'control', null, 'Organizacionales'),
    ],
  };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 19, 15, 0, t++));
  const nuevoId = () => crypto.randomUUID();
  const u = () => crearUnidadDeTrabajoCertificacion(pools.db('app'));
  const casos = () => ({
    crearProceso: new CrearProcesoUseCase(u(), permitir, reloj, nuevoId),
    listar: new ListarProgramasUseCase(u(), permitir),
    obtener: new ObtenerProgramaUseCase(u(), permitir, catalogo),
    crear: new CrearProgramaUseCase(u(), permitir, catalogo, reloj, nuevoId),
    cambiar: new CambiarProgramaUseCase(u(), permitir, catalogo, reloj),
    aprobar: new AprobarProgramaUseCase(u(), permitir, catalogo, reloj),
    agregar: new AgregarExclusionUseCase(u(), permitir, reloj, nuevoId),
    quitar: new QuitarExclusionUseCase(u(), permitir),
  });
  let c: ReturnType<typeof casos>;
  const admin = { empresaId: A, usuarioId: ADMIN };
  const NORMAS = ['prog-anexo-a', 'prog-ha']; // el programa las guarda ordenadas

  const TABLAS = [
    'auditoria_informe',
    'hallazgo',
    'auditoria_pregunta',
    'auditoria_item',
    'auditoria_equipo',
    'auditoria_capitulo',
    'auditoria_proceso',
    'auditoria_norma',
    'auditoria',
    'programa_exclusion',
    'programa_norma',
    'programa_auditoria',
    'persona_proceso',
    'proceso',
  ];
  const limpiar = async (id: typeof A) => {
    await conTenant(owner(), id, async (trx) => {
      for (const tabla of TABLAS) await sql`delete from ${sql.table(tabla)} where empresa_id = ${id}`.execute(trx);
    });
  };
  const sembrar = async (id: typeof A, slug: string, usuario: string) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      await sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${usuario}, ${id}, ${'Persona ' + slug}, ${usuario + '@example.test'}, 'administrador_sig') on conflict do nothing`.execute(
        trx,
      );
    });
  };

  beforeAll(async () => {
    c = casos();
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'progint-a', ADMIN);
    await sembrar(B, 'progint-b', UB);
  });
  afterAll(async () => {
    for (const id of [A, B]) {
      await limpiar(id);
      await conTenant(owner(), id, async (trx) => void (await sql`delete from usuario where empresa_id = ${id}`.execute(trx)));
      await conTenant(owner(), id, async (trx) => void (await sql`delete from empresa where id = ${id}`.execute(trx)));
    }
    await pools.cerrar();
  });

  it('un programa por año: lo garantiza la base y un segundo intento es conflicto', async () => {
    const p = await c.crear.ejecutar({ ...admin, anio: 2027, objetivo: 'Verificar', normas: NORMAS });
    expect(p).toMatchObject({ anio: 2027, estado: 'sin_aprobar', normas: NORMAS, version: 1 });
    await expect(c.crear.ejecutar({ ...admin, anio: 2027, objetivo: 'Otro', normas: NORMAS })).rejects.toBeInstanceOf(ConflictoError);
    expect((await c.listar.ejecutar(admin)).programas).toHaveLength(1);
  });

  it('motivos: uno por proceso o capítulo, se aprueba al cubrirlo todo y un cambio lo devuelve a «sin aprobar»', async () => {
    const proceso = await c.crearProceso.ejecutar({ ...admin, nombre: 'Compras', duenaId: ADMIN });
    const p = (await c.listar.ejecutar(admin)).programas[0]!;
    await expect(c.aprobar.ejecutar({ ...admin, id: p.id, versionEsperada: 1 })).rejects.toBeInstanceOf(ConflictoError);
    const x = await c.agregar.ejecutar({ ...admin, id: p.id, tipo: 'proceso', procesoId: proceso.id, motivo: 'auditado el año pasado' });
    await expect(
      c.agregar.ejecutar({ ...admin, id: p.id, tipo: 'proceso', procesoId: proceso.id, motivo: 'otra vez' }),
    ).rejects.toBeInstanceOf(ConflictoError);
    for (const [libreriaCodigo, capitulo] of [
      ['prog-ha', '4'],
      ['prog-anexo-a', 'Organizacionales'],
    ] as const)
      await c.agregar.ejecutar({ ...admin, id: p.id, tipo: 'capitulo', libreriaCodigo, capitulo, motivo: 'riesgo bajo' });
    const d = await c.obtener.ejecutar({ ...admin, id: p.id });
    expect(d.pendientes).toMatchObject({ procesos: [], capitulos: [] });
    expect(d.exclusiones).toHaveLength(3);
    const ap = await c.aprobar.ejecutar({ ...admin, id: p.id, versionEsperada: 1 });
    expect(ap).toMatchObject({ estado: 'aprobado', aprobadoPor: ADMIN, version: 2 });
    expect(ap.aprobadoEn).toMatch(/^2026-11-19T/);
    await expect(c.quitar.ejecutar({ ...admin, id: p.id, exclusionId: x.id })).rejects.toBeInstanceOf(ConflictoError);
    const cambiado = await c.cambiar.ejecutar({ ...admin, id: p.id, versionEsperada: 2, normas: ['prog-ha'] });
    expect(cambiado).toMatchObject({ estado: 'sin_aprobar', aprobadoPor: null, aprobadoEn: null, normas: ['prog-ha'] });
    await c.quitar.ejecutar({ ...admin, id: p.id, exclusionId: x.id });
    await expect(c.quitar.ejecutar({ ...admin, id: p.id, exclusionId: x.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
  });

  it('dos cambios a la vez con la misma versión: uno gana y el otro es conflicto', async () => {
    const p = (await c.listar.ejecutar(admin)).programas[0]!;
    const r = await Promise.allSettled([
      c.cambiar.ejecutar({ ...admin, id: p.id, versionEsperada: p.version, objetivo: 'Uno' }),
      c.cambiar.ejecutar({ ...admin, id: p.id, versionEsperada: p.version, objetivo: 'Dos' }),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictoDeVersionError);
  });

  it('las ayudas traen la última auditoría cerrada de cada proceso y sus hallazgos abiertos', async () => {
    const p = (await c.listar.ejecutar(admin)).programas[0]!;
    const proceso = (await c.obtener.ejecutar({ ...admin, id: p.id })).procesos[0]!;
    const aud = crypto.randomUUID();
    await conTenant(owner(), A, async (trx) => {
      await sql`insert into auditoria (id, empresa_id, programa_id, anio, numero, objetivo, estado, inicio, fin, informe_emitido_por, informe_emitido_en, cerrada_por, cerrada_en, creado_por, actualizado_por)
        values (${aud}, ${A}, ${p.id}, 2027, 1, 'x', 'cerrada', '2027-03-01', '2027-03-05', ${ADMIN}, now(), ${ADMIN}, now(), ${ADMIN}, ${ADMIN})`.execute(
        trx,
      );
      await sql`insert into auditoria_proceso (empresa_id, auditoria_id, proceso_id, creado_por) values (${A}, ${aud}, ${proceso.procesoId}, ${ADMIN})`.execute(
        trx,
      );
      await sql`insert into hallazgo (empresa_id, auditoria_id, numero, tipo, proceso_id, libreria_codigo, id_estable, enunciado, evidencia, registrado_por, creado_por, actualizado_por)
        values (${A}, ${aud}, 1, 'nc_menor', ${proceso.procesoId}, 'prog-ha', 'c4-1', 'enunciado', 'evidencia', ${ADMIN}, ${ADMIN}, ${ADMIN})`.execute(
        trx,
      );
    });
    const d = await c.obtener.ejecutar({ ...admin, id: p.id });
    expect(d.procesos[0]).toMatchObject({ ultimaAuditoria: '2027-03-05', hallazgosAbiertos: 1 });
    expect(d.auditorias).toHaveLength(1);
    expect(d.auditorias[0]).toMatchObject({ codigo: 'AI-2027-01', estado: 'cerrada', trimestre: 1, combinada: false, liderId: null });
  });

  it('los hechos quedan en la bitácora con el objeto exacto y sin textos', async () => {
    const r = await conTenant(owner(), A, (trx) =>
      sql<{ accion: string; objeto: string | null }>`select accion, objeto from bitacora where empresa_id = ${A}
        and accion in ('programa.creado', 'programa.cambiado', 'programa.aprobado', 'exclusion.creada', 'exclusion.eliminada')`.execute(
        trx,
      ),
    );
    expect(r.rows.length).toBeGreaterThan(5);
    for (const f of r.rows) expect(f.objeto).toMatch(/^(programa:[0-9]{4}|exclusion:[0-9]{4}\.(PR-[0-9]{3,6}|capitulo))$/);
    expect(JSON.stringify(r.rows)).not.toMatch(/Verificar|auditado el año|riesgo bajo/);
  });

  it('aislamiento: el programa de A no se ve, no se cambia, no se aprueba y no admite normas ni procesos de B', async () => {
    const p = (await c.listar.ejecutar(admin)).programas[0]!;
    expect((await c.listar.ejecutar({ empresaId: B, usuarioId: UB })).programas).toEqual([]);
    const b = { empresaId: B, usuarioId: UB };
    await expect(c.obtener.ejecutar({ ...b, id: p.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.cambiar.ejecutar({ ...b, id: p.id, versionEsperada: p.version, objetivo: 'x' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(c.aprobar.ejecutar({ ...b, id: p.id, versionEsperada: p.version })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(
      c.agregar.ejecutar({ ...b, id: p.id, tipo: 'capitulo', libreriaCodigo: 'prog-ha', capitulo: '4', motivo: 'x' }),
    ).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    const propio = await c.crearProceso.ejecutar({ ...b, nombre: 'Proceso de B', duenaId: UB });
    await expect(c.agregar.ejecutar({ ...admin, id: p.id, tipo: 'proceso', procesoId: propio.id, motivo: 'x' })).rejects.toThrow(); // proceso de otra empresa
  });
});
