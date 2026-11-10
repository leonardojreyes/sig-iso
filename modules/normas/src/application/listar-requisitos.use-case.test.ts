import { EmpresaIdInvalidoError } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { AdopcionLibreria } from '../domain/adopcion-libreria.js';
import { ErrorNormas } from '../domain/errores.js';
import { ListarRequisitosUseCase } from './listar-requisitos.use-case.js';
import { ParametroInvalidoError } from './parametro-invalido.error.js';
import { A, B, E, entrada, LIB1, LIB2, libreria1, libreria2, USUARIO } from './prueba/datos.js';
import { crearUnidadDeTrabajoFalsa, EstadoFalso } from './prueba/fakes.js';

const montar = () => {
  const estado = new EstadoFalso(null, 0);
  estado.librerias = [libreria1, libreria2];
  // Se guardan desordenadas a propósito: el orden lo impone el caso de uso.
  estado.entradasCatalogo = [E.mejora, E.otra, E.contexto, E.riesgos, E.liderazgo];
  return { estado, caso: new ListarRequisitosUseCase(crearUnidadDeTrabajoFalsa(estado)) };
};
const adoptar = (estado: EstadoFalso, empresaId: typeof A, libreriaId: string) =>
  estado.adopciones.set(`${empresaId}|${libreriaId}`, AdopcionLibreria.crear({ empresaId, libreriaId, usuarioId: USUARIO, ahora: new Date('2026-11-06T00:00:00Z') }));
const ids = (r: readonly { idEstable: string }[]) => r.map((e) => e.idEstable);

