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

// Activos de información (ADR 038): [operación, permiso, parámetros, ¿recibe cuerpo?, ¿tiene 404?]
const ACTIVOS_ADR038: readonly (readonly [string, string, string[], boolean, boolean])[] = [
  ['GET /activos', 'activos.ver', ['query:clasificacion', 'query:incluirRetirados', 'query:responsableId', 'query:tipo'], false, false],
  ['POST /activos', 'activos.gestionar', [], true, false],
  ['GET /activos/{id}', 'activos.ver', ['path:id'], false, true],
  ['PUT /activos/{id}', 'activos.gestionar', ['path:id'], true, true],
  ['GET /activos/{id}/aviso-retiro', 'activos.gestionar', ['path:id'], false, true],
  ['POST /activos/{id}/retiro', 'activos.gestionar', ['path:id'], true, true],
  ['GET /riesgos/{id}/activos', 'activos.ver', ['path:id'], false, true],
  ['POST /riesgos/{id}/activos', 'activos.gestionar', ['path:id'], true, true],
  ['POST /riesgos/{id}/activos/eliminacion', 'activos.gestionar', ['path:id'], true, true],
];
const OPS_ACTIVOS = ACTIVOS_ADR038.map((x) => x[0]);

// Auditoría interna (ADR 040): las operaciones se agregan aquí a propósito, con su permiso y su forma (parámetros y cuerpo).
// [operación, permiso, parámetros de ruta o consulta, ¿recibe cuerpo?, ¿tiene 404?]
const AUDITORIA_INTERNA: readonly (readonly [string, string, string[], boolean, boolean])[] = [
  ['GET /procesos', 'auditoria.ver', [], false, false],
  ['POST /procesos', 'auditoria.gestionar', [], true, false],
  ['POST /procesos/gestion-sig', 'auditoria.gestionar', [], false, false],
  ['PUT /procesos/{id}', 'auditoria.gestionar', ['path:id'], true, true],
  ['POST /procesos/{id}/retiro', 'auditoria.gestionar', ['path:id'], false, true],
  ['GET /procesos/{id}/relaciones', 'auditoria.ver', ['path:id'], false, true],
  ['POST /procesos/{id}/relaciones', 'auditoria.gestionar', ['path:id'], true, true],
  ['POST /procesos/{id}/relaciones/eliminacion', 'auditoria.gestionar', ['path:id'], true, true],
  ['GET /programas', 'auditoria.ver', [], false, false],
  ['POST /programas', 'auditoria.planificar', [], true, false],
  ['GET /programas/{id}', 'auditoria.ver', ['path:id'], false, true],
  ['PUT /programas/{id}', 'auditoria.planificar', ['path:id'], true, true],
  ['POST /programas/{id}/aprobacion', 'auditoria.aprobar', ['path:id'], true, true],
  ['POST /programas/{id}/exclusiones', 'auditoria.planificar', ['path:id'], true, true],
  ['POST /programas/{id}/exclusiones/eliminacion', 'auditoria.planificar', ['path:id'], true, true],
  ['POST /programas/{id}/auditorias', 'auditoria.planificar', ['path:id'], true, true],
  ['GET /auditorias/{id}', 'auditoria.ver', ['path:id'], false, true],
  ['PUT /auditorias/{id}', 'auditoria.planificar', ['path:id'], true, true],
  ['POST /auditorias/{id}/reprogramacion', 'auditoria.planificar', ['path:id'], true, true],
  ['POST /auditorias/{id}/cancelacion', 'auditoria.planificar', ['path:id'], true, true],
  ['POST /auditorias/{id}/avance', 'auditoria.planificar', ['path:id'], true, true],
  ['GET /auditorias/{id}/independencia', 'auditoria.ver', ['path:id', 'query:personaId'], false, true],
  ['POST /auditorias/{id}/equipo', 'auditoria.planificar', ['path:id'], true, true],
  ['POST /auditorias/{id}/equipo/eliminacion', 'auditoria.planificar', ['path:id'], true, true],
  ['GET /auditorias/{id}/lista', 'auditoria.ver', ['path:id'], false, true],
  ['POST /auditorias/{id}/lista/regeneracion', 'auditoria.planificar', ['path:id'], false, true],
  ['PUT /auditorias/{id}/lista/resultado', 'auditoria.ejecutar', ['path:id'], true, true],
  ['POST /auditorias/{id}/lista/preguntas', 'auditoria.ejecutar', ['path:id'], true, true],
  ['POST /auditorias/{id}/lista/preguntas/eliminacion', 'auditoria.ejecutar', ['path:id'], true, true],
  ['GET /auditorias/{id}/hallazgos', 'auditoria.ver', ['path:id'], false, true],
  ['POST /auditorias/{id}/hallazgos', 'auditoria.ejecutar', ['path:id'], true, true],
  ['PUT /auditorias/{id}/hallazgos', 'auditoria.ejecutar', ['path:id'], true, true],
  ['POST /auditorias/{id}/hallazgos/anulacion', 'auditoria.ejecutar', ['path:id'], true, true],
  ['GET /auditorias/{id}/informe', 'auditoria.ver', ['path:id'], false, true],
  ['POST /auditorias/{id}/informe', 'auditoria.ejecutar', ['path:id'], true, true],
  ['POST /auditorias/{id}/cierre', 'auditoria.aprobar', ['path:id'], true, true],
  ['GET /auditorias/{id}/informe/documento', 'auditoria.ver', ['path:id'], false, true],
  ['GET /auditoria/panel', 'auditoria.ver', [], false, false],
];
const OPS_AUDITORIA = AUDITORIA_INTERNA.map((x) => x[0]);

