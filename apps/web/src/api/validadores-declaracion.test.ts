import { describe, expect, it } from 'vitest';
import { validarDeclaracion, validarMotivosDeclaracion, validarVersionDeclaracion, validarVersionDeclaracionConFilas, validarVersionesDeclaracion } from './validadores';

const V1 = 'dddddddd-1111-4111-8111-111111111111';
const V2 = 'dddddddd-2222-4222-8222-222222222222';
const U = '11111111-1111-4111-8111-1111111111a1';
const fila = (o: Record<string, unknown> = {}) => ({ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', orden: 1, titulo: 'Políticas de seguridad', grupo: 'Organizacionales', aplicabilidad: 'aplica', implementacion: 'implementado', justificacion: null, controles: ['C-001'], cobertura: 'cubierta', ...o });
const noAplica = (o: Record<string, unknown> = {}) => fila({ idEstable: 'a27-5-2', orden: 2, aplicabilidad: 'no_aplica', implementacion: null, justificacion: 'No hay personal propio', controles: [], cobertura: 'no_aplica', ...o });
const version = (o: Record<string, unknown> = {}) => ({ id: V1, numero: 1, total: 2, aplican: 1, noAplican: 1, sinControl: 0, aprobadaPor: U, aprobadaEn: '2026-11-12T15:00:00.000Z', ...o });
const ESCALA = { escalaMax: 5, corteMedio: 5, corteAlto: 10, corteCritico: 16 };
const filaJ = (o: Record<string, unknown> = {}) => ({ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', sinMotivo: false, motivos: [{ tipo: 'legal', nota: 'Ley de datos' }], riesgos: [{ codigo: 'R-001', titulo: 'Pérdida de portátiles', nivel: 'alto', via: 'control' }], ...o });
const ref = (o: Record<string, unknown> = {}) => ({ tipo: 'plan', titulo: 'Plan 2026', versionDoc: '1.0', fecha: '2026-11-01', ubicacion: 'SIG-PL-004', version: 1, ...o });
/** Justificación coherente con `declaracion()`: la fila que aplica trae motivo y riesgo; la que no aplica, nada. */
const just = (o: Record<string, unknown> = {}) => ({
  conMotivo: 1, sinMotivo: 0, riesgosVigentes: 1, riesgosSinTratamiento: 0, bloqueos: [], faltaPlanTratamiento: false, referencias: [ref()], escala: ESCALA,
  filas: [filaJ(), { libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-2', sinMotivo: false, motivos: [], riesgos: [] }], ...o,
});
const declaracion = (o: Record<string, unknown> = {}) => ({
  norma: 'ISO/IEC 27001', hoy: '2026-11-12', resumen: { total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 0, aprobable: true }, filas: [fila(), noAplica()],
  alcance: { texto: 'Desarrollo de software', aprobado: true }, ultimaVersion: version(), justificacion: just(), ...o,
});

describe('validarDeclaracion', () => {
  it('acepta un borrador válido, con o sin alcance y última versión', () => {
    expect(validarDeclaracion(declaracion())).not.toBeNull();
    expect(validarDeclaracion(declaracion({ alcance: null, ultimaVersion: null }))).not.toBeNull();
  });
  it('acepta un borrador sin filas (aún no hay controles) y uno con controles por decidir', () => {
    expect(validarDeclaracion(declaracion({ filas: [], resumen: { total: 0, aplican: 0, noAplican: 0, porDecidir: 0, sinControl: 0, aprobable: false }, justificacion: just({ conMotivo: 0, riesgosVigentes: 0, bloqueos: ['sin_filas'], filas: [] }) }))).not.toBeNull();
    const porDecidir = fila({ aplicabilidad: 'por_decidir', implementacion: null, controles: [], cobertura: 'sin_control' });
    expect(validarDeclaracion(declaracion({ filas: [porDecidir], resumen: { total: 1, aplican: 0, noAplican: 0, porDecidir: 1, sinControl: 0, aprobable: false }, justificacion: just({ conMotivo: 0, riesgosVigentes: 0, bloqueos: ['por_decidir'], filas: [filaJ({ motivos: [], riesgos: [] })] }) }))).not.toBeNull();
  });
  it.each([
    ['null', null],
    ['una clave de más', { ...declaracion(), extra: 1 }],
    ['sin alcance (clave ausente)', (() => { const r: Record<string, unknown> = declaracion(); delete r.alcance; return r; })()],
    ['una fecha mal formada', declaracion({ hoy: '12/11/2026' })],
    ['un resumen que no cuadra con las filas', declaracion({ resumen: { total: 2, aplican: 2, noAplican: 0, porDecidir: 0, sinControl: 0, aprobable: true } })],
    ['aprobable que miente', declaracion({ resumen: { total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 0, aprobable: false } })],
    ['sinControl mayor que los que aplican', declaracion({ resumen: { total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 2, aprobable: true } })],
    ['un alcance sin texto', declaracion({ alcance: { texto: '', aprobado: true } })],
    ['un alcance con aprobado no booleano', declaracion({ alcance: { texto: 'x', aprobado: 'si' } })],
    ['una última versión inválida', declaracion({ ultimaVersion: version({ numero: 0 }) })],
    ['más de 500 filas', declaracion({ filas: Array.from({ length: 501 }, (_, i) => fila({ idEstable: `a${i}` })) })],
  ])('rechaza %s', (_n, cuerpo) => expect(validarDeclaracion(cuerpo)).toBeNull());

  it.each([
    ['aplica sin implementación', fila({ implementacion: null })],
    ['aplica con justificación', fila({ justificacion: 'x' })],
    ['no aplica con implementación', noAplica({ implementacion: 'parcial' })],
    ['no aplica sin justificación', noAplica({ justificacion: null })],
    ['no aplica con otra cobertura', noAplica({ cobertura: 'cubierta' })],
    ['por decidir con implementación', fila({ aplicabilidad: 'por_decidir' })],
    ['una implementación desconocida', fila({ implementacion: 'mas_o_menos' })],
    ['una cobertura desconocida', fila({ cobertura: 'quizas' })],
    ['una aplicabilidad desconocida', fila({ aplicabilidad: 'tal_vez' })],
    ['un código de control con marcado', fila({ controles: ['<img src=x>'] })],
    ['más de 50 códigos', fila({ controles: Array.from({ length: 51 }, (_, i) => `C-${i}`) })],
    ['un título vacío', fila({ titulo: '' })],
    ['una clave de más en la fila', fila({ extra: true })],
  ])('rechaza una fila con %s', (_n, f) => {
    const filas = [f];
    const r = { total: 1, aplican: f.aplicabilidad === 'aplica' ? 1 : 0, noAplican: f.aplicabilidad === 'no_aplica' ? 1 : 0, porDecidir: f.aplicabilidad === 'por_decidir' ? 1 : 0, sinControl: 0, aprobable: false };
    expect(validarDeclaracion(declaracion({ filas, resumen: { ...r, aprobable: r.total > 0 && r.porDecidir === 0 } }))).toBeNull();
  });

  it('rechaza dos filas de la misma entrada', () => {
    expect(validarDeclaracion(declaracion({ filas: [fila(), fila()], resumen: { total: 2, aplican: 2, noAplican: 0, porDecidir: 0, sinControl: 0, aprobable: true } }))).toBeNull();
  });
});

describe('validarVersionDeclaracion y validarVersionesDeclaracion', () => {
  it('acepta una versión válida', () => expect(validarVersionDeclaracion(version())).not.toBeNull());
  it.each([
    ['un id que no es UUID', version({ id: 'x' })],
    ['un número menor que 1', version({ numero: 0 })],
    ['conteos que no suman', version({ total: 5 })],
    ['sinControl mayor que aplican', version({ sinControl: 2 })],
    ['una fecha sin forma de fecha y hora', version({ aprobadaEn: 'ayer' })],
    ['una clave de más', { ...version(), extra: 1 }],
    ['null', null],
  ])('rechaza %s', (_n, v) => expect(validarVersionDeclaracion(v)).toBeNull());

  it('la lista va de la más nueva a la más antigua, sin repetir', () => {
    expect(validarVersionesDeclaracion([version({ id: V2, numero: 2 }), version()])).toHaveLength(2);
    expect(validarVersionesDeclaracion([])).toEqual([]);
    expect(validarVersionesDeclaracion([version(), version({ id: V2, numero: 2 })])).toBeNull();
    expect(validarVersionesDeclaracion([version(), version()])).toBeNull();
    expect(validarVersionesDeclaracion(Array.from({ length: 101 }, (_, i) => version({ numero: 200 - i })))).toBeNull();
    expect(validarVersionesDeclaracion({})).toBeNull();
  });
});

describe('validarVersionDeclaracionConFilas', () => {
  const conFilas = (o: Record<string, unknown> = {}) => ({ ...version(), alcance: 'Desarrollo de software', filas: [fila(), noAplica()], justificacion: null, ...o });
  it('acepta una versión congelada válida, con o sin alcance', () => {
    expect(validarVersionDeclaracionConFilas(conFilas())).not.toBeNull();
    expect(validarVersionDeclaracionConFilas(conFilas({ alcance: null }))).not.toBeNull();
  });
  it.each([
    ['filas que no suman el total', conFilas({ filas: [fila()] })],
    ['una fila por decidir (una versión congelada no las tiene)', conFilas({ filas: [fila(), fila({ idEstable: 'a27-5-2', aplicabilidad: 'por_decidir', implementacion: null })], })],
    ['conteo de «aplican» distinto de las filas', conFilas({ aplican: 2, noAplican: 0 })],
    ['un alcance vacío', conFilas({ alcance: '' })],
    ['un alcance de más de 4000 caracteres', conFilas({ alcance: 'x'.repeat(4001) })],
    ['sin la clave alcance', (() => { const r: Record<string, unknown> = conFilas(); delete r.alcance; return r; })()],
  ])('rechaza %s', (_n, v) => expect(validarVersionDeclaracionConFilas(v)).toBeNull());
});

// ---- Justificación (ADR 037)
describe('validarDeclaracion: justificación del borrador', () => {
  const sinMotivo = just({ conMotivo: 0, sinMotivo: 1, riesgosVigentes: 0, bloqueos: ['sin_motivo'], filas: [filaJ({ sinMotivo: true, motivos: [], riesgos: [] }), { libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-2', sinMotivo: false, motivos: [], riesgos: [] }] });

  it('acepta una justificación coherente, también sin referencias y con riesgos «previstos»', () => {
    expect(validarDeclaracion(declaracion({ justificacion: just({ referencias: [] }) }))).not.toBeNull();
    const previsto = just({ filas: [filaJ({ riesgos: [{ codigo: 'R-002', titulo: 'Fuga', nivel: 'critico', via: 'previsto' }] }), just().filas[1]] });
    expect(validarDeclaracion(declaracion({ justificacion: previsto }))?.justificacion.filas[0]?.riesgos[0]?.via).toBe('previsto');
  });

  it('un control que aplica sin motivo impide aprobar: aprobable debe ser falso y el bloqueo, «sin_motivo»', () => {
    const r = { total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 0 };
    expect(validarDeclaracion(declaracion({ justificacion: sinMotivo, resumen: { ...r, aprobable: false } }))).not.toBeNull();
    expect(validarDeclaracion(declaracion({ justificacion: sinMotivo, resumen: { ...r, aprobable: true } }))).toBeNull(); // miente
  });

  it.each([
    ['sin la clave justificacion', (() => { const r: Record<string, unknown> = declaracion(); delete r.justificacion; return r; })()],
    ['una clave de más', declaracion({ justificacion: just({ extra: 1 }) })],
    ['conteos que no suman los que aplican', declaracion({ justificacion: just({ conMotivo: 2 }) })],
    ['sinMotivo que no cuadra con las filas', declaracion({ justificacion: just({ sinMotivo: 1, conMotivo: 0 }) })],
    ['bloqueos que no dicen lo mismo que las filas', declaracion({ justificacion: just({ bloqueos: ['por_decidir'] }) })],
    ['un bloqueo desconocido', declaracion({ justificacion: just({ bloqueos: ['quizas'] }) })],
    ['un bloqueo repetido', declaracion({ justificacion: just({ bloqueos: ['sin_motivo', 'sin_motivo'] }) })],
    ['una fila que aplica sin motivo ni riesgo no marcada «sinMotivo»', declaracion({ justificacion: just({ filas: [filaJ({ motivos: [], riesgos: [] }), just().filas[1]] }) })],
    ['una fila que no aplica con motivos', declaracion({ justificacion: just({ filas: [filaJ(), { ...(just().filas[1] as object), motivos: [{ tipo: 'legal', nota: 'x' }] }] }) })],
    ['un tipo de motivo «riesgo» (se deriva, no se registra)', declaracion({ justificacion: just({ filas: [filaJ({ motivos: [{ tipo: 'riesgo', nota: 'x' }] }), just().filas[1]] }) })],
    ['un motivo sin nota', declaracion({ justificacion: just({ filas: [filaJ({ motivos: [{ tipo: 'legal', nota: '' }] }), just().filas[1]] }) })],
    ['una nota de más de 500 caracteres', declaracion({ justificacion: just({ filas: [filaJ({ motivos: [{ tipo: 'legal', nota: 'x'.repeat(501) }] }), just().filas[1]] }) })],
    ['el mismo tipo de motivo dos veces', declaracion({ justificacion: just({ filas: [filaJ({ motivos: [{ tipo: 'legal', nota: 'a' }, { tipo: 'legal', nota: 'b' }] }), just().filas[1]] }) })],
    ['un código de riesgo mal formado', declaracion({ justificacion: just({ filas: [filaJ({ riesgos: [{ codigo: 'riesgo 1', titulo: 'x', nivel: 'alto', via: 'control' }] }), just().filas[1]] }) })],
    ['un nivel o una vía desconocidos', declaracion({ justificacion: just({ filas: [filaJ({ riesgos: [{ codigo: 'R-001', titulo: 'x', nivel: 'extremo', via: 'control' }] }), just().filas[1]] }) })],
    ['una fila de justificación repetida', declaracion({ justificacion: just({ filas: [filaJ(), filaJ()] }) })],
    ['más de dos referencias', declaracion({ justificacion: just({ referencias: [ref(), ref({ tipo: 'analisis' }), ref()] }) })],
    ['dos referencias del mismo tipo', declaracion({ justificacion: just({ referencias: [ref(), ref()] }) })],
    ['una referencia con fecha mal formada', declaracion({ justificacion: just({ referencias: [ref({ fecha: '01/11/2026' })] }) })],
    ['una referencia sin ubicación', declaracion({ justificacion: just({ referencias: [ref({ ubicacion: '' })] }) })],
    ['una escala con cortes desordenados', declaracion({ justificacion: just({ escala: { ...ESCALA, corteAlto: 4 } }) })],
    ['una escala con un corte fuera de la escala', declaracion({ justificacion: just({ escala: { ...ESCALA, corteCritico: 26 } }) })],
    ['faltaPlanTratamiento no booleano', declaracion({ justificacion: just({ faltaPlanTratamiento: 'si' }) })],
  ])('rechaza %s', (_n, cuerpo) => expect(validarDeclaracion(cuerpo)).toBeNull());
});

describe('validarVersionDeclaracionConFilas: justificación congelada', () => {
  const conFilas = (o: Record<string, unknown> = {}) => ({ ...version(), alcance: null, filas: [fila(), noAplica()], justificacion: null, ...o });
  const congelada = (o: Record<string, unknown> = {}) => ({
    escala: ESCALA, conMotivo: 1, riesgosVigentes: 1,
    motivos: [{ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', tipo: 'contractual', nota: 'Cláusula 7' }],
    riesgos: [{ codigo: 'R-001', titulo: 'Pérdida de portátiles', probabilidad: 3, impacto: 4, nivel: 'alto', decision: 'mitigar', responsableId: U, controles: ['C-001'] }],
    riesgosPorFila: [{ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', riesgoCodigo: 'R-001', via: 'control' }],
    referencias: [{ tipo: 'plan', titulo: 'Plan 2026', versionDoc: '1.0', fecha: '2026-11-01', ubicacion: 'SIG-PL-004' }],
    ...o,
  });

  it('acepta una versión anterior (justificación nula) y una con justificación congelada', () => {
    expect(validarVersionDeclaracionConFilas(conFilas())?.justificacion).toBeNull();
    expect(validarVersionDeclaracionConFilas(conFilas({ justificacion: congelada() }))?.justificacion?.riesgos[0]?.codigo).toBe('R-001');
    expect(validarVersionDeclaracionConFilas(conFilas({ justificacion: congelada({ riesgos: [], riesgosVigentes: 0, riesgosPorFila: [], referencias: [] }) }))).not.toBeNull();
  });

  it.each([
    ['sin la clave justificacion', (() => { const r: Record<string, unknown> = conFilas(); delete r.justificacion; return r; })()],
    ['una clave de más', conFilas({ justificacion: congelada({ extra: 1 }) })],
    ['conMotivo distinto de los que aplican (al aprobar todos tenían motivo)', conFilas({ justificacion: congelada({ conMotivo: 0 }) })],
    ['riesgosVigentes que no cuadra con los riesgos', conFilas({ justificacion: congelada({ riesgosVigentes: 3 }) })],
    ['un vínculo con un riesgo que no está congelado', conFilas({ justificacion: congelada({ riesgosPorFila: [{ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', riesgoCodigo: 'R-999', via: 'control' }] }) })],
    ['un riesgo repetido', conFilas({ justificacion: congelada({ riesgos: [congelada().riesgos[0], congelada().riesgos[0]], riesgosVigentes: 2 }) })],
    ['una decisión desconocida', conFilas({ justificacion: congelada({ riesgos: [{ ...congelada().riesgos[0], decision: 'ignorar' }] }) })],
    ['un responsable que no es UUID', conFilas({ justificacion: congelada({ riesgos: [{ ...congelada().riesgos[0], responsableId: 'Ana Pérez' }] }) })],
    ['una probabilidad fuera de rango', conFilas({ justificacion: congelada({ riesgos: [{ ...congelada().riesgos[0], probabilidad: 11 }] }) })],
    ['un motivo con tipo «riesgo»', conFilas({ justificacion: congelada({ motivos: [{ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', tipo: 'riesgo', nota: 'x' }] }) })],
    ['una referencia con la clave version (solo la tiene el borrador)', conFilas({ justificacion: congelada({ referencias: [ref()] }) })],
    ['una escala con cortes desordenados', conFilas({ justificacion: congelada({ escala: { ...ESCALA, corteMedio: 12 } }) })],
  ])('rechaza %s', (_n, v) => expect(validarVersionDeclaracionConFilas(v)).toBeNull());
});

describe('validarMotivosDeclaracion', () => {
  const m = (o: Record<string, unknown> = {}) => ({ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', tipo: 'legal', nota: 'Ley de protección de datos', version: 2, ...o });
  it('acepta una lista válida, vacía o con varios tipos de un mismo control', () => {
    expect(validarMotivosDeclaracion([])).toEqual([]);
    expect(validarMotivosDeclaracion([m(), m({ tipo: 'otro' }), m({ idEstable: 'a27-5-2' })])).toHaveLength(3);
  });
  it.each([
    ['null', null],
    ['más de 500', Array.from({ length: 501 }, (_, i) => m({ idEstable: `a${i}` }))],
    ['una clave de más', [{ ...m(), extra: 1 }]],
    ['un tipo «riesgo» (se deriva, no se registra)', [m({ tipo: 'riesgo' })]],
    ['una nota vacía', [m({ nota: '' })]],
    ['una nota de más de 500', [m({ nota: 'x'.repeat(501) })]],
    ['una versión cero', [m({ version: 0 })]],
    ['un identificador mal formado', [m({ idEstable: 'MAL ID' })]],
    ['el mismo tipo dos veces para un control', [m(), m({ nota: 'otra' })]],
  ])('rechaza %s', (_n, cuerpo) => expect(validarMotivosDeclaracion(cuerpo)).toBeNull());
});
