import { describe, expect, it } from 'vitest';
import {
  aprobar,
  codigoDeDocumento,
  descartarBorrador,
  devolverABorrador,
  elegibleParaDisposicion,
  enviarARevision,
  esInmutable,
  esVigente,
  estadoDeRevision,
  puedeNombrarseAprobador,
  resumenDeLecturas,
  unAnioDespues,
  validarAniosRetencion,
  validarDatosDocumento,
  validarFechaRevision,
  validarNotaVersion,
  type VersionFlujo,
} from './documento.js';
import { ErrorCertificacion } from './errores.js';

const AUTOR = 'a1a1a1a1-0000-4000-8000-000000000001';
const OTRO = 'b2b2b2b2-0000-4000-8000-000000000002';
const AHORA = new Date('2026-11-18T15:00:00Z');
const v = (estado: VersionFlujo['estado'], aprobadorId: string | null = null): VersionFlujo => ({ estado, autorId: AUTOR, aprobadorId });
const falla = (f: () => unknown, campo: string, motivo?: string) => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorCertificacion);
    expect((e as ErrorCertificacion).campo).toBe(campo);
    if (motivo) expect((e as ErrorCertificacion).motivos).toContain(motivo);
    return;
  }
  throw new Error('debía fallar');
};

describe('código del documento', () => {
  it('lleva el prefijo del tipo y un correlativo de tres cifras como mínimo', () => {
    expect(codigoDeDocumento('politica', 1)).toBe('POL-001');
    expect(codigoDeDocumento('procedimiento', 42)).toBe('PRO-042');
    expect(codigoDeDocumento('externo', 1234)).toBe('EXT-1234');
    expect(codigoDeDocumento('otro', 7)).toBe('OTR-007');
  });
});

describe('datos del documento', () => {
  const base = { tipo: 'politica', titulo: '  Política de acceso  ', clasificacion: 'interna' };
  it('normaliza el título y deja el área, el emisor y la edición en nulo', () => {
    expect(validarDatosDocumento(base)).toEqual({
      tipo: 'politica',
      titulo: 'Política de acceso',
      area: null,
      clasificacion: 'interna',
      emisor: null,
      edicionFuente: null,
    });
  });
  it('rechaza un tipo o una clasificación fuera de la lista y un título vacío, largo o con caracteres de control', () => {
    falla(() => validarDatosDocumento({ ...base, tipo: 'carta' }), 'tipo');
    falla(() => validarDatosDocumento({ ...base, clasificacion: 'secreta' }), 'clasificacion');
    falla(() => validarDatosDocumento({ ...base, titulo: '   ' }), 'titulo');
    falla(() => validarDatosDocumento({ ...base, titulo: 'x'.repeat(121) }), 'titulo');
    falla(() => validarDatosDocumento({ ...base, titulo: 'a\u0000b' }), 'titulo');
    falla(() => validarDatosDocumento({ ...base, titulo: 7 }), 'titulo');
  });
  it('solo el documento externo lleva emisor y edición de la fuente', () => {
    falla(() => validarDatosDocumento({ ...base, emisor: 'Un organismo' }), 'emisor', 'solo_externo');
    falla(() => validarDatosDocumento({ ...base, edicionFuente: '2024' }), 'edicionFuente', 'solo_externo');
    expect(validarDatosDocumento({ ...base, tipo: 'externo', emisor: 'Un organismo', edicionFuente: '2024', area: 'Legal' })).toMatchObject(
      { emisor: 'Un organismo', edicionFuente: '2024', area: 'Legal' },
    );
  });
  it('la nota de cambios es obligatoria y acotada', () => {
    expect(validarNotaVersion(' versión inicial ')).toBe('versión inicial');
    falla(() => validarNotaVersion(''), 'nota');
    falla(() => validarNotaVersion(undefined), 'nota');
    falla(() => validarNotaVersion('x'.repeat(501)), 'nota');
  });
});

