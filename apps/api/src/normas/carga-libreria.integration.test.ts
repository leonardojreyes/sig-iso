import { AutorizacionFake } from '@sig/autorizacion';
import { AdoptarLibreriaUseCase, ListarLibreriasUseCase, ListarRequisitosUseCase, ObtenerRequisitoUseCase, TAMANO_MAX_LIBRERIA } from '@sig/normas';
import { crearUnidadDeTrabajoFalsa, EstadoFalso } from '@sig/normas/prueba';
import { crearEmpresaId } from '@sig/tenancy';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearArnes, hechosEnMemoria, type Arnes } from '../autenticacion/prueba/arnes.js';
import { erroresDeEsquema } from '../autenticacion/prueba/contrato.js';
import { NormasApiModule } from './normas-api.module.js';
import { AlmacenCargaFalso, cargarDePrueba } from './prueba/carga.js';

// POST /librerias/carga sobre una aplicación Nest REAL con el caso de uso real (lector de YAML real) y un almacén que separa por empresa.
// Cada respuesta se valida contra los esquemas de openapi.yaml. Datos SINTÉTICOS: ninguna frase proviene de una norma.
const A = crearEmpresaId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const B = crearEmpresaId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const ADMIN_A = '44444444-4444-4444-8444-444444444444';
const COLAB_A = '55555555-5555-4555-8555-555555555555';
const ADMIN_B = '66666666-6666-4666-8666-666666666666';

const YAML = (cambio = '') => `esquema: 3
codigo: propia-api
nombre: Librería propia de prueba
version: 1.0.0${cambio}
es_ejemplo: false
fuente: elaboración propia de la empresa
referencias:
  - { norma: Norma X, edicion: "2022" }
entradas:
  - id: x-4.1
    capitulo: 4
    nivel: 1
    titulo: Primer tema de prueba
    guia: Texto sintético de prueba, sin relación con ninguna norma.
    alcance_comun: comun
    aplica_a:
      - { norma: Norma X, edicion: "2022", clausula: "4.1" }
`;

