import { randomBytes, randomUUID } from 'node:crypto';
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { conTenant, GestorPools, leerUrls, ROLES_BD, UnidadDeTrabajoKysely } from '@sig/db';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdoptarLibreriaUseCase } from '../application/adoptar-libreria.use-case.js';
import type { ContextoAdopcion } from '../application/contexto-adopcion.js';
import { ListarLibreriasUseCase } from '../application/listar-librerias.use-case.js';
import { ListarRequisitosUseCase } from '../application/listar-requisitos.use-case.js';
import { ObtenerRequisitoUseCase, RequisitoNoEncontradoError } from '../application/obtener-requisito.use-case.js';
import { AdopcionKysely } from './adopcion-kysely.adapter.js';
import { CatalogoKysely } from './catalogo-kysely.adapter.js';
import { crearUnidadDeTrabajoNormas } from './unidad-de-trabajo-normas.js';

// AISLAMIENTO (integración, PostgreSQL real, dos empresas): A adopta, B no; B pide el id de una entrada de A y recibe
// «no encontrado». Cada ejecución usa empresas, usuarios y librerías propios (la bitácora no se puede borrar).
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('adaptadores de normas (PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 8 });
  const owner = () => pools.db('owner');
  const unidad = () => crearUnidadDeTrabajoNormas(pools.db('app'));
  const sufijo = randomBytes(4).toString('hex');
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const UA = randomUUID();
  const UB = randomUUID();
  const permiso = { puede: async () => true };
  const adoptar = () => new AdoptarLibreriaUseCase(unidad(), permiso);
  const listarLibrerias = () => new ListarLibreriasUseCase(unidad());
  const listarRequisitos = () => new ListarRequisitosUseCase(unidad());
  const obtenerRequisito = () => new ObtenerRequisitoUseCase(unidad());
  const traza = () => `n${randomBytes(6).toString('hex')}`;

  let L1 = '';
  let L2 = '';
  const entradas: Record<string, string> = {};
  const librerias: string[] = [];

  const crearLibreria = async (codigo: string, esEjemplo: boolean) => {
    const r = await sql<{ id: string }>`insert into libreria (codigo, nombre, version, hash, es_ejemplo, fuente)
      values (${codigo}, ${`Librería ${codigo}`}, '1.0.0', ${randomBytes(32).toString('hex')}, ${esEjemplo}, 'elaboración propia SynapTech') returning id`.execute(pools.db('catalogo'));
    librerias.push(r.rows[0]!.id);
    return r.rows[0]!.id;
  };
  const crearEntrada = async (libreriaId: string, idEstable: string, capitulo: number, titulo: string, orden: number, alcance: string, normas: [string, string, string][]) => {
    const r = await sql<{ id: string }>`insert into libreria_entrada (libreria_id, id_estable, capitulo, nivel, titulo, guia, alcance_comun, orden)
      values (${libreriaId}, ${idEstable}, ${capitulo}, 1, ${titulo}, 'Explica con palabras propias qué conviene tener resuelto en este apartado.', ${alcance}, ${orden}) returning id`.execute(pools.db('catalogo'));
    const id = r.rows[0]!.id;
    for (const [norma, edicion, clausula] of normas) {
      await sql`insert into libreria_entrada_norma (entrada_id, libreria_id, norma, edicion, clausula) values (${id}, ${libreriaId}, ${norma}, ${edicion}, ${clausula})`.execute(pools.db('catalogo'));
    }
    entradas[idEstable] = id;
  };
  const filas = async <T>(consulta: ReturnType<typeof sql<T>>) => (await consulta.execute(owner())).rows;
  const adopcionesDe = async (empresa: typeof A, libreria: string) =>
    (await conTenant(owner(), empresa, async (trx) => (await sql`select 1 from empresa_libreria where libreria_id = ${libreria}`.execute(trx)).rows)).length;

  beforeAll(async () => {
    for (const [id, n, u] of [[A, 'a', UA], [B, 'b', UB]] as const) {
      await conTenant(owner(), id, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${id}, ${`n-${sufijo}-${n}`}, ${`Empresa ${n}`}, '#0b5fff')`.execute(trx);
        await sql`insert into usuario (id, empresa_id, nombre, correo) values (${u}, ${id}, ${`Persona ${n}`}, ${`${u}@example.test`})`.execute(trx);
      });
    }
    L1 = await crearLibreria(`prueba-n1-${sufijo}`, true);
    L2 = await crearLibreria(`prueba-n2-${sufijo}`, false);
    // Se insertan fuera de orden: la consulta debe devolverlas por `orden`.
    await crearEntrada(L1, 'ha-mejora', 10, 'Mejora', 3, 'parcial', [['ISO/IEC 27001', '2022', '10.1'], ['ISO 9001', '2015', '10.3']]);
    await crearEntrada(L1, 'ha-contexto', 4, 'Contexto', 1, 'comun', [['ISO 9001', '2015', '4.1'], ['ISO/IEC 27001', '2022', '4.1']]);
    await crearEntrada(L1, 'ha-liderazgo', 5, 'Liderazgo y compromiso', 2, 'comun', [['ISO 9001', '2015', '5.1']]);
    await crearEntrada(L2, 'ha-otra', 8, 'Operación planificada', 1, 'comun', [['ISO 9001', '2015', '8.1']]);
  });

  afterAll(async () => {
    for (const e of [A, B]) await conTenant(owner(), e, (trx) => sql`delete from empresa_libreria where empresa_id = ${e}`.execute(trx));
    for (const [e, u] of [[A, UA], [B, UB]] as const) {
      await conTenant(owner(), e, async (trx) => {
        await sql`delete from usuario where id = ${u}`.execute(trx);
        await sql`delete from empresa where id = ${e}`.execute(trx);
      });
    }
    for (const id of librerias) {
      await sql`delete from libreria_entrada_norma where libreria_id = ${id}`.execute(owner());
      await sql`delete from libreria_entrada where libreria_id = ${id}`.execute(owner());
      await sql`delete from libreria where id = ${id}`.execute(owner());
    }
    await pools.cerrar();
  });

  describe('antes de adoptar', () => {
    it('A y B ven las dos librerías del catálogo, ninguna adoptada', async () => {
      for (const e of [A, B]) {
        const l = (await listarLibrerias().ejecutar(e)).filter((x) => librerias.includes(x.id));
        expect(l.map((x) => [x.codigo, x.adoptada, x.esEjemplo])).toEqual([[`prueba-n1-${sufijo}`, false, true], [`prueba-n2-${sufijo}`, false, false]].sort());
      }
    });

    it('sin adopciones no ven ninguna entrada, ni por listado ni por id (adaptador sin ayuda del caso de uso)', async () => {
      expect(await listarRequisitos().ejecutar({ empresaId: A })).toEqual([]);
      await expect(obtenerRequisito().ejecutar({ empresaId: A, id: entradas['ha-contexto']! })).rejects.toBeInstanceOf(RequisitoNoEncontradoError);
      const crudo = await conTenant(pools.db('app'), A, async (trx) => {
        const c = new CatalogoKysely(trx);
        return { lista: await c.listarEntradas(), una: await c.obtenerEntrada(entradas['ha-contexto']!), cuenta: await c.contarEntradas(L1) };
      });
      expect(crudo).toEqual({ lista: [], una: null, cuenta: 0 });
    });
  });

  describe('adopción', () => {
    it('A adopta: informa 3 entradas, deja la fila y UN registro de bitácora (misma transacción)', async () => {
      const t = traza();
      const r = await adoptar().ejecutar({ empresaId: A, usuarioId: UA, libreriaId: L1, traceId: t });
      expect(r).toMatchObject({ libreriaId: L1, entradas: 3, yaAdoptada: false });
      expect(await adopcionesDe(A, L1)).toBe(1);
      const reg = await filas<{ accion: string; resultado: string; motivo: string | null; objeto: string; objeto_version: string; usuario_id: string; empresa_id: string }>(
        sql`select accion, resultado, motivo, objeto, objeto_version, usuario_id, empresa_id from bitacora where trace_id = ${t}`);
      expect(reg).toEqual([{ accion: 'libreria.adoptada', resultado: 'ok', motivo: null, objeto: `libreria:prueba-n1-${sufijo}`, objeto_version: '1.0.0', usuario_id: UA, empresa_id: A }]);
    });

    it('adoptar otra vez: «ya adoptada», sin duplicar la fila ni cambiar quién ni cuándo; el intento queda registrado', async () => {
      const antes = await conTenant(owner(), A, async (trx) => (await sql<{ adoptada_por: string; adoptada_en: Date }>`select adoptada_por, adoptada_en from empresa_libreria where libreria_id = ${L1}`.execute(trx)).rows);
      const t = traza();
      const r = await adoptar().ejecutar({ empresaId: A, usuarioId: UA, libreriaId: L1, traceId: t });
      expect(r).toMatchObject({ yaAdoptada: true, entradas: 3 });
      const despues = await conTenant(owner(), A, async (trx) => (await sql<{ adoptada_por: string; adoptada_en: Date }>`select adoptada_por, adoptada_en from empresa_libreria where libreria_id = ${L1}`.execute(trx)).rows);
      expect(despues).toEqual(antes);
      expect((await filas<{ motivo: string }>(sql`select motivo from bitacora where trace_id = ${t}`))[0]!.motivo).toBe('ya_adoptada');
    });

    it('cinco adopciones simultáneas de una librería nueva: una sola «creada», las demás «ya adoptada», sin errores', async () => {
      // Barrera DENTRO de la unidad: las cinco leen «no existe» antes de que alguna cree, así que las cinco intentan insertar.
      let leidas = 0;
      let liberar!: () => void;
      const todas = new Promise<void>((r) => { liberar = r; });
      const conBarrera = new UnidadDeTrabajoKysely<ContextoAdopcion>(pools.db('app'), (trx, empresa) => {
        const adopciones = new AdopcionKysely(trx, empresa);
        return {
          catalogo: new CatalogoKysely(trx),
          bitacora: new Bitacora(BitacoraKysely.enTransaccion(trx)),
          adopciones: {
            listarLibreriaIds: () => adopciones.listarLibreriaIds(),
            crear: (adopcion) => adopciones.crear(adopcion),
            obtener: async (id) => {
              const encontrada = await adopciones.obtener(id);
              if (encontrada === null) {
                if (++leidas === 5) liberar();
                await todas;
              }
              return encontrada;
            },
          },
        };
      });
      const resultados = await Promise.all(Array.from({ length: 5 }, () =>
        new AdoptarLibreriaUseCase(conBarrera, permiso).ejecutar({ empresaId: A, usuarioId: UA, libreriaId: L2, traceId: traza() })));
      expect(resultados.filter((r) => !r.yaAdoptada)).toHaveLength(1);
      expect(resultados.every((r) => r.entradas === 1)).toBe(true);
      expect(await adopcionesDe(A, L2)).toBe(1);
    });

    it('todo o nada (H4.10): si algo falla a mitad de camino la empresa queda como estaba (usuario inexistente → falla la fila)', async () => {
      const t = traza();
      await expect(adoptar().ejecutar({ empresaId: B, usuarioId: randomUUID(), libreriaId: L1, traceId: t })).rejects.toThrow(/foreign key|violates/i);
      expect(await adopcionesDe(B, L1)).toBe(0);
      expect(await filas(sql`select 1 from bitacora where trace_id = ${t}`)).toEqual([]);
    });

    it('una librería inexistente no escribe nada', async () => {
      const t = traza();
      await expect(adoptar().ejecutar({ empresaId: B, usuarioId: UB, libreriaId: randomUUID(), traceId: t })).rejects.toThrow(/no encontrada/i);
      expect(await filas(sql`select 1 from bitacora where trace_id = ${t}`)).toEqual([]);
    });
  });

  describe('aislamiento después de que A adoptó (H4.8)', () => {
    it('A ve L1 y L2 como adoptadas; B no ve ninguna adoptada', async () => {
      const deA = (await listarLibrerias().ejecutar(A)).filter((x) => librerias.includes(x.id));
      const deB = (await listarLibrerias().ejecutar(B)).filter((x) => librerias.includes(x.id));
      expect(deA.every((x) => x.adoptada)).toBe(true);
      expect(deB.every((x) => !x.adoptada)).toBe(true);
    });

    it('B no ve entradas de A: listado vacío y, por id, «no encontrado» idéntico al de un id inexistente', async () => {
      expect(await listarRequisitos().ejecutar({ empresaId: B })).toEqual([]);
      const deA = await obtenerRequisito().ejecutar({ empresaId: B, id: entradas['ha-contexto']! }).catch((e: unknown) => e as Error);
      const inexistente = await obtenerRequisito().ejecutar({ empresaId: B, id: randomUUID() }).catch((e: unknown) => e as Error);
      expect(deA).toBeInstanceOf(RequisitoNoEncontradoError);
      expect(inexistente).toBeInstanceOf(RequisitoNoEncontradoError);
      expect((deA as Error).message).toBe((inexistente as Error).message);
    });

    it('en el adaptador crudo (sin la defensa del caso de uso) la RLS ya oculta lo de A a B', async () => {
      const crudo = await conTenant(pools.db('app'), B, async (trx) => {
        const c = new CatalogoKysely(trx);
        const adop = new AdopcionKysely(trx, B);
        return { lista: await c.listarEntradas(), una: await c.obtenerEntrada(entradas['ha-contexto']!), cuenta: await c.contarEntradas(L1), adoptadas: await adop.listarLibreriaIds(), propia: await adop.obtener(L1) };
      });
      expect(crudo).toEqual({ lista: [], una: null, cuenta: 0, adoptadas: [], propia: null });
    });

    it('B adopta por su cuenta y entonces ve lo suyo; A no pierde nada', async () => {
      const r = await adoptar().ejecutar({ empresaId: B, usuarioId: UB, libreriaId: L1, traceId: traza() });
      expect(r).toMatchObject({ yaAdoptada: false, entradas: 3 });
      expect((await listarRequisitos().ejecutar({ empresaId: B })).map((e) => e.idEstable)).toEqual(['ha-contexto', 'ha-liderazgo', 'ha-mejora']);
      expect((await listarRequisitos().ejecutar({ empresaId: A })).length).toBe(4);
    });
  });

  describe('lectura de entradas y mapeo a las formas del contrato', () => {
    it('devuelve las entradas en el orden de la librería (no el de inserción) con todos los campos mapeados', async () => {
      const r = (await listarRequisitos().ejecutar({ empresaId: A })).filter((e) => e.libreriaId === L1);
      expect(r.map((e) => e.idEstable)).toEqual(['ha-contexto', 'ha-liderazgo', 'ha-mejora']);
      expect(r[2]).toEqual({
        id: entradas['ha-mejora'], idEstable: 'ha-mejora', libreriaId: L1, capitulo: 10, nivel: 1, tipo: 'clausula', grupo: null, titulo: 'Mejora',
        guia: 'Explica con palabras propias qué conviene tener resuelto en este apartado.', alcanceComun: 'parcial', esEjemplo: true,
        aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '10.3' }, { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '10.1' }],
      });
    });

    it('el adaptador entrega las entradas ya ordenadas por librería y orden', async () => {
      const lista = await conTenant(pools.db('app'), A, (trx) => new CatalogoKysely(trx).listarEntradas());
      expect(lista.filter((e) => e.libreriaId === L1).map((e) => e.orden)).toEqual([1, 2, 3]);
      const posicion = (id: string) => lista.findIndex((e) => e.libreriaId === id);
      expect(posicion(L1)).toBeLessThan(posicion(L2));
    });

    it('esEjemplo sale de la librería de cada entrada', async () => {
      const r = await listarRequisitos().ejecutar({ empresaId: A });
      expect(r.find((e) => e.idEstable === 'ha-otra')?.esEjemplo).toBe(false);
      expect(r.find((e) => e.idEstable === 'ha-contexto')?.esEjemplo).toBe(true);
    });

    it('obtener por id devuelve la misma forma', async () => {
      const una = await obtenerRequisito().ejecutar({ empresaId: A, id: entradas['ha-contexto']! });
      expect(una).toMatchObject({ idEstable: 'ha-contexto', capitulo: 4, alcanceComun: 'comun' });
      expect(una.aplicaA).toEqual([{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1' }, { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '4.1' }]);
    });

    it('los filtros se aplican sobre los datos reales', async () => {
      const ids = async (f: Record<string, unknown>) => (await listarRequisitos().ejecutar({ empresaId: A, ...f } as never)).map((e) => e.idEstable);
      expect(await ids({ norma: 'ISO/IEC 27001' })).toEqual(['ha-contexto', 'ha-mejora']);
      expect(await ids({ capitulo: 5 })).toEqual(['ha-liderazgo']);
      expect(await ids({ q: 'liderazgo' })).toEqual(['ha-liderazgo']);
      expect(await ids({ q: '10.3' })).toEqual(['ha-mejora']);
      expect(await ids({ q: "' or 1=1 --" }).catch(() => 'invalido')).toBe('invalido');
    });
  });
});