describe('flujo de una versión', () => {
  it('solo un borrador se envía a revisión, nombrando al aprobador', () => {
    expect(enviarARevision(v('borrador'), OTRO)).toEqual({ estado: 'en_revision', aprobadorId: OTRO });
    for (const e of ['en_revision', 'aprobada', 'obsoleta', 'descartada'] as const) falla(() => enviarARevision(v(e), OTRO), 'estado');
  });
  it('un borrador se descarta; el resto no', () => {
    expect(descartarBorrador(v('borrador'))).toEqual({ estado: 'descartada' });
    for (const e of ['en_revision', 'aprobada', 'obsoleta', 'descartada'] as const) falla(() => descartarBorrador(v(e)), 'estado');
  });
  it('se devuelve a borrador con un motivo de lista cerrada y una nota opcional', () => {
    expect(devolverABorrador(v('en_revision', OTRO), 'incompleta', ' falta el alcance ')).toEqual({
      estado: 'borrador',
      motivo: 'incompleta',
      nota: 'falta el alcance',
    });
    expect(devolverABorrador(v('en_revision', OTRO), 'otro', undefined).nota).toBeNull();
    falla(() => devolverABorrador(v('en_revision', OTRO), 'no me gusta', undefined), 'motivo');
    falla(() => devolverABorrador(v('borrador'), 'incompleta', undefined), 'estado');
    falla(() => devolverABorrador(v('en_revision', OTRO), 'otro', 'x'.repeat(301)), 'nota');
  });
});

describe('aprobar: separación de funciones', () => {
  it('otra persona aprueba sin motivo; la versión no queda marcada como propia', () => {
    const r = aprobar(v('en_revision', OTRO), { aprobadorId: OTRO, ahora: AHORA, administradoresActivos: 2, requiereLectura: true });
    expect(r).toEqual({ aprobadaPor: OTRO, aprobadaEn: AHORA, porSuAutor: false, motivoExcepcion: null, requiereLectura: true });
  });
  it('la lectura nueva solo se pide si se marca (por omisión no)', () => {
    expect(aprobar(v('en_revision', OTRO), { aprobadorId: OTRO, ahora: AHORA, administradoresActivos: 2 }).requiereLectura).toBe(false);
    falla(
      () => aprobar(v('en_revision', OTRO), { aprobadorId: OTRO, ahora: AHORA, administradoresActivos: 2, requiereLectura: 'sí' }),
      'requiereLectura',
    );
  });
  it('solo aprueba quien fue nombrado y solo desde «en revisión»', () => {
    falla(
      () => aprobar(v('en_revision', OTRO), { aprobadorId: AUTOR, ahora: AHORA, administradoresActivos: 3, motivoExcepcion: 'x' }),
      'aprobadorId',
      'no_es_el_aprobador',
    );
    falla(() => aprobar(v('borrador'), { aprobadorId: OTRO, ahora: AHORA, administradoresActivos: 2 }), 'estado');
    falla(() => aprobar(v('aprobada', OTRO), { aprobadorId: OTRO, ahora: AHORA, administradoresActivos: 2 }), 'estado');
  });
  it('el autor no aprueba su propia versión si hay dos o más administradores', () => {
    const ver = { estado: 'en_revision', autorId: AUTOR, aprobadorId: AUTOR } as const;
    falla(
      () => aprobar(ver, { aprobadorId: AUTOR, ahora: AHORA, administradoresActivos: 2, motivoExcepcion: 'soy yo' }),
      'aprobadorId',
      'es_el_autor',
    );
  });
  it('con un solo administrador puede aprobar la suya, pero con motivo obligatorio y marcada', () => {
    const ver = { estado: 'en_revision', autorId: AUTOR, aprobadorId: AUTOR } as const;
    falla(() => aprobar(ver, { aprobadorId: AUTOR, ahora: AHORA, administradoresActivos: 1 }), 'motivoExcepcion');
    falla(() => aprobar(ver, { aprobadorId: AUTOR, ahora: AHORA, administradoresActivos: 1, motivoExcepcion: '  ' }), 'motivoExcepcion');
    expect(
      aprobar(ver, { aprobadorId: AUTOR, ahora: AHORA, administradoresActivos: 1, motivoExcepcion: ' soy el único administrador ' }),
    ).toMatchObject({ porSuAutor: true, motivoExcepcion: 'soy el único administrador' });
  });
  it('no se acepta un motivo de excepción cuando aprueba otra persona', () => {
    falla(
      () => aprobar(v('en_revision', OTRO), { aprobadorId: OTRO, ahora: AHORA, administradoresActivos: 2, motivoExcepcion: 'x' }),
      'motivoExcepcion',
      'no_corresponde',
    );
  });
  it('a quién se puede nombrar como aprobador', () => {
    expect(puedeNombrarseAprobador(AUTOR, OTRO, 2)).toBe(true);
    expect(puedeNombrarseAprobador(AUTOR, AUTOR, 2)).toBe(false);
    expect(puedeNombrarseAprobador(AUTOR, AUTOR, 1)).toBe(true);
  });
});

