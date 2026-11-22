import { describe, expect, it } from 'vitest';
import { ErrorCertificacion } from './errores.js';
import { evaluarIndependencia, procesosDelAlcance, validarExcepcion, type RelacionDePersona } from './independencia.js';

const P1 = { id: 'p1', transversal: false };
const P2 = { id: 'p2', transversal: false };
const SIG = { id: 'sig', transversal: true };
const base = { usuarioId: 'u1', procesos: [P1, P2], relaciones: [] as RelacionDePersona[], previas: [], hoy: '2027-06-15' };

describe('independencia del auditor', () => {
  it('sin relaciones ni auditorías previas es independiente y no hay avisos', () => {
    expect(evaluarIndependencia(base)).toEqual({ independiente: true, conflictos: [], avisos: [] });
  });

  it('cada una de las cuatro relaciones con un proceso del alcance bloquea', () => {
    for (const relacion of ['duena', 'participa', 'diseno', 'supervisa'] as const) {
      const r = evaluarIndependencia({ ...base, relaciones: [{ usuarioId: 'u1', procesoId: 'p1', relacion }] });
      expect(r.independiente).toBe(false);
      expect(r.conflictos).toEqual([{ procesoId: 'p1', relaciones: [relacion] }]);
    }
  });

  it('agrupa varias relaciones con el mismo proceso y las ordena', () => {
    const r = evaluarIndependencia({
      ...base,
      relaciones: [
        { usuarioId: 'u1', procesoId: 'p1', relacion: 'supervisa' },
        { usuarioId: 'u1', procesoId: 'p1', relacion: 'duena' },
        { usuarioId: 'u1', procesoId: 'p1', relacion: 'duena' },
      ],
    });
    expect(r.conflictos).toEqual([{ procesoId: 'p1', relaciones: ['duena', 'supervisa'] }]);
  });

  it('la relación con un proceso FUERA del alcance, o de otra persona, no bloquea', () => {
    const r = evaluarIndependencia({
      ...base,
      relaciones: [
        { usuarioId: 'u1', procesoId: 'p9', relacion: 'duena' },
        { usuarioId: 'u2', procesoId: 'p1', relacion: 'duena' },
      ],
    });
    expect(r.independiente).toBe(true);
  });

  it('haber auditado el mismo proceso en los últimos 12 meses es solo un aviso, no un bloqueo', () => {
    const r = evaluarIndependencia({ ...base, previas: [{ usuarioId: 'u1', procesoId: 'p1', fecha: '2026-09-10' }] });
    expect(r.independiente).toBe(true);
    expect(r.avisos).toEqual([{ procesoId: 'p1', ultimaFecha: '2026-09-10' }]);
  });

  it('una auditoría de hace más de 12 meses, de otra persona o de otro proceso no avisa; el límite exacto sí', () => {
    const previas = [
      { usuarioId: 'u1', procesoId: 'p1', fecha: '2026-06-14' },
      { usuarioId: 'u2', procesoId: 'p2', fecha: '2027-01-01' },
      { usuarioId: 'u1', procesoId: 'p9', fecha: '2027-01-01' },
    ];
    expect(evaluarIndependencia({ ...base, previas }).avisos).toEqual([]);
    expect(evaluarIndependencia({ ...base, previas: [{ usuarioId: 'u1', procesoId: 'p2', fecha: '2026-06-15' }] }).avisos).toHaveLength(1);
  });

  it('el aviso muestra la última fecha cuando hay varias', () => {
    const previas = [
      { usuarioId: 'u1', procesoId: 'p1', fecha: '2026-08-01' },
      { usuarioId: 'u1', procesoId: 'p1', fecha: '2027-02-01' },
    ];
    expect(evaluarIndependencia({ ...base, previas }).avisos).toEqual([{ procesoId: 'p1', ultimaFecha: '2027-02-01' }]);
  });

  it('rechaza una fecha de hoy inexistente', () => {
    expect(() => evaluarIndependencia({ ...base, hoy: '2027-02-31' })).toThrow(ErrorCertificacion);
  });
});

describe('procesos del alcance', () => {
  it('suma «Gestión del SIG» solo si la auditoría cubre las cláusulas 4 a 10', () => {
    expect(procesosDelAlcance([P1], SIG, true).map((p) => p.id)).toEqual(['p1', 'sig']);
    expect(procesosDelAlcance([P1], SIG, false).map((p) => p.id)).toEqual(['p1']);
    expect(procesosDelAlcance([P1], null, true).map((p) => p.id)).toEqual(['p1']);
  });

  it('no duplica el proceso transversal si ya estaba elegido', () => {
    expect(procesosDelAlcance([P1, SIG], SIG, true).map((p) => p.id)).toEqual(['p1', 'sig']);
  });

  it('el administrador que diseña el sistema no puede auditar los requisitos transversales', () => {
    const alcance = procesosDelAlcance([P1], SIG, true);
    const r = evaluarIndependencia({ ...base, procesos: alcance, relaciones: [{ usuarioId: 'u1', procesoId: 'sig', relacion: 'diseno' }] });
    expect(r.conflictos).toEqual([{ procesoId: 'sig', relaciones: ['diseno'] }]);
  });
});

describe('excepción de independencia', () => {
  const ok = {
    motivo: ' no hay otra persona ',
    medida: 'otra persona revisa el informe',
    autorizadaPor: 'admin',
    designada: 'u1',
    unicoAdministradorActivo: false,
  };

  it('exige motivo y medida compensatoria y los devuelve sin espacios sobrantes', () => {
    expect(validarExcepcion(ok)).toEqual({
      motivo: 'no hay otra persona',
      medida: 'otra persona revisa el informe',
      autoautorizada: false,
    });
    expect(() => validarExcepcion({ ...ok, motivo: '  ' })).toThrow(ErrorCertificacion);
    expect(() => validarExcepcion({ ...ok, medida: '' })).toThrow(ErrorCertificacion);
    expect(() => validarExcepcion({ ...ok, medida: 'x'.repeat(301) })).toThrow(ErrorCertificacion);
  });

  it('nadie autoriza su propia excepción, salvo el único administrador activo (queda marcada)', () => {
    expect(() => validarExcepcion({ ...ok, autorizadaPor: 'u1' })).toThrow(ErrorCertificacion);
    expect(validarExcepcion({ ...ok, autorizadaPor: 'u1', unicoAdministradorActivo: true }).autoautorizada).toBe(true);
  });

  it('el error nombra el campo y nunca el texto recibido', () => {
    try {
      validarExcepcion({ ...ok, motivo: '' });
    } catch (e) {
      expect((e as ErrorCertificacion).campo).toBe('motivo');
      expect((e as Error).message).not.toContain('otra persona');
    }
  });
});
