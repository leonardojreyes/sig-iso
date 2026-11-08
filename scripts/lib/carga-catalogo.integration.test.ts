import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { GestorPools, leerUrls } from '@sig/db';
import { sql, type OperationNodeTransformer } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { cargarCatalogo, evaluarCarpeta, huellaCanonica } from './carga-catalogo.js';

// Integración con PostgreSQL real (sigiso_test): la carga corre con el rol del catálogo, es idempotente, rechaza una versión con
// otro contenido y es todo o nada. Usa códigos de librería propios de esta ejecución. La bitácora no se puede borrar.
const hayBase = Boolean(
  process.env.DATABASE_URL_OWNER &&
  process.env.DATABASE_URL_APP &&
  process.env.DATABASE_URL_PLATAFORMA &&
  process.env.DATABASE_URL_CATALOGO &&
  process.env.DATABASE_URL_TEST,
);

const sufijo = randomBytes(4).toString('hex');
const CODIGO = `prueba-carga-${sufijo}`;

// Librería SINTÉTICA (ningún texto de norma).
const libreria = (cambios: Record<string, unknown> = {}) => ({
  esquema: 2,
  codigo: CODIGO,
  nombre: 'Librería sintética de carga',
  version: '1.0.0',
  es_ejemplo: true,
  fuente: 'elaboración propia SynapTech',
  referencias: [
    { norma: 'Norma A', edicion: '2015' },
    { norma: 'Norma B', edicion: '2022' },
  ],
  entradas: [
    {
      id: 'ha-4.1',
      capitulo: 4,
      nivel: 1,
      titulo: 'Primer tema',
      guia: 'Texto sintético uno, sin relación con ninguna norma.',
      alcance_comun: 'comun',
      aplica_a: [
        { norma: 'Norma A', edicion: '2015', clausula: '4.1' },
        { norma: 'Norma B', edicion: '2022', clausula: '4.1' },
      ],
    },
    {
      id: 'ha-4.2',
      capitulo: 4,
      nivel: 1,
      titulo: 'Segundo tema',
      guia: 'Texto sintético dos, sin relación con ninguna norma.',
      alcance_comun: 'parcial',
      aplica_a: [{ norma: 'Norma A', edicion: '2015', clausula: '4.2' }],
    },
    {
      id: 'ha-5.1',
      capitulo: 5,
      nivel: 2,
      titulo: 'Tercer tema',
      guia: 'Texto sintético tres, sin relación con ninguna norma.',
      alcance_comun: 'especifico',
      aplica_a: [{ norma: 'Norma B', edicion: '2022', clausula: '5.1' }],
    },
  ],
  ...cambios,
});

