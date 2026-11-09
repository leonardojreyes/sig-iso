import { describe, expect, it } from 'vitest';
import esquema from '../libreria-norma.schema.json' with { type: 'json' };
import { contarFrases, detectarTextoNormativo, LIMITES, revisarContenido, revisarRespuestaIa, revisarTexto, type CodigoContenido } from './contenido';

// TODOS los textos de esta prueba son sintéticos: frases genéricas inventadas, ninguna tomada de una norma.
const codigos = (campo: 'titulo' | 'guia', texto: string): CodigoContenido[] => revisarTexto(campo, texto);
const GUIA_BUENA = 'Define qué áreas cubre el sistema y qué queda fuera. Mantén ese registro actualizado.';

describe('límites', () => {
  it('coinciden con los del esquema JSON (una sola fuente de verdad en la práctica)', () => {
    const p = esquema.properties.entradas.items.properties;
    expect([p.titulo.minLength, p.titulo.maxLength, p.guia.minLength, p.guia.maxLength]).toEqual([LIMITES.tituloMin, LIMITES.tituloMax, LIMITES.guiaMin, LIMITES.guiaMax]);
  });
});

describe('contarFrases', () => {
  it.each([
    ['', 0],
    ['   \n ', 0],
    ['Una sola frase.', 1],
    ['Sin punto final', 1],
    ['Una frase. Otra frase.', 2],
    ['Una. Dos. Tres.', 3],
    ['¿Qué incluye? Todo lo anterior.', 2],
    ['¡Atención! Revise esto.', 2],
    ['Una frase.\nOtra frase en otra línea.', 2],
    ['Y así sigue... hasta aquí.', 2],
  ])('cuenta las frases de %j: %i', (texto, esperado) => {
    expect(contarFrases(texto)).toBe(esperado);
  });

  it('no cuenta como frases los números con punto ni los identificadores de cláusula', () => {
    expect(contarFrases('Revisa la cláusula 4.1 y la 10.2.3 cada año.')).toBe(1);
    expect(contarFrases('Versión 2.5 del documento. Revísala.')).toBe(2);
  });

  it('no cuenta como frases las abreviaturas habituales', () => {
    expect(contarFrases('Incluye, p. ej. actas y registros, lo necesario.')).toBe(1);
    expect(contarFrases('Reúne actas, registros, etc. Guárdalos.')).toBe(2);
    expect(contarFrases('Lo aprueba el Ing. Pérez cada año.')).toBe(1);
  });
});

describe('guía: lo que sí pasa', () => {
  it.each([
    GUIA_BUENA,
    'Identifica quién tiene expectativas sobre el sistema. Revísalo cuando cambie el contexto.',
    'Asigna por escrito quién responde por cada parte del sistema.',
    'Debe estar documentado y coincidir con lo que se certificará.',
    'Fija objetivos medibles y define quién los mide, cuándo y cómo, para que el seguimiento no dependa de una sola persona.',
    'x'.repeat(10) + '.',
  ])('acepta: %s', (texto) => {
    expect(codigos('guia', texto)).toEqual([]);
  });
});

describe('guía: longitud y frases', () => {
  it('rechaza una guía de más de 280 caracteres', () => {
    expect(codigos('guia', `${'a'.repeat(140)}. ${'b'.repeat(140)}.`)).toContain('guia_demasiado_larga');
  });
  it('acepta exactamente 280 caracteres y rechaza 281', () => {
    expect(codigos('guia', `${'a'.repeat(279)}.`)).not.toContain('guia_demasiado_larga');
    expect(codigos('guia', `${'a'.repeat(280)}.`)).toContain('guia_demasiado_larga');
  });
  it('rechaza una guía de menos de 10 caracteres', () => {
    expect(codigos('guia', 'Corto.')).toContain('guia_demasiado_corta');
  });
  it('rechaza más de 2 frases', () => {
    expect(codigos('guia', 'Primera frase. Segunda frase. Tercera frase.')).toContain('guia_demasiadas_frases');
  });
  it('acepta 1 y 2 frases', () => {
    expect(codigos('guia', 'Una frase suficientemente larga.')).toEqual([]);
    expect(codigos('guia', 'Una frase suficientemente larga. Y otra más.')).toEqual([]);
  });
  it('rechaza una sola frase interminable, típica del lenguaje legal', () => {
    const larga = `Esto describe ${'algo muy específico y detallado que se debe tener presente '.repeat(3).trim()} sin parar y sin que nadie lo detenga`;
    expect(larga.length).toBeGreaterThan(200);
    expect(larga.length).toBeLessThanOrEqual(280);
    expect(codigos('guia', larga)).toContain('frase_demasiado_larga');
  });
});