describe('operaciones del corte 0.6', () => {
  it('son exactamente las del plan', () => {
    expect(operaciones.map((o) => o.id).sort()).toEqual(
      ['POST /acceso/solicitud', 'GET /personas', 'POST /personas/solicitudes/{id}/aprobacion', 'POST /personas/solicitudes/{id}/descarte', 'PUT /personas/{id}/rol', 'POST /personas/{id}/baja', 'GET /health', 'GET /me', 'GET /empresa/marca', 'PUT /empresa/marca', 'POST /sesion/inicio', 'POST /sesion/cierre', 'GET /sesion/empresas', 'POST /sesion/empresa', 'GET /librerias', 'POST /librerias/carga', 'POST /librerias/{id}/adopcion', 'GET /requisitos', 'GET /requisitos/{id}', 'GET /alcances', 'PUT /alcances', 'POST /alcances/aprobacion', 'GET /diagnostico', 'PUT /diagnostico/evaluaciones', 'GET /controles', 'POST /controles', 'PUT /controles/{id}', 'POST /controles/{id}/retiro', 'POST /controles/{id}/mapeos', 'POST /controles/{id}/mapeos/eliminacion', 'GET /controles/{id}/evidencias', 'POST /controles/{id}/evidencias', 'POST /evidencias/{id}/reemplazo', 'POST /evidencias/{id}/eliminacion', 'GET /evidencias/{id}/archivo', 'GET /cobertura', 'GET /declaracion', 'POST /declaracion/aprobacion', 'GET /declaracion/versiones', 'GET /declaracion/versiones/{id}', 'GET /declaracion/documento', 'GET /declaracion/versiones/{id}/documento', 'GET /riesgos', 'POST /riesgos', 'GET /riesgos/{id}', 'PUT /riesgos/{id}', 'GET /riesgos/{id}/aviso-retiro', 'POST /riesgos/{id}/retiro', 'POST /riesgos/{id}/controles', 'POST /riesgos/{id}/controles/eliminacion', 'POST /riesgos/{id}/tratamientos', 'POST /riesgos/{id}/tratamientos/eliminacion', 'GET /controles/{id}/riesgos', 'GET /declaracion/motivos', 'PUT /declaracion/motivos', 'POST /declaracion/motivos/eliminacion', 'GET /declaracion/referencias', 'PUT /declaracion/referencias', 'POST /declaracion/referencias/eliminacion', 'GET /documentos', 'POST /documentos', 'GET /documentos/{id}', 'PUT /documentos/{id}', 'POST /documentos/{id}/retiro', 'POST /documentos/{id}/revision', 'PUT /documentos/{id}/distribucion', 'POST /documentos/{id}/vinculos', 'POST /documentos/{id}/vinculos/eliminacion', 'POST /documentos/{id}/versiones', 'POST /versiones/{id}/envio', 'POST /versiones/{id}/devolucion', 'POST /versiones/{id}/aprobacion', 'POST /versiones/{id}/descarte', 'GET /versiones/{id}/archivo', 'POST /versiones/{id}/lectura', 'GET /lecturas/pendientes', 'GET /cobertura-documental', 'GET /retencion', 'PUT /retencion', 'GET /certificacion/personas', ...OPS_AUDITORIA, ...OPS_ACTIVOS].sort(),
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
      'PUT /empresa/marca': [],
      'POST /sesion/inicio': [],
      'POST /sesion/cierre': [],
      'GET /sesion/empresas': [],
      // ÚNICA operación que nombra una empresa (ADR 035): el slug va en el cuerpo y la API lo compara con las pertenencias de la persona del token.
      'POST /sesion/empresa': [],
      'GET /librerias': [],
      'POST /librerias/carga': [],
      'POST /librerias/{id}/adopcion': ['path:id'],
      'GET /requisitos': ['query:capitulo', 'query:norma', 'query:q', 'query:tipo'],
      'GET /requisitos/{id}': ['path:id'],
      'GET /alcances': [],
      'PUT /alcances': [],
      'POST /alcances/aprobacion': [],
      'GET /diagnostico': ['query:estado', 'query:norma', 'query:q', 'query:tipo'],
      'PUT /diagnostico/evaluaciones': [],
      'GET /controles': ['query:incluirRetirados', 'query:norma'],
      'POST /controles': [],
      'PUT /controles/{id}': ['path:id'],
      'POST /controles/{id}/retiro': ['path:id'],
      'POST /controles/{id}/mapeos': ['path:id'],
      'POST /controles/{id}/mapeos/eliminacion': ['path:id'],
      'GET /controles/{id}/evidencias': ['path:id', 'query:incluirHistoricas'],
      'POST /controles/{id}/evidencias': ['path:id'],
      'POST /evidencias/{id}/reemplazo': ['path:id'],
      'POST /evidencias/{id}/eliminacion': ['path:id'],
      'GET /evidencias/{id}/archivo': ['path:id'],
      'GET /cobertura': ['query:norma'],
      'GET /declaracion': [],
      'POST /declaracion/aprobacion': [],
      // Personas (ADR 036): la empresa y la persona salen del token; solo el identificador del recurso va en la ruta.
      'POST /acceso/solicitud': [],
      'GET /personas': [],
      'POST /personas/solicitudes/{id}/aprobacion': ['path:id'],
      'POST /personas/solicitudes/{id}/descarte': ['path:id'],
      'PUT /personas/{id}/rol': ['path:id'],
      'POST /personas/{id}/baja': ['path:id'],
      'GET /declaracion/versiones': [],
      'GET /declaracion/versiones/{id}': ['path:id'],
      'GET /declaracion/documento': [],
      'GET /declaracion/versiones/{id}/documento': ['path:id'],
      // Riesgos mínimos y justificación de la Declaración (ADR 037): la empresa y la persona salen del token; solo el identificador va en la ruta.
      'GET /riesgos': ['query:incluirRetirados'],
      'POST /riesgos': [],
      'GET /riesgos/{id}': ['path:id'],
      'PUT /riesgos/{id}': ['path:id'],
      'GET /riesgos/{id}/aviso-retiro': ['path:id'],
      'POST /riesgos/{id}/retiro': ['path:id'],
      'POST /riesgos/{id}/controles': ['path:id'],
      'POST /riesgos/{id}/controles/eliminacion': ['path:id'],
      'POST /riesgos/{id}/tratamientos': ['path:id'],
      'POST /riesgos/{id}/tratamientos/eliminacion': ['path:id'],
      'GET /controles/{id}/riesgos': ['path:id'],
      'GET /declaracion/motivos': [],
      'PUT /declaracion/motivos': [],
      'POST /declaracion/motivos/eliminacion': [],
      'GET /declaracion/referencias': [],
      'PUT /declaracion/referencias': [],
      'POST /declaracion/referencias/eliminacion': [],
      // Control documental (ADR 039): la empresa y la persona salen del token; solo el identificador del recurso va en la ruta.
      'GET /documentos': ['query:area', 'query:estado', 'query:norma', 'query:responsableId', 'query:revisionVencida', 'query:sinVigente', 'query:tipo'],
      'POST /documentos': [],
      'GET /documentos/{id}': ['path:id'],
      'PUT /documentos/{id}': ['path:id'],
      'POST /documentos/{id}/retiro': ['path:id'],
      'POST /documentos/{id}/revision': ['path:id'],
      'PUT /documentos/{id}/distribucion': ['path:id'],
      'POST /documentos/{id}/vinculos': ['path:id'],
      'POST /documentos/{id}/vinculos/eliminacion': ['path:id'],
      'POST /documentos/{id}/versiones': ['path:id'],
      'POST /versiones/{id}/envio': ['path:id'],
      'POST /versiones/{id}/devolucion': ['path:id'],
      'POST /versiones/{id}/aprobacion': ['path:id'],
      'POST /versiones/{id}/descarte': ['path:id'],
      'GET /versiones/{id}/archivo': ['path:id'],
      'POST /versiones/{id}/lectura': ['path:id'],
      'GET /lecturas/pendientes': [],
      'GET /cobertura-documental': ['query:norma', 'query:soloSinDocumento'],
      'GET /retencion': [],
      'PUT /retencion': [],
      'GET /certificacion/personas': [],
      ...Object.fromEntries(AUDITORIA_INTERNA.map((x) => [x[0], x[2]])),
      ...Object.fromEntries(ACTIVOS_ADR038.map((x) => [x[0], x[2]])),
    };
    // Solo estas tres reciben cuerpo, y su esquema es cerrado y sin campos de empresa (la empresa sale del token).
    const conCuerpo = [...AUDITORIA_INTERNA.filter((x) => x[3]).map((x) => x[0]), ...ACTIVOS_ADR038.filter((x) => x[3]).map((x) => x[0]), 'POST /personas/solicitudes/{id}/aprobacion', 'PUT /personas/{id}/rol', 'POST /personas/{id}/baja', 'PUT /empresa/marca', 'POST /sesion/empresa', 'POST /librerias/carga', 'PUT /alcances', 'POST /alcances/aprobacion', 'PUT /diagnostico/evaluaciones', 'POST /controles', 'PUT /controles/{id}', 'POST /controles/{id}/retiro', 'POST /controles/{id}/mapeos', 'POST /controles/{id}/mapeos/eliminacion', 'POST /controles/{id}/evidencias', 'POST /evidencias/{id}/reemplazo', 'POST /riesgos', 'PUT /riesgos/{id}', 'POST /riesgos/{id}/retiro', 'POST /riesgos/{id}/controles', 'POST /riesgos/{id}/controles/eliminacion', 'POST /riesgos/{id}/tratamientos', 'POST /riesgos/{id}/tratamientos/eliminacion', 'PUT /declaracion/motivos', 'POST /declaracion/motivos/eliminacion', 'PUT /declaracion/referencias', 'POST /declaracion/referencias/eliminacion', 'POST /documentos', 'PUT /documentos/{id}', 'POST /documentos/{id}/revision', 'PUT /documentos/{id}/distribucion', 'POST /documentos/{id}/vinculos', 'POST /documentos/{id}/vinculos/eliminacion', 'POST /documentos/{id}/versiones', 'POST /versiones/{id}/envio', 'POST /versiones/{id}/devolucion', 'POST /versiones/{id}/aprobacion', 'PUT /retencion'];
    for (const o of operaciones) {
      const parametros = [...((doc.paths[o.ruta]!.parameters ?? []) as Obj[]), ...((o.op.parameters ?? []) as Obj[])].map((p: any) => (p.$ref ? resolver(p.$ref)! : p));
      expect(parametros.map((p: any) => `${p.in}:${p.name}`).sort(), o.id).toEqual(esperados[o.id]);
      if (conCuerpo.includes(o.id)) {
        // Las subidas de archivos (evidencias y librerías) son multipart/form-data; el resto, JSON.
        const contenido = o.op.requestBody?.content ?? {};
        const ref = (contenido['application/json'] ?? contenido['multipart/form-data'])?.schema?.$ref as string;
        const esquema = resolver(ref)!;
        expect(esquema.additionalProperties, o.id).toBe(false);
        expect(Object.keys(esquema.properties).filter((k) => /empresa|tenant/i.test(k)), `${o.id} no lleva la empresa`).toEqual([]);
      } else expect(o.op.requestBody, `${o.id} no recibe cuerpo`).toBeUndefined();
    }
    for (const o of operaciones) expect(o.ruta, o.id).not.toMatch(/\{(?!id\})[^}]*\}/);
  });

  it('ninguna operación autenticada puede dejar de declarar el 429 con Retry-After', () => {
    for (const o of operaciones.filter((x) => x.id !== 'GET /health')) expect(o.op.responses['429']?.$ref, o.id).toBe('#/components/responses/LimiteExcedido');
    expect(doc.components.responses.LimiteExcedido!.headers['Retry-After'].$ref).toBe('#/components/headers/RetryAfter');
  });

  it('solo las acciones restringidas declaran un permiso formal (x-permiso) y el 403', () => {
    expect(operaciones.filter((o) => o.op['x-permiso']).map((o) => [o.id, o.op['x-permiso']]).sort()).toEqual(
      [['GET /personas', 'personas.ver'], ['POST /personas/solicitudes/{id}/aprobacion', 'personas.gestionar'], ['POST /personas/solicitudes/{id}/descarte', 'personas.gestionar'], ['PUT /personas/{id}/rol', 'personas.gestionar'], ['POST /personas/{id}/baja', 'personas.gestionar'], ['POST /librerias/carga', 'normas.cargar'], ['PUT /empresa/marca', 'marca.editar'], ['POST /librerias/{id}/adopcion', 'administrador_sig'], ['GET /alcances', 'alcance.ver'], ['PUT /alcances', 'alcance.gestionar'], ['POST /alcances/aprobacion', 'alcance.aprobar'], ['GET /diagnostico', 'diagnostico.ver'], ['PUT /diagnostico/evaluaciones', 'diagnostico.evaluar'], ['GET /controles', 'controles.ver'], ['POST /controles', 'controles.gestionar'], ['PUT /controles/{id}', 'controles.gestionar'], ['POST /controles/{id}/retiro', 'controles.gestionar'], ['POST /controles/{id}/mapeos', 'controles.gestionar'], ['POST /controles/{id}/mapeos/eliminacion', 'controles.gestionar'], ['GET /controles/{id}/evidencias', 'evidencias.ver'], ['POST /controles/{id}/evidencias', 'evidencias.registrar'], ['POST /evidencias/{id}/reemplazo', 'evidencias.registrar'], ['POST /evidencias/{id}/eliminacion', 'evidencias.eliminar'], ['GET /evidencias/{id}/archivo', 'evidencias.ver'], ['GET /cobertura', 'evidencias.ver'], ['GET /declaracion', 'declaracion.ver'], ['POST /declaracion/aprobacion', 'declaracion.aprobar'], ['GET /declaracion/versiones', 'declaracion.ver'], ['GET /declaracion/versiones/{id}', 'declaracion.ver'], ['GET /declaracion/documento', 'declaracion.exportar'], ['GET /declaracion/versiones/{id}/documento', 'declaracion.exportar'], ['GET /riesgos', 'riesgos.ver'], ['POST /riesgos', 'riesgos.gestionar'], ['GET /riesgos/{id}', 'riesgos.ver'], ['PUT /riesgos/{id}', 'riesgos.gestionar'], ['GET /riesgos/{id}/aviso-retiro', 'riesgos.gestionar'], ['POST /riesgos/{id}/retiro', 'riesgos.gestionar'], ['POST /riesgos/{id}/controles', 'riesgos.gestionar'], ['POST /riesgos/{id}/controles/eliminacion', 'riesgos.gestionar'], ['POST /riesgos/{id}/tratamientos', 'riesgos.gestionar'], ['POST /riesgos/{id}/tratamientos/eliminacion', 'riesgos.gestionar'], ['GET /controles/{id}/riesgos', 'riesgos.ver'], ['GET /declaracion/motivos', 'declaracion.ver'], ['PUT /declaracion/motivos', 'declaracion.justificar'], ['POST /declaracion/motivos/eliminacion', 'declaracion.justificar'], ['GET /declaracion/referencias', 'declaracion.ver'], ['PUT /declaracion/referencias', 'declaracion.justificar'], ['POST /declaracion/referencias/eliminacion', 'declaracion.justificar'], ['GET /documentos', 'documentos.ver'], ['POST /documentos', 'documentos.redactar'], ['GET /documentos/{id}', 'documentos.ver'], ['PUT /documentos/{id}', 'documentos.redactar'], ['POST /documentos/{id}/retiro', 'documentos.gestionar'], ['POST /documentos/{id}/revision', 'documentos.redactar'], ['PUT /documentos/{id}/distribucion', 'documentos.gestionar'], ['POST /documentos/{id}/vinculos', 'documentos.gestionar'], ['POST /documentos/{id}/vinculos/eliminacion', 'documentos.gestionar'], ['POST /documentos/{id}/versiones', 'documentos.redactar'], ['POST /versiones/{id}/envio', 'documentos.redactar'], ['POST /versiones/{id}/devolucion', 'documentos.aprobar'], ['POST /versiones/{id}/aprobacion', 'documentos.aprobar'], ['POST /versiones/{id}/descarte', 'documentos.redactar'], ['GET /versiones/{id}/archivo', 'documentos.ver'], ['POST /versiones/{id}/lectura', 'documentos.leer'], ['GET /lecturas/pendientes', 'documentos.leer'], ['GET /cobertura-documental', 'documentos.ver'], ['GET /retencion', 'documentos.ver'], ['PUT /retencion', 'documentos.gestionar'], ['GET /certificacion/personas', 'documentos.ver'], ...AUDITORIA_INTERNA.map((x) => [x[0], x[1]]), ...ACTIVOS_ADR038.map((x) => [x[0], x[1]])].sort(),
    );
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
    expect(cuatrocientoscuatro.map((o) => o.id).sort()).toEqual(['POST /personas/solicitudes/{id}/aprobacion', 'POST /personas/solicitudes/{id}/descarte', 'PUT /personas/{id}/rol', 'POST /personas/{id}/baja', 'GET /requisitos/{id}', 'POST /alcances/aprobacion', 'POST /controles/{id}/mapeos', 'POST /controles/{id}/mapeos/eliminacion', 'POST /controles/{id}/evidencias', 'POST /controles/{id}/retiro', 'POST /evidencias/{id}/eliminacion', 'POST /evidencias/{id}/reemplazo', 'GET /controles/{id}/evidencias', 'GET /evidencias/{id}/archivo', 'GET /declaracion/versiones/{id}', 'GET /declaracion/versiones/{id}/documento', 'POST /librerias/{id}/adopcion', 'PUT /alcances', 'PUT /controles/{id}', 'PUT /diagnostico/evaluaciones', 'POST /sesion/empresa', 'GET /riesgos/{id}', 'PUT /riesgos/{id}', 'GET /riesgos/{id}/aviso-retiro', 'POST /riesgos/{id}/retiro', 'POST /riesgos/{id}/controles', 'POST /riesgos/{id}/controles/eliminacion', 'POST /riesgos/{id}/tratamientos', 'POST /riesgos/{id}/tratamientos/eliminacion', 'GET /controles/{id}/riesgos', 'POST /declaracion/motivos/eliminacion', 'PUT /declaracion/motivos', 'POST /declaracion/referencias/eliminacion', 'GET /documentos/{id}', 'PUT /documentos/{id}', 'POST /documentos/{id}/retiro', 'POST /documentos/{id}/revision', 'PUT /documentos/{id}/distribucion', 'POST /documentos/{id}/vinculos', 'POST /documentos/{id}/vinculos/eliminacion', 'POST /documentos/{id}/versiones', 'POST /versiones/{id}/envio', 'POST /versiones/{id}/devolucion', 'POST /versiones/{id}/aprobacion', 'POST /versiones/{id}/descarte', 'GET /versiones/{id}/archivo', 'POST /versiones/{id}/lectura', ...AUDITORIA_INTERNA.filter((x) => x[4]).map((x) => x[0]), ...ACTIVOS_ADR038.filter((x) => x[4]).map((x) => x[0])].sort());
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
    expect(p.properties.codigo.enum).toEqual(['no_autenticado', 'sin_permiso', 'no_encontrado', 'parametro_invalido', 'conflicto', 'archivo_demasiado_grande', 'tipo_no_permitido', 'limite_excedido', 'error_interno']);
    expect(p.properties.type).toMatchObject({ const: 'about:blank' });
  });

  it('los errores usan application/problem+json y su código coincide con el estado', () => {
    const esperado: Record<string, [number, string]> = { NoAutenticado: [401, 'no_autenticado'], SinPermiso: [403, 'sin_permiso'], NoEncontrado: [404, 'no_encontrado'], ParametrosInvalidos: [400, 'parametro_invalido'], Conflicto: [409, 'conflicto'], ArchivoDemasiadoGrande: [413, 'archivo_demasiado_grande'], TipoNoPermitido: [415, 'tipo_no_permitido'], LimiteExcedido: [429, 'limite_excedido'], ErrorInterno: [500, 'error_interno'] };
    for (const [nombre, [estado, codigo]] of Object.entries(esperado)) {
      const r = doc.components.responses[nombre]!;
      expect(Object.keys(r.content), nombre).toEqual(['application/problem+json']);
      const ejemplo = Object.values<any>(r.content['application/problem+json'].examples ?? {})[0]?.value ?? r.content['application/problem+json'].example;
      expect(ejemplo, nombre).toMatchObject({ status: estado, codigo });
    }
  });

  it('el 403 solo existe donde hay una acción restringida (tiene x-permiso)', () => {
    expect(operaciones.filter((o) => o.op.responses['403']).map((o) => o.id).sort()).toEqual(operaciones.filter((o) => o.op['x-permiso']).map((o) => o.id).sort());
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
    expect(Object.keys(params).sort()).toEqual(['capitulo', 'norma', 'q', 'tipo']);
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
    for (const campo of ['id', 'idEstable', 'libreriaId', 'capitulo', 'nivel', 'tipo', 'grupo', 'titulo', 'guia', 'alcanceComun', 'aplicaA', 'esEjemplo']) expect(r.required, campo).toContain(campo);
    expect(r.properties.aplicaA.items.required.sort()).toEqual(['clausula', 'edicion', 'norma']);
    expect(new RegExp(r.properties.idEstable.pattern, 'u').test('ha-4.1')).toBe(true);
  });

  it('la librería indica si la empresa la adoptó y si es de ejemplo', () => {
    const l = doc.components.schemas.LibreriaResumen!;
    for (const campo of ['id', 'codigo', 'nombre', 'version', 'esEjemplo', 'fuente', 'propia', 'adoptada']) expect(l.required, campo).toContain(campo);
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

// El correo aparece solo en la respuesta Persona (y en `Personas`, que la contiene; la ve el administrador SIG) y en el cuerpo de la aprobación (lo escribe él): ADR 036.
const CORREO_DE_PERSONA = new Set(['Persona correo', 'Personas correo', 'AprobacionSolicitud correo']);

describe('las respuestas no pueden ganar campos de empresa ni datos personales sin que falle una prueba', () => {
  const propiedadesDe = (nombre: string): string[] => Object.keys(doc.components.schemas[nombre]!.properties).sort();

  it('conjunto exacto de propiedades de cada respuesta', () => {
    expect(propiedadesDe('Identidad')).toEqual(['empresa', 'nombre', 'roles', 'usuarioId']);
    expect(propiedadesDe('Marca')).toEqual(['ajustadoPorContraste', 'colorOriginal', 'colorPrimario', 'logoUrl', 'nombre']);
    expect(propiedadesDe('LibreriaResumen')).toEqual(['adoptada', 'codigo', 'esEjemplo', 'fuente', 'id', 'nombre', 'propia', 'version']);
    expect(propiedadesDe('Adopcion')).toEqual(['adoptadaEn', 'entradas', 'libreriaId', 'yaAdoptada']);
    // Personas (ADR 036): nombre y correo SOLO en Persona (lo ve el administrador SIG) y en la aprobación (lo escribe el administrador).
    // La solicitud, que es lo único que ve quien pide acceso, NO lleva nombre ni correo: solo el código y el plazo.
    expect(propiedadesDe('Persona')).toEqual(['bajaEn', 'correo', 'id', 'nombre', 'rol', 'version']);
    expect(propiedadesDe('SolicitudAcceso')).toEqual(['codigo', 'venceEn']);
    expect(propiedadesDe('SolicitudPendiente')).toEqual(['codigo', 'creadaEn', 'id', 'usuarioId', 'venceEn']);
    expect(propiedadesDe('AprobacionSolicitud')).toEqual(['correo', 'nombre', 'rol']);
    expect(propiedadesDe('EntradaLibreria')).toEqual(['alcanceComun', 'aplicaA', 'capitulo', 'esEjemplo', 'grupo', 'guia', 'id', 'idEstable', 'libreriaId', 'nivel', 'tipo', 'titulo']);
  });

  it('la empresa solo aparece en Identidad.empresa, como un objeto (no una lista), y en ninguna otra respuesta', () => {
    for (const nombre of ['Marca', 'LibreriaResumen', 'Adopcion', 'EntradaLibreria', 'Problema', 'Salud']) {
      expect(propiedades(doc.components.schemas[nombre]).filter((c) => /empresa|tenant/i.test(c)), nombre).toEqual([]);
    }
    expect(Object.keys(doc.components.schemas.Identidad!.properties).filter((c) => /empresa|tenant/i.test(c))).toEqual(['empresa']);
  });

  it('ningún esquema tiene correo, teléfono, cédula ni claves (salvo el correo de la persona que el administrador SIG escribe y ve, ADR 036)', () => {
    for (const [nombre, e] of Object.entries(doc.components.schemas)) {
      expect(propiedades(e).filter((c) => /correo|email|mail|telefono|cedula|password|clave$|token/i.test(c) && !CORREO_DE_PERSONA.has(`${nombre} ${c}`)), nombre).toEqual([]);
    }
  });
});

// El «nombre» de un proceso (auditoría interna, ADR 040) es el de un proceso de la organización, no el de una persona.
const NOMBRES_DE_MEDIDA = new Set(['POST /controles nombre', 'PUT /controles/{id} nombre', 'POST /activos nombre', 'PUT /activos/{id} nombre', 'POST /procesos nombre', 'PUT /procesos/{id} nombre']);
// Datos de la persona que SOLO escribe el administrador SIG al aprobar una solicitud (ADR 036): nunca salen del token ni van a la bitácora.
const DATOS_DE_PERSONA_ESCRITOS_POR_EL_ADMINISTRADOR = new Set(['POST /personas/solicitudes/{id}/aprobacion nombre', 'POST /personas/solicitudes/{id}/aprobacion correo']);

describe('privacidad del contrato', () => {
  it('los ejemplos y las descripciones no traen direcciones de red ni correos reales (solo @example.test)', () => {
    expect(texto).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    for (const correo of texto.match(/[\w.+-]+@[\w.-]+/g) ?? []) expect(correo, correo).toMatch(/@example\.test$/);
  });

  it('ninguna operación recibe datos personales: solo identificadores y filtros acotados', () => {
    for (const o of operaciones) {
      const contenido = o.op.requestBody?.content ?? {};
      const cuerpo = (contenido['application/json'] ?? contenido['multipart/form-data'])?.schema;
      for (const clave of propiedades(cuerpo)) {
        // Excepción deliberada: el «nombre» de un control es el título de una medida de la organización, no el de una persona
        // (la interfaz pide no incluir datos personales y la bitácora nunca lo guarda).
        if (NOMBRES_DE_MEDIDA.has(`${o.id} ${clave}`) || DATOS_DE_PERSONA_ESCRITOS_POR_EL_ADMINISTRADOR.has(`${o.id} ${clave}`)) continue;
        expect(clave, `${o.id} cuerpo`).not.toMatch(/nombre|correo|email|password|clave|token|telefono|cedula/i);
      }
    }
  });
});

describe('riesgos mínimos y justificación de la Declaración (ADR 037)', () => {
  it('los textos libres de la empresa son EXACTAMENTE estos y todos están acotados (no se cuela otro campo de texto)', () => {
    // Descripciones, notas y referencias son textos de la empresa (la pantalla avisa que no deben llevar datos personales ni texto de las
    // normas y la bitácora nunca los guarda). Cualquier campo de texto libre nuevo en un cuerpo debe agregarse aquí a propósito.
    const esperados: Record<string, string[]> = {
      'POST /riesgos': ['descripcion', 'titulo'],
      'PUT /riesgos/{id}': ['descripcion', 'titulo'],
      'PUT /declaracion/motivos': ['nota'],
      'PUT /declaracion/referencias': ['titulo', 'ubicacion', 'versionDoc'],
    };
    const LIBRES = ['POST /riesgos', 'PUT /riesgos/{id}', 'PUT /declaracion/motivos', 'PUT /declaracion/referencias', 'POST /riesgos/{id}/retiro', 'POST /riesgos/{id}/controles', 'POST /riesgos/{id}/controles/eliminacion', 'POST /riesgos/{id}/tratamientos', 'POST /riesgos/{id}/tratamientos/eliminacion', 'POST /declaracion/motivos/eliminacion', 'POST /declaracion/referencias/eliminacion'];
    for (const id of LIBRES) {
      const esquema = resolver(op(id).requestBody.content['application/json'].schema.$ref)!;
      const libres = Object.entries<any>(esquema.properties).filter(([, p]) => (p.type === 'string' || (Array.isArray(p.type) && p.type.includes('string'))) && !p.format && !p.pattern && !p.enum && !p.$ref).map(([k]) => k).sort();
      expect(libres, id).toEqual(esperados[id] ?? []);
      for (const [k, p] of Object.entries<any>(esquema.properties)) if (libres.includes(k) || (Array.isArray(p.type) && p.type.includes('string') && !p.format)) expect(p.maxLength, `${id} ${k}`).toBeGreaterThan(0);
    }
  });

  it('el nivel de riesgo no se envía: lo calcula el sistema; y la empresa tampoco', () => {
    for (const id of ['POST /riesgos', 'PUT /riesgos/{id}']) {
      const claves = Object.keys(resolver(op(id).requestBody.content['application/json'].schema.$ref)!.properties);
      expect(claves.filter((k) => /nivel|puntaje|codigo|estado|empresa/i.test(k)), id).toEqual([]);
    }
  });

  it('conjunto exacto de propiedades de los esquemas nuevos', () => {
    const props = (n: string) => Object.keys(doc.components.schemas[n]!.properties).sort();
    expect(props('Riesgo')).toEqual(['codigo', 'decision', 'descripcion', 'estado', 'id', 'impacto', 'nivel', 'probabilidad', 'puntaje', 'responsableId', 'titulo', 'version']);
    expect(props('RiesgoListado')).toEqual([...props('Riesgo'), 'controles', 'sinTratamiento', 'tratamientosPrevistos'].sort());
    expect(props('RiesgoDetalle')).toEqual([...props('Riesgo'), 'controles', 'tratamientosPrevistos'].sort());
    expect(props('MotivoDeclaracion')).toEqual(['idEstable', 'libreriaCodigo', 'nota', 'tipo', 'version']);
    expect(props('ReferenciaDeclaracion')).toEqual(['fecha', 'tipo', 'titulo', 'ubicacion', 'version', 'versionDoc']);
    expect(props('JustificacionBorrador')).toEqual(['bloqueos', 'conMotivo', 'escala', 'faltaPlanTratamiento', 'filas', 'referencias', 'riesgosSinTratamiento', 'riesgosVigentes', 'sinMotivo']);
    expect(props('JustificacionVersion')).toEqual(['conMotivo', 'escala', 'motivos', 'referencias', 'riesgos', 'riesgosPorFila', 'riesgosVigentes']);
    expect(props('EscalaRiesgo')).toEqual(['corteAlto', 'corteCritico', 'corteMedio', 'escalaMax']);
  });

  it('las listas cerradas coinciden con las del dominio', () => {
    const e = (n: string) => doc.components.schemas[n]!.enum;
    expect(e('NivelRiesgo')).toEqual(['bajo', 'medio', 'alto', 'critico']);
    expect(e('DecisionTratamiento')).toEqual(['mitigar', 'aceptar', 'transferir', 'evitar']);
    expect(e('TipoMotivo')).toEqual(['legal', 'contractual', 'negocio', 'otro']); // «riesgo» se deriva: no se registra
    expect(e('TipoReferencia')).toEqual(['analisis', 'plan']);
    expect(e('ViaRiesgo')).toEqual(['control', 'previsto']);
    expect(e('BloqueoDeclaracion')).toEqual(['sin_filas', 'por_decidir', 'sin_motivo']);
  });

  it('la Declaración y la versión congelada exponen la justificación; la de una versión anterior es nula', () => {
    expect(doc.components.schemas.Declaracion!.required).toContain('justificacion');
    expect(doc.components.schemas.VersionDeclaracionConFilas!.required).toContain('justificacion');
    expect(doc.components.schemas.VersionDeclaracionConFilas!.properties.justificacion.$ref).toBe('#/components/schemas/JustificacionVersion');
    expect(doc.components.schemas.JustificacionVersion!.type).toEqual(['object', 'null']);
  });

  it('las operaciones que cambian algo con versión exigen `versionEsperada` o la aceptan para distinguir crear de cambiar', () => {
    expect(resolver('#/components/schemas/RiesgoCambios')!.required).toContain('versionEsperada');
    expect(resolver('#/components/schemas/RiesgoVersion')!.required).toEqual(['versionEsperada']);
    expect(resolver('#/components/schemas/MotivoQuitar')!.required).toContain('versionEsperada');
    expect(resolver('#/components/schemas/ReferenciaQuitar')!.required).toContain('versionEsperada');
    expect(resolver('#/components/schemas/MotivoEntrada')!.required).not.toContain('versionEsperada'); // ausente = crear
    expect(resolver('#/components/schemas/ReferenciaEntrada')!.required).not.toContain('versionEsperada');
  });
});

describe('control documental (ADR 039)', () => {
  const props = (n: string) => Object.keys(doc.components.schemas[n]!.properties).sort();
  const cuerpo = (id: string): Obj => {
    const contenido = op(id).requestBody.content;
    return resolver((contenido['application/json'] ?? contenido['multipart/form-data']).schema.$ref)!;
  };

  it('los textos libres de la empresa son EXACTAMENTE estos y todos están acotados', () => {
    // Títulos, áreas, notas y motivos son textos de la empresa: la pantalla avisa que no deben llevar datos personales ni texto de las
    // normas y la bitácora NUNCA los guarda. Cualquier campo de texto libre nuevo en un cuerpo debe agregarse aquí a propósito.
    const esperados: Record<string, string[]> = {
      'POST /documentos': ['area', 'edicionFuente', 'emisor', 'titulo'],
      'PUT /documentos/{id}': ['area', 'edicionFuente', 'emisor', 'titulo'],
      'POST /documentos/{id}/versiones': ['nota'],
      'POST /versiones/{id}/devolucion': ['nota'],
      'POST /versiones/{id}/aprobacion': ['motivoExcepcion'],
      'PUT /retencion': ['motivo'],
    };
    const LIBRES = ['POST /documentos', 'PUT /documentos/{id}', 'POST /documentos/{id}/revision', 'PUT /documentos/{id}/distribucion', 'POST /documentos/{id}/vinculos', 'POST /documentos/{id}/vinculos/eliminacion', 'POST /documentos/{id}/versiones', 'POST /versiones/{id}/envio', 'POST /versiones/{id}/devolucion', 'POST /versiones/{id}/aprobacion', 'PUT /retencion'];
    for (const id of LIBRES) {
      const esquema = cuerpo(id);
      const libres = Object.entries<any>(esquema.properties).filter(([, p]) => (p.type === 'string' || (Array.isArray(p.type) && p.type.includes('string'))) && !p.format && !p.pattern && !p.enum && !p.$ref).map(([k]) => k).sort();
      expect(libres, id).toEqual(esperados[id] ?? []);
      for (const k of libres) expect(esquema.properties[k].maxLength, `${id} ${k}`).toBeGreaterThan(0);
    }
  });

  it('el código y el estado los asigna el sistema: ningún cuerpo los envía, y la empresa tampoco', () => {
    for (const id of ['POST /documentos', 'PUT /documentos/{id}']) expect(Object.keys(cuerpo(id).properties).filter((k) => /codigo|estado|empresa|vigente/i.test(k)), id).toEqual([]);
  });

  it('conjunto exacto de propiedades de los esquemas', () => {
    expect(props('Documento')).toEqual(['area', 'clasificacion', 'codigo', 'edicionFuente', 'emisor', 'estado', 'id', 'lecturaPendiente', 'lecturas', 'proximaRevision', 'responsableId', 'revision', 'sinVigente', 'tipo', 'titulo', 'ultimaRevisionEn', 'version', 'vigente']);
    expect(props('DocumentoDetalle')).toEqual([...props('Documento'), 'controles', 'destinatarios', 'entradas', 'retencion', 'unicoAdministrador', 'versiones'].sort());
    expect(props('VersionDocumento')).toEqual(['aprobadaEn', 'aprobadaPor', 'aprobadorId', 'archivo', 'autorId', 'creadaEn', 'devueltaMotivo', 'devueltaNota', 'documentoId', 'elegibleParaDisposicion', 'estado', 'id', 'lecturas', 'motivoExcepcion', 'nota', 'numero', 'obsoletaEn', 'porSuAutor', 'requiereLectura', 'vigente']);
    // El directorio solo trae para qué sirve: identificador, nombre, si sigue activa y si puede aprobar (sin correo ni rol).
    expect(props('PersonaDirectorio')).toEqual(['activa', 'id', 'nombre', 'puedeAprobar']);
    expect(props('LecturaPendiente')).toEqual(['codigo', 'documentoId', 'numeroVersion', 'titulo', 'versionId']);
    expect(props('Retencion')).toEqual(['anios', 'motivo', 'tipo', 'version']);
  });

  it('las listas cerradas coinciden con las del dominio', () => {
    const e = (n: string) => doc.components.schemas[n]!.enum;
    expect(e('TipoDocumento')).toEqual(['politica', 'procedimiento', 'instructivo', 'formato', 'manual', 'externo', 'otro']);
    expect(e('ClasificacionDocumento')).toEqual(['publica', 'interna', 'confidencial', 'restringida']);
    expect(e('EstadoVersionDocumento')).toEqual(['borrador', 'en_revision', 'aprobada', 'obsoleta', 'descartada']);
    expect(e('MotivoDevolucion')).toEqual(['incompleta', 'incorrecta', 'otro']);
    expect(e('MotivoRevision')).toEqual(['periodica', 'auditoria', 'cambio_de_contexto']);
    expect(e('EstadoRevision')).toEqual(['vencida', 'por_vencer', 'al_dia']);
  });

  it('las operaciones que cambian algo con versión la exigen o la aceptan para distinguir crear de cambiar', () => {
    expect(resolver('#/components/schemas/DocumentoCambios')!.required).toContain('versionEsperada');
    expect(resolver('#/components/schemas/RetencionEntrada')!.required).not.toContain('versionEsperada'); // ausente = crear
  });

  it('la subida de una versión es multipart con la nota ANTES del archivo, y la descarga siempre es un adjunto sin caché', () => {
    const o = op('POST /documentos/{id}/versiones');
    expect(Object.keys(o.requestBody.content)).toEqual(['multipart/form-data']);
    expect(Object.keys(resolver('#/components/schemas/VersionSubida')!.properties)).toEqual(['nota', 'archivo']);
    expect(Object.keys(o.responses).sort()).toEqual(['201', '400', '401', '403', '404', '409', '413', '415', '429', '500']);
    const d = op('GET /versiones/{id}/archivo').responses['200'];
    expect(d.headers['X-Content-Type-Options'].schema.enum).toEqual(['nosniff']);
    expect(d.headers['Cache-Control'].$ref).toBe('#/components/headers/CacheControlNoStore');
  });

  it('solo quien aprueba devuelve o aprueba, y la lectura es de la propia persona', () => {
    expect(op('POST /versiones/{id}/aprobacion')['x-permiso']).toBe('documentos.aprobar');
    expect(op('POST /versiones/{id}/devolucion')['x-permiso']).toBe('documentos.aprobar');
    expect(op('POST /versiones/{id}/lectura')['x-permiso']).toBe('documentos.leer');
    expect(op('POST /versiones/{id}/lectura').requestBody).toBeUndefined(); // la persona sale del token: no se envía
  });
});

describe('auditoría interna (ADR 040)', () => {
  const props = (n: string) => Object.keys(doc.components.schemas[n]!.properties).sort();

  it('los textos libres de la empresa son EXACTAMENTE estos y todos están acotados', () => {
    // El nombre y la descripción de un proceso son textos de la empresa: la pantalla avisa que no deben llevar datos personales y la
    // bitácora NUNCA los guarda. Cualquier campo de texto libre nuevo en un cuerpo debe agregarse aquí a propósito.
    const esperados: Record<string, string[]> = {
      'POST /procesos': ['descripcion', 'nombre'],
      'PUT /procesos/{id}': ['descripcion', 'nombre'],
      'POST /programas': ['objetivo'],
      'PUT /programas/{id}': ['objetivo'],
      'POST /programas/{id}/exclusiones': ['capitulo', 'motivo'],
      'POST /programas/{id}/auditorias': ['nota', 'objetivo'],
      'PUT /auditorias/{id}': ['objetivo'],
      'POST /auditorias/{id}/reprogramacion': ['nota'],
      'POST /auditorias/{id}/cancelacion': ['nota'],
      'PUT /auditorias/{id}/lista/resultado': ['nota'],
      'POST /auditorias/{id}/lista/preguntas': ['texto'],
      'POST /auditorias/{id}/hallazgos': ['enunciado', 'evidencia', 'justificacionGravedad'],
      'PUT /auditorias/{id}/hallazgos': ['enunciado', 'evidencia', 'justificacionGravedad'],
      'POST /auditorias/{id}/informe': ['conclusion', 'limitaciones'],
    };
    const LIBRES = [
      'POST /procesos',
      'PUT /procesos/{id}',
      'POST /procesos/{id}/relaciones',
      'POST /procesos/{id}/relaciones/eliminacion',
      'POST /programas',
      'PUT /programas/{id}',
      'POST /programas/{id}/aprobacion',
      'POST /programas/{id}/exclusiones',
      'POST /programas/{id}/exclusiones/eliminacion',
      'POST /programas/{id}/auditorias',
      'PUT /auditorias/{id}',
      'POST /auditorias/{id}/reprogramacion',
      'POST /auditorias/{id}/cancelacion',
      'POST /auditorias/{id}/avance',
      'POST /auditorias/{id}/equipo',
      'POST /auditorias/{id}/equipo/eliminacion',
      'PUT /auditorias/{id}/lista/resultado',
      'POST /auditorias/{id}/lista/preguntas',
      'POST /auditorias/{id}/lista/preguntas/eliminacion',
      'POST /auditorias/{id}/hallazgos',
      'PUT /auditorias/{id}/hallazgos',
      'POST /auditorias/{id}/hallazgos/anulacion',
      'POST /auditorias/{id}/informe',
      'POST /auditorias/{id}/cierre',
    ];
    for (const id of LIBRES) {
      const esquema = resolver(op(id).requestBody.content['application/json'].schema.$ref)!;
      const libres = Object.entries<any>(esquema.properties)
        .filter(([, p]) => (p.type === 'string' || (Array.isArray(p.type) && p.type.includes('string'))) && !p.format && !p.pattern && !p.enum && !p.$ref)
        .map(([k]) => k)
        .sort();
      expect(libres, id).toEqual(esperados[id] ?? []);
      for (const k of libres) expect(esquema.properties[k].maxLength, `${id} ${k}`).toBeGreaterThan(0);
    }
  });

  it('la excepción de independencia lleva EXACTAMENTE dos textos libres, acotados', () => {
    const esquema = resolver('#/components/schemas/ExcepcionEntrada')!;
    expect(Object.keys(esquema.properties).sort()).toEqual(['medida', 'motivo']);
    for (const k of ['medida', 'motivo']) expect(esquema.properties[k].maxLength, k).toBe(300);
  });

  it('conjunto exacto de propiedades de los esquemas de procesos', () => {
    expect(props('Proceso')).toEqual(['avisos', 'cambioRelevante', 'codigo', 'descripcion', 'duenaId', 'estado', 'frecuencia', 'id', 'importancia', 'nombre', 'personasRelacionadas', 'transversal', 'version']);
    expect(props('ProcesoEntrada')).toEqual(['descripcion', 'duenaId', 'frecuencia', 'importancia', 'nombre']);
    expect(props('ProcesoCambios')).toEqual(['cambioRelevante', 'descripcion', 'duenaId', 'frecuencia', 'importancia', 'nombre', 'versionEsperada']);
    expect(props('RelacionEntrada')).toEqual(['personaId', 'relacion']);
    expect(props('Programa')).toEqual(['anio', 'aprobadoEn', 'aprobadoPor', 'estado', 'id', 'normas', 'objetivo', 'version']);
    expect(props('ProgramaEntrada')).toEqual(['anio', 'normas', 'objetivo']);
    expect(props('ProgramaCambios')).toEqual(['normas', 'objetivo', 'versionEsperada']);
    expect(props('ExclusionEntrada')).toEqual(['capitulo', 'libreriaCodigo', 'motivo', 'procesoId', 'tipo']);
    expect(props('DetallePrograma')).toEqual(['auditorias', 'exclusiones', 'pendientes', 'procesos', 'programa']);
    expect(props('AuditoriaDePrograma')).toEqual(['codigo', 'combinada', 'estado', 'fin', 'id', 'inicio', 'liderId', 'normas', 'objetivo', 'procesosIds', 'trimestre']);
    expect(props('Auditoria')).toEqual(['anio', 'cancelacionMotivo', 'capitulos', 'cerradaEn', 'codigo', 'combinada', 'equipo', 'estado', 'fin', 'id', 'informeEmitidoEn', 'inicio', 'normas', 'objetivo', 'procesosDelAlcance', 'procesosIds', 'programaId', 'reprogramaciones', 'reunionApertura', 'reunionCierre', 'version']);
    expect(props('AuditoriaEntrada')).toEqual(['capitulos', 'fin', 'inicio', 'motivo', 'normas', 'nota', 'objetivo', 'procesosIds', 'reunionApertura', 'reunionCierre']);
    expect(props('MiembroEntrada')).toEqual(['excepcion', 'personaId', 'rol']);
    expect(props('ExcepcionEntrada')).toEqual(['medida', 'motivo']);
    expect(props('MiembroEquipo')).toEqual(['autoautorizada', 'excepcion', 'excepcionAutorizadaPor', 'excepcionMedida', 'excepcionMotivo', 'personaId', 'rol']);
    expect(props('ResultadoFilaEntrada')).toEqual(['filaId', 'nota', 'resultado', 'versionEsperada']);
    expect(props('FilaLista')).toEqual(['agrupador', 'diagnostico', 'evaluadoEn', 'evaluadoPor', 'guia', 'id', 'idEstable', 'libreriaCodigo', 'nota', 'preguntas', 'resultado', 'titulo', 'version']);
    expect(props('Hallazgo')).toEqual(['anulacionMotivo', 'codigo', 'enunciado', 'estado', 'evidencia', 'id', 'idEstable', 'itemId', 'justificacionGravedad', 'libreriaCodigo', 'procesoId', 'registradoPor', 'tipo', 'version']);
    expect(props('HallazgoEntrada')).toEqual(['enunciado', 'evidencia', 'idEstable', 'itemId', 'justificacionGravedad', 'libreriaCodigo', 'procesoId', 'tipo']);
    expect(props('InformeEntrada')).toEqual(['conclusion', 'limitaciones', 'versionEsperada']);
    expect(props('InformeAuditoria')).toEqual(['auditoriaId', 'codigo', 'contenido', 'emitidoEn', 'emitidoPor', 'huella']);
    expect(props('InformeContenido')).toEqual(['auditoria', 'conclusion', 'conteos', 'emitidoEn', 'emitidoPor', 'equipo', 'filas', 'hallazgos', 'limitaciones', 'noVerificadas', 'programa', 'version']);
    expect(props('PanelAuditoria')).toEqual(['auditorias', 'cobertura12Meses', 'prerrequisito', 'programaAnio']);
    expect(props('Independencia')).toEqual(['avisos', 'conflictos', 'independiente', 'personaId', 'procesosDelAlcance']);
    expect(props('ProcesoDePrograma')).toEqual(['cambioRelevante', 'codigo', 'frecuencia', 'hallazgosAbiertos', 'importancia', 'incluido', 'nombre', 'procesoId', 'ultimaAuditoria']);
  });

  it('las listas cerradas coinciden con las del dominio', () => {
    const e = (n: string) => doc.components.schemas[n]!.enum;
    expect(e('ImportanciaProceso')).toEqual(['alta', 'media', 'baja']);
    expect(e('FrecuenciaProceso')).toEqual(['semestral', 'anual', 'cada_dos_anios', 'cada_tres_anios']);
    expect(e('TipoRelacionProceso')).toEqual(['duena', 'participa', 'diseno', 'supervisa']);
    expect(e('CambioRelevanteProceso')).toEqual(['cambio', 'incidente']);
    expect(e('AvisoProceso')).toEqual(['sin_relaciones', 'duena_inactiva']);
    expect(e('EstadoPrograma')).toEqual(['sin_aprobar', 'aprobado']);
    expect(e('ResultadoItem')).toEqual(['por_evaluar', 'conforme', 'no_conforme', 'observacion', 'oportunidad', 'no_aplica', 'no_verificado']);
    expect(e('TipoHallazgo')).toEqual(['nc_mayor', 'nc_menor', 'observacion', 'oportunidad']);
    expect(e('MotivoAnulacionHallazgo')).toEqual(['duplicado', 'error_de_registro', 'otro']);
    expect(e('MotivoCambioAuditoria')).toEqual(['sin_recursos', 'cambio_de_alcance', 'reprogramada', 'otro']);
    expect(e('EstadoAuditoria')).toEqual(['planificada', 'en_preparacion', 'en_ejecucion', 'informe_emitido', 'cerrada', 'cancelada']);
  });

  it('cambiar un proceso exige `versionEsperada`; la empresa y el código nunca se envían', () => {
    expect(resolver('#/components/schemas/ProcesoCambios')!.required).toEqual(['versionEsperada']);
    expect(resolver('#/components/schemas/ProgramaCambios')!.required).toEqual(['versionEsperada']);
    for (const n of ['ResultadoFilaEntrada', 'HallazgoCambios', 'HallazgoAnulacion', 'InformeEntrada', 'CierreEntrada']) expect(resolver(`#/components/schemas/${n}`)!.required, n).toContain('versionEsperada');
    for (const n of ['AuditoriaCambios', 'AuditoriaCancelacion', 'AuditoriaAvance']) expect(resolver(`#/components/schemas/${n}`)!.required, n).toContain('versionEsperada');
    expect(resolver('#/components/schemas/AuditoriaReprogramacion')!.required).toContain('versionEsperada');
    expect(resolver('#/components/schemas/ProgramaVersion')!.required).toEqual(['versionEsperada']);
    for (const n of ['ProcesoEntrada', 'ProcesoCambios', 'RelacionEntrada', 'ProgramaEntrada', 'ProgramaCambios', 'ProgramaVersion', 'ExclusionEntrada', 'AuditoriaEntrada', 'AuditoriaCambios', 'AuditoriaReprogramacion', 'AuditoriaCancelacion', 'MiembroEntrada', 'MiembroQuitar', 'ResultadoFilaEntrada', 'PreguntaEntrada', 'HallazgoEntrada', 'HallazgoCambios', 'InformeEntrada', 'CierreEntrada']) expect(props(n).filter((k) => k !== 'libreriaCodigo' && /empresa|codigo|transversal|estado/i.test(k)), n).toEqual([]);
  });

  it('solo el administrador SIG escribe; consultar es de «auditoria.ver»', () => {
    for (const [id, permiso] of AUDITORIA_INTERNA.map((x) => [x[0], x[1]] as const)) expect(op(id)['x-permiso'], id).toBe(permiso);
    expect(op('POST /procesos/{id}/relaciones').responses['200']).toBeDefined(); // idempotente: ya existía
    expect(op('POST /procesos/{id}/relaciones').responses['201']).toBeDefined();
  });
});

describe('activos de información (ADR 038)', () => {
  const props = (n: string) => Object.keys(doc.components.schemas[n]!.properties).sort();
  it('los textos libres de la empresa son EXACTAMENTE estos y están acotados', () => {
    const esperados: Record<string, string[]> = { 'POST /activos': ['descripcion', 'nombre'], 'PUT /activos/{id}': ['descripcion', 'nombre'] };
    for (const id of ['POST /activos', 'PUT /activos/{id}', 'POST /activos/{id}/retiro', 'POST /riesgos/{id}/activos', 'POST /riesgos/{id}/activos/eliminacion']) {
      const esquema = resolver(op(id).requestBody.content['application/json'].schema.$ref)!;
      const libres = Object.entries<any>(esquema.properties).filter(([, p]) => (p.type === 'string' || (Array.isArray(p.type) && p.type.includes('string'))) && !p.format && !p.pattern && !p.enum && !p.$ref).map(([k]) => k).sort();
      expect(libres, id).toEqual(esperados[id] ?? []);
      for (const k of libres) expect(esquema.properties[k].maxLength, `${id} ${k}`).toBeGreaterThan(0);
    }
  });
  it('el código y el estado los asigna el sistema, y la empresa no se envía', () => {
    for (const id of ['POST /activos', 'PUT /activos/{id}']) expect(Object.keys(resolver(op(id).requestBody.content['application/json'].schema.$ref)!.properties).filter((k) => /codigo|estado|empresa/i.test(k)), id).toEqual([]);
  });
  it('conjunto exacto de propiedades y listas cerradas', () => {
    expect(props('Activo')).toEqual(['clasificacion', 'codigo', 'descripcion', 'estado', 'id', 'nombre', 'responsableId', 'tipo', 'version']);
    expect(props('ActivoListado')).toEqual([...props('Activo'), 'riesgos', 'sinRiesgos'].sort());
    expect(props('ActivoDetalle')).toEqual([...props('Activo'), 'nivelMasAlto', 'riesgos'].sort());
    expect(doc.components.schemas.TipoActivo!.enum).toEqual(['informacion', 'aplicacion_sistema', 'infraestructura', 'persona', 'servicio_terceros', 'instalacion']);
    expect(doc.components.schemas.ClasificacionActivo!.enum).toEqual(['publica', 'interna', 'confidencial', 'restringida']);
  });
  it('cambiar y retirar exigen la versión que la persona vio', () => {
    expect(resolver('#/components/schemas/ActivoCambios')!.required).toContain('versionEsperada');
    expect(resolver('#/components/schemas/ActivoVersion')!.required).toEqual(['versionEsperada']);
  });
});
