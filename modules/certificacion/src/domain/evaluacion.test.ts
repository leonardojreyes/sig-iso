import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import { Evaluacion } from './evaluacion.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const base = { empresaId: EMPRESA, libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', libreriaId: '11111111-1111-4111-8111-111111111111', estado: 'parcial' as const, version: 1 };
const falla = (cambio: Record<string, unknown>) => {
  try { Evaluacion.crear({ ...base, ...cambio } as never); } catch (e) { return e as ErrorCertificacion; }
  return undefined;
};

describe('Evaluacion', () => {
  it('acepta una evaluación mínima y normaliza los opcionales a nulo', () => {
    const e = Evaluacion.crear(base);
    expect(e).toMatchObject({ estado: 'parcial', comentario: null, responsableId: null, fechaObjetivo: null, version: 1 });
    expect(e.clave).toBe('iso-27001-2022-anexo-a|a27-5-1');
  });

  it('recorta el comentario y lo deja nulo si queda vacío', () => {
    expect(Evaluacion.crear({ ...base, comentario: '  hay una política parcial  ' }).comentario).toBe('hay una política parcial');
    expect(Evaluacion.crear({ ...base, comentario: '   ' }).comentario).toBeNull();
  });

  it.each(['cumple', 'parcial', 'no_cumple'] as const)('el estado «%s» no exige justificación', (estado) => {
    expect(Evaluacion.crear({ ...base, estado }).estado).toBe(estado);
  });

  it('«no aplica» exige una justificación de al menos 5 caracteres', () => {
    expect(falla({ estado: 'no_aplica' })?.motivos).toEqual(['justificacion_requerida']);
    expect(falla({ estado: 'no_aplica', comentario: 'no' })?.motivos).toEqual(['justificacion_requerida']);
    expect(Evaluacion.crear({ ...base, estado: 'no_aplica', comentario: 'No tenemos desarrollo propio' }).estado).toBe('no_aplica');
  });

  it.each([['estado desconocido', { estado: 'quizas' }], ['sin evaluar no se guarda', { estado: 'sin_evaluar' }], ['código con mayúsculas', { libreriaCodigo: 'ISO' }],
    ['id con espacios', { idEstable: 'a 1' }], ['librería que no es UUID', { libreriaId: 'x' }], ['comentario demasiado largo', { comentario: 'x'.repeat(1001) }],
    ['comentario con caracteres de control', { comentario: 'hola\u0000' }], ['responsable que no es UUID', { responsableId: 'x' }],
    ['fecha inexistente', { fechaObjetivo: '2026-02-31' }], ['fecha con otro formato', { fechaObjetivo: '10/11/2026' }],
    ['versión cero', { version: 0 }], ['versión con decimales', { version: 1.5 }]])('rechaza %s', (_n, cambio) => {
    expect(falla(cambio)).toBeInstanceOf(ErrorCertificacion);
  });

  it('acepta una fecha objetivo y un responsable válidos', () => {
    const e = Evaluacion.crear({ ...base, fechaObjetivo: '2026-12-31', responsableId: '22222222-2222-4222-8222-222222222222' });
    expect(e.fechaObjetivo).toBe('2026-12-31');
    expect(e.responsableId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('el error nunca repite el valor recibido', () => {
    expect(String(falla({ comentario: 'SECRETO'.repeat(200) })?.message)).not.toContain('SECRETO');
  });

  it('es inmutable', () => {
    expect(Object.isFrozen(Evaluacion.crear(base))).toBe(true);
  });
});
