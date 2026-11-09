// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validarEntradas, validarIdentidad, validarLibrerias } from './validadores';

const UUID = '5eed0001-0000-4000-8000-0000000000a1';
const libreria = () => ({
  id: UUID,
  codigo: 'ejemplo-demo',
  nombre: 'Librería de demostración',
  version: '0.1.0',
  esEjemplo: true,
  fuente: 'elaboración propia SynapTech',
  adoptada: false,
});
const entrada = () => ({
  id: UUID,
  idEstable: 'ha-4.1',
  libreriaId: UUID,
  capitulo: 4,
  nivel: 1,
  titulo: 'Contexto',
  guia: 'Texto de guía propio.',
  alcanceComun: 'comun',
  aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1' }],
  esEjemplo: true,
});
const identidad = () => ({
  usuarioId: UUID,
  nombre: 'Persona de prueba',
  roles: ['administrador_sig'],
  empresa: { slug: 'empresa-a', nombre: 'Empresa A' },
});

describe('validarLibrerias', () => {
  it('acepta una lista (también vacía)', () => {
    expect(validarLibrerias([libreria()])).toEqual([libreria()]);
    expect(validarLibrerias([])).toEqual([]);
  });
  it.each([
    ['no es un arreglo', {}],
    ['más de 200 elementos', Array.from({ length: 201 }, libreria)],
    ['campo de más', [{ ...libreria(), otro: 1 }]],
    ['falta un campo', [{ ...libreria(), adoptada: undefined }]],
    ['id no UUID', [{ ...libreria(), id: 'x' }]],
    ['código con mayúsculas', [{ ...libreria(), codigo: 'Demo' }]],
    ['nombre largo', [{ ...libreria(), nombre: 'a'.repeat(121) }]],
    ['versión inválida', [{ ...libreria(), version: '1.0' }]],
    ['esEjemplo no booleano', [{ ...libreria(), esEjemplo: 'si' }]],
    ['fuente larga', [{ ...libreria(), fuente: 'a'.repeat(201) }]],
    ['adoptada no booleano', [{ ...libreria(), adoptada: 1 }]],
    ['un elemento que no es objeto', [null]],
  ])('rechaza: %s', (_n, v) => {
    expect(validarLibrerias(v)).toBeNull();
  });
});

describe('validarEntradas', () => {
  it('acepta una lista (también vacía)', () => {
    expect(validarEntradas([entrada()])).toEqual([entrada()]);
    expect(validarEntradas([])).toEqual([]);
  });
  it.each([
    ['no es un arreglo', 'x'],
    ['más de 500 elementos', Array.from({ length: 501 }, entrada)],
    ['campo de más', [{ ...entrada(), otro: 1 }]],
    ['id no UUID', [{ ...entrada(), id: 'x' }]],
    ['libreriaId no UUID', [{ ...entrada(), libreriaId: 'x' }]],
    ['idEstable inválido', [{ ...entrada(), idEstable: 'HA 4.1' }]],
    ['capítulo por debajo del rango', [{ ...entrada(), capitulo: 3 }]],
    ['capítulo por encima del rango', [{ ...entrada(), capitulo: 11 }]],
    ['capítulo no entero', [{ ...entrada(), capitulo: 4.5 }]],
    ['nivel inválido', [{ ...entrada(), nivel: 3 }]],
    ['título largo', [{ ...entrada(), titulo: 'a'.repeat(81) }]],
    ['guía larga', [{ ...entrada(), guia: 'a'.repeat(281) }]],
    ['alcance desconocido', [{ ...entrada(), alcanceComun: 'todo' }]],
    ['aplicaA vacío', [{ ...entrada(), aplicaA: [] }]],
    [
      'aplicaA con más de 20',
      [{ ...entrada(), aplicaA: Array.from({ length: 21 }, () => ({ norma: 'N', edicion: '2015', clausula: '4.1' })) }],
    ],
    [
      'correspondencia con campo de más',
      [{ ...entrada(), aplicaA: [{ norma: 'N', edicion: '2015', clausula: '4.1', x: 1 }] }],
    ],
    ['edición inválida', [{ ...entrada(), aplicaA: [{ norma: 'N', edicion: '15', clausula: '4.1' }] }]],
    ['cláusula inválida', [{ ...entrada(), aplicaA: [{ norma: 'N', edicion: '2015', clausula: '4..1' }] }]],
    ['norma larga', [{ ...entrada(), aplicaA: [{ norma: 'a'.repeat(61), edicion: '2015', clausula: '4.1' }] }]],
    ['esEjemplo no booleano', [{ ...entrada(), esEjemplo: 'si' }]],
  ])('rechaza: %s', (_n, v) => {
    expect(validarEntradas(v)).toBeNull();
  });
});

describe('validarIdentidad', () => {
  it('acepta la identidad del contrato', () => {
    expect(validarIdentidad(identidad())).toEqual(identidad());
  });
  it.each([
    ['no es un objeto', null],
    ['campo de más', { ...identidad(), otro: 1 }],
    ['usuarioId no UUID', { ...identidad(), usuarioId: 'x' }],
    ['nombre vacío', { ...identidad(), nombre: '' }],
    ['nombre largo', { ...identidad(), nombre: 'a'.repeat(121) }],
    ['sin roles', { ...identidad(), roles: [] }],
    ['rol desconocido', { ...identidad(), roles: ['superadmin'] }],
    ['roles repetidos', { ...identidad(), roles: ['colaborador', 'colaborador'] }],
    [
      'más de 6 roles',
      {
        ...identidad(),
        roles: [
          'administrador_sig',
          'dueno_proceso',
          'auditor_interno',
          'auditor_externo',
          'colaborador',
          'alta_direccion',
          'x',
        ],
      },
    ],
    ['slug inválido', { ...identidad(), empresa: { slug: 'EMPRESA', nombre: 'E' } }],
    ['empresa con campo de más', { ...identidad(), empresa: { slug: 'a', nombre: 'E', id: 'x' } }],
    ['nombre de empresa largo', { ...identidad(), empresa: { slug: 'a', nombre: 'a'.repeat(121) } }],
  ])('rechaza: %s', (_n, v) => {
    expect(validarIdentidad(v)).toBeNull();
  });
});
