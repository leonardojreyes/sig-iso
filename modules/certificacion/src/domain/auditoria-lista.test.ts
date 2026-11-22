import { describe, expect, it } from 'vitest';
import {
  calcularCoberturaAuditoria,
  evaluarPrerrequisito,
  filaCubierta,
  generarFilas,
  planificarRegeneracion,
  validarPregunta,
  validarResultado,
  ventanaMovil,
  type AuditoriaParaCobertura,
  type EntradaDeNorma,
  type ReferenciaDeCobertura,
} from './auditoria-lista.js';
import { ErrorCertificacion } from './errores.js';

const cl = (id: string, capitulo: number, orden: number): EntradaDeNorma => ({
  idEstable: id,
  orden,
  titulo: `Cláusula ${id}`,
  tipo: 'clausula',
  capitulo,
  grupo: null,
});
const ct = (id: string, grupo: string, orden: number): EntradaDeNorma => ({
  idEstable: id,
  orden,
  titulo: `Control ${id}`,
  tipo: 'control',
  capitulo: null,
  grupo,
});
const N27 = {
  libreriaCodigo: 'iso-27001',
  libreriaVersion: '1.0.0',
  entradas: [cl('c4-1', 4, 1), cl('c9-2', 9, 2), cl('c9-3', 9, 3), ct('a5-1', 'Organizacionales', 4), ct('a8-1', 'Tecnológicos', 5)],
};
const N9 = { libreriaCodigo: 'iso-9001', libreriaVersion: '2.0.0', entradas: [cl('c4-1', 4, 1), cl('c8-1', 8, 2)] };

describe('validar resultado de una fila', () => {
  it('«conforme» y «no verificado» no exigen nota; los demás sí', () => {
    expect(validarResultado('conforme', null)).toEqual({ resultado: 'conforme', nota: null });
    expect(validarResultado('no_verificado', undefined).nota).toBeNull();
    for (const r of ['no_conforme', 'observacion', 'oportunidad', 'no_aplica'])
      expect(() => validarResultado(r, '  ')).toThrow(ErrorCertificacion);
    expect(validarResultado('no_conforme', ' no hay registro ').nota).toBe('no hay registro');
  });

  it('«no aplica» pide una justificación de al menos 5 caracteres', () => {
    expect(() => validarResultado('no_aplica', 'no')).toThrow(ErrorCertificacion);
    expect(validarResultado('no_aplica', 'no se usa').resultado).toBe('no_aplica');
  });

  it('rechaza «por evaluar», un resultado inventado y una nota demasiado larga', () => {
    for (const r of ['por_evaluar', 'inventado', 3, null]) expect(() => validarResultado(r, 'x')).toThrow(ErrorCertificacion);
    expect(() => validarResultado('conforme', 'x'.repeat(501))).toThrow(ErrorCertificacion);
  });

  it('valida las preguntas propias', () => {
    expect(validarPregunta(' ¿Hay registro? ')).toBe('¿Hay registro?');
    expect(() => validarPregunta('')).toThrow(ErrorCertificacion);
    expect(() => validarPregunta('x'.repeat(301))).toThrow(ErrorCertificacion);
  });
});

describe('generar la lista de verificación', () => {
  it('sin alcance por capítulo trae todas las entradas, ordenadas por norma y orden', () => {
    const filas = generarFilas([N27, N9], []);
    expect(filas.map((f) => `${f.libreriaCodigo}:${f.idEstable}`)).toEqual([
      'iso-27001:c4-1',
      'iso-27001:c9-2',
      'iso-27001:c9-3',
      'iso-27001:a5-1',
      'iso-27001:a8-1',
      'iso-9001:c4-1',
      'iso-9001:c8-1',
    ]);
  });

  it('el alcance por capítulo o tema limita solo a esa norma; la otra queda completa', () => {
    const filas = generarFilas(
      [N27, N9],
      [
        { libreriaCodigo: 'iso-27001', capitulo: '9' },
        { libreriaCodigo: 'iso-27001', capitulo: 'Tecnológicos' },
      ],
    );
    expect(filas.map((f) => `${f.libreriaCodigo}:${f.idEstable}`)).toEqual([
      'iso-27001:c9-2',
      'iso-27001:c9-3',
      'iso-27001:a8-1',
      'iso-9001:c4-1',
      'iso-9001:c8-1',
    ]);
  });

  it('fija la versión de la librería con que se generó y no guarda texto de la norma', () => {
    const f = generarFilas([N27], [])[0];
    expect(f).toEqual({ libreriaCodigo: 'iso-27001', libreriaVersion: '1.0.0', idEstable: 'c4-1', titulo: 'Cláusula c4-1', orden: 1 });
  });

  it('una norma sin entradas, o un alcance que no coincide con nada, da una lista vacía', () => {
    expect(generarFilas([{ ...N27, entradas: [] }], [])).toEqual([]);
    expect(generarFilas([N27], [{ libreriaCodigo: 'iso-27001', capitulo: '99' }])).toEqual([]);
  });
});

