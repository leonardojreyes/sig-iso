import { describe, expect, it } from 'vitest';
import { clonar, entrada, libreriaValida } from './prueba/fixtures';
import { validarLibreria, type ErrorLibreria } from './validar';

type Obj = Record<string, unknown>;
/** Un caso inválido: nombre, cómo estropear el objeto, ruta esperada y código esperado. */
type Caso = [nombre: string, estropear: (objeto: Obj) => void, ruta: string, codigo: string];
const con = (cambio: (l: Obj) => void): unknown => {
  const l = clonar(libreriaValida());
  cambio(l);
  return l;
};
const codigos = (datos: unknown): readonly ErrorLibreria[] => {
  const r = validarLibreria(datos);
  return r.ok ? [] : r.errores;
};
const rechaza = (datos: unknown, ruta?: string, codigo?: string) => {
  const e = codigos(datos);
  expect(e.length, 'debía rechazarse').toBeGreaterThan(0);
  if (ruta) expect(e.map((x) => x.ruta)).toContain(ruta);
  if (codigo) expect(e.map((x) => x.codigo)).toContain(codigo);
};

describe('librerías válidas', () => {
  it('acepta la librería sintética y la devuelve tipada', () => {
    const r = validarLibreria(libreriaValida());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.libreria.codigo).toBe('prueba-sintetica');
      expect(r.libreria.entradas).toHaveLength(2);
      expect(r.libreria.entradas[1]?.aplica_a.map((a) => a.clausula)).toEqual(['10.3', '10.1']);
    }
  });

  it('acepta los valores límite', () => {
    const l = con((l) => {
      Object.assign(entrada(l), { capitulo: 10, nivel: 2, titulo: 'x'.repeat(80), guia: 'y'.repeat(280), id: 'a'.repeat(41) });
      Object.assign(entrada(l, 1), { capitulo: 4, titulo: 'xx', guia: 'y'.repeat(10) });
      l.codigo = 'a'.repeat(64);
      l.nombre = 'n'.repeat(120);
      l.fuente = 'f'.repeat(200);
    });
    expect(validarLibreria(l).ok).toBe(true);
  });

  it('acepta cada alcance común', () => {
    for (const alcance of ['comun', 'parcial', 'especifico']) expect(validarLibreria(con((l) => (entrada(l).alcance_comun = alcance))).ok).toBe(true);
  });
});

describe('estructura de la librería', () => {
  it.each([null, undefined, 'texto', 42, []])('rechaza algo que no es un objeto: %j', (v) => rechaza(v));

  it.each<Caso>([
    ['sin esquema', (l: Obj) => delete l.esquema, 'esquema', 'campo_obligatorio'],
    ['esquema 1', (l: Obj) => (l.esquema = 1), 'esquema', 'esquema_no_soportado'],
    ['esquema 3', (l: Obj) => (l.esquema = 3), 'esquema', 'esquema_no_soportado'],
    ['código con mayúsculas', (l: Obj) => (l.codigo = 'Prueba'), 'codigo', 'formato_invalido'],
    ['código con espacios', (l: Obj) => (l.codigo = 'prueba sintetica'), 'codigo', 'formato_invalido'],
    ['código demasiado largo', (l: Obj) => (l.codigo = 'a'.repeat(65)), 'codigo', 'demasiado_largo'],
    ['sin código', (l: Obj) => delete l.codigo, 'codigo', 'campo_obligatorio'],
    ['nombre vacío', (l: Obj) => (l.nombre = ''), 'nombre', 'demasiado_corto'],
    ['nombre demasiado largo', (l: Obj) => (l.nombre = 'n'.repeat(121)), 'nombre', 'demasiado_largo'],
    ['versión sin patch', (l: Obj) => (l.version = '1.0'), 'version', 'formato_invalido'],
    ['versión con v', (l: Obj) => (l.version = 'v1.0.0'), 'version', 'formato_invalido'],
    ['sin versión', (l: Obj) => delete l.version, 'version', 'campo_obligatorio'],
    ['es_ejemplo como texto', (l: Obj) => (l.es_ejemplo = 'si'), 'es_ejemplo', 'tipo_incorrecto'],
    ['sin es_ejemplo', (l: Obj) => delete l.es_ejemplo, 'es_ejemplo', 'campo_obligatorio'],
    ['sin fuente', (l: Obj) => delete l.fuente, 'fuente', 'campo_obligatorio'],
    ['fuente vacía', (l: Obj) => (l.fuente = ''), 'fuente', 'demasiado_corto'],
    ['fuente demasiado larga', (l: Obj) => (l.fuente = 'f'.repeat(201)), 'fuente', 'demasiado_largo'],
    ['sin referencias', (l: Obj) => delete l.referencias, 'referencias', 'campo_obligatorio'],
    ['referencias vacías', (l: Obj) => (l.referencias = []), 'referencias', 'lista_vacia'],
    ['referencia con edición mal formada', (l: Obj) => ((l.referencias as Obj[])[0]!.edicion = '15'), 'referencias[0].edicion', 'formato_invalido'],
    ['referencia sin norma', (l: Obj) => delete (l.referencias as Obj[])[0]!.norma, 'referencias[0].norma', 'campo_obligatorio'],
    ['sin entradas', (l: Obj) => delete l.entradas, 'entradas', 'campo_obligatorio'],
    ['entradas vacías', (l: Obj) => (l.entradas = []), 'entradas', 'lista_vacia'],
    ['campo desconocido en la librería', (l: Obj) => (l.licencia = 'x'), '', 'campo_desconocido'],
  ])('rechaza: %s', (_n, cambio, ruta, codigo) => {
    rechaza(con(cambio), ruta || undefined, codigo);
  });
});