describe.skipIf(!hayBase)('cargarCatalogo (PostgreSQL real)', () => {
  const pools = new GestorPools(
    hayBase ? leerUrls(process.env, ['owner', 'app', 'plataforma', 'catalogo'], { prueba: true }) : {},
    { max: 6 },
  );
  const bitacora = () => new Bitacora(new BitacoraKysely({ app: pools.db('app'), plataforma: pools.db('plataforma') }));
  const carpetas: string[] = [];

  const carpeta = (archivos: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'sigiso-carga-'));
    carpetas.push(dir);
    for (const [nombre, contenido] of Object.entries(archivos)) {
      mkdirSync(join(dir, nombre, '..'), { recursive: true });
      writeFileSync(join(dir, nombre), contenido);
    }
    return dir;
  };
  const cargar = (dir: string, catalogo = pools.db('catalogo')) =>
    cargarCatalogo({ catalogo, bitacora: bitacora() }, evaluarCarpeta(dir));

  const filas = async () => ({
    libreria: Number(
      (await sql<{ n: string }>`select count(*) as n from libreria where codigo = ${CODIGO}`.execute(pools.db('owner')))
        .rows[0]!.n,
    ),
    entradas: Number(
      (
        await sql<{
          n: string;
        }>`select count(*) as n from libreria_entrada e join libreria l on l.id = e.libreria_id where l.codigo = ${CODIGO}`.execute(
          pools.db('owner'),
        )
      ).rows[0]!.n,
    ),
    normas: Number(
      (
        await sql<{
          n: string;
        }>`select count(*) as n from libreria_entrada_norma n join libreria l on l.id = n.libreria_id where l.codigo = ${CODIGO}`.execute(
          pools.db('owner'),
        )
      ).rows[0]!.n,
    ),
  });
  const eventos = async () =>
    (
      await sql<{
        resultado: string;
        motivo: string | null;
        objeto: string;
        objeto_version: string;
        despues: unknown;
        empresa_id: string | null;
        actor_tipo: string;
      }>`
      select resultado, motivo, objeto, objeto_version, despues, empresa_id, actor_tipo from bitacora
      where accion = 'catalogo.cargado' and objeto = ${`libreria:${CODIGO}`} order by id`.execute(pools.db('owner'))
    ).rows;

  afterAll(async () => {
    const o = pools.db('owner');
    await sql`delete from libreria_entrada_norma where libreria_id in (select id from libreria where codigo = ${CODIGO})`.execute(
      o,
    );
    await sql`delete from libreria_entrada where libreria_id in (select id from libreria where codigo = ${CODIGO})`.execute(
      o,
    );
    await sql`delete from libreria where codigo = ${CODIGO}`.execute(o);
    for (const d of carpetas) rmSync(d, { recursive: true, force: true });
    await pools.cerrar();
  });

  beforeAll(() => undefined);

  it('la primera carga inserta la librería, sus entradas y sus correspondencias, y registra UN hecho de plataforma sin empresa', async () => {
    const r = await cargar(carpeta({ 'a.yaml': stringify(libreria()) }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      codigo: CODIGO,
      version: '1.0.0',
      estado: 'cargada',
      entradas: 3,
      evento: 'registrado',
    });
    expect(await filas()).toEqual({ libreria: 1, entradas: 3, normas: 4 });
    const e = await eventos();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({
      resultado: 'ok',
      motivo: 'carga_inicial',
      actor_tipo: 'plataforma',
      empresa_id: null,
      despues: { entradas: 3 },
    });
    expect(e[0]!.objeto_version).toMatch(/^[0-9a-f]{64}$/);
  });

  it('guarda la huella calculada y el orden de las entradas', async () => {
    const [{ hash }] = (
      await sql<{ hash: string }>`select hash from libreria where codigo = ${CODIGO}`.execute(pools.db('owner'))
    ).rows as [{ hash: string }];
    expect(hash).toBe((await eventos())[0]!.objeto_version);
    const ordenadas = (
      await sql<{
        id_estable: string;
        orden: number;
      }>`select id_estable, orden from libreria_entrada e join libreria l on l.id = e.libreria_id where l.codigo = ${CODIGO} and l.version = '1.0.0' order by e.orden`.execute(
        pools.db('owner'),
      )
    ).rows;
    expect(ordenadas.map((x) => x.id_estable)).toEqual(['ha-4.1', 'ha-4.2', 'ha-5.1']);
    expect(ordenadas.map((x) => x.orden)).toEqual([1, 2, 3]);
    const [meta] = (
      await sql<{
        es_ejemplo: boolean;
        fuente: string;
        nombre: string;
      }>`select es_ejemplo, fuente, nombre from libreria where codigo = ${CODIGO} and version = '1.0.0'`.execute(
        pools.db('owner'),
      )
    ).rows;
    expect(meta).toEqual({
      es_ejemplo: true,
      fuente: 'elaboración propia SynapTech',
      nombre: 'Librería sintética de carga',
    });
  });

  it('cargar de nuevo la misma versión con el mismo contenido NO duplica nada ni registra otro hecho (aunque el archivo se escriba distinto)', async () => {
    const reescrita = JSON.stringify(libreria()); // mismo contenido, otro formato de archivo
    const r = await cargar(carpeta({ 'otra-forma.yaml': reescrita }));
    expect(r[0]).toMatchObject({ estado: 'ya_cargada', evento: 'ya_existia' });
    expect(await filas()).toEqual({ libreria: 1, entradas: 3, normas: 4 });
    expect(await eventos()).toHaveLength(1);
  });

  it('la misma versión con OTRO contenido se rechaza (hash_distinto): nada cambia y queda un hecho «rechazado»; repetirlo no lo duplica', async () => {
    const cambiada = libreria({ nombre: 'Otro nombre para la misma versión' });
    const dir = carpeta({ 'a.yaml': stringify(cambiada) });
    const r = await cargar(dir);
    expect(r[0]).toMatchObject({ estado: 'hash_distinto', evento: 'registrado' });
    await cargar(dir);
    expect(await filas()).toEqual({ libreria: 1, entradas: 3, normas: 4 });
    const e = await eventos();
    expect(e.filter((x) => x.resultado === 'rechazado')).toHaveLength(1);
    expect(e.find((x) => x.resultado === 'rechazado')).toMatchObject({ motivo: 'hash_distinto', empresa_id: null });
    const [{ nombre }] = (
      await sql<{ nombre: string }>`select nombre from libreria where codigo = ${CODIGO}`.execute(pools.db('owner'))
    ).rows as [{ nombre: string }];
    expect(nombre).toBe('Librería sintética de carga');
  });

  it('una versión NUEVA del mismo código se carga como otra librería', async () => {
    const r = await cargar(carpeta({ 'a.yaml': stringify(libreria({ version: '1.1.0' })) }));
    expect(r[0]).toMatchObject({ estado: 'cargada' });
    expect((await filas()).libreria).toBe(2);
  });

  it('un archivo con formato inválido no inserta nada y deja un hecho «rechazado» (formato_invalido) sin su contenido', async () => {
    const roto = { ...libreria({ version: '2.0.0' }), campo_que_no_existe: 'x' };
    const antes = await filas();
    const dir = carpeta({ 'roto.yaml': stringify(roto) });
    const r = await cargar(dir);
    expect(r[0]).toMatchObject({ estado: 'formato_invalido', evento: 'registrado' });
    expect(await filas()).toEqual(antes);
    await cargar(dir);
    const rechazos = (
      await sql<{
        motivo: string;
        despues: unknown;
      }>`select motivo, despues from bitacora where accion = 'catalogo.cargado' and motivo = 'formato_invalido' and objeto like 'libreria:%' and objeto_version = ${r[0]!.huella}`.execute(
        pools.db('owner'),
      )
    ).rows;
    expect(rechazos).toHaveLength(1);
    expect(JSON.stringify(rechazos[0])).not.toContain('campo_que_no_existe');
  });

  it('un YAML ilegible también se rechaza como formato_invalido', async () => {
    const r = await cargar(carpeta({ 'ilegible.yaml': 'esquema: [2\nnombre: "sin cerrar' }));
    expect(r[0]).toMatchObject({ estado: 'formato_invalido' });
  });

  it('una guía que parece texto copiado se rechaza (contenido_no_permitido) y no se carga', async () => {
    const copiada = libreria({ version: '3.0.0' });
    (copiada.entradas as Array<{ guia: string }>)[0]!.guia =
      `La organización ${'debe determinar lo necesario'}; ${'debe asegurar lo demás'}; ${'debe mantener la información documentada'}.`;
    const antes = await filas();
    const r = await cargar(carpeta({ 'copiada.yaml': stringify(copiada) }));
    expect(r[0]).toMatchObject({ estado: 'contenido_no_permitido', evento: 'registrado' });
    expect(await filas()).toEqual(antes);
    const hecho = (
      await sql<{
        motivo: string;
        resultado: string;
      }>`select motivo, resultado from bitacora where accion = 'catalogo.cargado' and objeto_version = ${r[0]!.huella}`.execute(
        pools.db('owner'),
      )
    ).rows;
    expect(hecho).toEqual([{ motivo: 'contenido_no_permitido', resultado: 'rechazado' }]);
  });

  it('es todo o nada: si falla a mitad de la carga (tercera tabla) no queda NADA de esa librería', async () => {
    const nueva = libreria({ codigo: CODIGO, version: '4.0.0' });
    const antes = await filas();
    const fallaAlInsertarNormas = pools.db('catalogo').withPlugin({
      transformQuery: ({ node }: { node: { kind: string; into?: { table?: { identifier?: { name?: string } } } } }) => {
        if (node.kind === 'InsertQueryNode' && node.into?.table?.identifier?.name === 'libreria_entrada_norma')
          throw new Error('fallo simulado');
        return node as never;
      },
      transformResult: async ({ result }: { result: unknown }) => result as never,
    } as unknown as OperationNodeTransformer & never);
    await expect(cargar(carpeta({ 'a.yaml': stringify(nueva) }), fallaAlInsertarNormas as never)).rejects.toThrow(
      /fallo simulado/,
    );
    expect(await filas()).toEqual(antes);
    expect((await eventos()).filter((e) => e.resultado === 'ok')).toHaveLength(2); // solo las dos cargas buenas (1.0.0 y 1.1.0)
  });

  it('dos cargas SIMULTÁNEAS de la misma versión nueva dejan una sola librería: una la carga y la otra la ve ya cargada', async () => {
    const dir = carpeta({ 'a.yaml': stringify(libreria({ version: '6.0.0' })) });
    const antes = (await filas()).libreria;
    const [x, y] = await Promise.all([cargar(dir), cargar(dir)]);
    expect([x![0]!.estado, y![0]!.estado].sort()).toEqual(['cargada', 'ya_cargada']);
    expect((await filas()).libreria).toBe(antes + 1);
    const hechos = (
      await sql<{
        n: string;
      }>`select count(*) as n from bitacora where accion = 'catalogo.cargado' and objeto = ${`libreria:${CODIGO}`} and resultado = 'ok' and objeto_version = ${x![0]!.huella}`.execute(
        pools.db('owner'),
      )
    ).rows[0]!.n;
    expect(Number(hechos)).toBe(1);
  });

  it('si OTRA carga de la misma versión se confirma justo en medio (choque de unicidad), reintenta y la ve ya cargada, sin fallar', async () => {
    const l = libreria({ version: '7.0.0' });
    const huella = huellaCanonica(l);
    const dir = carpeta({ 'a.yaml': stringify(l) });
    // Otra sesión inserta la misma versión y tarda en confirmar: la carga se queda esperando el índice único.
    const otra = pools
      .db('owner')
      .transaction()
      .execute(async (trx) => {
        await sql`insert into libreria (codigo, nombre, version, hash, es_ejemplo, fuente) values (${CODIGO}, 'Librería sintética de carga', '7.0.0', ${huella}, true, 'elaboración propia SynapTech')`.execute(
          trx,
        );
        await new Promise((r) => setTimeout(r, 800));
      });
    await new Promise((r) => setTimeout(r, 250));
    const carga = cargar(dir);
    await otra;
    const r = await carga;
    expect(r[0]).toMatchObject({ estado: 'ya_cargada', huella });
  });

  it('procesa varios archivos y no se detiene en el primero que falla; el resultado conserva el orden', async () => {
    const dir = carpeta({
      '1-mal.yaml': 'esquema: 2',
      '2-bien.yaml': stringify(libreria({ version: '5.0.0' })),
      'sub/3-bien.yml': stringify(libreria({ version: '5.1.0' })),
    });
    const r = await cargar(dir);
    expect(r.map((x) => x.estado)).toEqual(['formato_invalido', 'cargada', 'cargada']);
  });

  it('sin archivos en la carpeta no hace nada (y lo dice)', async () => {
    expect(await cargar(carpeta({ 'leeme.txt': 'nada' }))).toEqual([]);
  });

  it('la aplicación NO puede cargar catálogo: el rol de la API no inserta librerías', async () => {
    await expect(
      sql`insert into libreria (codigo, nombre, version, hash, es_ejemplo, fuente) values ('x', 'x', '1.0.0', ${'0'.repeat(64)}, true, 'x')`.execute(
        pools.db('app'),
      ),
    ).rejects.toThrow(/permission denied|permiso denegado/i);
  });
});