describe('ListarRequisitos — alcance', () => {
  it('sin adopciones devuelve lista vacía (H5.4)', async () => {
    expect(await montar().caso.ejecutar({ empresaId: A })).toEqual([]);
  });

  it('solo incluye entradas de librerías adoptadas, ordenadas por librería y por el orden de la librería', async () => {
    const { caso, estado } = montar();
    adoptar(estado, A, LIB1);
    adoptar(estado, A, LIB2);
    expect(ids(await caso.ejecutar({ empresaId: A }))).toEqual(['ha-otra', 'ha-contexto', 'ha-liderazgo', 'ha-riesgos', 'ha-mejora']);
  });

  it('la forma es la del contrato: sin `orden` ni otros campos internos', async () => {
    const { caso, estado } = montar();
    adoptar(estado, A, LIB1);
    const [primera] = await caso.ejecutar({ empresaId: A });
    expect(Object.keys(primera!).sort()).toEqual(['alcanceComun', 'aplicaA', 'capitulo', 'esEjemplo', 'grupo', 'guia', 'id', 'idEstable', 'libreriaId', 'nivel', 'tipo', 'titulo']);
    expect(primera!.aplicaA).toEqual([{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1' }, { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '4.1' }]);
  });
});

describe('ListarRequisitos — aislamiento (H4.8)', () => {
  it('lo que adopta A no lo ve B', async () => {
    const { caso, estado } = montar();
    adoptar(estado, A, LIB1);
    expect((await caso.ejecutar({ empresaId: A })).length).toBe(4);
    expect(await caso.ejecutar({ empresaId: B })).toEqual([]);
  });

  it('aunque el repositorio no aislara, el caso de uso descarta las de librerías no adoptadas (defensa en profundidad)', async () => {
    const { caso, estado } = montar();
    estado.sinAislamiento = true;
    adoptar(estado, A, LIB2);
    expect(ids(await caso.ejecutar({ empresaId: A }))).toEqual(['ha-otra']);
    expect(await caso.ejecutar({ empresaId: B })).toEqual([]);
  });
});

describe('ListarRequisitos — filtros (H5.2, H5.3)', () => {
  const con = async (filtros: Record<string, unknown>) => {
    const { caso, estado } = montar();
    adoptar(estado, A, LIB1);
    adoptar(estado, A, LIB2);
    return ids(await caso.ejecutar({ empresaId: A, ...filtros } as never));
  };

  it('q busca en el identificador, el título y la cláusula, sin distinguir mayúsculas ni tildes', async () => {
    expect(await con({ q: 'LIDERAZGO' })).toEqual(['ha-liderazgo']);
    expect(await con({ q: 'ha-mejora' })).toEqual(['ha-mejora']);
    expect(await con({ q: 'gestion de riesgos' })).toEqual(['ha-riesgos']);
    expect(await con({ q: 'operación' })).toEqual(['ha-otra']);
    expect(await con({ q: '10.3' })).toEqual(['ha-mejora']);
    expect(await con({ q: '  contexto  ' })).toEqual(['ha-contexto']);
  });

  it('q no admite comodines: se busca como texto literal', async () => {
    for (const q of ['%', '_', 'h_', '%a%', '*', 'a|b', "ha' or '1'='1", 'a\\b']) {
      await expect(con({ q })).rejects.toBeInstanceOf(ParametroInvalidoError);
    }
  });

  it('capitulo filtra por capítulo', async () => {
    expect(await con({ capitulo: 5 })).toEqual(['ha-liderazgo']);
    expect(await con({ capitulo: 10 })).toEqual(['ha-mejora']);
    expect(await con({ capitulo: 7 })).toEqual([]);
  });

  it('norma deja solo las entradas que aplican a esa norma (H5.3)', async () => {
    expect(await con({ norma: 'ISO/IEC 27001' })).toEqual(['ha-contexto', 'ha-riesgos', 'ha-mejora']);
    expect(await con({ norma: 'ISO 9001' })).toEqual(['ha-otra', 'ha-contexto', 'ha-liderazgo', 'ha-mejora']);
    expect(await con({ norma: 'ISO/IEC 42001' })).toEqual([]);
  });

  it('la norma se compara completa, no por parte', async () => {
    expect(await con({ norma: 'ISO' })).toEqual([]);
    expect(await con({ norma: 'iso 9001' })).toEqual([]);
  });

  it('los filtros se combinan con «y»', async () => {
    expect(await con({ norma: 'ISO/IEC 27001', capitulo: 6 })).toEqual(['ha-riesgos']);
    expect(await con({ norma: 'ISO 9001', q: 'mejora' })).toEqual(['ha-mejora']);
    expect(await con({ norma: 'ISO/IEC 27001', capitulo: 5 })).toEqual([]);
  });

  it.each([
    [{ capitulo: 3 }], [{ capitulo: 11 }], [{ capitulo: 4.5 }], [{ capitulo: '4' }], [{ capitulo: Number.NaN }],
    [{ q: '' }], [{ q: 'a'.repeat(81) }], [{ norma: '' }], [{ norma: 'N'.repeat(61) }], [{ norma: 'ISO%' }], [{ norma: '<script>' }],
  ])('rechaza el filtro inválido %j y el error no repite el valor', async (filtro) => {
    const { caso } = montar();
    const error = await caso.ejecutar({ empresaId: A, ...filtro } as never).catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(ParametroInvalidoError);
    expect((error as Error).message).not.toMatch(/script|ISO%|aaaa/);
  });

  it('un filtro inválido se rechaza antes de abrir ninguna unidad', async () => {
    const { caso, estado } = montar();
    await expect(caso.ejecutar({ empresaId: A, capitulo: 99 })).rejects.toBeInstanceOf(ParametroInvalidoError);
    expect(estado.unidades).toEqual([]);
  });
});

describe('ListarRequisitos — límites y errores', () => {
  it('más entradas que el tope del contrato (500) es un error, no un truncado silencioso', async () => {
    const { caso, estado } = montar();
    adoptar(estado, A, LIB1);
    estado.entradasCatalogo = Array.from({ length: 501 }, (_, i) => entrada(i + 1, LIB1));
    await expect(caso.ejecutar({ empresaId: A })).rejects.toThrow(/tope/);
  });

  it('empresa inválida: error de identificador y nada consultado', async () => {
    const { caso, estado } = montar();
    await expect(caso.ejecutar({ empresaId: 'x' as never })).rejects.toBeInstanceOf(EmpresaIdInvalidoError);
    expect(estado.unidades).toEqual([]);
  });

  it('los errores del repositorio se propagan', async () => {
    const { caso, estado } = montar();
    estado.fallos.set('listarEntradas', new Error('base caída'));
    await expect(caso.ejecutar({ empresaId: A })).rejects.toThrow('base caída');
  });

  it('ErrorNormas no se confunde con un parámetro inválido', () => {
    expect(new ParametroInvalidoError('q')).not.toBeInstanceOf(ErrorNormas);
  });
});

describe('ListarRequisitos — tipo (cláusula o control del Anexo A)', () => {
  const conControl = () => {
    const { caso, estado } = montar();
    const c = entrada(9, LIB1, { idEstable: 'a27-5-1', titulo: 'Políticas de seguridad', tipo: 'control', capitulo: null, grupo: 'Organizacionales', orden: 9, alcanceComun: 'especifico', aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }] });
    estado.entradasCatalogo = [...estado.entradasCatalogo, c];
    adoptar(estado, A, LIB1);
    return caso;
  };

  it('filtra solo controles o solo cláusulas', async () => {
    const caso = conControl();
    expect(ids(await caso.ejecutar({ empresaId: A, tipo: 'control' }))).toEqual(['a27-5-1']);
    expect(ids(await caso.ejecutar({ empresaId: A, tipo: 'clausula' }))).not.toContain('a27-5-1');
  });

  it('un control no coincide con el filtro por capítulo', async () => {
    const caso = conControl();
    expect(ids(await caso.ejecutar({ empresaId: A, capitulo: 4 }))).not.toContain('a27-5-1');
  });

  it('la búsqueda mira también el tema del control', async () => {
    const caso = conControl();
    expect(ids(await caso.ejecutar({ empresaId: A, q: 'organizacionales' }))).toEqual(['a27-5-1']);
  });

  it('rechaza un tipo desconocido', async () => {
    const caso = conControl();
    await expect(caso.ejecutar({ empresaId: A, tipo: 'objetivo' as never })).rejects.toBeInstanceOf(ParametroInvalidoError);
  });
});