describe('entradas', () => {
  it.each<Caso>([
    ['id con mayúsculas', (e: Obj) => (e.id = 'HA-4.1'), 'entradas[0].id', 'formato_invalido'],
    ['id con espacios', (e: Obj) => (e.id = 'ha 4.1'), 'entradas[0].id', 'formato_invalido'],
    ['id demasiado largo', (e: Obj) => (e.id = 'a'.repeat(42)), 'entradas[0].id', 'formato_invalido'],
    ['sin id', (e: Obj) => delete e.id, 'entradas[0].id', 'campo_obligatorio'],
    ['capítulo 3', (e: Obj) => (e.capitulo = 3), 'entradas[0].capitulo', 'fuera_de_rango'],
    ['capítulo 11', (e: Obj) => (e.capitulo = 11), 'entradas[0].capitulo', 'fuera_de_rango'],
    ['capítulo decimal', (e: Obj) => (e.capitulo = 5.5), 'entradas[0].capitulo', 'tipo_incorrecto'],
    ['capítulo como texto', (e: Obj) => (e.capitulo = '5'), 'entradas[0].capitulo', 'tipo_incorrecto'],
    ['nivel 3', (e: Obj) => (e.nivel = 3), 'entradas[0].nivel', 'valor_no_permitido'],
    ['título de un carácter', (e: Obj) => (e.titulo = 'x'), 'entradas[0].titulo', 'demasiado_corto'],
    ['título de 81 caracteres', (e: Obj) => (e.titulo = 'x'.repeat(81)), 'entradas[0].titulo', 'demasiado_largo'],
    ['guía de 9 caracteres', (e: Obj) => (e.guia = 'x'.repeat(9)), 'entradas[0].guia', 'demasiado_corto'],
    ['guía de 281 caracteres', (e: Obj) => (e.guia = 'x'.repeat(281)), 'entradas[0].guia', 'demasiado_largo'],
    ['guía de 600 caracteres (límite del esquema v1)', (e: Obj) => (e.guia = 'x'.repeat(600)), 'entradas[0].guia', 'demasiado_largo'],
    ['sin guía', (e: Obj) => delete e.guia, 'entradas[0].guia', 'campo_obligatorio'],
    ['alcance desconocido', (e: Obj) => (e.alcance_comun = 'otro'), 'entradas[0].alcance_comun', 'valor_no_permitido'],
    ['sin alcance', (e: Obj) => delete e.alcance_comun, 'entradas[0].alcance_comun', 'campo_obligatorio'],
    ['sin aplica_a', (e: Obj) => delete e.aplica_a, 'entradas[0].aplica_a', 'campo_obligatorio'],
    ['aplica_a vacío', (e: Obj) => (e.aplica_a = []), 'entradas[0].aplica_a', 'lista_vacia'],
    ['aplica_a con edición mal formada', (e: Obj) => ((e.aplica_a as Obj[])[0]!.edicion = 'abcd'), 'entradas[0].aplica_a[0].edicion', 'formato_invalido'],
    ['aplica_a con cláusula mal formada', (e: Obj) => ((e.aplica_a as Obj[])[0]!.clausula = '4..1'), 'entradas[0].aplica_a[0].clausula', 'formato_invalido'],
    ['aplica_a sin cláusula', (e: Obj) => delete (e.aplica_a as Obj[])[0]!.clausula, 'entradas[0].aplica_a[0].clausula', 'campo_obligatorio'],
    ['campo desconocido en la entrada', (e: Obj) => (e.mapeos = []), 'entradas[0]', 'campo_desconocido'],
    ['campo desconocido en aplica_a', (e: Obj) => ((e.aplica_a as Obj[])[0]!.texto = 'x'), 'entradas[0].aplica_a[0]', 'campo_desconocido'],
  ])('rechaza: %s', (_n, cambio, ruta, codigo) => {
    rechaza(
      con((l) => cambio(entrada(l))),
      ruta,
      codigo,
    );
  });

  it('señala la entrada afectada por su identificador y su posición', () => {
    const e = codigos(con((l) => (entrada(l, 1).guia = 'x'.repeat(300))));
    expect(e).toEqual([{ entrada: 'ha-mejora', indice: 1, ruta: 'entradas[1].guia', codigo: 'demasiado_largo' }]);
  });
});

