import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Validator } from '@seriousme/openapi-schema-validator';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

// CONTRATO PRIMERO (regla 6): el contrato OpenAPI 3.1 se escribe y se prueba antes que los controladores.
// La empresa sale solo del token (decisión que recogerá el ADR 027, tarea 10.1 del plan).
const ruta = join(import.meta.dirname, '../openapi.yaml');
const texto = readFileSync(ruta, 'utf8');
const doc = parse(texto) as Doc;

type Obj = Record<string, any>;
interface Doc extends Obj {
  paths: Record<string, Record<string, Obj>>;
  components: { schemas: Record<string, Obj>; responses: Record<string, Obj>; headers: Record<string, Obj>; securitySchemes: Record<string, Obj>; parameters?: Record<string, Obj> };
}

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];
const operaciones = Object.entries(doc.paths).flatMap(([p, item]) => METODOS.filter((m) => item[m]).map((m) => ({ ruta: p, metodo: m, id: `${m.toUpperCase()} ${p}`, op: item[m]! })));
const op = (id: string): Obj => operaciones.find((o) => o.id === id)!.op;

/** Resuelve una referencia local `#/a/b/c`. */
const resolver = (ref: string): Obj | undefined => ref.replace(/^#\//, '').split('/').reduce<any>((nodo, parte) => nodo?.[parte.replace(/~1/g, '/').replace(/~0/g, '~')], doc);
const referencias = (nodo: unknown, salida: string[] = []): string[] => {
  if (Array.isArray(nodo)) nodo.forEach((n) => referencias(n, salida));
  else if (nodo && typeof nodo === 'object') {
    for (const [k, v] of Object.entries(nodo)) {
      if (k === '$ref' && typeof v === 'string') salida.push(v);
      else referencias(v, salida);
    }
  }
  return salida;
};
/** Todas las claves de propiedades que aparecen en un esquema (resolviendo referencias), para buscar nombres prohibidos. */
const propiedades = (esquema: any, vistos = new Set<string>()): string[] => {
  if (!esquema || typeof esquema !== 'object') return [];
  if (esquema.$ref) return vistos.has(esquema.$ref) ? [] : propiedades(resolver(esquema.$ref), vistos.add(esquema.$ref));
  return [...Object.keys(esquema.properties ?? {}), ...Object.values<any>(esquema.properties ?? {}).flatMap((p) => propiedades(p, vistos)), ...propiedades(esquema.items, vistos), ...(esquema.allOf ?? []).flatMap((s: any) => propiedades(s, vistos))];
};

/** Todos los esquemas del documento: los de `components.schemas` y los de cualquier clave `schema` (parámetros y cuerpos). */
const todosLosEsquemas = (): { donde: string; esquema: Obj }[] => {
  const hallados: { donde: string; esquema: Obj }[] = Object.entries(doc.components.schemas).map(([n, e]) => ({ donde: `components.schemas.${n}`, esquema: e }));
  const recorrer = (nodo: unknown, camino: string): void => {
    if (Array.isArray(nodo)) nodo.forEach((n, i) => recorrer(n, `${camino}[${i}]`));
    else if (nodo && typeof nodo === 'object') {
      for (const [k, v] of Object.entries(nodo)) {
        if (k === 'schema' && v && typeof v === 'object' && !camino.startsWith('components.schemas')) hallados.push({ donde: `${camino}.schema`, esquema: v as Obj });
        recorrer(v, `${camino}.${k}`);
      }
    }
  };
  recorrer({ paths: doc.paths, components: { parameters: doc.components.parameters, responses: doc.components.responses } }, '');
  return hallados;
};
/** Todos los valores de `pattern` del documento. */
const patrones = (nodo: unknown, salida: string[] = []): string[] => {
  if (Array.isArray(nodo)) nodo.forEach((n) => patrones(n, salida));
  else if (nodo && typeof nodo === 'object') {
    for (const [k, v] of Object.entries(nodo)) {
      if (k === 'pattern' && typeof v === 'string') salida.push(v);
      else patrones(v, salida);
    }
  }
  return salida;
};

describe('documento', () => {
  // El validador de OpenAPI comprueba la estructura del documento pero deja ABIERTO el contenido de cada esquema (un
  // `type: strng` o una expresión regular rota pasan). Por eso cada esquema se valida además como JSON Schema 2020-12.
  it('cada esquema es un JSON Schema 2020-12 válido (el validador de OpenAPI no lo comprueba)', () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const esquemas = todosLosEsquemas();
    expect(esquemas.length).toBeGreaterThan(15);
    for (const { donde, esquema } of esquemas) {
      expect(ajv.validateSchema(esquema), `${donde}: ${JSON.stringify(ajv.errors)}`).toBe(true);
    }
  });

  it('cada `pattern` es una expresión regular válida', () => {
    const lista = patrones(doc);
    expect(lista.length).toBeGreaterThan(5);
    for (const p of lista) expect(() => new RegExp(p, 'u'), p).not.toThrow();
  });

  it('es un OpenAPI 3.1 válido según el esquema oficial', async () => {
    const r = await new Validator().validate(doc);
    expect(r.errors ?? []).toEqual([]);
    expect(r.valid).toBe(true);
    expect(String(doc.openapi)).toMatch(/^3\.1\./);
  });

  it('tiene título, versión y descripción', () => {
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(doc.info.description).toBeTruthy();
  });

  it('todas las referencias locales se resuelven', () => {
    for (const ref of referencias(doc)) expect(resolver(ref), ref).toBeDefined();
  });

  it('no hay esquemas, respuestas, parámetros ni cabeceras sin usar', () => {
    const usados = new Set(referencias(doc));
    for (const tipo of ['schemas', 'responses', 'parameters', 'headers'] as const) {
      for (const nombre of Object.keys(doc.components[tipo] ?? {})) expect(usados.has(`#/components/${tipo}/${nombre}`), `${tipo}/${nombre}`).toBe(true);
    }
  });
});

