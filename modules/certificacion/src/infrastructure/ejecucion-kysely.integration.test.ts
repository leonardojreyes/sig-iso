import { createHash } from 'node:crypto';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AutorizacionPort } from '../application/autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../application/catalogo-lectura.port.js';
import { serializarCanonico } from '../domain/canonico.js';
import { AvanzarAuditoriaUseCase, CrearAuditoriaUseCase, DesignarMiembroUseCase } from '../application/auditorias.use-cases.js';
import { ConflictoDeVersionError, ConflictoError, EntradaNoEncontradaError, SinPermisoError } from '../application/errores.js';
import { AnularHallazgoUseCase, ListarHallazgosUseCase, RegistrarHallazgoUseCase } from '../application/hallazgos.use-cases.js';
import {
  CerrarAuditoriaUseCase,
  EmitirInformeUseCase,
  ObtenerInformeUseCase,
  ObtenerPanelAuditoriaUseCase,
} from '../application/informe.use-cases.js';
import { AgregarPreguntaUseCase, EvaluarFilaUseCase, ListarListaUseCase, RegenerarListaUseCase } from '../application/lista.use-cases.js';
import { CrearProcesoUseCase } from '../application/procesos.use-cases.js';
import { CrearProgramaUseCase } from '../application/programas.use-cases.js';
import { crearUnidadDeTrabajoCertificacion } from './unidad-de-trabajo-certificacion.js';

// Con PostgreSQL real: lista de verificación, hallazgos, informe congelado, cierre y panel (ADR 040, regla 2).
const A = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e9');
const B = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000ea');
const ADMIN = 'a1a1a1a1-0000-4000-8000-0000000000e9';
const AUDITOR = 'a3a3a3a3-0000-4000-8000-0000000000e9';
const UB = 'b1b1b1b1-0000-4000-8000-0000000000ea';
const LIB = 'c0c0c0c0-0000-4000-8000-0000000000eb';

const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;
const entrada = (
  codigo: string,
  id: string,
  tipo: 'clausula' | 'control',
  capitulo: number | null,
  grupo: string | null,
  orden: number,
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
  orden,
});