describe('regenerar la lista a propósito', () => {
  const nuevas = generarFilas([N27], [{ libreriaCodigo: 'iso-27001', capitulo: '9' }]); // c9-2, c9-3
  it('agrega lo que falta y conserva lo que sigue en el alcance', () => {
    const plan = planificarRegeneracion([{ libreriaCodigo: 'iso-27001', idEstable: 'c9-2', resultado: 'conforme' }], nuevas);
    expect(plan.agregar.map((f) => f.idEstable)).toEqual(['c9-3']);
    expect(plan.conservadas).toBe(1);
    expect(plan.quitar).toEqual([]);
  });

  it('quita solo lo «por evaluar» que ya no corresponde y conserva (con aviso) lo evaluado que quedó fuera', () => {
    const plan = planificarRegeneracion(
      [
        { libreriaCodigo: 'iso-27001', idEstable: 'c4-1', resultado: 'por_evaluar' },
        { libreriaCodigo: 'iso-27001', idEstable: 'a5-1', resultado: 'no_conforme' },
      ],
      nuevas,
    );
    expect(plan.quitar).toEqual([{ libreriaCodigo: 'iso-27001', idEstable: 'c4-1' }]);
    expect(plan.conservadasFueraDeAlcance).toEqual([{ libreriaCodigo: 'iso-27001', idEstable: 'a5-1' }]);
    expect(plan.agregar).toHaveLength(2);
  });
});

