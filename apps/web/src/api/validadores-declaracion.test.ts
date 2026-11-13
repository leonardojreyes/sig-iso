import { describe, expect, it } from 'vitest';
import { validarDeclaracion, validarVersionDeclaracion, validarVersionDeclaracionConFilas, validarVersionesDeclaracion } from './validadores';

const V1 = 'dddddddd-1111-4111-8111-111111111111';
const V2 = 'dddddddd-2222-4222-8222-222222222222';
const U = '11111111-1111-4111-8111-1111111111a1';
const fila = (o: Record<string, unknown> = {}) => ({ libreriaCodigo: 'iso-27001-anexo-a', idEstable: 'a27-5-1', orden: 1, titulo: 'Políticas de seguridad', grupo: 'Organizacionales', aplicabilidad: 'aplica', implementacion: 'implementado', justificacion: null, controles: ['C-001'], cobertura: 'cubierta', ...o });
const noAplica = (o: Record<string, unknown> = {}) => fila({ idEstable: 'a27-5-2', orden: 2, aplicabilidad: 'no_aplica', implementacion: null, justificacion: 'No hay personal propio', controles: [], cobertura: 'no_aplica', ...o });
const version = (o: Record<string, unknown> = {}) => ({ id: V1, numero: 1, total: 2, aplican: 1, noAplican: 1, sinControl: 0, aprobadaPor: U, aprobadaEn: '2026-11-12T15:00:00.000Z', ...o });
const declaracion = (o: Record<string, unknown> = {}) => ({
  norma: 'ISO/IEC 27001', hoy: '2026-11-12', resumen: { total: 2, aplican: 1, noAplican: 1, porDecidir: 0, sinControl: 0, aprobable: true }, filas: [fila(), noAplica()],
  alcance: { texto: 'Desarrollo de software', aprobado: true }, ultimaVersion: version(), ...o,
});

describe('validarDeclaracion', () => {
  it('acepta un borrador válido, con o sin alcance y última versión', () => {
    expect(validarDeclaracion(declaracion())).not.toBeNull();
    expect(validarDeclaracion(declaracion({ alcance: null, ultimaVersion: null }))).not.toBeNull();
  });
  it('acepta un borrador sin filas (aún no hay controles) y uno con controles por decidir', () => {
    expect(validarDeclaracion(declaracion({ filas: [], resumen: { total: 0, aplican: 0, noAplican: 0, porDecidir: 0, sinControl: 0, aprobable: false } }))).not.toBeNull();
    const porDecidir = fila({ aplicabilidad: 'por_decidir', implementacion: null, controles: [], cobertura: 'sin_control' });
    expect(validarDeclaracion(declaracion({ filas: [porDecidir], resumen: { total: 1, aplican: 0, noAplican: 0, porDecidir: 1, sinControl: 0, aprobable: false } }))).not.toBeNull();
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
  const conFilas = (o: Record<string, unknown> = {}) => ({ ...version(), alcance: 'Desarrollo de software', filas: [fila(), noAplica()], ...o });
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