describe('POST /librerias/carga', () => {
  let arnes: Arnes;
  let almacen: AlmacenCargaFalso;
  const bitacora = hechosEnMemoria();
  let sesion = 0;
  const token = (empresa: string, usuario: string) => arnes.firmar(empresa, usuario, { sid: `s-${++sesion}` });
  const tA = () => token(A, ADMIN_A);
  const tColab = () => token(A, COLAB_A);
  const tB = () => token(B, ADMIN_B);

  beforeAll(async () => {
    const estado = new EstadoFalso(null, 0);
    const autorizacion = new AutorizacionFake();
    autorizacion.asignar(A, ADMIN_A, 'administrador_sig');
    autorizacion.asignar(A, COLAB_A, 'colaborador');
    autorizacion.asignar(B, ADMIN_B, 'administrador_sig');
    const unidad = crearUnidadDeTrabajoFalsa(estado);
    const c = cargarDePrueba(autorizacion);
    almacen = c.almacen;
    arnes = await crearArnes({
      hechos: bitacora.hechos,
      modulos: [
        NormasApiModule.register({
          adoptar: new AdoptarLibreriaUseCase(unidad, autorizacion),
          cargar: c.caso,
          librerias: new ListarLibreriasUseCase(unidad),
          requisitos: new ListarRequisitosUseCase(unidad),
          requisito: new ObtenerRequisitoUseCase(unidad),
        }),
      ],
    });
  });
  afterAll(async () => {
    await arnes.cerrar();
  });
  beforeEach(() => {
    almacen.librerias.clear();
    almacen.bitacora = [];
    almacen.falloBitacora = false;
    bitacora.estado.eventos = [];
    bitacora.estado.falla = false;
  });

  const formulario = (contenido: string | Uint8Array, nombre = 'norma.yaml') => {
    const f = new FormData();
    f.append('archivo', new Blob([contenido as BlobPart], { type: 'application/yaml' }), nombre);
    return f;
  };
  const subir = (t: string | undefined, cuerpo: FormData = formulario(YAML())) => arnes.pedir('/librerias/carga', t, 'POST', cuerpo);
  const cuerpo = async (r: Response) => (await r.json()) as Record<string, unknown>;
  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    const c = await cuerpo(r);
    expect(c).toMatchObject({ status, codigo });
    expect(erroresDeEsquema('Problema', c)).toEqual([]);
  };

  it('201 con la forma del contrato la primera vez, y el hecho queda en la bitácora', async () => {
    const r = await subir(await tA());
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const c = await cuerpo(r);
    expect(c).toMatchObject({ estado: 'cargada', motivo: null, codigo: 'propia-api', version: '1.0.0', entradas: 1, errores: [] });
    expect(erroresDeEsquema('CargaLibreria', c)).toEqual([]);
    expect(almacen.bitacora).toHaveLength(1);
    expect(almacen.bitacora[0]).toMatchObject({ accion: 'libreria.cargada', resultado: 'ok', objeto: 'libreria:propia-api' });
  });

  it('200 «ya cargada» si se sube lo mismo', async () => {
    await subir(await tA());
    const r = await subir(await tA());
    expect(r.status).toBe(200);
    expect(await cuerpo(r)).toMatchObject({ estado: 'ya_cargada' });
  });

  it('un archivo inválido no es un error HTTP: 200 rechazada, con códigos y rutas, sin repetir el contenido', async () => {
    const r = await subir(await tA(), formulario('codigo: 12\nsecreto: SECRETO-XYZ\n'));
    expect(r.status).toBe(200);
    const texto = await r.text();
    expect(texto).not.toContain('SECRETO-XYZ');
    const c = JSON.parse(texto) as Record<string, unknown>;
    expect(c).toMatchObject({ estado: 'rechazada', motivo: 'formato_invalido', entradas: null });
    expect((c['errores'] as unknown[]).length).toBeGreaterThan(0);
    expect(erroresDeEsquema('CargaLibreria', c)).toEqual([]);
    expect(almacen.librerias.size).toBe(0);
    expect(almacen.bitacora[0]).toMatchObject({ resultado: 'rechazado', motivo: 'formato_invalido', objeto: 'libreria:archivo' });
  });

  it('un archivo que no es texto (un PDF) se rechaza como tipo no permitido', async () => {
    const r = await subir(await tA(), formulario(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xfe])));
    expect(await cuerpo(r)).toMatchObject({ estado: 'rechazada', motivo: 'tipo_no_permitido' });
  });

  it('el código sin el prefijo propia- se rechaza', async () => {
    const r = await subir(await tA(), formulario(YAML().replace('propia-api', 'mi-norma')));
    expect(await cuerpo(r)).toMatchObject({ estado: 'rechazada', motivo: 'codigo_no_permitido' });
  });

  describe('orden de evaluación 401 → 403 → 400/413', () => {
    it('sin token: 401', async () => problema(await subir(undefined), 401, 'no_autenticado'));

    it('un colaborador recibe 403 siempre (con archivo bueno, con basura o sin archivo) y queda UN acceso.denegado por intento', async () => {
      for (const f of [formulario(YAML()), formulario(new Uint8Array(TAMANO_MAX_LIBRERIA + 100)), new FormData()]) {
        bitacora.estado.eventos = [];
        await problema(await subir(await tColab(), f), 403, 'sin_permiso');
        expect(bitacora.estado.eventos).toMatchObject([{ accion: 'acceso.denegado', resultado: 'rechazado', motivo: 'sin_permiso', objeto: 'accion:normas.cargar' }]);
      }
      expect(almacen.librerias.size).toBe(0);
    });

    it('sin archivo: 400', async () => problema(await subir(await tA(), new FormData()), 400, 'parametro_invalido'));

    it('con un campo de texto de más (por ejemplo, una empresa): 400, y no se guarda nada', async () => {
      const f = formulario(YAML());
      f.append('empresa', B);
      const r = await subir(await tA(), f);
      expect(r.status).toBe(400);
      expect(almacen.librerias.size).toBe(0);
    });

    it('con más de un archivo: no se guarda nada', async () => {
      const f = formulario(YAML());
      f.append('archivo', new Blob([YAML()]), 'otra.yaml');
      const r = await subir(await tA(), f);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(almacen.librerias.size).toBe(0);
    });

    it('más de 1 MB: 413, sin guardar nada', async () => {
      const r = await subir(await tA(), formulario(new Uint8Array(TAMANO_MAX_LIBRERIA + 1).fill(97)));
      await problema(r, 413, 'archivo_demasiado_grande');
      expect(almacen.librerias.size).toBe(0);
    });
  });

  it('un archivo de exactamente 1 MB entra a la validación (no es 413)', async () => {
    const r = await subir(await tA(), formulario(new Uint8Array(TAMANO_MAX_LIBRERIA).fill(97)));
    expect(r.status).toBe(200);
    expect(await cuerpo(r)).toMatchObject({ estado: 'rechazada', motivo: 'formato_invalido' });
  });

  describe('aislamiento entre empresas', () => {
    it('la misma librería en A y en B son dos librerías; lo de A no afecta a B', async () => {
      expect((await subir(await tA())).status).toBe(201);
      expect((await subir(await tB())).status).toBe(201); // B no ve que A ya la tiene
      expect(almacen.librerias.size).toBe(2);
      expect([...almacen.librerias.keys()].map((k) => k.split('|')[0]).sort()).toEqual([A, B].sort());
    });
    it('un token de B no puede escribir en A: la empresa sale solo del token', async () => {
      await subir(await tB());
      expect([...almacen.librerias.keys()].every((k) => k.startsWith(`${B}|`))).toBe(true);
    });
  });

  it('si la bitácora falla, responde 500 y no queda la librería', async () => {
    almacen.falloBitacora = true;
    const r = await subir(await tA());
    expect(r.status).toBe(500);
    expect(almacen.librerias.size).toBe(0);
  });
});
