// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validarCargaLibreria, validarEmpresasDePersona, validarEntradas, validarIdentidad, validarLibrerias } from './validadores';

const UUID = '5eed0001-0000-4000-8000-0000000000a1';
const libreria = () => ({
  id: UUID,
  codigo: 'ejemplo-demo',
  nombre: 'Librería de demostración',
  version: '0.1.0',
  esEjemplo: true,
  fuente: 'elaboración propia SynapTech',
  propia: false,
  adoptada: false,
});
const entrada = () => ({
  id: UUID,
  idEstable: 'ha-4.1',
  libreriaId: UUID,
  capitulo: 4,
  tipo: 'clausula',
  grupo: null,
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
    ['propia no booleano', [{ ...libreria(), propia: 'no' }]],
    ['sin el campo propia', [Object.fromEntries(Object.entries(libreria()).filter(([k]) => k !== 'propia'))]],
    ['fuente larga', [{ ...libreria(), fuente: 'a'.repeat(201) }]],
    ['adoptada no booleano', [{ ...libreria(), adoptada: 1 }]],
    ['un elemento que no es objeto', [null]],
  ])('rechaza: %s', (_n, v) => {
    expect(validarLibrerias(v)).toBeNull();
  });
});

describe('validarEntradas', () => {
  it('acepta un control del Anexo A: tema en lugar de capítulo', () => {
    const control = { ...entrada(), tipo: 'control', capitulo: null, grupo: 'Organizacionales' };
    expect(validarEntradas([control])).toEqual([control]);
  });
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
    ['cláusula sin capítulo', [{ ...entrada(), capitulo: null }]],
    ['cláusula con tema', [{ ...entrada(), grupo: 'Organizacionales' }]],
    ['control con capítulo', [{ ...entrada(), tipo: 'control', grupo: 'Organizacionales' }]],
    ['control sin tema', [{ ...entrada(), tipo: 'control', capitulo: null }]],
    ['tipo desconocido', [{ ...entrada(), tipo: 'objetivo' }]],
    ['tema demasiado largo', [{ ...entrada(), tipo: 'control', capitulo: null, grupo: 'x'.repeat(61) }]],
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

describe('validarCargaLibreria', () => {
  const H = 'a'.repeat(64);
  const cargada = { estado: 'cargada', motivo: null, codigo: 'propia-x', version: '1.0.0', entradas: 3, huella: H, errores: [] };
  const rechazada = { estado: 'rechazada', motivo: 'formato_invalido', codigo: null, version: null, entradas: null, huella: H, errores: [{ entrada: 'x-4.1', indice: 0, ruta: 'entradas[0].guia', codigo: 'campo_obligatorio' }] };

  it('acepta una librería cargada, una ya cargada y una rechazada', () => {
    expect(validarCargaLibreria(cargada)).toEqual(cargada);
    expect(validarCargaLibreria({ ...cargada, estado: 'ya_cargada' })).not.toBeNull();
    expect(validarCargaLibreria(rechazada)).toEqual(rechazada);
  });
  it.each([
    ['no es un objeto', null],
    ['campo de más', { ...cargada, extra: 1 }],
    ['estado desconocido', { ...cargada, estado: 'quizas' }],
    ['rechazada sin motivo', { ...rechazada, motivo: null }],
    ['cargada con motivo', { ...cargada, motivo: 'formato_invalido' }],
    ['motivo desconocido', { ...rechazada, motivo: 'raro' }],
    ['cargada sin código', { ...cargada, codigo: null }],
    ['cargada con errores', { ...cargada, errores: rechazada.errores }],
    ['código con mayúsculas', { ...cargada, codigo: 'Propia' }],
    ['versión mal formada', { ...cargada, version: '1.0' }],
    ['entradas negativas', { ...cargada, entradas: -1 }],
    ['entradas de más', { ...cargada, entradas: 1001 }],
    ['huella corta', { ...cargada, huella: 'abc' }],
    ['más de 200 errores', { ...rechazada, errores: Array.from({ length: 201 }, () => rechazada.errores[0]) }],
    ['error con campo de más', { ...rechazada, errores: [{ ...rechazada.errores[0], extra: 1 }] }],
    ['error sin código', { ...rechazada, errores: [{ ...rechazada.errores[0], codigo: '' }] }],
    ['índice fuera de rango', { ...rechazada, errores: [{ ...rechazada.errores[0], indice: 1000 }] }],
  ])('rechaza %s', (_n, cuerpo) => expect(validarCargaLibreria(cuerpo)).toBeNull());
});

describe('validarEmpresasDePersona', () => {
  const a = { slug: 'empresa-a', nombre: 'Empresa A', activa: true };
  const b = { slug: 'empresa-b', nombre: 'Empresa B', activa: false };
  it('acepta una lista de empresas de la persona', () => {
    expect(validarEmpresasDePersona([a, b])).toEqual([a, b]);
    expect(validarEmpresasDePersona([])).toEqual([]);
  });
  it.each([
    ['no es una lista', null],
    ['un elemento con campo de más', [{ ...a, extra: 1 }]],
    ['sin el campo activa', [{ slug: 'empresa-a', nombre: 'A' }]],
    ['activa que no es booleano', [{ ...a, activa: 'si' }]],
    ['slug con mayúsculas', [{ ...a, slug: 'EMPRESA-A' }]],
    ['slug vacío', [{ ...a, slug: '' }]],
    ['nombre vacío', [{ ...a, nombre: '' }]],
    ['dos empresas activas', [a, { ...b, activa: true }]],
    ['un slug repetido', [a, { ...b, slug: 'empresa-a' }]],
    ['más de 50 empresas', Array.from({ length: 51 }, (_, i) => ({ slug: `e-${i}`, nombre: 'E', activa: false }))],
  ])('rechaza %s', (_n, cuerpo) => expect(validarEmpresasDePersona(cuerpo)).toBeNull());
});