describe('operaciones del corte 0.6', () => {
  it('son exactamente las del plan', () => {
    expect(operaciones.map((o) => o.id).sort()).toEqual(
      ['GET /health', 'GET /me', 'GET /empresa/marca', 'POST /sesion/inicio', 'POST /sesion/cierre', 'GET /librerias', 'POST /librerias/{id}/adopcion', 'GET /requisitos', 'GET /requisitos/{id}'].sort(),
    );
  });

  it('cada una tiene operationId único en camelCase, resumen, etiqueta y respuestas', () => {
    const ids = operaciones.map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of operaciones) {
      expect(o.op.operationId, o.id).toMatch(/^[a-z][A-Za-z0-9]+$/);
      expect(o.op.summary, o.id).toBeTruthy();
      expect(o.op.tags?.length, o.id).toBeGreaterThan(0);
      expect(Object.keys(o.op.responses).length, o.id).toBeGreaterThan(0);
    }
  });
});

describe('seguridad', () => {
  it('todo exige un token de portador salvo la comprobación de salud', () => {
    expect(doc.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    expect(op('GET /health').security).toEqual([]);
    for (const o of operaciones.filter((x) => x.id !== 'GET /health')) expect(o.op.security, o.id).toBeUndefined();
  });

  it('toda operación autenticada declara el 401 y las respuestas de error son referencias comunes', () => {
    for (const o of operaciones.filter((x) => x.id !== 'GET /health')) expect(o.op.responses['401']?.$ref, o.id).toBe('#/components/responses/NoAutenticado');
    for (const o of operaciones) for (const [codigo, r] of Object.entries<any>(o.op.responses)) if (Number(codigo) >= 400) expect(r.$ref, `${o.id} ${codigo}`).toMatch(/^#\/components\/responses\//);
  });

  it('la empresa NUNCA la envía el cliente: lista cerrada de parámetros por operación, sin cabeceras, cookies ni cuerpos', () => {
    const esperados: Record<string, string[]> = {
      'GET /health': [],
      'GET /me': [],
      'GET /empresa/marca': [],
      'POST /sesion/inicio': [],
      'POST /sesion/cierre': [],
      'GET /librerias': [],
      'POST /librerias/{id}/adopcion': ['path:id'],
      'GET /requisitos': ['query:capitulo', 'query:norma', 'query:q'],
      'GET /requisitos/{id}': ['path:id'],
    };
    for (const o of operaciones) {
      const parametros = [...((doc.paths[o.ruta]!.parameters ?? []) as Obj[]), ...((o.op.parameters ?? []) as Obj[])].map((p: any) => (p.$ref ? resolver(p.$ref)! : p));
      expect(parametros.map((p: any) => `${p.in}:${p.name}`).sort(), o.id).toEqual(esperados[o.id]);
      expect(o.op.requestBody, `${o.id} no recibe cuerpo`).toBeUndefined();
    }
    for (const o of operaciones) expect(o.ruta, o.id).not.toMatch(/\{(?!id\})[^}]*\}/);
  });

  it('ninguna operación autenticada puede dejar de declarar el 429 con Retry-After', () => {
    for (const o of operaciones.filter((x) => x.id !== 'GET /health')) expect(o.op.responses['429']?.$ref, o.id).toBe('#/components/responses/LimiteExcedido');
    expect(doc.components.responses.LimiteExcedido!.headers['Retry-After'].$ref).toBe('#/components/headers/RetryAfter');
  });

  it('solo la adopción declara un permiso formal (x-permiso) y declara el 403', () => {
    expect(operaciones.filter((o) => o.op['x-permiso']).map((o) => [o.id, o.op['x-permiso']])).toEqual([['POST /librerias/{id}/adopcion', 'administrador_sig']]);
    expect(op('POST /librerias/{id}/adopcion').responses['403']).toBeDefined();
  });

  it('el orden de evaluación (401, 403, 400, 404) está escrito donde hay identificadores', () => {
    for (const id of ['POST /librerias/{id}/adopcion', 'GET /requisitos/{id}']) expect(op(id).description, id).toMatch(/Orden de evaluación/);
    expect(op('POST /librerias/{id}/adopcion').description).toMatch(/403.*400.*404/s);
    expect(doc.info.description).toMatch(/Orden de evaluación/);
  });
});

