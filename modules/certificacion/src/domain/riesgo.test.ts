import { crearEmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import { codigoDeRiesgo, numeroDeRiesgo, CORTES_NIVEL, DECISIONES_TRATAMIENTO, ESCALA_MAX, ESCALA_MIN, calcularNivel, nombreDeNivel, Riesgo } from './riesgo.js';

const EMPRESA = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000e1');
const ID = 'cccccccc-1111-4111-8111-111111111111';
const PERSONA = '22222222-2222-4222-8222-222222222222';
const base = {
  id: ID,
  empresaId: EMPRESA,
  codigo: 'R-001',
  titulo: 'Pérdida de portátiles',
  probabilidad: 3,
  impacto: 4,
  decision: 'mitigar',
} as const;
const falla = (cambio: Record<string, unknown>) => {
  try {
    Riesgo.crear({ ...base, ...cambio } as never);
  } catch (e) {
    return e as ErrorCertificacion;
  }
  return undefined;
};

describe('calcularNivel', () => {
  it.each([
    [1, 1, 1, 'bajo'],
    [2, 2, 4, 'bajo'],
    [1, 5, 5, 'medio'],
    [3, 3, 9, 'medio'],
    [2, 5, 10, 'alto'],
    [3, 5, 15, 'alto'],
    [4, 4, 16, 'critico'],
    [5, 5, 25, 'critico'],
  ])('%i × %i = %i es %s (cortes inclusivos)', (p, i, puntaje, nivel) => {
    expect(calcularNivel(p, i)).toEqual({ puntaje, nivel });
  });

  it('rechaza valores fuera de 1 a 5, decimales y no numéricos', () => {
    for (const malo of [0, 6, -1, 2.5, Number.NaN, '3', null, undefined]) {
      expect(() => calcularNivel(malo as never, 3)).toThrow(ErrorCertificacion);
      expect(() => calcularNivel(3, malo as never)).toThrow(ErrorCertificacion);
    }
  });

  it('los cortes cubren toda la escala sin huecos ni solapes', () => {
    expect(ESCALA_MIN).toBe(1);
    expect(ESCALA_MAX).toBe(5);
    let esperado = 1;
    for (const c of CORTES_NIVEL) {
      expect(c.desde).toBe(esperado);
      esperado = c.hasta + 1;
    }
    expect(esperado).toBe(ESCALA_MAX * ESCALA_MAX + 1);
  });

  it('nombra cada nivel con palabras', () => {
    expect(nombreDeNivel('critico')).toBe('crítico');
  });
});

describe('Riesgo.crear', () => {
  it('acepta un riesgo mínimo: vigente, versión 1, opcionales nulos y nivel calculado', () => {
    const r = Riesgo.crear(base);
    expect(r).toMatchObject({
      codigo: 'R-001',
      descripcion: null,
      responsableId: null,
      estado: 'vigente',
      version: 1,
      puntaje: 12,
      nivel: 'alto',
    });
    expect(r.vigente).toBe(true);
  });

  it('conoce las cuatro decisiones', () => {
    expect([...DECISIONES_TRATAMIENTO]).toEqual(['mitigar', 'aceptar', 'transferir', 'evitar']);
  });

  it('exige responsable al aceptar y no para las demás decisiones', () => {
    expect(falla({ decision: 'aceptar' })?.campo).toBe('responsableId');
    expect(Riesgo.crear({ ...base, decision: 'aceptar', responsableId: PERSONA.toUpperCase() }).responsableId).toBe(PERSONA);
    for (const d of ['mitigar', 'transferir', 'evitar'] as const) expect(Riesgo.crear({ ...base, decision: d }).responsableId).toBeNull();
  });

  it('valida código, título, descripción, decisión, escala, estado y versión', () => {
    expect(falla({ codigo: 'riesgo 1' })?.campo).toBe('codigo');
    expect(falla({ codigo: 'R-1' })?.campo).toBe('codigo');
    expect(falla({ titulo: '   ' })?.campo).toBe('titulo');
    expect(falla({ titulo: 'x'.repeat(121) })?.campo).toBe('titulo');
    expect(falla({ descripcion: 'x'.repeat(1001) })?.campo).toBe('descripcion');
    expect(falla({ titulo: 'a\u0000b' })?.campo).toBe('titulo');
    expect(falla({ decision: 'ignorar' })?.campo).toBe('decision');
    expect(falla({ probabilidad: 6 })?.campo).toBe('probabilidad');
    expect(falla({ impacto: 0 })?.campo).toBe('impacto');
    expect(falla({ id: 'no-uuid' })?.campo).toBe('id');
    expect(falla({ estado: 'otro' })?.campo).toBe('estado');
    expect(falla({ version: 0 })?.campo).toBe('version');
    expect(falla({ responsableId: 'no-uuid' })?.campo).toBe('responsableId');
  });

  it('no incluye el valor recibido en el error', () => {
    expect(falla({ titulo: 'x'.repeat(500) })?.message).not.toContain('xxxxx');
  });
});

describe('Riesgo.conCambios', () => {
  it('aplica cambios, recalcula el nivel y sube la versión', () => {
    const r = Riesgo.crear(base).conCambios({ probabilidad: 1, impacto: 2 });
    expect(r).toMatchObject({ puntaje: 2, nivel: 'bajo', version: 2 });
  });

  it('devuelve el mismo riesgo si nada cambia', () => {
    const r = Riesgo.crear(base);
    expect(r.conCambios({ titulo: 'Pérdida de portátiles', probabilidad: 3 })).toBe(r);
  });

  it('pasar a aceptar sin responsable falla; quitar el responsable de uno aceptado también', () => {
    const r = Riesgo.crear(base);
    expect(() => r.conCambios({ decision: 'aceptar' })).toThrow(ErrorCertificacion);
    const aceptado = r.conCambios({ decision: 'aceptar', responsableId: PERSONA });
    expect(() => aceptado.conCambios({ responsableId: null })).toThrow(ErrorCertificacion);
    expect(aceptado.conCambios({ decision: 'transferir', responsableId: null }).responsableId).toBeNull();
  });

  it('un riesgo retirado no se cambia', () => {
    expect(() => Riesgo.crear(base).retirar().conCambios({ titulo: 'Otro' })).toThrow(ErrorCertificacion);
  });
});

describe('Riesgo.retirar', () => {
  it('conserva los datos, cambia el estado y sube la versión', () => {
    const r = Riesgo.crear(base).retirar();
    expect(r).toMatchObject({ codigo: 'R-001', estado: 'retirado', version: 2 });
    expect(r.vigente).toBe(false);
  });

  it('no se retira dos veces', () => {
    expect(() => Riesgo.crear(base).retirar().retirar()).toThrow(ErrorCertificacion);
  });
});

describe('código correlativo', () => {
  it('se arma con relleno de tres cifras y crece sin relleno', () => {
    expect([1, 12, 999, 1000, 123456].map(codigoDeRiesgo)).toEqual(['R-001', 'R-012', 'R-999', 'R-1000', 'R-123456']);
  });
  it('va y viene entre número y código', () => {
    for (const n of [1, 42, 1000, 999999]) expect(numeroDeRiesgo(codigoDeRiesgo(n))).toBe(n);
  });
  it('rechaza números fuera de rango y códigos mal formados', () => {
    for (const n of [0, -1, 1.5, 1_000_000, Number.NaN]) expect(() => codigoDeRiesgo(n)).toThrow(ErrorCertificacion);
    for (const c of ['R-1', 'r-001', 'R-001x', '', 'C-001']) expect(() => numeroDeRiesgo(c)).toThrow(ErrorCertificacion);
  });
});
