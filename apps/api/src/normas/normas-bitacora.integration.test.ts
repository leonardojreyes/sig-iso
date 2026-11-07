import { randomBytes, randomUUID } from 'node:crypto';
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { AutorizacionFake } from '@sig/autorizacion';
import { conTenant, GestorPools, leerUrls, ROLES_BD } from '@sig/db';
import { AdoptarLibreriaUseCase, crearUnidadDeTrabajoNormas, ListarLibreriasUseCase, ListarRequisitosUseCase, ObtenerRequisitoUseCase } from '@sig/normas';
import { crearEmpresaId } from '@sig/tenancy';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearArnes, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { NormasApiModule } from './normas-api.module.js';

// API + PostgreSQL REAL con los adaptadores de producción: adopción atómica con su bitácora, aislamiento entre empresas por
// RLS y rechazos registrados. Cada ejecución usa empresas, personas y librerías propias (la bitácora no se puede borrar).
const hayBase = ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) && !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)('normas (API + PostgreSQL real)', () => {
  const pools = new GestorPools(hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {}, { max: 10 });
  const owner = () => pools.db('owner');
  const sufijo = randomBytes(4).toString('hex');
  const A = crearEmpresaId(randomUUID());
  const B = crearEmpresaId(randomUUID());
  const ADMIN_A = randomUUID();
  const COLAB_A = randomUUID();
  const ADMIN_B = randomUUID();
  const entradas: Record<string, string> = {};
  const librerias: string[] = [];
  let L1 = '';
  let L2 = '';
  let arnes: Arnes;
  let cerrados = false;
  let sesion = 0;
  const token = (e: string, u: string) => arnes.firmar(e, u, { sid: `n-${sufijo}-${++sesion}` });
  const adoptar = async (id: string, t: string) => arnes.pedir(`/librerias/${id}/adopcion`, t, 'POST');

  const crearLibreria = async (codigo: string) => {
    const r = await sql<{ id: string }>`insert into libreria (codigo, nombre, version, hash, es_ejemplo, fuente)
      values (${codigo}, ${`Librería ${codigo}`}, '1.0.0', ${randomBytes(32).toString('hex')}, true, 'elaboración propia SynapTech') returning id`.execute(pools.db('catalogo'));
    librerias.push(r.rows[0]!.id);
    return r.rows[0]!.id;
  };
  const crearEntrada = async (lib: string, idEstable: string, capitulo: number, titulo: string, orden: number, normas: [string, string, string][]) => {
    const r = await sql<{ id: string }>`insert into libreria_entrada (libreria_id, id_estable, capitulo, nivel, titulo, guia, alcance_comun, orden)
      values (${lib}, ${idEstable}, ${capitulo}, 1, ${titulo}, 'Explica con palabras propias qué conviene tener resuelto en este apartado.', 'comun', ${orden}) returning id`.execute(pools.db('catalogo'));
    for (const [norma, edicion, clausula] of normas) {
      await sql`insert into libreria_entrada_norma (entrada_id, libreria_id, norma, edicion, clausula) values (${r.rows[0]!.id}, ${lib}, ${norma}, ${edicion}, ${clausula})`.execute(pools.db('catalogo'));
    }
    entradas[idEstable] = r.rows[0]!.id;
  };
  const eventos = (empresa: typeof A) =>
    conTenant(pools.db('app'), empresa, async (trx) =>
      (await sql<{ accion: string; resultado: string; motivo: string | null; objeto: string | null; usuario_id: string }>`
        select accion, resultado, motivo, objeto, usuario_id from bitacora where accion in ('libreria.adoptada', 'acceso.denegado') order by secuencia`.execute(trx)).rows,
    );
  const adopciones = (empresa: typeof A) =>
    conTenant(owner(), empresa, async (trx) => (await sql`select 1 from empresa_libreria`.execute(trx)).rows.length);
  const huella = async (r: Response) => JSON.stringify({ s: r.status, c: [...r.headers.entries()].filter(([k]) => !['date', 'connection', 'keep-alive'].includes(k)).sort(), b: await r.text() });

  beforeAll(async () => {
    for (const [e, n, personas] of [[A, 'a', [ADMIN_A, COLAB_A]], [B, 'b', [ADMIN_B]]] as const) {
      await conTenant(owner(), e, async (trx) => {
        await sql`insert into empresa (id, slug, nombre, color_primario) values (${e}, ${`n6-${sufijo}-${n}`}, ${`Empresa ${n}`}, '#0b5fff')`.execute(trx);
        for (const p of personas) await sql`insert into usuario (id, empresa_id, nombre, correo) values (${p}, ${e}, ${`Persona ${p.slice(0, 4)}`}, ${`${p}@example.test`})`.execute(trx);
      });
    }
    L1 = await crearLibreria(`prueba-n61-${sufijo}`);
    L2 = await crearLibreria(`prueba-n62-${sufijo}`);
    await crearEntrada(L1, 'ha-mejora', 10, 'Mejora', 3, [['ISO/IEC 27001', '2022', '10.1'], ['ISO 9001', '2015', '10.3']]);
    await crearEntrada(L1, 'ha-contexto', 4, 'Contexto', 1, [['ISO 9001', '2015', '4.1'], ['ISO/IEC 27001', '2022', '4.1']]);
    await crearEntrada(L1, 'ha-liderazgo', 5, 'Liderazgo y compromiso', 2, [['ISO 9001', '2015', '5.1']]);
    await crearEntrada(L2, 'ha-otra', 8, 'Operación planificada', 1, [['ISO 9001', '2015', '8.1']]);

    const autorizacion = new AutorizacionFake();
    autorizacion.asignar(A, ADMIN_A, 'administrador_sig');
    autorizacion.asignar(A, COLAB_A, 'colaborador');
    autorizacion.asignar(B, ADMIN_B, 'administrador_sig');
    const unidad = crearUnidadDeTrabajoNormas(pools.db('app'));
    const bitacora = new Bitacora(new BitacoraKysely({ app: pools.db('app'), plataforma: pools.db('plataforma') }));
    arnes = await crearArnes({
      hechos: { registrar: (e) => bitacora.registrar(e), registrarUnaVez: (e) => bitacora.registrarUnaVez(e) },
      modulos: [
        NormasApiModule.register({
          adoptar: new AdoptarLibreriaUseCase(unidad, autorizacion),
          librerias: new ListarLibreriasUseCase(unidad),
          requisitos: new ListarRequisitosUseCase(unidad),
          requisito: new ObtenerRequisitoUseCase(unidad),
        }),
      ],
    });
  });

  afterAll(async () => {
    await arnes?.cerrar();
    if (cerrados) return;
    for (const e of [A, B]) await conTenant(owner(), e, (trx) => sql`delete from empresa_libreria where empresa_id = ${e}`.execute(trx));
    for (const [e, personas] of [[A, [ADMIN_A, COLAB_A]], [B, [ADMIN_B]]] as const) {
      await conTenant(owner(), e, async (trx) => {
        for (const p of personas) await sql`delete from usuario where id = ${p}`.execute(trx);
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

  it('antes de adoptar: A y B ven el catálogo sin nada adoptado y ninguna entrada, ni por listado ni por id', async () => {
    for (const [e, u] of [[A, ADMIN_A], [B, ADMIN_B]] as const) {
      const lista = ((await (await arnes.pedir('/librerias', await token(e, u))).json()) as { id: string; adoptada: boolean }[]).filter((l) => librerias.includes(l.id));
      expect(lista).toHaveLength(2);
      expect(lista.every((l) => !l.adoptada)).toBe(true);
      expect(await (await arnes.pedir('/requisitos', await token(e, u))).json()).toEqual([]);
    }
    expect((await arnes.pedir(`/requisitos/${entradas['ha-contexto']}`, await token(A, ADMIN_A))).status).toBe(404);
  });

  it('un colaborador recibe 403, no se adopta nada y el rechazo queda en la bitácora de SU empresa (H4.6, H6.5)', async () => {
    const r = await adoptar(L1, await token(A, COLAB_A));
    expect(r.status).toBe(403);
    expect(await adopciones(A)).toBe(0);
    expect(await eventos(A)).toEqual([{ accion: 'acceso.denegado', resultado: 'rechazado', motivo: 'sin_permiso', objeto: 'accion:librerias.adoptar', usuario_id: COLAB_A }]);
    expect(await eventos(B)).toEqual([]);
  });

  it('el administrador de A adopta: 201 con 3 entradas disponibles, UNA fila y UN registro libreria.adoptada (H4.9)', async () => {
    const r = await adoptar(L1, await token(A, ADMIN_A));
    expect(r.status).toBe(201);
    const c = (await r.json()) as Record<string, unknown>;
    expect(c).toMatchObject({ libreriaId: L1, entradas: 3, yaAdoptada: false });
    expect(erroresDeEsquema('Adopcion', c)).toEqual([]);
    expect(await adopciones(A)).toBe(1);
    expect((await eventos(A)).filter((e) => e.accion === 'libreria.adoptada')).toEqual([
      { accion: 'libreria.adoptada', resultado: 'ok', motivo: null, objeto: `libreria:prueba-n61-${sufijo}`, usuario_id: ADMIN_A },
    ]);
  });

  it('adoptar otra vez: 200 «ya adoptada», sin duplicar la fila; el intento queda registrado con motivo ya_adoptada (H4.7)', async () => {
    const r = await adoptar(L1, await token(A, ADMIN_A));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { yaAdoptada: boolean }).yaAdoptada).toBe(true);
    expect(await adopciones(A)).toBe(1);
    expect((await eventos(A)).filter((e) => e.accion === 'libreria.adoptada').map((e) => e.motivo)).toEqual([null, 'ya_adoptada']);
  });

  it('A ve sus 3 entradas en el orden de la librería, y los filtros funcionan sobre los datos reales (H5.x)', async () => {
    const t = await token(A, ADMIN_A);
    const lista = (await (await arnes.pedir('/requisitos', t)).json()) as { idEstable: string; libreriaId: string }[];
    expect(lista.map((e) => e.idEstable)).toEqual(['ha-contexto', 'ha-liderazgo', 'ha-mejora']);
    for (const e of lista) expect(erroresDeEsquema('EntradaLibreria', e)).toEqual([]);
    const ids = async (q: string) => ((await (await arnes.pedir(`/requisitos${q}`, t)).json()) as { idEstable: string }[]).map((e) => e.idEstable);
    expect(await ids('?norma=ISO%2FIEC%2027001')).toEqual(['ha-contexto', 'ha-mejora']);
    expect(await ids('?capitulo=5')).toEqual(['ha-liderazgo']);
    expect(await ids('?q=10.3')).toEqual(['ha-mejora']);
    expect((await arnes.pedir("/requisitos?q=ha'%20or%20'1'='1", t)).status).toBe(400);
  });

  it('B no ve nada de lo adoptado por A (H4.8): listado vacío, `adoptada` en falso y su 404 es idéntico al de un id inexistente (H2.2)', async () => {
    const t = await token(B, ADMIN_B);
    expect(await (await arnes.pedir('/requisitos', t)).json()).toEqual([]);
    const lib = ((await (await arnes.pedir('/librerias', t)).json()) as { id: string; adoptada: boolean }[]).filter((l) => librerias.includes(l.id));
    expect(lib.every((l) => !l.adoptada)).toBe(true);
    const deA = await huella(await arnes.pedir(`/requisitos/${entradas['ha-contexto']}`, t));
    const inexistente = await huella(await arnes.pedir(`/requisitos/${randomUUID()}`, t));
    expect(deA).toBe(inexistente);
    expect(JSON.parse(deA).s).toBe(404);
  });

  it('cinco adopciones simultáneas de una librería nueva: un solo 201 y cuatro 200, una fila y sin errores', async () => {
    const tokens = await Promise.all(Array.from({ length: 5 }, () => token(A, ADMIN_A)));
    const respuestas = await Promise.all(tokens.map((t) => adoptar(L2, t)));
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await adopciones(A)).toBe(2);
  });

  it('una persona sin ningún rol en la empresa no puede adoptar: 403 y la empresa queda como estaba', async () => {
    const sinRol = await arnes.firmar(B, randomUUID(), { sid: `x-${sufijo}` });
    expect((await adoptar(L1, sinRol)).status).toBe(403);
    expect(await adopciones(B)).toBe(0);
  });

  it('con la base de datos caída, adoptar responde 500 y no se da nada por hecho', async () => {
    await pools.cerrar();
    cerrados = true;
    const r = await adoptar(L2, await token(A, ADMIN_A));
    expect(r.status).toBe(500);
    expect(((await r.json()) as { codigo: string }).codigo).toBe('error_interno');
  });
});