describe('errores que no filtran datos', () => {
  it('hay una sola respuesta 404 y todas la reutilizan: «no existe», «es de otra empresa» y «librería no adoptada» son indistinguibles', () => {
    const cuatrocientoscuatro = operaciones.filter((o) => o.op.responses['404']);
    expect(cuatrocientoscuatro.map((o) => o.id).sort()).toEqual(['GET /requisitos/{id}', 'POST /librerias/{id}/adopcion']);
    for (const o of cuatrocientoscuatro) expect(o.op.responses['404'].$ref, o.id).toBe('#/components/responses/NoEncontrado');
    const r = doc.components.responses.NoEncontrado!;
    expect(r.description).toMatch(/indistinguible/i);
    expect(Object.keys(r.content)).toEqual(['application/problem+json']);
  });

  it('el problema es cerrado: sin `detail` ni campos libres, y su código sale de una lista cerrada', () => {
    const p = doc.components.schemas.Problema!;
    expect(p.additionalProperties).toBe(false);
    expect(Object.keys(p.properties).sort()).toEqual(['codigo', 'status', 'title', 'type']);
    expect(p.required.sort()).toEqual(['codigo', 'status', 'title', 'type']);
    expect(p.properties.codigo.enum).toEqual(['no_autenticado', 'sin_permiso', 'no_encontrado', 'parametro_invalido', 'limite_excedido', 'error_interno']);
    expect(p.properties.type).toMatchObject({ const: 'about:blank' });
  });

  it('los errores usan application/problem+json y su código coincide con el estado', () => {
    const esperado: Record<string, [number, string]> = { NoAutenticado: [401, 'no_autenticado'], SinPermiso: [403, 'sin_permiso'], NoEncontrado: [404, 'no_encontrado'], ParametrosInvalidos: [400, 'parametro_invalido'], LimiteExcedido: [429, 'limite_excedido'], ErrorInterno: [500, 'error_interno'] };
    for (const [nombre, [estado, codigo]] of Object.entries(esperado)) {
      const r = doc.components.responses[nombre]!;
      expect(Object.keys(r.content), nombre).toEqual(['application/problem+json']);
      const ejemplo = Object.values<any>(r.content['application/problem+json'].examples ?? {})[0]?.value ?? r.content['application/problem+json'].example;
      expect(ejemplo, nombre).toMatchObject({ status: estado, codigo });
    }
  });

  it('el 403 solo existe donde hay una acción restringida (adoptar)', () => {
    expect(operaciones.filter((o) => o.op.responses['403']).map((o) => o.id)).toEqual(['POST /librerias/{id}/adopcion']);
  });
});

