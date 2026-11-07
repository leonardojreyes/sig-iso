import { AutorizacionFake } from '@sig/autorizacion';
import { AdoptarLibreriaUseCase, ListarLibreriasUseCase, ListarRequisitosUseCase, ObtenerRequisitoUseCase } from '@sig/normas';
import { crearUnidadDeTrabajoFalsa, E, EstadoFalso, LIB1, LIB2, libreria1, libreria2 } from '@sig/normas/prueba';
import { crearEmpresaId } from '@sig/tenancy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { NormasApiModule } from './normas-api.module.js';

// /librerias, adopción, /requisitos y /requisitos/{id} sobre una aplicación Nest REAL con los casos de uso reales y fakes que
// respetan el aislamiento por empresa y revierten de verdad. Cada respuesta se valida contra los esquemas de openapi.yaml.
const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const ADMIN_A = '44444444-4444-4444-8444-444444444444';
const COLAB_A = '55555555-5555-4555-8555-555555555555';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';
const INEXISTENTE = 'f0000000-0000-4000-8000-000000000999';
const NULO = '00000000-0000-0000-0000-000000000000';

describe('controladores de normas (tarea 6.6; H4.x, H5.x, H6.5)', () => {
  let arnes: Arnes;
  let estado: EstadoFalso;
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tA = () => token(A, ADMIN_A);
  const tColab = () => token(A, COLAB_A);
  const tB = () => token(B, ADMIN_B);

  beforeAll(async () => {
    estado = new EstadoFalso(null, 0);
    const autorizacion = new AutorizacionFake();
    autorizacion.asignar(A, ADMIN_A, 'administrador_sig');
    autorizacion.asignar(A, COLAB_A, 'colaborador');
    autorizacion.asignar(B, ADMIN_B, 'administrador_sig');
    const unidad = crearUnidadDeTrabajoFalsa(estado);
    arnes = await crearArnes({
      hechos: bitacora.hechos,
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
  afterAll(async () => { await arnes.cerrar(); });
  beforeEach(() => {
    estado.librerias = [libreria1, libreria2];
    estado.entradasCatalogo = [E.mejora, E.otra, E.contexto, E.riesgos, E.liderazgo];
    estado.adopciones.clear();
    estado.bitacora = [];
    estado.fallos.clear();
    estado.ganadora = null;
    estado.sinAislamiento = false;
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  const cuerpo = async (r: Response) => (await r.json()) as unknown;
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const c = (await cuerpo(r)) as Record<string, unknown>;
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
    return c;
  };
  const adoptar = (id: string, t: string | undefined, query = '') => arnes.pedir(`/librerias/${id}/adopcion${query}`, t, 'POST');
  const huella = async (r: Response) =>
    JSON.stringify({ status: r.status, cabeceras: [...r.headers.entries()].filter(([k]) => !['date', 'connection', 'keep-alive'].includes(k)).sort(), cuerpo: await r.text() });

  describe('GET /librerias', () => {
    it('lista el catálogo con la forma del contrato y `adoptada` según la empresa del token (H4.8)', async () => {
      await adoptar(LIB1, await tA());
      const deA = (await cuerpo(await arnes.pedir('/librerias', await tA()))) as { codigo: string; adoptada: boolean }[];
      const deB = (await cuerpo(await arnes.pedir('/librerias', await tB()))) as { codigo: string; adoptada: boolean }[];
      expect(deA.map((l) => [l.codigo, l.adoptada])).toEqual([['ejemplo-dos', false], ['ejemplo-uno', true]]);
      expect(deB.every((l) => !l.adoptada)).toBe(true);
      for (const l of deA) expect(erroresDeEsquema('LibreriaResumen', l)).toEqual([]);
    });

    it('lleva Cache-Control: no-store y exige token', async () => {
      expect((await arnes.pedir('/librerias', await tA())).headers.get('cache-control')).toBe('no-store');
      await problema(await arnes.pedir('/librerias'), 401, 'no_autenticado');
    });

    it('lo que adopta B no cambia lo que ve A', async () => {
      await adoptar(LIB1, await tB());
      const deA = (await cuerpo(await arnes.pedir('/librerias', await tA()))) as { adoptada: boolean }[];
      expect(deA.every((l) => !l.adoptada)).toBe(true);
    });
  });

  describe('POST /librerias/{id}/adopcion', () => {
    it('la primera vez responde 201 con la forma del contrato y cuántas entradas quedaron disponibles (H4.9)', async () => {
      estado.entradasCatalogo = [E.contexto, E.liderazgo, E.riesgos, E.mejora];
      const r = await adoptar(LIB1, await tA());
      expect(r.status).toBe(201);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = (await cuerpo(r)) as Record<string, unknown>;
      expect(c).toMatchObject({ libreriaId: LIB1, yaAdoptada: false });
      expect(erroresDeEsquema('Adopcion', c)).toEqual([]);
      expect(estado.adopciones.size).toBe(1);
      expect(bitacora.estado.eventos).toEqual([]); // la bitácora de la adopción va dentro de su unidad, no por el filtro
      expect(estado.bitacora.map((r) => r.accion)).toEqual(['libreria.adoptada']);
    });

    it('adoptar otra vez responde 200 «ya adoptada», sin cambios (no es un error, H4.7)', async () => {
      const primera = (await cuerpo(await adoptar(LIB1, await tA()))) as Record<string, unknown>;
      const r = await adoptar(LIB1, await tA());
      expect(r.status).toBe(200);
      const segunda = (await cuerpo(r)) as Record<string, unknown>;
      expect(segunda).toEqual({ ...primera, yaAdoptada: true });
      expect(erroresDeEsquema('Adopcion', segunda)).toEqual([]);
      expect(estado.adopciones.size).toBe(1);
    });

    it('la empresa y la persona salen del token, no de la consulta', async () => {
      await adoptar(LIB1, await tA(), `?empresa=${B}&usuario=${ADMIN_B}`);
      expect([...estado.adopciones.keys()]).toEqual([`${A}|${LIB1}`]);
    });

    describe('403 por rol, sin mirar el identificador (H4.6, H6.5)', () => {
      const variantes: [string, string][] = [
        ['librería existente', LIB1],
        ['librería inexistente', INEXISTENTE],
        ['UUID mal formado', 'no-es-un-uuid'],
        ['UUID con llaves', `%7B${LIB1}%7D`],
        ['UUID sin guiones', LIB1.replaceAll('-', '')],
      ];

      it('un colaborador recibe SIEMPRE el mismo 403, byte a byte, y no se adopta nada', async () => {
        const huellas = new Set<string>();
        for (const [, id] of variantes) huellas.add(await huella(await adoptar(id, await tColab())));
        expect(huellas.size).toBe(1);
        const c = await problema(await adoptar(LIB1, await tColab()), 403, 'sin_permiso');
        expect(JSON.stringify(c)).not.toMatch(/libreria|ejemplo/i);
        expect(estado.adopciones.size).toBe(0);
      });

      it.each(variantes)('un colaborador con %s deja UN hecho acceso.denegado con el permiso que faltó', async (_n, id) => {
        bitacora.estado.eventos = [];
        await adoptar(id, await tColab());
        expect(bitacora.estado.eventos).toEqual([
          { empresaId: A, actor: { tipo: 'usuario', usuarioId: COLAB_A }, accion: 'acceso.denegado', resultado: 'rechazado', motivo: 'sin_permiso', objeto: 'accion:librerias.adoptar' },
        ]);
      });

      it('si NO se puede registrar el rechazo, responde 500 (H6.8)', async () => {
        bitacora.estado.falla = true;
        await problema(await adoptar(LIB1, await tColab()), 500, 'error_interno');
      });
    });

    describe('un administrador: 400 y 404', () => {
      it.each([
        ['texto cualquiera', 'no-es-un-uuid'],
        ['con llaves', `%7B${LIB1}%7D`],
        ['sin guiones', LIB1.replaceAll('-', '')],
        ['inyección', "x'%20or%201=1%20--"],
        ['demasiado largo', 'a'.repeat(200)],
      ])('un identificador %s → 400 sin repetir el valor', async (_n, id) => {
        const c = await problema(await adoptar(id, await tA()), 400, 'parametro_invalido');
        expect(JSON.stringify(c)).not.toMatch(/no-es-un-uuid|aaaaaaaaaa|or 1=1/);
        expect(estado.adopciones.size).toBe(0);
      });

      it('una librería que no existe, incluido el UUID nulo → 404 sin hechos', async () => {
        await problema(await adoptar(INEXISTENTE, await tA()), 404, 'no_encontrado');
        await problema(await adoptar(NULO, await tA()), 404, 'no_encontrado');
        expect(bitacora.estado.eventos).toEqual([]);
        expect(estado.adopciones.size).toBe(0);
      });

      it('un UUID en mayúsculas se acepta', async () => {
        expect((await adoptar(LIB1.toUpperCase(), await tA())).status).toBe(201);
      });
    });

    it('H4.10 / H6.8: si la bitácora falla, la adopción NO se guarda (500) y al reintentar es una adopción nueva (201, no 200)', async () => {
      estado.fallos.set('bitacora', new Error('bitácora caída'));
      await problema(await adoptar(LIB1, await tA()), 500, 'error_interno');
      expect(estado.adopciones.size).toBe(0);
      estado.fallos.clear();
      const r = await adoptar(LIB1, await tA());
      expect(r.status).toBe(201);
      expect(((await cuerpo(r)) as { yaAdoptada: boolean }).yaAdoptada).toBe(false);
    });

    it('sin token → 401 y no se registra nada', async () => {
      await problema(await adoptar(LIB1, undefined), 401, 'no_autenticado');
      expect(estado.adopciones.size).toBe(0);
    });

    it('la adopción de B no cambia lo que ve A (y viceversa)', async () => {
      await adoptar(LIB1, await tB());
      expect(estado.adopciones.has(`${A}|${LIB1}`)).toBe(false);
      expect(((await cuerpo(await arnes.pedir('/requisitos', await tA()))) as unknown[]).length).toBe(0);
      expect(((await cuerpo(await arnes.pedir('/requisitos', await tB()))) as unknown[]).length).toBe(4);
    });
  });

  describe('GET /requisitos', () => {
    const adoptadas = async () => { await adoptar(LIB1, await tA()); await adoptar(LIB2, await tA()); };
    const ids = async (query = '', t?: string) => ((await cuerpo(await arnes.pedir(`/requisitos${query}`, t ?? (await tA())))) as { idEstable: string }[]).map((e) => e.idEstable);

    it('sin adopciones devuelve una lista vacía (H5.4)', async () => {
      expect(await ids()).toEqual([]);
    });

    it('lista las entradas de las librerías adoptadas, en el orden de la librería, con la forma del contrato', async () => {
      await adoptadas();
      const r = await arnes.pedir('/requisitos', await tA());
      expect(r.headers.get('cache-control')).toBe('no-store');
      const lista = (await cuerpo(r)) as { idEstable: string }[];
      expect(lista.map((e) => e.idEstable)).toEqual(['ha-otra', 'ha-contexto', 'ha-liderazgo', 'ha-riesgos', 'ha-mejora']);
      for (const e of lista) expect(erroresDeEsquema('EntradaLibreria', e)).toEqual([]);
    });

    it('filtra por texto, capítulo y norma, y los filtros se combinan (H5.2, H5.3)', async () => {
      await adoptadas();
      expect(await ids('?q=liderazgo')).toEqual(['ha-liderazgo']);
      expect(await ids('?q=10.3')).toEqual(['ha-mejora']);
      expect(await ids('?capitulo=6')).toEqual(['ha-riesgos']);
      expect(await ids('?norma=ISO%2FIEC%2027001')).toEqual(['ha-contexto', 'ha-riesgos', 'ha-mejora']);
      expect(await ids('?norma=ISO%2FIEC%2027001&capitulo=6')).toEqual(['ha-riesgos']);
      expect(await ids('?capitulo=7')).toEqual([]);
    });

    it('sin autenticar → 401', async () => {
      await problema(await arnes.pedir('/requisitos'), 401, 'no_autenticado');
    });

    it('la empresa de la consulta no cambia el alcance: B no ve lo adoptado por A', async () => {
      await adoptadas();
      expect(await ids(`?empresa=${A}`, await tB())).toEqual([]);
    });

    describe('filtros inválidos → 400, sin repetir el valor y sin ampliar el alcance', () => {
      it.each([
        ['capitulo bajo', '?capitulo=3'],
        ['capitulo alto', '?capitulo=11'],
        ['capitulo decimal', '?capitulo=4.5'],
        ['capitulo no numérico', '?capitulo=abc'],
        ['capitulo vacío', '?capitulo='],
        ['capitulo hexadecimal', '?capitulo=0x5'],
        ['capitulo en notación científica', '?capitulo=1e1'],
        ['capitulo con espacio', '?capitulo=%205'],
        ['capitulo con signo', '?capitulo=%2B5'],
        ['capitulo negativo', '?capitulo=-5'],
        ['capitulo repetido', '?capitulo=5&capitulo=6'],
        ['q vacío', '?q='],
        ['q repetido', '?q=a&q=b'],
        ['q demasiado largo', `?q=${'a'.repeat(81)}`],
        ['q con %', '?q=%25'],
        ['q con _', '?q=_'],
        ['q con comillas', "?q=ha'%20or%20'1'='1"],
        ['q con asterisco', '?q=*'],
        ['norma con símbolos', '?norma=ISO%25'],
        ['norma con script', '?norma=%3Cscript%3E'],
        ['norma vacía', '?norma='],
        ['norma demasiado larga', `?norma=${'N'.repeat(61)}`],
      ])('%s', async (_n, consulta) => {
        await adoptadas();
        const c = await problema(await arnes.pedir(`/requisitos${consulta}`, await tA()), 400, 'parametro_invalido');
        expect(JSON.stringify(c)).not.toMatch(/script|or 1|aaaaaaaa|NNNN|%/);
      });

      it('un comodín no devuelve «todo»: se rechaza en vez de ampliar el alcance', async () => {
        await adoptadas();
        expect((await arnes.pedir('/requisitos?q=%25', await tA())).status).toBe(400);
        expect((await arnes.pedir('/requisitos?norma=*', await tA())).status).toBe(400);
      });
    });
  });

  describe('GET /requisitos/{id}', () => {
    it('devuelve la entrada de una librería adoptada, con la forma del contrato', async () => {
      await adoptar(LIB1, await tA());
      const r = await arnes.pedir(`/requisitos/${E.contexto.id}`, await tA());
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const c = (await cuerpo(r)) as Record<string, unknown>;
      expect(c).toMatchObject({ id: E.contexto.id, idEstable: 'ha-contexto' });
      expect(erroresDeEsquema('EntradaLibreria', c)).toEqual([]);
    });

    it('«no existe», «es de otra empresa» y «su librería no está adoptada» dan el MISMO 404, byte a byte (H2.2)', async () => {
      await adoptar(LIB1, await tA());
      const noExiste = await huella(await arnes.pedir(`/requisitos/${INEXISTENTE}`, await tA()));
      const deOtraEmpresa = await huella(await arnes.pedir(`/requisitos/${E.contexto.id}`, await tB()));
      const noAdoptada = await huella(await arnes.pedir(`/requisitos/${E.otra.id}`, await tA()));
      const nulo = await huella(await arnes.pedir(`/requisitos/${NULO}`, await tA()));
      expect(new Set([noExiste, deOtraEmpresa, noAdoptada, nulo]).size).toBe(1);
      await problema(await arnes.pedir(`/requisitos/${E.contexto.id}`, await tB()), 404, 'no_encontrado');
    });

    it.each([
      ['texto', 'no-es-un-uuid'], ['llaves', `%7B${E.contexto.id}%7D`], ['sin guiones', E.contexto.id.replaceAll('-', '')], ['inyección', "x'%20or%201=1"],
    ])('un identificador mal formado (%s) → 400 sin repetir el valor', async (_n, id) => {
      await adoptar(LIB1, await tA());
      const c = await problema(await arnes.pedir(`/requisitos/${id}`, await tA()), 400, 'parametro_invalido');
      expect(JSON.stringify(c)).not.toMatch(/no-es-un-uuid|or 1=1/);
    });

    it('sin token → 401', async () => {
      await problema(await arnes.pedir(`/requisitos/${E.contexto.id}`), 401, 'no_autenticado');
    });

    it('aunque el repositorio no aislara, una entrada de una librería no adoptada sigue dando 404', async () => {
      estado.sinAislamiento = true;
      await problema(await arnes.pedir(`/requisitos/${E.contexto.id}`, await tB()), 404, 'no_encontrado');
    });
  });

  it('ninguna de estas rutas acepta métodos que cambian algo, salvo la adopción por POST', async () => {
    const t = await tA();
    expect((await arnes.pedir('/librerias', t, 'POST')).status).toBe(404);
    expect((await arnes.pedir(`/librerias/${LIB1}/adopcion`, t, 'DELETE')).status).toBe(404);
    expect((await arnes.pedir(`/librerias/${LIB1}/adopcion`, t, 'GET')).status).toBe(404);
    expect((await arnes.pedir('/requisitos', t, 'DELETE')).status).toBe(404);
    expect((await arnes.pedir(`/requisitos/${E.contexto.id}`, t, 'PUT')).status).toBe(404);
  });
});
