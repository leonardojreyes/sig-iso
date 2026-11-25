import { describe, expect, it } from 'vitest';
import { CRITERIOS_POR_OMISION, calcularMatriz, mismosCriterios, validarCriterios } from './criterios.js';
import { ErrorCertificacion } from './errores.js';

const cinco = (p = 'x') => [`${p}1`, `${p}2`, `${p}3`, `${p}4`, `${p}5`];
const valida = { probabilidad: cinco('p'), impacto: cinco('i'), nivelAceptacion: 'medio' };
const falla = (f: () => unknown, campo: string) => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorCertificacion);
    expect((e as ErrorCertificacion).campo).toBe(campo);
    return;
  }
  throw new Error('debía fallar');
};

describe('criterios por omisión', () => {
  it('se rotulan como de la herramienta (versión 0) y no traen nivel de aceptación', () => {
    expect(CRITERIOS_POR_OMISION).toMatchObject({ origen: 'omision', version: 0, nivelAceptacion: null });
    expect(CRITERIOS_POR_OMISION.probabilidad).toHaveLength(5);
    expect(CRITERIOS_POR_OMISION.impacto).toHaveLength(5);
  });
});

describe('validar criterios', () => {
  it('acepta diez descripciones y un nivel de aceptación, y recorta los espacios', () => {
    const r = validarCriterios({ ...valida, probabilidad: [' a ', 'b', 'c', 'd', 'e'] });
    expect(r.probabilidad[0]).toBe('a');
    expect(r.nivelAceptacion).toBe('medio');
  });
  it('rechaza listas de otro largo, descripciones vacías, largas o con caracteres de control o de dirección', () => {
    falla(() => validarCriterios({ ...valida, probabilidad: cinco().slice(0, 4) }), 'probabilidad');
    falla(() => validarCriterios({ ...valida, impacto: [...cinco(), 'x'] }), 'impacto');
    falla(() => validarCriterios({ ...valida, probabilidad: ['a', '   ', 'c', 'd', 'e'] }), 'probabilidad');
    falla(() => validarCriterios({ ...valida, impacto: ['a', 'b', 'x'.repeat(201), 'd', 'e'] }), 'impacto');
    falla(() => validarCriterios({ ...valida, impacto: ['a', 'b', 'c\u0000', 'd', 'e'] }), 'impacto');
    falla(() => validarCriterios({ ...valida, impacto: ['a', 'b', 'c‮', 'd', 'e'] }), 'impacto');
    falla(() => validarCriterios({ ...valida, probabilidad: ['a', 1, 'c', 'd', 'e'] }), 'probabilidad');
    falla(() => validarCriterios({ ...valida, probabilidad: 'no es lista' }), 'probabilidad');
  });
  it('el nivel de aceptación es de la lista cerrada y es obligatorio', () => {
    for (const mal of [undefined, null, 'enorme', 3, 'Medio']) falla(() => validarCriterios({ ...valida, nivelAceptacion: mal }), 'nivelAceptacion');
    for (const bien of ['bajo', 'medio', 'alto', 'critico']) expect(validarCriterios({ ...valida, nivelAceptacion: bien }).nivelAceptacion).toBe(bien);
  });
  it('guardar los mismos criterios se reconoce como «sin cambios»', () => {
    const a = validarCriterios(valida);
    expect(mismosCriterios(a, validarCriterios(valida))).toBe(true);
    expect(mismosCriterios(a, validarCriterios({ ...valida, nivelAceptacion: 'alto' }))).toBe(false);
    expect(mismosCriterios(a, validarCriterios({ ...valida, impacto: [...cinco('i').slice(0, 4), 'otro'] }))).toBe(false);
  });
});

describe('matriz 5 × 5', () => {
  it('siempre trae 25 celdas, de la probabilidad más alta a la más baja, con su nivel', () => {
    const m = calcularMatriz([]);
    expect(m).toHaveLength(25);
    expect(m[0]).toMatchObject({ probabilidad: 5, impacto: 1, puntaje: 5, nivel: 'medio', cantidad: 0 });
    expect(m[4]).toMatchObject({ probabilidad: 5, impacto: 5, puntaje: 25, nivel: 'critico' });
    expect(m[24]).toMatchObject({ probabilidad: 1, impacto: 5, puntaje: 5 });
    expect(m.find((c) => c.probabilidad === 1 && c.impacto === 1)).toMatchObject({ puntaje: 1, nivel: 'bajo' });
  });
  it('cuenta los riesgos de cada celda', () => {
    const m = calcularMatriz([{ probabilidad: 3, impacto: 4 }, { probabilidad: 3, impacto: 4 }, { probabilidad: 1, impacto: 1 }]);
    expect(m.find((c) => c.probabilidad === 3 && c.impacto === 4)?.cantidad).toBe(2);
    expect(m.find((c) => c.probabilidad === 1 && c.impacto === 1)?.cantidad).toBe(1);
    expect(m.reduce((s, c) => s + c.cantidad, 0)).toBe(3);
  });
});
