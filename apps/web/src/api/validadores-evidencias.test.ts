// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validarCobertura, validarEvidencias } from './validadores';

const UUID = '5eed0001-0000-4000-8000-0000000000a1';
const SHA = 'a'.repeat(64);
const evidencia = (c: Record<string, unknown> = {}) => ({
  id: UUID, controlId: UUID, tipo: 'documento', titulo: 'Política aprobada', fechaHecho: '2026-11-01', vigenteHasta: null, estado: 'activa', reemplazaId: null,
  vigente: true, vencida: false, creadaEn: '2026-11-11T15:00:00.000Z', archivo: { nombre: 'politica.pdf', tipo: 'application/pdf', bytes: 1234, sha256: SHA }, ...c,
});
const desglose = (c: Record<string, unknown> = {}) => ({ total: 4, cubiertas: 2, evidenciaVencida: 1, sinEvidencia: 1, sinControl: 0, porcentaje: 50, ...c });
const entrada = (c: Record<string, unknown> = {}) => ({ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', tipo: 'control', capitulo: null, grupo: 'Organizacionales', titulo: 'Políticas', normas: ['ISO/IEC 27001'], estado: 'cubierta', controles: 1, evidencias: 2, ...c });
const cobertura = (c: Record<string, unknown> = {}) => ({ hoy: '2026-11-11', entradas: [entrada()], porNorma: [{ norma: 'ISO/IEC 27001', ...desglose() }], total: desglose(), normas: ['ISO/IEC 27001'], ...c });

describe('validarEvidencias', () => {
  it('acepta la forma exacta del contrato, también reemplazada o vencida', () => {
    expect(validarEvidencias([evidencia(), evidencia({ estado: 'reemplazada', vigente: false, reemplazaId: UUID }), evidencia({ vigente: false, vencida: true, vigenteHasta: '2026-01-01' })])).toHaveLength(3);
    expect(validarEvidencias([])).toEqual([]);
  });

  it('rechaza entero lo que no cumple: campos de más o de menos, tipos, fechas, huella, tamaño, estado y coherencia', () => {
    const malos: unknown[] = [
      {}, null, 'x', Array.from({ length: 101 }, () => evidencia()),
      [{ ...evidencia(), extra: 1 }], [evidencia({ archivo: { nombre: 'x.pdf', tipo: 'application/pdf', bytes: 10, sha256: SHA, ruta: '/etc/passwd' } })],
      [evidencia({ id: 'x' })], [evidencia({ tipo: 'otro' })], [evidencia({ titulo: '' })], [evidencia({ fechaHecho: '01/11/2026' })], [evidencia({ vigenteHasta: 'mañana' })],
      [evidencia({ estado: 'borrada' })], [evidencia({ vigente: 'si' })], [evidencia({ creadaEn: 'ayer' })],
      [evidencia({ archivo: { nombre: 'x.svg', tipo: 'image/svg+xml', bytes: 10, sha256: SHA } })], [evidencia({ archivo: { nombre: 'x.pdf', tipo: 'text/html', bytes: 10, sha256: SHA } })],
      [evidencia({ archivo: { nombre: 'x.pdf', tipo: 'application/pdf', bytes: 0, sha256: SHA } })], [evidencia({ archivo: { nombre: 'x.pdf', tipo: 'application/pdf', bytes: 26_214_401, sha256: SHA } })],
      [evidencia({ archivo: { nombre: 'x.pdf', tipo: 'application/pdf', bytes: 10, sha256: 'xyz' } })], [evidencia({ archivo: { nombre: '', tipo: 'application/pdf', bytes: 10, sha256: SHA } })],
      [evidencia({ vigente: true, vencida: true })], // no puede estar vigente y vencida a la vez
      [evidencia({ estado: 'eliminada', vigente: true })], // solo una activa puede estar vigente
    ];
    for (const [i, malo] of malos.entries()) expect(validarEvidencias(malo), `caso ${i}`).toBeNull();
  });
});

describe('validarCobertura', () => {
  it('acepta la forma exacta del contrato, también sin porcentaje', () => {
    expect(validarCobertura(cobertura())?.entradas).toHaveLength(1);
    expect(validarCobertura(cobertura({ total: desglose({ total: 0, cubiertas: 0, evidenciaVencida: 0, sinEvidencia: 0, porcentaje: null }), entradas: [], porNorma: [], normas: [] }))?.total.porcentaje).toBeNull();
  });

  it('rechaza entera una cobertura que no cumple: formas, estados, coherencia de las cuentas y topes', () => {
    const malos: unknown[] = [
      null, {}, { ...cobertura(), extra: 1 }, cobertura({ hoy: '11/11/2026' }),
      cobertura({ total: desglose({ cubiertas: 9 }) }), // las cuentas no suman el total
      cobertura({ total: desglose({ porcentaje: 101 }) }), cobertura({ total: desglose({ total: -1 }) }),
      cobertura({ entradas: [entrada({ estado: 'perfecta' })] }), cobertura({ entradas: [entrada({ tipo: 'clausula' })] }), // una cláusula lleva capítulo y no tema
      cobertura({ entradas: [entrada({ idEstable: '../x' })] }), cobertura({ entradas: [entrada({ normas: [] })] }), cobertura({ entradas: [entrada({ controles: -1 })] }),
      cobertura({ entradas: [{ ...entrada(), extra: 1 }] }), cobertura({ porNorma: [{ ...desglose(), norma: '' }] }), cobertura({ porNorma: [desglose()] }),
      cobertura({ entradas: Array.from({ length: 501 }, () => entrada()) }), cobertura({ normas: ['a'.repeat(61)] }),
    ];
    for (const [i, malo] of malos.entries()) expect(validarCobertura(malo), `caso ${i}`).toBeNull();
  });
});