describe('guía: tono normativo (estructura, no frases de una norma)', () => {
  it.each([
    'La organización debe hacer esto y aquello con regularidad.',
    'La alta dirección debe demostrar compromiso con el sistema.',
    'Las organizaciones deberán mantener esta información.',
    'El personal deberá conocer su función.',
  ])('rechaza un sujeto institucional con "deber": %s', (texto) => {
    expect(codigos('guia', texto)).toContain('tono_normativo');
  });

  it('rechaza varias obligaciones en una misma guía', () => {
    expect(codigos('guia', 'Esto debe estar hecho. Aquello debe estar firmado.')).toContain('tono_normativo');
    expect(codigos('guia', 'Se requiere un registro. Es necesario que alguien lo revise.')).toContain('tono_normativo');
  });

  it('rechaza el modal en inglés', () => {
    expect(codigos('guia', 'The thing shall be recorded in the register.')).toContain('tono_normativo');
  });

  it('no penaliza una sola obligación sin sujeto institucional', () => {
    expect(codigos('guia', 'Debe estar documentado y coincidir con lo que se certificará.')).not.toContain('tono_normativo');
  });

  it('no confunde palabras que solo contienen la raíz', () => {
    expect(codigos('guia', 'Revisa el deber de reserva y los deberes de cada rol del equipo.')).not.toContain('tono_normativo');
  });
});

describe('guía y título: citas, listas, enlaces', () => {
  it('rechaza una cita textual larga y acepta una breve', () => {
    expect(codigos('guia', `Dice así: «${'texto citado que ocupa bastante espacio '.repeat(2).trim()}» y sigue.`)).toContain('cita_textual');
    expect(codigos('guia', 'Se suele llamar "alcance" a este límite del sistema.')).not.toContain('cita_textual');
  });

  it.each(['"', '“'])('detecta citas con comillas %s', (abre) => {
    const cierra = abre === '"' ? '"' : '”';
    expect(codigos('guia', `Dice así: ${abre}${'texto citado que ocupa bastante espacio '.repeat(2).trim()}${cierra} y sigue.`)).toContain('cita_textual');
  });

  it('rechaza el formato de lista de las normas: a), b), c), viñetas, saltos de línea y muchos punto y coma', () => {
    expect(codigos('guia', 'Incluye: a) esto, b) aquello, c) lo otro.')).toContain('formato_de_lista');
    expect(codigos('guia', 'Incluye:\n- esto\n- aquello')).toContain('formato_de_lista');
    expect(codigos('guia', 'Primera línea.\nSegunda línea.')).toContain('formato_de_lista');
    expect(codigos('guia', 'Esto; aquello; lo otro; y además esto otro.')).toContain('formato_de_lista');
    expect(codigos('guia', 'Una opción a) o la otra.')).not.toContain('formato_de_lista');
  });

  it.each(['Escribe a ana@example.test para más información.', 'Consulta https://ejemplo.test/norma ahora mismo.', 'Mira www.ejemplo.test hoy mismo.'])('rechaza correos y enlaces: %s', (texto) => {
    expect(codigos('guia', texto)).toContain('enlace_o_correo');
  });
});