describe('respuestas estrictas y acotadas', () => {
  it('todo esquema de objeto es cerrado (additionalProperties: false): no se cuelan campos', () => {
    const revisar = (nombre: string, e: any): void => {
      if (!e || typeof e !== 'object') return;
      if (e.type === 'object') expect(e.additionalProperties, nombre).toBe(false);
      Object.entries<any>(e.properties ?? {}).forEach(([k, v]) => revisar(`${nombre}.${k}`, v));
      revisar(`${nombre}[]`, e.items);
      for (const clave of ['oneOf', 'anyOf', 'allOf']) (e[clave] ?? []).forEach((v: any, i: number) => revisar(`${nombre}.${clave}[${i}]`, v));
    };
    for (const [nombre, e] of Object.entries(doc.components.schemas)) revisar(nombre, e);
  });

  it('todo texto de una respuesta tiene longitud máxima, formato o lista de valores', () => {
    const revisar = (nombre: string, e: any): void => {
      if (!e || typeof e !== 'object') return;
      if (e.type === 'string' || (Array.isArray(e.type) && e.type.includes('string'))) expect(e.maxLength !== undefined || e.enum !== undefined || e.format !== undefined || e.const !== undefined, nombre).toBe(true);
      Object.entries<any>(e.properties ?? {}).forEach(([k, v]) => revisar(`${nombre}.${k}`, v));
      revisar(`${nombre}[]`, e.items);
    };
    for (const [nombre, e] of Object.entries(doc.components.schemas)) revisar(nombre, e);
  });

  it('todo parámetro de texto tiene longitud máxima o lista de valores', () => {
    for (const o of operaciones) {
      for (const p of o.op.parameters ?? []) {
        const par = p.$ref ? resolver(p.$ref)! : p;
        if (par.schema?.type === 'string') expect(par.schema.maxLength !== undefined || par.schema.enum !== undefined || par.schema.format !== undefined, `${o.id} ${par.name}`).toBe(true);
      }
    }
  });

  it('las respuestas de operaciones autenticadas no se guardan en caché (H1.4)', () => {
    for (const o of operaciones.filter((x) => x.id !== 'GET /health')) {
      for (const [codigo, r] of Object.entries<any>(o.op.responses)) {
        const resp = r.$ref ? resolver(r.$ref)! : r;
        expect(resp.headers?.['Cache-Control']?.$ref, `${o.id} ${codigo}`).toBe('#/components/headers/CacheControlNoStore');
      }
    }
    expect(doc.components.headers.CacheControlNoStore!.schema.enum).toEqual(['no-store']);
  });
});

