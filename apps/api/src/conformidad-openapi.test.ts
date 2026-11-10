import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { AppModule } from './app.module.js';
import { crearConfiguracionOpenApi, OPCIONES_DOCUMENTO } from './openapi.js';

// CONFORMIDAD: el OpenAPI que genera la API (`/docs`) debe coincidir con el contrato (packages/contracts/openapi.yaml), que es
// la fuente de verdad. No se compara el texto: se compara lo que importa a un cliente, normalizado (referencias resueltas, sin
// descripciones ni ejemplos, nulos de 3.1). Lo que el contrato pide y la API aún no hace va en PENDIENTES, con su tarea.

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const contrato = parse(readFileSync(join(import.meta.dirname, '../../../packages/contracts/openapi.yaml'), 'utf8')) as Json;
const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

/** Respuestas del contrato que la API todavía no implementa. Se quitan al cerrar la tarea indicada. */
const PENDIENTES: Record<string, string> = {};

const resolver = (doc: Json, nodo: Json | undefined, vistos: string[] = []): Json | undefined => {
  if (!nodo || typeof nodo.$ref !== 'string') return nodo;
  if (vistos.includes(nodo.$ref)) throw new Error(`Referencia circular: ${nodo.$ref}`);
  const ruta = nodo.$ref.replace(/^#\//, '').split('/');
  const destino = ruta.reduce<Json | undefined>((n, k) => n?.[k], doc);
  return resolver(doc, destino, [...vistos, nodo.$ref]);
};

const CLAVES_NUMERICAS = ['maxLength', 'minLength', 'minimum', 'maximum', 'minItems', 'maxItems'] as const;

/** Forma canónica de un esquema: lo que cambia lo que puede enviar o recibir un cliente. */
const normalizar = (doc: Json, esquema: Json | undefined): unknown => {
  const e = resolver(doc, esquema);
  if (!e) return null;
  const tipos = new Set<string>(e.type === undefined ? [] : Array.isArray(e.type) ? e.type : [e.type]);
  if (e.nullable === true) tipos.add('null');
  const salida: Json = {};
  if (tipos.size) salida.type = [...tipos].sort();
  if (e.format) salida.format = e.format;
  const valores = e.const !== undefined ? [e.const] : e.enum;
  if (valores) salida.enum = [...valores].map(String).sort();
  if (e.pattern) salida.pattern = e.pattern;
  for (const k of CLAVES_NUMERICAS) if (e[k] !== undefined) salida[k] = e[k];
  if (e.uniqueItems) salida.uniqueItems = true;
  if (e.items) salida.items = normalizar(doc, e.items);
  if (e.properties) {
    salida.properties = Object.fromEntries(Object.keys(e.properties).sort().map((k) => [k, normalizar(doc, e.properties[k])]));
    salida.required = [...(e.required ?? [])].sort();
  }
  return salida;
};

interface Operacion {
  clave: string;
  operationId: string | undefined;
  tags: string[];
  seguro: boolean;
  parametros: unknown[];
  respuestas: Record<string, { media: string[]; esquema: unknown }>;
}

const extraer = (doc: Json, seguridadGlobal: boolean): Operacion[] => {
  const ops: Operacion[] = [];
  for (const [ruta, item] of Object.entries<Json>(doc.paths)) {
    for (const metodo of METODOS) {
      const op = item[metodo] as Json | undefined;
      if (!op) continue;
      const parametros = ((op.parameters ?? []) as Json[])
        .map((p) => resolver(doc, p) as Json)
        .map((p) => ({ nombre: p.name, en: p.in, requerido: p.required === true, esquema: normalizar(doc, p.schema) }))
        .sort((a, b) => `${a.en}:${a.nombre}`.localeCompare(`${b.en}:${b.nombre}`));
      const respuestas: Operacion['respuestas'] = {};
      for (const [codigo, r] of Object.entries<Json>(op.responses ?? {})) {
        const resp = resolver(doc, r) as Json;
        const contenido = (resp.content ?? {}) as Json;
        const media = Object.keys(contenido).sort();
        respuestas[codigo] = { media, esquema: media.length ? normalizar(doc, contenido[media[0]!].schema) : null };
      }
      const seguridad = op.security ?? (seguridadGlobal ? [{}] : []);
      ops.push({ clave: `${metodo.toUpperCase()} ${ruta}`, operationId: op.operationId, tags: [...(op.tags ?? [])].sort(), seguro: seguridad.length > 0, parametros, respuestas });
    }
  }
  return ops.sort((a, b) => a.clave.localeCompare(b.clave));
};

describe('conformidad del OpenAPI generado con el contrato (tarea 6.7)', () => {
  let generado: Json;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = modulo.createNestApplication();
    await app.init();
    generado = SwaggerModule.createDocument(app, crearConfiguracionOpenApi(), OPCIONES_DOCUMENTO) as unknown as Json;
    await app.close();
  });
  afterAll(() => undefined);

  const delContrato = () => extraer(contrato, (contrato.security ?? []).length > 0);
  const delGenerado = () => extraer(generado, (generado.security ?? []).length > 0);
  const por = (ops: Operacion[]) => new Map(ops.map((o) => [o.clave, o]));

  it('es OpenAPI 3.1 y declara el esquema de seguridad bearer JWT del contrato', () => {
    expect(generado.openapi).toBe(contrato.openapi);
    expect(generado.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    expect(contrato.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
  });

  it('tiene exactamente las mismas operaciones (método y ruta)', () => {
    expect(delGenerado().map((o) => o.clave)).toEqual(delContrato().map((o) => o.clave));
  });

  describe.each(delContrato().map((o) => o.clave))('%s', (clave) => {
    const c = () => por(delContrato()).get(clave)!;
    const g = () => por(delGenerado()).get(clave)!;

    it('mismo operationId', () => expect(g().operationId).toBe(c().operationId));
    it('mismas etiquetas', () => expect(g().tags).toEqual(c().tags));
    it('misma seguridad: protegida con el token, o pública (solo /health)', () => expect(g().seguro).toBe(c().seguro));
    it('mismos parámetros (nombre, lugar, obligatoriedad y esquema)', () => expect(g().parametros).toEqual(c().parametros));

    it('mismos códigos de respuesta (salvo los pendientes declarados)', () => {
      const esperados = Object.keys(c().respuestas).filter((k) => !(k in PENDIENTES)).sort();
      expect(Object.keys(g().respuestas).sort()).toEqual(esperados);
    });

    it('mismo tipo de contenido y mismo esquema en cada respuesta', () => {
      for (const codigo of Object.keys(g().respuestas)) {
        expect({ codigo, ...g().respuestas[codigo] }).toEqual({ codigo, ...c().respuestas[codigo] });
      }
    });
  });

  it('los 429 declaran la cabecera Retry-After (entero, mínimo 1) en cada operación protegida, como el contrato', () => {
    const conLimite = Object.entries<Json>(contrato.paths).flatMap(([ruta, item]) =>
      METODOS.filter((m) => item[m]?.responses?.['429']).map((m) => ({ ruta, m })),
    );
    expect(conLimite.length).toBe(13); // todas menos /health
    for (const { ruta, m } of conLimite) {
      const r = generado.paths[ruta][m].responses['429'] as Json;
      expect(Object.keys(r.headers ?? {}), `${m} ${ruta}`).toEqual(['Retry-After']);
      expect(normalizar(generado, r.headers['Retry-After'].schema), `${m} ${ruta}`).toEqual({ type: ['integer'], minimum: 1 });
    }
    expect(generado.paths['/health'].get.responses['429']).toBeUndefined();
  });

  it('no deja pendientes sin motivo: cada uno nombra su tarea', () => {
    for (const [codigo, tarea] of Object.entries(PENDIENTES)) expect(tarea, codigo).toMatch(/^tarea \d+\.\d+/);
  });
});