describe('título', () => {
  it('acepta un título breve', () => {
    expect(codigos('titulo', 'Contexto del sistema')).toEqual([]);
  });
  it('rechaza más de 80 caracteres y menos de 2', () => {
    expect(codigos('titulo', 'x'.repeat(81))).toContain('titulo_demasiado_largo');
    expect(codigos('titulo', 'x'.repeat(80))).not.toContain('titulo_demasiado_largo');
    expect(codigos('titulo', 'x')).toContain('titulo_demasiado_corto');
  });
  it('rechaza saltos de línea y correos', () => {
    expect(codigos('titulo', 'Dos\nlíneas')).toContain('formato_de_lista');
    expect(codigos('titulo', 'Contacto ana@example.test')).toContain('enlace_o_correo');
  });
  it('un título no está sujeto a las reglas de frases ni de tono', () => {
    expect(codigos('titulo', 'La organización debe cambiar')).toEqual([]);
    expect(codigos('titulo', 'Uno. Dos. Tres. Cuatro')).toEqual([]);
  });
});

describe('revisarTexto en general', () => {
  it('acumula todos los problemas y no repite códigos', () => {
    const c = codigos('guia', 'La organización debe esto. Y esto otro. Y un tercero: a) uno, b) dos. Escribe a ana@example.test.');
    expect(new Set(c).size).toBe(c.length);
    expect(c).toEqual(expect.arrayContaining(['guia_demasiadas_frases', 'tono_normativo', 'formato_de_lista', 'enlace_o_correo']));
  });

  it('es determinista y no tiene estado entre llamadas', () => {
    const texto = 'La organización debe esto. Y esto otro. Y un tercero.';
    expect(codigos('guia', texto)).toEqual(codigos('guia', texto));
  });
});

describe('revisarContenido', () => {
  const entradas = [
    { id: 'ha-4.1', titulo: 'Contexto del sistema', guia: GUIA_BUENA },
    { id: 'ha-4.2', titulo: 'Partes interesadas', guia: 'Primera. Segunda. Tercera frase aquí.' },
    { id: 'ha-4.3', titulo: 'x'.repeat(90), guia: 'La organización debe esto.' },
  ];

  it('no devuelve nada si todo cumple', () => {
    expect(revisarContenido({ entradas: [entradas[0]!] })).toEqual([]);
  });

  it('indica entrada, posición, campo y código de cada hallazgo', () => {
    const h = revisarContenido({ entradas });
    expect(h).toContainEqual({ entrada: 'ha-4.2', indice: 1, campo: 'guia', codigo: 'guia_demasiadas_frases' });
    expect(h).toContainEqual({ entrada: 'ha-4.3', indice: 2, campo: 'titulo', codigo: 'titulo_demasiado_largo' });
    expect(h).toContainEqual({ entrada: 'ha-4.3', indice: 2, campo: 'guia', codigo: 'tono_normativo' });
    expect(h.some((x) => x.indice === 0)).toBe(false);
  });

  it('no repite nunca el contenido revisado', () => {
    const secreto = 'ana.perez@example.test';
    const h = revisarContenido({ entradas: [{ id: 'ha-1', titulo: `Contacto ${secreto}`, guia: `Escribe a ${secreto} para más información sobre esto.` }] });
    expect(h.length).toBeGreaterThan(0);
    expect(JSON.stringify(h)).not.toContain('ana.perez');
  });

  it('no modifica lo recibido', () => {
    const copia = JSON.parse(JSON.stringify(entradas));
    revisarContenido({ entradas });
    expect(entradas).toEqual(copia);
  });
});

// Respuestas de IA (paso 0.7): mismos detectores de texto copiado de una norma, SIN los límites de largo, de frases ni de formato
// que son propios de las guías breves de una librería. Textos sintéticos.
const RESPUESTA_LARGA_LIMPIA = [
  'Una práctica habitual es conservar el registro de las áreas que cubre el sistema y de lo que queda fuera.',
  'Suele servir una lista de procesos con su responsable, revisada cada vez que cambia la organización.',
  'Puede servir un mapa simple que muestre qué se incluye. También ayuda guardar la fecha de la última revisión.',
  'Otra opción es anexar un resumen de las conversaciones con las personas que usan el sistema cada día.',
].join(' ');

