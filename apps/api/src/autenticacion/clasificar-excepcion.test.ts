import { BadRequestException, ForbiddenException, HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EmpresaNoEncontradaError, PersonaNoEncontradaError } from '@sig/empresas';
import { ErrorNormas, FuncionDeshabilitadaError, LibreriaNoEncontradaError, ParametroInvalidoError, RequisitoNoEncontradoError, SinPermisoError } from '@sig/normas';
import { describe, expect, it } from 'vitest';
import { clasificarExcepcion } from './clasificar-excepcion.js';
import { AccesoCruzadoException, AccesoDenegadoException } from './excepciones-acceso.js';

describe('clasificarExcepcion', () => {
  it('AccesoDenegadoException → denegado con su objeto', () => {
    expect(clasificarExcepcion(new AccesoDenegadoException('accion:librerias.adoptar'))).toEqual({ tipo: 'denegado', objeto: 'accion:librerias.adoptar' });
    expect(clasificarExcepcion(new AccesoDenegadoException())).toEqual({ tipo: 'denegado', objeto: null });
  });

  it('SinPermisoError del módulo de normas → denegado, con el permiso como objeto', () => {
    expect(clasificarExcepcion(new SinPermisoError('librerias.adoptar'))).toEqual({ tipo: 'denegado', objeto: 'accion:librerias.adoptar' });
  });

  it('un 403 cualquiera (ForbiddenException) también es un acceso denegado', () => {
    expect(clasificarExcepcion(new ForbiddenException('detalle'))).toEqual({ tipo: 'denegado', objeto: null });
    expect(clasificarExcepcion(new HttpException('x', 403))).toEqual({ tipo: 'denegado', objeto: null });
  });

  it('AccesoCruzadoException → cruzado con su objeto', () => {
    expect(clasificarExcepcion(new AccesoCruzadoException('libreria:otra'))).toEqual({ tipo: 'cruzado', objeto: 'libreria:otra' });
    expect(clasificarExcepcion(new AccesoCruzadoException())).toEqual({ tipo: 'cruzado', objeto: null });
  });

  it.each([
    ['«requisito no encontrado» del dominio', new RequisitoNoEncontradoError(), 404],
    ['«librería no encontrada» del dominio', new LibreriaNoEncontradaError(), 404],
    ['función apagada por flag (se presenta como inexistente)', new FuncionDeshabilitadaError(), 404],
    ['404 de Nest', new NotFoundException(), 404],
    ['empresa del token inexistente', new EmpresaNoEncontradaError(), 401],
    ['persona del token que ya no vale en la empresa', new PersonaNoEncontradaError(), 401],
    ['401 de Nest', new UnauthorizedException(), 401],
    ['filtro inválido', new ParametroInvalidoError('q'), 400],
    ['400 de Nest', new BadRequestException(), 400],
    ['otro 4xx de Nest', new HttpException('x', 413), 413],
    ['5xx de Nest', new HttpException('x', 503), 503],
  ])('%s → respuesta normal %i, sin hecho de acceso', (_n, error, estado) => {
    expect(clasificarExcepcion(error)).toEqual({ tipo: 'http', estado });
  });

  it.each([
    ['un Error cualquiera', new Error('x')],
    ['una violación de reglas del dominio al leer datos (no es culpa de quien llama)', new ErrorNormas('guia')],
    ['algo que no es un Error', 'texto'],
    ['null', null],
    ['undefined', undefined],
  ])('%s → 500', (_n, error) => {
    expect(clasificarExcepcion(error)).toEqual({ tipo: 'http', estado: 500 });
  });

  it('las excepciones de acceso son HttpException con el estado que anuncian (por si el filtro no estuviera)', () => {
    expect(new AccesoDenegadoException().getStatus()).toBe(403);
    expect(new AccesoCruzadoException().getStatus()).toBe(404);
  });

  it('las excepciones de acceso no filtran el objeto en su mensaje', () => {
    expect(new AccesoDenegadoException('accion:secreta').message).not.toContain('secreta');
    expect(new AccesoCruzadoException('libreria:secreta').message).not.toContain('secreta');
  });
});
