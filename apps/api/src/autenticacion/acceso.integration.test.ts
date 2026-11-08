import { BadRequestException } from '@nestjs/common';
import { RequisitoNoEncontradoError, SinPermisoError, ParametroInvalidoError } from '@sig/normas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccesoCruzadoException, AccesoDenegadoException } from './excepciones-acceso.js';
import { Publico } from './publico.decorator.js';
import { Controller, ForbiddenException, Get, NotFoundException, crearArnes, hechosEnMemoria, type Arnes } from './prueba/arnes.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USUARIO_A = '44444444-4444-4444-8444-444444444444';

@Controller('prueba')
class AccesoController {
  @Get('denegado') denegado(): never { throw new AccesoDenegadoException('accion:librerias.adoptar'); }
  @Get('denegado-sin-objeto') denegadoSinObjeto(): never { throw new AccesoDenegadoException(); }
  @Get('sin-permiso') sinPermiso(): never { throw new SinPermisoError('librerias.adoptar'); }
  @Get('forbidden') forbidden(): never { throw new ForbiddenException('detalle sensible del 403'); }
  @Get('objeto-malo') objetoMalo(): never { throw new AccesoDenegadoException('NO TIENE FORMATO'); }
  @Get('cruzado') cruzado(): never { throw new AccesoCruzadoException('libreria:otra-empresa'); }
  @Get('normal-404') normal404(): never { throw new NotFoundException('detalle sensible del 404'); }
  @Get('dominio-404') dominio404(): never { throw new RequisitoNoEncontradoError(); }
  @Get('parametro') parametro(): never { throw new ParametroInvalidoError('q'); }
  @Publico() @Get('publico-denegado') publicoDenegado(): never { throw new AccesoDenegadoException('accion:algo'); }
  @Get('mala-peticion') malaPeticion(): never { throw new BadRequestException('detalle sensible del 400'); }
}

describe('filtro de accesos denegados y cruzados (H6.5, H6.8, H6.10)', () => {
  let arnes: Arnes;
  const { estado, hechos } = hechosEnMemoria();
  let token = '';

  beforeAll(async () => {
    arnes = await crearArnes({ controladores: [AccesoController], hechos });
    token = await arnes.firmar(A, USUARIO_A);
  });
  afterAll(async () => { await arnes.cerrar(); });
  beforeEach(() => { estado.eventos = []; estado.falla = false; });

  const problema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const c = (await r.json()) as Record<string, unknown>;
    expect(c).toMatchObject({ type: 'about:blank', status, codigo });
    expect(Object.keys(c).sort()).toEqual(['codigo', 'status', 'title', 'type']);
    return c;
  };

  describe('403: acceso denegado', () => {
    it.each([
      ['AccesoDenegadoException con objeto', '/prueba/denegado', 'accion:librerias.adoptar'],
      ['SinPermisoError del caso de uso', '/prueba/sin-permiso', 'accion:librerias.adoptar'],
      ['ForbiddenException cualquiera', '/prueba/forbidden', undefined],
      ['AccesoDenegadoException sin objeto', '/prueba/denegado-sin-objeto', undefined],
    ])('%s → 403 sin_permiso y UN hecho acceso.denegado', async (_n, ruta, objeto) => {
      const cuerpo = await problema(await arnes.pedir(ruta, token), 403, 'sin_permiso');
      expect(JSON.stringify(cuerpo)).not.toContain('detalle sensible');
      expect(estado.eventos).toEqual([
        { empresaId: A, actor: { tipo: 'usuario', usuarioId: USUARIO_A }, accion: 'acceso.denegado', resultado: 'rechazado', motivo: 'sin_permiso', ...(objeto ? { objeto } : {}) },
      ]);
    });

    it('cada intento deja su propio hecho, también si son simultáneos', async () => {
      await Promise.all(Array.from({ length: 10 }, () => arnes.pedir('/prueba/denegado', token)));
      expect(estado.eventos).toHaveLength(10);
    });

    it('la empresa del hecho es la del token, no la que el cliente diga', async () => {
      await arnes.pedir(`/prueba/denegado?empresa=${B}`, token);
      expect(estado.eventos.map((e) => e.empresaId)).toEqual([A]);
    });

    it('si NO se puede registrar, responde 500 (nunca un 403 sin rastro)', async () => {
      estado.falla = true;
      await problema(await arnes.pedir('/prueba/denegado', token), 500, 'error_interno');
      await problema(await arnes.pedir('/prueba/sin-permiso', token), 500, 'error_interno');
    });

    it('un acceso denegado sin identidad verificada (ruta pública) no se puede registrar: responde 500', async () => {
      await problema(await arnes.pedir('/prueba/publico-denegado'), 500, 'error_interno');
      expect(estado.eventos).toEqual([]);
    });

    it('un objeto con formato inválido hace fallar el registro y, por tanto, responde 500', async () => {
      await problema(await arnes.pedir('/prueba/objeto-malo', token), 500, 'error_interno');
      expect(estado.eventos).toEqual([]);
    });
  });

  describe('404 cruzado: acceso.cruzado', () => {
    it('responde 404 y registra UN hecho acceso.cruzado con motivo empresa_distinta', async () => {
      await problema(await arnes.pedir('/prueba/cruzado', token), 404, 'no_encontrado');
      expect(estado.eventos).toEqual([
        { empresaId: A, actor: { tipo: 'usuario', usuarioId: USUARIO_A }, accion: 'acceso.cruzado', resultado: 'rechazado', motivo: 'empresa_distinta', objeto: 'libreria:otra-empresa' },
      ]);
    });

    it('es IDÉNTICO, byte a byte (cuerpo y cabeceras), al 404 normal', async () => {
      const cruzado = await arnes.pedir('/prueba/cruzado', token);
      const normal = await arnes.pedir('/prueba/normal-404', token);
      const dominio = await arnes.pedir('/prueba/dominio-404', token);
      const inexistente = await arnes.pedir('/no-existe', token);
      const huella = async (r: Response) => {
        const cabeceras = [...r.headers.entries()].filter(([k]) => !['date', 'connection', 'keep-alive'].includes(k)).sort();
        return JSON.stringify({ status: r.status, cabeceras, cuerpo: await r.text() });
      };
      const base = await huella(cruzado);
      for (const otro of [normal, dominio, inexistente]) expect(await huella(otro)).toBe(base);
    });

    it('los 404 normales NO generan hecho de acceso', async () => {
      await arnes.pedir('/prueba/normal-404', token);
      await arnes.pedir('/prueba/dominio-404', token);
      await arnes.pedir('/no-existe', token);
      expect(estado.eventos).toEqual([]);
    });

    it('H6.8 prevalece sobre «no encontrado»: si falla el registro del acceso cruzado, responde 500', async () => {
      estado.falla = true;
      await problema(await arnes.pedir('/prueba/cruzado', token), 500, 'error_interno');
    });
  });

  describe('otros errores', () => {
    it('un parámetro inválido → 400 parametro_invalido, sin hecho y sin repetir detalles', async () => {
      const c = await problema(await arnes.pedir('/prueba/parametro', token), 400, 'parametro_invalido');
      expect(JSON.stringify(c)).not.toContain('q');
      await problema(await arnes.pedir('/prueba/mala-peticion', token), 400, 'parametro_invalido');
      expect(estado.eventos).toEqual([]);
    });
  });
});
