import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../application/catalogo-lectura.port.js';
import {
  AvanzarAuditoriaUseCase,
  CambiarAuditoriaUseCase,
  CancelarAuditoriaUseCase,
  ComprobarIndependenciaUseCase,
  CrearAuditoriaUseCase,
  DesignarMiembroUseCase,
  ObtenerAuditoriaUseCase,
  QuitarMiembroUseCase,
  ReprogramarAuditoriaUseCase,
} from '../application/auditorias.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError } from '../application/errores.js';
import { AgregarRelacionUseCase, CrearGestionSigUseCase, CrearProcesoUseCase } from '../application/procesos.use-cases.js';
import { CrearProgramaUseCase } from '../application/programas.use-cases.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real: planificar una auditoría, su alcance, el equipo con la independencia y las excepciones, los estados y el
// aislamiento entre empresas (ADR 040, regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e6');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000e7');
const ADMIN = 'a1a1a1a1-0000-4000-8000-0000000000e6';
const ADMIN2 = 'a2a2a2a2-0000-4000-8000-0000000000e6';
const AUDITOR = 'a3a3a3a3-0000-4000-8000-0000000000e6';
const AUDITOR2 = 'a4a4a4a4-0000-4000-8000-0000000000e6';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000e7';
const LIB = 'c0c0c0c0-0000-4000-8000-0000000000e8';

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