describe('reglas entre campos', () => {
  it('rechaza dos entradas con el mismo id', () => {
    rechaza(con((l) => (entrada(l, 1).id = 'ha-4.1')), 'entradas[1].id', 'id_repetido');
  });

  it('rechaza referencias repetidas', () => {
    rechaza(con((l) => (l.referencias as Obj[]).push({ norma: 'Norma A', edicion: '2015' })), 'referencias[2]', 'referencia_repetida');
  });

  it('rechaza una entrada que se refiere a una norma no declarada en referencias', () => {
    rechaza(con((l) => ((entrada(l).aplica_a as Obj[])[0]!.norma = 'Norma Z')), 'entradas[0].aplica_a[0]', 'norma_no_declarada');
  });

  it('rechaza una edición no declarada para esa norma', () => {
    rechaza(con((l) => ((entrada(l).aplica_a as Obj[])[0]!.edicion = '1999')), 'entradas[0].aplica_a[0]', 'norma_no_declarada');
  });

  it('rechaza dos cláusulas de la misma norma y edición dentro de una entrada', () => {
    rechaza(con((l) => (entrada(l).aplica_a as Obj[]).push({ norma: 'Norma A', edicion: '2015', clausula: '4.9' })), 'entradas[0].aplica_a[2]', 'aplica_a_repetido');
  });

  it('las reglas entre campos no se evalúan si la estructura ya falla (no se mezclan errores)', () => {
    const e = codigos(con((l) => ((entrada(l).aplica_a as Obj[])[0]!.edicion = 'x')));
    expect(e.map((x) => x.codigo)).toEqual(['formato_invalido']);
  });
});

describe('los errores no repiten el contenido recibido', () => {
  const secreto = 'ana.perez@example.test';

  it('no incluyen valores, ni nombres de campos desconocidos, ni identificadores mal formados', () => {
    const l = con((l) => {
      l[secreto] = 'x';
      entrada(l).id = secreto;
      entrada(l).guia = secreto.repeat(20);
      entrada(l, 1).titulo = secreto.repeat(20);
      l.fuente = secreto.repeat(20);
    });
    const e = codigos(l);
    expect(e.length).toBeGreaterThanOrEqual(4);
    const texto = JSON.stringify(e);
    expect(texto).not.toContain('ana.perez');
    expect(texto).not.toContain('example.test');
  });

  it('para una entrada con id mal formado no se nombra el id (solo su posición)', () => {
    const e = codigos(con((l) => (entrada(l).id = secreto)));
    expect(e[0]).toMatchObject({ entrada: null, indice: 0, ruta: 'entradas[0].id' });
  });

  it('informa todos los problemas a la vez, no solo el primero', () => {
    const e = codigos(
      con((l) => {
        delete l.fuente;
        entrada(l).capitulo = 99;
        entrada(l, 1).guia = 'x';
      }),
    );
    expect(e.map((x) => x.ruta).sort()).toEqual(['entradas[0].capitulo', 'entradas[1].guia', 'fuente']);
  });
});
