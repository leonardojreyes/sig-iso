// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cargarListado } from './cargar-listado';

const UUID = '5eed0001-0000-4000-8000-0000000000a1';
const libreria = (cambios: Record<string, unknown> = {}) => ({
  id: UUID,
  codigo: 'ejemplo-demo',
  nombre: 'Librería de demostración',
  version: '0.1.0',
  esEjemplo: true,
  fuente: 'elaboración propia SynapTech',
  adoptada: true,
  ...cambios,
});
const entrada = (norma: string, id = 'ha-4.1') => ({
  id: UUID,
  idEstable: id,
  libreriaId: UUID,
  capitulo: 4,
  tipo: 'clausula',
  grupo: null,
  nivel: 1,
  titulo: 'Contexto',
  guia: 'Texto de guía propio.',
  alcanceComun: 'comun',
  aplicaA: [{ norma, edicion: '2015', clausula: '4.1' }],
  esEjemplo: true,
});
const json = (c: unknown, estado = 200) => new Response(JSON.stringify(c), { status: estado });

const cargar = (rutas: Record<string, () => Response>, filtros = {}) => {
  const llamadas: string[] = [];
  const fetchFn = (async (url: string) => {
    const ruta = url.replace('http://127.0.0.1:3001', '');
    llamadas.push(ruta);
    const f = rutas[ruta];
    return f ? f() : new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  return cargarListado({ acceso: 'tok', apiUrl: 'http://127.0.0.1:3001', fetchFn, filtros }).then((r) => ({
    r,
    llamadas,
  }));
};

describe('cargarListado', () => {
  it('sin filtros: una consulta de librerías y una de requisitos; las normas disponibles salen de las entradas, ordenadas y sin repetir', async () => {
    const { r, llamadas } = await cargar({
      '/librerias': () => json([libreria()]),
      '/requisitos': () =>
        json([entrada('ISO/IEC 27001'), entrada('ISO 9001', 'ha-4.2'), entrada('ISO/IEC 27001', 'ha-4.3')]),
    });
    expect(llamadas.sort()).toEqual(['/librerias', '/requisitos']);
    expect(r).toMatchObject({ tipo: 'ok', normasDisponibles: ['ISO 9001', 'ISO/IEC 27001'] });
    if (r.tipo === 'ok') {
      expect(r.librerias).toHaveLength(1);
      expect(r.entradas).toHaveLength(3);
    }
  });

  it('con filtros: pide los requisitos filtrados Y los sin filtrar (solo para poblar la lista de normas)', async () => {
    const { r, llamadas } = await cargar(
      {
        '/librerias': () => json([libreria()]),
        '/requisitos?q=contexto&capitulo=4&norma=ISO+9001': () => json([entrada('ISO 9001')]),
        '/requisitos': () => json([entrada('ISO 9001'), entrada('ISO/IEC 27001', 'ha-4.2')]),
      },
      { q: 'contexto', capitulo: 4, norma: 'ISO 9001' },
    );
    expect(llamadas.sort()).toEqual(
      ['/librerias', '/requisitos', '/requisitos?q=contexto&capitulo=4&norma=ISO+9001'].sort(),
    );
    expect(r).toMatchObject({ tipo: 'ok', normasDisponibles: ['ISO 9001', 'ISO/IEC 27001'] });
    if (r.tipo === 'ok') expect(r.entradas).toHaveLength(1);
  });

  it('sin librerías adoptadas no pide requisitos (y la lista queda vacía)', async () => {
    const { r, llamadas } = await cargar({ '/librerias': () => json([libreria({ adoptada: false })]) });
    expect(llamadas).toEqual(['/librerias']);
    expect(r).toMatchObject({ tipo: 'ok', entradas: [], normasDisponibles: [] });
  });

  it('401 en cualquiera de las consultas: ingresar', async () => {
    expect((await cargar({ '/librerias': () => json({}, 401), '/requisitos': () => json([]) })).r).toEqual({
      tipo: 'ingresar',
    });
    expect((await cargar({ '/librerias': () => json([libreria()]), '/requisitos': () => json({}, 401) })).r).toEqual({
      tipo: 'ingresar',
    });
  });

  it.each([
    ['librerías con 500', { '/librerias': () => json({}, 500), '/requisitos': () => json([]) }],
    ['requisitos con 500', { '/librerias': () => json([libreria()]), '/requisitos': () => json({}, 500) }],
    [
      'librerías con forma inválida',
      { '/librerias': () => json([{ ...libreria(), extra: 1 }]), '/requisitos': () => json([]) },
    ],
    [
      'requisitos con forma inválida',
      { '/librerias': () => json([libreria()]), '/requisitos': () => json([{ ...entrada('N'), extra: 1 }]) },
    ],
    ['requisitos con 429', { '/librerias': () => json([libreria()]), '/requisitos': () => json({}, 429) }],
  ])('no disponible (nunca una lista a medias): %s', async (_n, rutas) => {
    expect((await cargar(rutas)).r).toEqual({ tipo: 'no_disponible' });
  });

  it('un filtro que no devuelve nada deja la lista vacía pero conserva las normas disponibles', async () => {
    const { r } = await cargar(
      {
        '/librerias': () => json([libreria()]),
        '/requisitos?q=zzz': () => json([]),
        '/requisitos': () => json([entrada('ISO 9001')]),
      },
      { q: 'zzz' },
    );
    expect(r).toMatchObject({ tipo: 'ok', entradas: [], normasDisponibles: ['ISO 9001'] });
  });
});
