// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validarAlcances, validarDiagnostico } from './validadores';

const desglose = (c: Record<string, number | null> = {}) => ({ cumple: 1, parcial: 0, noCumple: 0, noAplica: 0, sinEvaluar: 1, total: 2, porcentaje: 100, ...c });
const fila = (c: Record<string, unknown> = {}) => ({
  libreriaCodigo: 'iso-27001-2022-anexo-a',
  idEstable: 'a27-5-1',
  tipo: 'control',
  capitulo: null,
  grupo: 'Organizacionales',
  titulo: 'Políticas de seguridad',
  guia: 'Redacta las reglas generales.',
  aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }],
  evaluacion: { estado: 'cumple', comentario: null, fechaObjetivo: '2026-12-31', version: 1 },
  ...c,
});
const diagnostico = () => ({
  filas: [fila(), fila({ idEstable: 'a27-5-2', evaluacion: null })],
  madurez: { porNorma: [{ norma: 'ISO/IEC 27001', desglose: desglose() }], porAgrupador: [{ tipo: 'tema', nombre: 'Organizacionales', desglose: desglose() }], clausulas: desglose({ porcentaje: null }) },
  normas: ['ISO/IEC 27001'],
});
const alcance = (c: Record<string, unknown> = {}) => ({ norma: 'ISO/IEC 27001', texto: 'Desarrollo de software.', aprobado: false, aprobadoEn: null, actualizadoEn: '2026-11-10T12:00:00.000Z', ...c });

describe('validarDiagnostico', () => {
  it('acepta la forma exacta del contrato', () => {
    const d = validarDiagnostico(diagnostico());
    expect(d?.filas).toHaveLength(2);
    expect(d?.filas[1]?.evaluacion).toBeNull();
  });

  it('rechaza entero lo que no cumple: campos de más o de menos, tipos, estados, coherencia y topes', () => {
    const malos: Array<(d: ReturnType<typeof diagnostico>) => unknown> = [
      (d) => ({ ...d, extra: 1 }),
      (d) => ({ filas: d.filas, normas: d.normas }),
      (d) => ({ ...d, filas: [{ ...fila(), extra: 1 }] }),
      (d) => ({ ...d, filas: [fila({ evaluacion: { estado: 'quizas', comentario: null, fechaObjetivo: null, version: 1 } })] }),
      (d) => ({ ...d, filas: [fila({ evaluacion: { estado: 'cumple', comentario: null, fechaObjetivo: '31/12/2026', version: 1 } })] }),
      (d) => ({ ...d, filas: [fila({ evaluacion: { estado: 'cumple', comentario: null, fechaObjetivo: null, version: 0 } })] }),
      (d) => ({ ...d, filas: [fila({ tipo: 'clausula' })] }), // una cláusula lleva capítulo y no grupo
      (d) => ({ ...d, filas: [fila({ idEstable: '../x' })] }),
      (d) => ({ ...d, filas: Array.from({ length: 501 }, () => fila()) }),
      (d) => ({ ...d, madurez: { ...d.madurez, clausulas: desglose({ porcentaje: 101 }) } }),
      (d) => ({ ...d, madurez: { ...d.madurez, porNorma: [{ norma: 'X', desglose: { ...desglose(), cumple: -1 } }] } }),
      (d) => ({ ...d, normas: ['a'.repeat(61)] }),
      () => null,
      () => [],
    ];
    for (const [i, malo] of malos.entries()) expect(validarDiagnostico(malo(diagnostico())), `caso ${i}`).toBeNull();
  });
});

describe('validarAlcances', () => {
  it('acepta definido, sin definir y aprobado', () => {
    expect(validarAlcances([alcance(), alcance({ norma: 'ISO 9001', texto: null, actualizadoEn: null }), alcance({ norma: 'ISO 42001', aprobado: true, aprobadoEn: '2026-11-10T12:00:00.000Z' })])).toHaveLength(3);
  });

  it('rechaza formas ajenas y estados incoherentes', () => {
    for (const malo of [[alcance({ extra: 1 })], [alcance({ aprobado: 'si' })], [alcance({ texto: '' })], [alcance({ aprobado: true })], [alcance({ texto: null, aprobado: true, aprobadoEn: '2026-11-10T12:00:00Z' })], [alcance({ norma: 'ISO <b>' })], [alcance({ actualizadoEn: 'ayer' })], {}, Array.from({ length: 21 }, () => alcance())])
      expect(validarAlcances(malo)).toBeNull();
  });
});