describe.skipIf(!hayBase)('auditorías internas sobre PostgreSQL real', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const permitir: AutorizacionPort = { puede: async () => true };
  const catalogo: CatalogoLecturaPort = {
    listarEntradasVigentes: async () => [
      entrada('aud-ha', 'c4-1', 'clausula', 4, null),
      entrada('aud-anexo-a', 'a5-1', 'control', null, 'Organizacionales'),
    ],
  };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 19, 15, 0, t++));
  const nuevoId = () => crypto.randomUUID();
  const u = () => crearUnidadDeTrabajoCertificacion(pools.db('app'));
  const casos = () => ({
    crearProceso: new CrearProcesoUseCase(u(), permitir, reloj, nuevoId),
    gestionSig: new CrearGestionSigUseCase(u(), permitir, reloj, nuevoId),
    relacion: new AgregarRelacionUseCase(u(), permitir, reloj),
    crearPrograma: new CrearProgramaUseCase(u(), permitir, catalogo, reloj, nuevoId),
    crear: new CrearAuditoriaUseCase(u(), permitir, catalogo, reloj, nuevoId),
    obtener: new ObtenerAuditoriaUseCase(u(), permitir, catalogo),
    cambiar: new CambiarAuditoriaUseCase(u(), permitir, catalogo, reloj),
    reprogramar: new ReprogramarAuditoriaUseCase(u(), permitir, catalogo, reloj),
    cancelar: new CancelarAuditoriaUseCase(u(), permitir, catalogo, reloj),
    avanzar: new AvanzarAuditoriaUseCase(u(), permitir, catalogo, reloj),
    independencia: new ComprobarIndependenciaUseCase(u(), permitir, catalogo, reloj),
    designar: new DesignarMiembroUseCase(u(), permitir, catalogo, reloj),
    quitar: new QuitarMiembroUseCase(u(), permitir),
  });
  let c: ReturnType<typeof casos>;
  const admin = { empresaId: A, usuarioId: ADMIN };
  const NORMAS = ['aud-anexo-a', 'aud-ha'];
  const TABLAS = [
    'hallazgo',
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
  const sembrar = async (id: typeof A, slug: string, personas: Array<[string, string]>) => {
    await conTenant(owner(), id, async (trx) => {
      await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${slug}, ${'Empresa ' + slug}, '#0E5C42') on conflict do nothing`.execute(
        trx,
      );
      for (const [uid, rol] of personas)
        await sql`insert into usuario (id, empresa_id, nombre, correo, rol) values (${uid}, ${id}, ${'Persona ' + uid.slice(0, 2)}, ${uid + '@example.test'}, ${rol}) on conflict do nothing`.execute(
          trx,
        );
    });
  };

  const datos = {
    objetivo: 'Verificar el SGSI',
    inicio: '2026-11-10',
    fin: '2026-11-25',
    reunionApertura: '2026-11-10',
    reunionCierre: '2026-11-25',
    normas: NORMAS,
  };
  let programaId: string;
  let compras: string;
  let a1: Awaited<ReturnType<typeof c.crear.ejecutar>>;

  beforeAll(async () => {
    c = casos();
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'audint-a', [
      [ADMIN, 'administrador_sig'],
      [ADMIN2, 'administrador_sig'],
      [AUDITOR, 'auditor_interno'],
      [AUDITOR2, 'auditor_interno'],
    ]);
    await sembrar(B, 'audint-b', [[UB, 'administrador_sig']]);
    compras = (await c.crearProceso.ejecutar({ ...admin, nombre: 'Compras', duenaId: ADMIN })).id;
    programaId = (await c.crearPrograma.ejecutar({ ...admin, anio: 2026, objetivo: 'Programa 2026', normas: NORMAS })).id;
  });
  afterAll(async () => {
    for (const id of [A, B]) {
      await limpiar(id);
      await conTenant(owner(), id, async (trx) => void (await sql`delete from usuario where empresa_id = ${id}`.execute(trx)));
      await conTenant(owner(), id, async (trx) => void (await sql`delete from empresa where id = ${id}`.execute(trx)));
    }
    await pools.cerrar();
  });

  it('planifica con código correlativo y guarda criterios, alcance y capítulos', async () => {
    a1 = await c.crear.ejecutar({
      ...admin,
      programaId,
      ...datos,
      procesosIds: [compras],
      capitulos: [{ libreriaCodigo: 'aud-ha', capitulo: '4' }],
    });
    expect(a1).toMatchObject({
      codigo: 'AI-2026-01',
      estado: 'planificada',
      combinada: true,
      normas: NORMAS,
      procesosIds: [compras],
      version: 1,
      inicio: '2026-11-10',
      fin: '2026-11-25',
    });
    expect(a1.capitulos).toEqual([{ libreriaCodigo: 'aud-ha', capitulo: '4' }]);
    const b = await c.crear.ejecutar({ ...admin, programaId, ...datos, normas: ['aud-ha'], inicio: '2026-12-01', fin: '2026-12-02' });
    expect(b.codigo).toBe('AI-2026-02');
    const leida = await c.obtener.ejecutar({ ...admin, id: a1.id });
    expect(leida).toMatchObject({ codigo: 'AI-2026-01', normas: NORMAS });
  });

  it('un solo líder por auditoría (lo garantiza la base) y el equipo se quita con rastro', async () => {
    const l = await c.designar.ejecutar({ ...admin, id: a1.id, personaId: AUDITOR, rol: 'lider' });
    expect(l).toMatchObject({ rol: 'lider', excepcion: false });
    await expect(c.designar.ejecutar({ ...admin, id: a1.id, personaId: AUDITOR2, rol: 'lider' })).rejects.toBeInstanceOf(ConflictoError);
    await c.designar.ejecutar({ ...admin, id: a1.id, personaId: AUDITOR2, rol: 'auditor' });
    expect((await c.obtener.ejecutar({ ...admin, id: a1.id })).equipo.map((m) => m.rol)).toEqual(['lider', 'auditor']);
    await c.quitar.ejecutar({ ...admin, id: a1.id, personaId: AUDITOR2 });
    expect((await c.obtener.ejecutar({ ...admin, id: a1.id })).equipo).toHaveLength(1);
    // aunque se saltara la aplicación, el índice único parcial lo impide
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, creado_por) values (${A}, ${a1.id}, ${AUDITOR2}, 'lider', ${ADMIN})`.execute(
          trx,
        ),
      ),
    ).rejects.toThrow();
  });

  it('independencia real: una relación impide designar; con excepción queda marcada; «Gestión del SIG» alcanza a quien diseñó el sistema', async () => {
    await c.relacion.ejecutar({ ...admin, id: compras, personaId: AUDITOR2, relacion: 'participa' });
    const ind = await c.independencia.ejecutar({ ...admin, id: a1.id, personaId: AUDITOR2 });
    expect(ind).toMatchObject({ independiente: false, conflictos: [{ procesoId: compras, relaciones: ['participa'] }] });
    await expect(c.designar.ejecutar({ ...admin, id: a1.id, personaId: AUDITOR2, rol: 'auditor' })).rejects.toBeInstanceOf(ConflictoError);
    const x = await c.designar.ejecutar({
      ...admin,
      id: a1.id,
      personaId: AUDITOR2,
      rol: 'auditor',
      excepcion: { motivo: 'no hay otra persona', medida: 'otra persona revisa el informe' },
    });
    expect(x).toMatchObject({
      excepcion: true,
      autoautorizada: false,
      excepcionAutorizadaPor: ADMIN,
      excepcionMedida: 'otra persona revisa el informe',
    });
    // ADMIN diseña el sistema («Gestión del SIG») y la auditoría cubre la cláusula 4
    const sig = await c.gestionSig.ejecutar(admin);
    const d = await c.obtener.ejecutar({ ...admin, id: a1.id });
    expect(d.procesosDelAlcance).toContain(sig.id);
    expect((await c.independencia.ejecutar({ ...admin, id: a1.id, personaId: ADMIN })).conflictos.map((k) => k.procesoId)).toContain(
      sig.id,
    );
    // quitar a AUDITOR2 para dejar el equipo con el líder
    await c.quitar.ejecutar({ ...admin, id: a1.id, personaId: AUDITOR2 });
  });

  it('estados: avanza con la fecha y la reunión, reprograma, cancela y dos cambios a la vez chocan', async () => {
    const e1 = await c.avanzar.ejecutar({ ...admin, id: a1.id, versionEsperada: a1.version, estado: 'en_preparacion' }).catch(async () => {
      const actual = await c.obtener.ejecutar({ ...admin, id: a1.id });
      return c.avanzar.ejecutar({ ...admin, id: a1.id, versionEsperada: actual.version, estado: 'en_preparacion' });
    });
    expect(e1.estado).toBe('en_preparacion');
    const r = await Promise.allSettled([
      c.reprogramar.ejecutar({
        ...admin,
        id: a1.id,
        versionEsperada: e1.version,
        inicio: '2026-12-01',
        fin: '2026-12-05',
        motivo: 'reprogramada',
      }),
      c.cancelar.ejecutar({ ...admin, id: a1.id, versionEsperada: e1.version, motivo: 'sin_recursos' }),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictoDeVersionError);
    const final = await c.obtener.ejecutar({ ...admin, id: a1.id });
    if (final.estado === 'cancelada') {
      await expect(c.cambiar.ejecutar({ ...admin, id: a1.id, versionEsperada: final.version, objetivo: 'x' })).rejects.toBeInstanceOf(
        ConflictoError,
      );
    } else expect(final.reprogramaciones).toBe(1);
  });

  it('los hechos quedan en la bitácora con el objeto exacto y sin textos', async () => {
    const r = await conTenant(owner(), A, (trx) =>
      sql<{ accion: string; objeto: string | null }>`select accion, objeto from bitacora where empresa_id = ${A}
        and accion in ('auditoria.planificada', 'auditoria.cambiada', 'auditoria.avanzada', 'auditoria.reprogramada', 'auditoria.cancelada', 'equipo.designado', 'equipo.retirado')`.execute(
        trx,
      ),
    );
    expect(r.rows.length).toBeGreaterThan(6);
    for (const f of r.rows) expect(f.objeto).toMatch(/^(auditoria|equipo):AI-[0-9]{4}-[0-9]{2,3}$/);
    expect(JSON.stringify(r.rows)).not.toMatch(/Verificar|otra persona|no hay otra/);
  });

  it('aislamiento: una auditoría de A no se ve, no se cambia ni se le designa equipo desde B', async () => {
    const b = { empresaId: B, usuarioId: UB };
    await expect(c.obtener.ejecutar({ ...b, id: a1.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.cambiar.ejecutar({ ...b, id: a1.id, versionEsperada: 1, objetivo: 'x' })).rejects.toBeInstanceOf(
      EntradaNoEncontradaError,
    );
    await expect(c.designar.ejecutar({ ...b, id: a1.id, personaId: UB, rol: 'auditor' })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.crear.ejecutar({ ...b, programaId, ...datos })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    // una persona de B no puede estar en el equipo de A
    await expect(
      conTenant(owner(), A, (trx) =>
        sql`insert into auditoria_equipo (empresa_id, auditoria_id, usuario_id, rol, creado_por) values (${A}, ${a1.id}, ${UB}, 'auditor', ${ADMIN})`.execute(
          trx,
        ),
      ),
    ).rejects.toThrow();
  });
});