describe('cobertura y prerrequisito de la Etapa 2', () => {
  const referencia: ReferenciaDeCobertura = {
    entradas: [
      { libreriaCodigo: 'iso-27001', idEstable: 'c4-1', tipo: 'clausula', capitulo: 4 },
      { libreriaCodigo: 'iso-27001', idEstable: 'c9-3', tipo: 'clausula', capitulo: 9 },
      { libreriaCodigo: 'iso-27001', idEstable: 'c3-1', tipo: 'clausula', capitulo: 3 }, // fuera de 4 a 10
      { libreriaCodigo: 'iso-27001', idEstable: 'a5-1', tipo: 'control', capitulo: null },
    ],
    procesosIds: ['p1', 'sig'],
    controlesAplicables: [{ libreriaCodigo: 'iso-27001', idEstable: 'a5-1' }],
  };
  const fila = (idEstable: string, resultado: AuditoriaParaCobertura['filas'][number]['resultado'], nota: string | null = null) => ({
    libreriaCodigo: 'iso-27001',
    idEstable,
    resultado,
    nota,
  });
  const cerrada = (
    filas: AuditoriaParaCobertura['filas'],
    procesosIds: string[],
    cerradaEn = '2027-06-01',
    extra: Partial<AuditoriaParaCobertura> = {},
  ): AuditoriaParaCobertura => ({
    estado: 'cerrada',
    cerradaEn,
    tieneInforme: true,
    filas,
    procesosIds,
    ...extra,
  });

  it('«no verificado», «por evaluar» y «no aplica» sin justificación NO cuentan como cubiertas', () => {
    expect(filaCubierta(fila('x', 'conforme'))).toBe(true);
    expect(filaCubierta(fila('x', 'no_conforme', 'nota'))).toBe(true);
    expect(filaCubierta(fila('x', 'no_aplica', 'no se usa'))).toBe(true);
    expect(filaCubierta(fila('x', 'no_aplica', null))).toBe(false);
    expect(filaCubierta(fila('x', 'no_verificado', 'sin tiempo'))).toBe(false);
    expect(filaCubierta(fila('x', 'por_evaluar'))).toBe(false);
  });

  it('solo cuentan las auditorías cerradas con informe; el capítulo 3 no se pide', () => {
    const planificada = cerrada([fila('c4-1', 'conforme')], ['p1'], '2027-06-01', { estado: 'en_ejecucion' });
    const sinInforme = cerrada([fila('c4-1', 'conforme')], ['p1'], '2027-06-01', { tieneInforme: false });
    for (const a of [planificada, sinInforme]) {
      const c = calcularCoberturaAuditoria([a], referencia);
      expect(c.clausulas).toEqual({ total: 2, cubiertas: 0, faltantes: ['iso-27001:c4-1', 'iso-27001:c9-3'] });
    }
  });

  it('suma varias auditorías cerradas del mismo programa y marca la brecha del Anexo A y de los procesos', () => {
    const c = calcularCoberturaAuditoria(
      [cerrada([fila('c4-1', 'conforme')], ['p1']), cerrada([fila('c9-3', 'observacion', 'falta acta')], ['sig'])],
      referencia,
    );
    expect(c.clausulas).toMatchObject({ total: 2, cubiertas: 2, faltantes: [] });
    expect(c.procesos).toMatchObject({ total: 2, cubiertos: 2, faltantes: [] });
    expect(c.controles).toMatchObject({ total: 1, cubiertos: 0, faltantes: ['iso-27001:a5-1'], sinDeclaracion: false });
  });

  it('la cláusula 9.3 «no verificada» queda como brecha hasta que una complementaria la cubra', () => {
    const primera = cerrada(
      [fila('c4-1', 'conforme'), fila('c9-3', 'no_verificado', 'aún no hay revisión por la dirección'), fila('a5-1', 'conforme')],
      ['p1', 'sig'],
    );
    expect(evaluarPrerrequisito([primera], referencia).brechas.clausulas).toEqual(['iso-27001:c9-3']);
    const complementaria = cerrada([fila('c9-3', 'conforme')], ['sig'], '2027-09-01');
    expect(evaluarPrerrequisito([primera, complementaria], referencia).cumple).toBe(true);
  });

  it('cumple solo con una cerrada con informe y toda la cobertura; sin Declaración aprobada no cumple', () => {
    const todo = cerrada([fila('c4-1', 'conforme'), fila('c9-3', 'conforme'), fila('a5-1', 'conforme')], ['p1', 'sig']);
    expect(evaluarPrerrequisito([todo], referencia)).toMatchObject({ cumple: true, auditoriasCerradas: 1 });
    expect(evaluarPrerrequisito([], referencia)).toMatchObject({ cumple: false, auditoriasCerradas: 0 });
    const sinDdA = evaluarPrerrequisito([todo], { ...referencia, controlesAplicables: null });
    expect(sinDdA.cumple).toBe(false);
    expect(sinDdA.brechas.sinDeclaracion).toBe(true);
  });

  it('sin cláusulas 4 a 10 en las normas elegidas no se puede decir que cumple', () => {
    const vacia: ReferenciaDeCobertura = { entradas: [], procesosIds: [], controlesAplicables: [] };
    expect(evaluarPrerrequisito([cerrada([], [])], vacia).cumple).toBe(false);
  });

  it('la ventana de 12 meses móviles deja fuera las cerradas más antiguas', () => {
    const vieja = cerrada([fila('c4-1', 'conforme')], ['p1'], '2026-01-10');
    const reciente = cerrada([fila('c9-3', 'conforme')], ['sig'], '2027-05-10');
    const desde = ventanaMovil('2027-06-15');
    expect(desde).toBe('2026-06-15');
    const c = calcularCoberturaAuditoria([vieja, reciente], referencia, desde);
    expect(c.clausulas.cubiertas).toBe(1);
    expect(c.procesos.cubiertos).toBe(1);
  });

  it('ventanaMovil ajusta el día cuando el mes destino es más corto', () => {
    expect(ventanaMovil('2028-02-29')).toBe('2027-02-28');
    expect(ventanaMovil('2027-03-31', 1)).toBe('2027-02-28');
  });
});