describe('comportamiento de cada endpoint', () => {
  it('la adopción responde 201 al adoptar, 200 «ya adoptada» sin cambios, 403 y 404; sin cuerpo de entrada', () => {
    const a = op('POST /librerias/{id}/adopcion');
    expect(Object.keys(a.responses).sort()).toEqual(['200', '201', '400', '401', '403', '404', '429', '500']);
    expect(a.responses['200'].description).toMatch(/ya (estaba )?adoptada/i);
    expect(a.responses['201'].content['application/json'].schema.$ref).toBe('#/components/schemas/Adopcion');
    expect(a.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/Adopcion');
    expect(a.requestBody).toBeUndefined();
  });

  it('el listado de requisitos filtra por texto, capítulo (4 a 10) y norma, todos opcionales y acotados', () => {
    const params = Object.fromEntries(op('GET /requisitos').parameters.map((p: any) => [p.name, p]));
    expect(Object.keys(params).sort()).toEqual(['capitulo', 'norma', 'q']);
    for (const p of Object.values<any>(params)) expect(p.in).toBe('query');
    for (const p of Object.values<any>(params)) expect(p.required ?? false).toBe(false);
    expect(params.capitulo.schema).toMatchObject({ type: 'integer', minimum: 4, maximum: 10 });
    expect(params.q.schema.maxLength).toBeLessThanOrEqual(80);
    expect(params.norma.schema.maxLength).toBeLessThanOrEqual(60);
    expect([params.q.schema.minLength, params.norma.schema.minLength]).toEqual([1, 1]);
    // Los filtros no admiten comodines ni caracteres de control: nada de % ni _ ni comillas.
    const q = new RegExp(params.q.schema.pattern, 'u');
    for (const bueno of ['auditoría', 'ha-4.1', 'Contexto de la organización']) expect(q.test(bueno), bueno).toBe(true);
    for (const malo of ['100%', 'a_b', "x'; --", 'a\nb', '<script>']) expect(q.test(malo), malo).toBe(false);
    const norma = new RegExp(params.norma.schema.pattern, 'u');
    for (const bueno of ['ISO 9001', 'ISO/IEC 27001']) expect(norma.test(bueno), bueno).toBe(true);
    for (const malo of ['ISO%', "ISO'", 'ISO\n9001']) expect(norma.test(malo), malo).toBe(false);
    expect(Object.keys(op('GET /requisitos').responses).sort()).toEqual(['200', '400', '401', '429', '500']);
  });

  it('los identificadores de ruta son UUID', () => {
    for (const id of ['GET /requisitos/{id}', 'POST /librerias/{id}/adopcion']) {
      const p = op(id).parameters.map((x: any) => (x.$ref ? resolver(x.$ref)! : x)).find((x: any) => x.name === 'id');
      expect(p, id).toMatchObject({ in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
      const uuid = new RegExp(p.schema.pattern, 'u');
      expect(uuid.test('3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c')).toBe(true);
      for (const malo of ['{3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c}', '3f2b8c1e9a4d4e7b8c215d6e7f8a9b0c', '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0', 'no-es-uuid', '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c ']) expect(uuid.test(malo), malo).toBe(false);
    }
  });

  it('el inicio y el cierre de sesión no llevan cuerpo: el hecho se deriva del token verificado', () => {
    for (const id of ['POST /sesion/inicio', 'POST /sesion/cierre']) {
      expect(op(id).requestBody, id).toBeUndefined();
      expect(Object.keys(op(id).responses).sort(), id).toEqual(['204', '401', '429', '500']);
    }
  });

  it('la entrada indica su identificador, a qué norma, edición y cláusula corresponde y si es de ejemplo (H5.1, H5.5)', () => {
    const r = doc.components.schemas.EntradaLibreria!;
    for (const campo of ['id', 'idEstable', 'libreriaId', 'capitulo', 'nivel', 'titulo', 'guia', 'alcanceComun', 'aplicaA', 'esEjemplo']) expect(r.required, campo).toContain(campo);
    expect(r.properties.aplicaA.items.required.sort()).toEqual(['clausula', 'edicion', 'norma']);
    expect(new RegExp(r.properties.idEstable.pattern, 'u').test('ha-4.1')).toBe(true);
  });

  it('la librería indica si la empresa la adoptó y si es de ejemplo', () => {
    const l = doc.components.schemas.LibreriaResumen!;
    for (const campo of ['id', 'codigo', 'nombre', 'version', 'esEjemplo', 'fuente', 'adoptada']) expect(l.required, campo).toContain(campo);
  });

  it('la marca informa si el color se ajustó por contraste y cuál era el original (H3.2); el logo es https o ruta propia (H3.3)', () => {
    const m = doc.components.schemas.Marca!;
    for (const campo of ['nombre', 'colorPrimario', 'colorOriginal', 'ajustadoPorContraste', 'logoUrl']) expect(m.required, campo).toContain(campo);
    expect(m.properties.colorPrimario.pattern).toBe('^#[0-9A-Fa-f]{6}$');
    const logo = new RegExp(m.properties.logoUrl.pattern, 'u');
    for (const bueno of ['https://cdn.example.test/logo.png', 'https://cdn.example.test:8443/a/logo.png', '/logos/a.svg']) expect(logo.test(bueno), bueno).toBe(true);
    // Relativas al protocolo, credenciales en la URL, otros esquemas y espacios: todas rechazadas.
    for (const malo of ['//evil.test/x', '/\\evil.test/x', 'https://usuario:clave@evil.test/x', 'http://evil.test/x', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'https://evil.test', '/con espacio.png', 'logo.png']) expect(logo.test(malo), malo).toBe(false);
  });

  it('la identidad indica los roles y la empresa (solo nombre y slug) de quien consulta, sin correo', () => {
    const u = doc.components.schemas.Identidad!;
    expect([...u.required].sort()).toEqual(['empresa', 'nombre', 'roles', 'usuarioId']);
    expect([...u.properties.empresa.required].sort()).toEqual(['nombre', 'slug']);
    expect(u.properties.empresa.type).toBe('object');
    expect(u.properties.roles.items.enum).toEqual(['administrador_sig', 'dueno_proceso', 'auditor_interno', 'auditor_externo', 'colaborador', 'alta_direccion']);
  });
});

describe('las respuestas no pueden ganar campos de empresa ni datos personales sin que falle una prueba', () => {
  const propiedadesDe = (nombre: string): string[] => Object.keys(doc.components.schemas[nombre]!.properties).sort();

  it('conjunto exacto de propiedades de cada respuesta', () => {
    expect(propiedadesDe('Identidad')).toEqual(['empresa', 'nombre', 'roles', 'usuarioId']);
    expect(propiedadesDe('Marca')).toEqual(['ajustadoPorContraste', 'colorOriginal', 'colorPrimario', 'logoUrl', 'nombre']);
    expect(propiedadesDe('LibreriaResumen')).toEqual(['adoptada', 'codigo', 'esEjemplo', 'fuente', 'id', 'nombre', 'version']);
    expect(propiedadesDe('Adopcion')).toEqual(['adoptadaEn', 'entradas', 'libreriaId', 'yaAdoptada']);
    expect(propiedadesDe('EntradaLibreria')).toEqual(['alcanceComun', 'aplicaA', 'capitulo', 'esEjemplo', 'guia', 'id', 'idEstable', 'libreriaId', 'nivel', 'titulo']);
  });

  it('la empresa solo aparece en Identidad.empresa, como un objeto (no una lista), y en ninguna otra respuesta', () => {
    for (const nombre of ['Marca', 'LibreriaResumen', 'Adopcion', 'EntradaLibreria', 'Problema', 'Salud']) {
      expect(propiedades(doc.components.schemas[nombre]).filter((c) => /empresa|tenant/i.test(c)), nombre).toEqual([]);
    }
    expect(Object.keys(doc.components.schemas.Identidad!.properties).filter((c) => /empresa|tenant/i.test(c))).toEqual(['empresa']);
  });

  it('ningún esquema tiene correo, teléfono, cédula ni claves', () => {
    for (const [nombre, e] of Object.entries(doc.components.schemas)) {
      expect(propiedades(e).filter((c) => /correo|email|mail|telefono|cedula|password|clave$|token/i.test(c)), nombre).toEqual([]);
    }
  });
});

describe('privacidad del contrato', () => {
  it('los ejemplos y las descripciones no traen direcciones de red ni correos reales (solo @example.test)', () => {
    expect(texto).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    for (const correo of texto.match(/[\w.+-]+@[\w.-]+/g) ?? []) expect(correo, correo).toMatch(/@example\.test$/);
  });

  it('ninguna operación recibe datos personales: solo identificadores y filtros acotados', () => {
    for (const o of operaciones) {
      const cuerpo = o.op.requestBody?.content?.['application/json']?.schema;
      for (const clave of propiedades(cuerpo)) expect(clave, `${o.id} cuerpo`).not.toMatch(/nombre|correo|email|password|clave|token|telefono|cedula/i);
    }
  });
});