describe.skipIf(!hayBase)('ejecución de la auditoría interna sobre PostgreSQL real', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const app = () => pools.db('app');
  const permitir: AutorizacionPort = { puede: async () => true };
  const catalogo: CatalogoLecturaPort = {
    listarEntradasVigentes: async () => [
      entrada('ej-ha', 'c4-1', 'clausula', 4, null, 1),
      entrada('ej-ha', 'c9-3', 'clausula', 9, null, 2),
      entrada('ej-anexo-a', 'a5-1', 'control', null, 'Organizacionales', 3),
    ],
  };
  let t = 0;
  const reloj = () => new Date(Date.UTC(2026, 10, 19, 15, 0, t++));
  const nuevoId = () => crypto.randomUUID();
  const hash = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');
  const u = () => crearUnidadDeTrabajoCertificacion(app());
  const casos = () => ({
    crearProceso: new CrearProcesoUseCase(u(), permitir, reloj, nuevoId),
    crearPrograma: new CrearProgramaUseCase(u(), permitir, catalogo, reloj, nuevoId),
    crear: new CrearAuditoriaUseCase(u(), permitir, catalogo, reloj, nuevoId),
    designar: new DesignarMiembroUseCase(u(), permitir, catalogo, reloj),
    avanzar: new AvanzarAuditoriaUseCase(u(), permitir, catalogo, reloj, nuevoId),
    listar: new ListarListaUseCase(u(), permitir, catalogo),
    regenerar: new RegenerarListaUseCase(u(), permitir, catalogo, reloj, nuevoId),
    evaluar: new EvaluarFilaUseCase(u(), permitir, reloj),
    pregunta: new AgregarPreguntaUseCase(u(), permitir, reloj, nuevoId),
    registrar: new RegistrarHallazgoUseCase(u(), permitir, catalogo, reloj, nuevoId),
    anular: new AnularHallazgoUseCase(u(), permitir, reloj),
    hallazgos: new ListarHallazgosUseCase(u(), permitir),
    emitir: new EmitirInformeUseCase(u(), permitir, catalogo, reloj, nuevoId, hash),
    informe: new ObtenerInformeUseCase(u(), permitir),
    cerrar: new CerrarAuditoriaUseCase(u(), permitir, reloj),
    panel: new ObtenerPanelAuditoriaUseCase(u(), permitir, catalogo, reloj),
  });
  let c: ReturnType<typeof casos>;
  const admin = { empresaId: A, usuarioId: ADMIN };
  const auditor = { empresaId: A, usuarioId: AUDITOR };
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

  let proceso: string;
  let a: { id: string; version: number };

  beforeAll(async () => {
    c = casos();
    await limpiar(A);
    await limpiar(B);
    await sembrar(A, 'ejecint-a', [
      [ADMIN, 'administrador_sig'],
      [AUDITOR, 'auditor_interno'],
    ]);
    await sembrar(B, 'ejecint-b', [[UB, 'administrador_sig']]);
    proceso = (await c.crearProceso.ejecutar({ ...admin, nombre: 'Compras', duenaId: ADMIN })).id;
    const programa = await c.crearPrograma.ejecutar({ ...admin, anio: 2026, objetivo: 'Programa 2026', normas: ['ej-anexo-a', 'ej-ha'] });
    const plan = await c.crear.ejecutar({
      ...admin,
      programaId: programa.id,
      objetivo: 'Verificar el SGSI',
      inicio: '2026-11-10',
      fin: '2026-11-25',
      reunionApertura: '2026-11-10',
      reunionCierre: '2026-11-25',
      normas: ['ej-anexo-a', 'ej-ha'],
      procesosIds: [proceso],
    });
    await c.designar.ejecutar({ ...admin, id: plan.id, personaId: AUDITOR, rol: 'lider' });
    const prep = await c.avanzar.ejecutar({ ...admin, id: plan.id, versionEsperada: plan.version, estado: 'en_preparacion' });
    a = await c.avanzar.ejecutar({ ...admin, id: plan.id, versionEsperada: prep.version, estado: 'en_ejecucion' });
  });
  afterAll(async () => {
    for (const id of [A, B]) {
      await limpiar(id);
      await conTenant(owner(), id, async (trx) => void (await sql`delete from usuario where empresa_id = ${id}`.execute(trx)));
      await conTenant(owner(), id, async (trx) => void (await sql`delete from empresa where id = ${id}`.execute(trx)));
    }
    await pools.cerrar();
  });

  it('la lista se generó al pasar a preparación, ordenada, con la versión de la librería fijada', async () => {
    const l = await c.listar.ejecutar({ ...admin, id: a.id });
    expect(l.filas.map((f) => `${f.libreriaCodigo}:${f.idEstable}`)).toEqual(['ej-anexo-a:a5-1', 'ej-ha:c4-1', 'ej-ha:c9-3']);
    expect(l.filas[0]).toMatchObject({
      titulo: 'Entrada a5-1',
      agrupador: 'Organizacionales',
      resultado: 'por_evaluar',
      diagnostico: null,
    });
    const v = await conTenant(owner(), A, (trx) =>
      sql<{ libreria_version: string }>`select distinct libreria_version from auditoria_item where empresa_id = ${A}`.execute(trx),
    );
    expect(v.rows.map((f) => f.libreria_version)).toEqual([LIB]);
  });

  it('solo el equipo evalúa; la nota exige la evidencia; dos evaluaciones con la misma versión chocan', async () => {
    const filas = (await c.listar.ejecutar({ ...admin, id: a.id })).filas;
    await expect(
      c.evaluar.ejecutar({ ...admin, id: a.id, filaId: filas[0]!.id, versionEsperada: 1, resultado: 'conforme' }),
    ).rejects.toBeInstanceOf(SinPermisoError);
    const r = await Promise.allSettled([
      c.evaluar.ejecutar({ ...auditor, id: a.id, filaId: filas[0]!.id, versionEsperada: 1, resultado: 'conforme' }),
      c.evaluar.ejecutar({
        ...auditor,
        id: a.id,
        filaId: filas[0]!.id,
        versionEsperada: 1,
        resultado: 'no_verificado',
        nota: 'sin tiempo',
      }),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((r.find((x) => x.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictoDeVersionError);
    await c.pregunta.ejecutar({ ...auditor, id: a.id, filaId: filas[1]!.id, texto: '¿Existe el acta?' });
    expect((await c.listar.ejecutar({ ...admin, id: a.id })).filas[1]?.preguntas).toHaveLength(1);
  });

  it('un hallazgo: la base exige proceso y requisito en una NC, no se borra y la aplicación solo lo anula', async () => {
    const filas = (await c.listar.ejecutar({ ...admin, id: a.id })).filas;
    const h = await c.registrar.ejecutar({
      ...auditor,
      id: a.id,
      itemId: filas[1]!.id,
      tipo: 'nc_menor',
      procesoId: proceso,
      enunciado: 'Falta el acta',
      evidencia: 'No se encontró',
    });
    expect(h).toMatchObject({ codigo: 'H-001', libreriaCodigo: 'ej-ha', idEstable: 'c4-1', estado: 'abierto' });
    await expect(
      conTenant(app(), A, (trx) =>
        sql`insert into hallazgo (empresa_id, auditoria_id, numero, tipo, enunciado, evidencia, registrado_por, creado_por, actualizado_por)
        values (${A}, ${a.id}, 50, 'nc_menor', 'x', 'y', ${AUDITOR}, ${AUDITOR}, ${AUDITOR})`.execute(trx),
      ),
    ).rejects.toThrow(); // sin proceso ni requisito
    await expect(conTenant(app(), A, (trx) => sql`delete from hallazgo where empresa_id = ${A}`.execute(trx))).rejects.toThrow(); // sin DELETE
    const x = await c.anular.ejecutar({ ...auditor, id: a.id, hallazgoId: h.id, versionEsperada: 1, motivo: 'duplicado' });
    expect(x).toMatchObject({ estado: 'anulado', anulacionMotivo: 'duplicado' });
    const otro = await c.registrar.ejecutar({
      ...auditor,
      id: a.id,
      itemId: filas[1]!.id,
      tipo: 'nc_menor',
      procesoId: proceso,
      enunciado: 'Falta el acta firmada',
      evidencia: 'No se encontró',
    });
    expect(otro.codigo).toBe('H-002');
  });

  it('informe: no se emite con filas sin evaluar, y al emitir congela una copia inmutable con su huella', async () => {
    await expect(c.emitir.ejecutar({ ...auditor, id: a.id, versionEsperada: a.version, conclusion: 'Conforme' })).rejects.toBeInstanceOf(
      ConflictoError,
    ); // faltan filas
    const filas = (await c.listar.ejecutar({ ...admin, id: a.id })).filas;
    const act = (id: string) => filas.find((f) => f.id === id)!;
    void act;
    const l = (await c.listar.ejecutar({ ...admin, id: a.id })).filas;
    await c.evaluar.ejecutar({
      ...auditor,
      id: a.id,
      filaId: l[1]!.id,
      versionEsperada: l[1]!.version,
      resultado: 'no_conforme',
      nota: 'No hay acta',
    });
    await c.evaluar.ejecutar({ ...auditor, id: a.id, filaId: l[2]!.id, versionEsperada: l[2]!.version, resultado: 'conforme' });
    const i = await c.emitir.ejecutar({
      ...auditor,
      id: a.id,
      versionEsperada: a.version,
      conclusion: 'CONCLUSION-PRIVADA conforme con una NC menor',
      limitaciones: 'Ninguna',
    });
    expect(i.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(i.huella).toBe(hash(serializarCanonico(i.contenido)));
    expect(i.contenido.conteos).toMatchObject({ total: 3, conforme: 2, no_conforme: 1, cubiertas: 3 });
    expect(i.contenido.hallazgos.map((h) => `${h.codigo}:${h.estado}`)).toEqual(['H-001:anulado', 'H-002:abierto']);
    const leido = await c.informe.ejecutar({ ...admin, id: a.id });
    expect(leido.huella).toBe(i.huella);
    expect(leido.contenido.conclusion).toContain('CONCLUSION-PRIVADA');
    // la huella se puede volver a verificar con la copia que devuelve la base (jsonb reordena las claves)
    expect(hash(serializarCanonico(leido.contenido))).toBe(leido.huella);
    // inmutable: la aplicación no puede actualizar ni borrar el informe
    await expect(
      conTenant(app(), A, (trx) => sql`update auditoria_informe set huella = ${'b'.repeat(64)} where empresa_id = ${A}`.execute(trx)),
    ).rejects.toThrow();
    await expect(conTenant(app(), A, (trx) => sql`delete from auditoria_informe where empresa_id = ${A}`.execute(trx))).rejects.toThrow();
    // una segunda emisión no es posible
    await expect(c.emitir.ejecutar({ ...auditor, id: a.id, versionEsperada: a.version + 1, conclusion: 'otra' })).rejects.toBeInstanceOf(
      ConflictoError,
    );
    const bit = await conTenant(owner(), A, (trx) =>
      sql<{
        objeto: string;
        objeto_version: string | null;
      }>`select objeto, objeto_version from bitacora where empresa_id = ${A} and accion = 'informe.emitido' and objeto_version = ${i.huella}`.execute(trx),
    );
    // la bitácora es inmutable: las corridas anteriores dejan sus hechos, por eso se busca el de esta huella
    expect(bit.rows.length).toBeGreaterThanOrEqual(1); // el contenido es el mismo en cada corrida: la huella también
    expect(bit.rows[0]).toMatchObject({ objeto: expect.stringMatching(/^informe:AI-2026-0[0-9]$/), objeto_version: i.huella });
    expect(JSON.stringify(bit.rows)).not.toContain('CONCLUSION-PRIVADA');
  });

  it('cierre y panel: cierra el administrador, los hallazgos siguen abiertos y la cobertura se calcula con las filas evaluadas', async () => {
    const act = await conTenant(owner(), A, (trx) =>
      sql<{ version: number }>`select version from auditoria where empresa_id = ${A} and id = ${a.id}`.execute(trx),
    );
    const cerrada = await c.cerrar.ejecutar({ ...admin, id: a.id, versionEsperada: act.rows[0]!.version });
    expect(cerrada.estado).toBe('cerrada');
    expect((await c.hallazgos.ejecutar({ ...admin, id: a.id })).abiertos.nc_menor).toBe(1);
    const p = await c.panel.ejecutar({ ...admin });
    expect(p).toMatchObject({
      programaAnio: 2026,
      auditorias: { total: 1, cerradas: 1 },
      prerrequisito: { auditoriasCerradas: 1, cumple: false },
    });
    expect(p.prerrequisito.brechas.sinDeclaracion).toBe(true);
    expect(p.prerrequisito.brechas.clausulas).toEqual([]); // las cláusulas 4 y 9 se evaluaron de verdad
    expect(p.cobertura12Meses.clausulas).toEqual({ total: 2, cubiertas: 2 });
    expect(p.cobertura12Meses.procesos).toEqual({ total: 1, cubiertos: 1 });
  });

  it('aislamiento: lista, hallazgos e informe de A no se ven desde B', async () => {
    const b = { empresaId: B, usuarioId: UB };
    await expect(c.listar.ejecutar({ ...b, id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.hallazgos.ejecutar({ ...b, id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.informe.ejecutar({ ...b, id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    await expect(c.regenerar.ejecutar({ ...b, id: a.id })).rejects.toBeInstanceOf(EntradaNoEncontradaError);
    expect(await c.panel.ejecutar(b)).toMatchObject({ programaAnio: null, auditorias: { total: 0 } });
    // ni siquiera con el rol del dueño se leen las filas de A bajo la empresa B
    const filas = await conTenant(owner(), B, (trx) => sql`select 1 from auditoria_item where empresa_id = ${A}`.execute(trx));
    expect(filas.rows).toEqual([]);
  });
});