describe('vigencia e inmutabilidad', () => {
  it('solo la versión aprobada rige', () => {
    expect(esVigente('aprobada')).toBe(true);
    for (const e of ['borrador', 'en_revision', 'obsoleta', 'descartada'] as const) expect(esVigente(e)).toBe(false);
  });
  it('una versión aprobada u obsoleta es inmutable', () => {
    expect(esInmutable('aprobada')).toBe(true);
    expect(esInmutable('obsoleta')).toBe(true);
    for (const e of ['borrador', 'en_revision', 'descartada'] as const) expect(esInmutable(e)).toBe(false);
  });
});

describe('revisión periódica', () => {
  it('un año después, incluido el 29 de febrero', () => {
    expect(unAnioDespues('2026-11-18')).toBe('2027-11-18');
    expect(unAnioDespues('2028-02-29')).toBe('2029-02-28');
    falla(() => unAnioDespues('2026-02-31'), 'fecha');
  });
  it('vencida, por vencer en 30 días o al día; sin fecha no hay estado', () => {
    expect(estadoDeRevision('2026-11-17', '2026-11-18')).toBe('vencida');
    expect(estadoDeRevision('2026-11-18', '2026-11-18')).toBe('por_vencer');
    expect(estadoDeRevision('2026-12-18', '2026-11-18')).toBe('por_vencer');
    expect(estadoDeRevision('2026-12-19', '2026-11-18')).toBe('al_dia');
    expect(estadoDeRevision(null, '2026-11-18')).toBeNull();
  });
  it('la fecha editable no puede estar en el pasado ni ser imposible', () => {
    expect(validarFechaRevision('2026-11-18', '2026-11-18')).toBe('2026-11-18');
    falla(() => validarFechaRevision('2026-11-17', '2026-11-18'), 'proximaRevision', 'en_el_pasado');
    falla(() => validarFechaRevision('2026-02-30', '2026-11-18'), 'proximaRevision');
  });
});

describe('retención y elegibilidad para disposición', () => {
  const obsoleta = { estado: 'obsoleta' as const, obsoletaEn: new Date('2020-03-10T12:00:00Z') };
  it('los años de retención son enteros de 1 a 100', () => {
    expect(validarAniosRetencion(5)).toBe(5);
    for (const malo of [0, 101, 1.5, '5', null]) falla(() => validarAniosRetencion(malo), 'anios');
  });
  it('es elegible cuando pasaron los años desde que quedó obsoleta, y solo entonces', () => {
    expect(elegibleParaDisposicion(obsoleta, 5, '2025-03-10')).toBe(true);
    expect(elegibleParaDisposicion(obsoleta, 5, '2025-03-09')).toBe(false);
  });
  it('sin retención definida, o si no está obsoleta, nunca es elegible (no se borra nada solo)', () => {
    expect(elegibleParaDisposicion(obsoleta, null, '2099-01-01')).toBe(false);
    for (const e of ['borrador', 'en_revision', 'aprobada', 'descartada'] as const)
      expect(elegibleParaDisposicion({ estado: e, obsoletaEn: null }, 1, '2099-01-01')).toBe(false);
  });
});

describe('lecturas confirmadas', () => {
  it('cuenta solo a quienes siguen en la empresa; la confirmación de quien se fue se conserva pero no suma', () => {
    const lecturas = [
      { usuarioId: 'u1', confirmada: true },
      { usuarioId: 'u2', confirmada: false },
      { usuarioId: 'u3', confirmada: true },
    ];
    expect(resumenDeLecturas(lecturas, new Set(['u1', 'u2']))).toEqual({ confirmadas: 1, total: 2 });
    expect(resumenDeLecturas([], new Set())).toEqual({ confirmadas: 0, total: 0 });
  });
});