describe('detectarTextoNormativo (detector común)', () => {
  it('devuelve vacío para un texto sin señales de texto normativo', () => {
    expect(detectarTextoNormativo(GUIA_BUENA)).toEqual([]);
    expect(detectarTextoNormativo(RESPUESTA_LARGA_LIMPIA)).toEqual([]);
  });

  it('detecta tono normativo, cita larga y enlace, y solo esos códigos', () => {
    expect(detectarTextoNormativo('La organización debe registrar sus cambios.')).toEqual(['tono_normativo']);
    expect(detectarTextoNormativo('Se explica así: «' + 'x'.repeat(LIMITES.citaMin) + '» en la práctica.')).toEqual(['cita_textual']);
    expect(detectarTextoNormativo('Más información en https://ejemplo.test')).toEqual(['enlace_o_correo']);
  });

  it('no aplica límites de largo ni de formato', () => {
    const codigosEncontrados = detectarTextoNormativo(RESPUESTA_LARGA_LIMPIA + '\n- uno\n- dos; tres; cuatro; cinco');
    expect(codigosEncontrados).toEqual([]);
  });

  it('NUNCA repite el texto revisado', () => {
    const secreto = 'ZZZ-contenido-que-no-debe-aparecer';
    const salida = JSON.stringify(detectarTextoNormativo('La organización debe ' + secreto));
    expect(salida).not.toContain(secreto);
  });
});

describe('revisarRespuestaIa', () => {
  it('acepta una respuesta larga, con lista, sin señales de texto normativo (no aplican los límites de las guías)', () => {
    expect(revisarRespuestaIa(RESPUESTA_LARGA_LIMPIA)).toEqual([]);
    expect(revisarRespuestaIa('Ejemplos posibles:\n- Un registro de áreas.\n- Un mapa de procesos.\n- Una lista de responsables.')).toEqual([]);
  });

  it.each([
    ['La organización debe conservar el registro.', 'tono_normativo'],
    ['Cada cambio shall be recorded.', 'tono_normativo'],
    ['Se recomienda: «' + 'y'.repeat(LIMITES.citaMin + 5) + '».', 'cita_textual'],
    ['Consulta www.ejemplo.test para más detalles.', 'enlace_o_correo'],
    ['Escribe a alguien@ejemplo.test si tienes dudas.', 'enlace_o_correo'],
  ] as const)('rechaza «%s» con %s', (texto, codigo) => {
    expect(revisarRespuestaIa(texto)).toContain(codigo);
  });

  it('una respuesta vacía no tiene señales, pero tampoco se considera válida: lo decide quien la usa', () => {
    expect(revisarRespuestaIa('')).toEqual([]);
  });

  it('cero coincidencias es el umbral: cualquier código la deja fuera', () => {
    expect(revisarRespuestaIa('La organización debe hacerlo. Ver https://ejemplo.test').sort()).toEqual(['enlace_o_correo', 'tono_normativo']);
  });
});

describe('revisarTexto: no cambia de comportamiento al usar el detector común', () => {
  it('conserva el orden de los códigos de una guía con varios problemas', () => {
    const texto = 'La organización debe registrar todo. «' + 'z'.repeat(LIMITES.citaMin) + '». Ver https://ejemplo.test\n- punto';
    expect(revisarTexto('guia', texto)).toEqual(['guia_demasiadas_frases', 'tono_normativo', 'cita_textual', 'formato_de_lista', 'enlace_o_correo']);
  });

  it('el título sigue revisando solo largo, formato y enlaces (no tono ni citas)', () => {
    expect(revisarTexto('titulo', 'La organización debe registrar')).toEqual([]);
  });
});
