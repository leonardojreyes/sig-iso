import { describe, expect, it } from 'vitest';
import { validarAuditoria, validarInforme, validarListaProcesos, validarPanel } from './validadores';

const ID = 'dddddddd-1111-4111-8111-111111111111';
const PERSONA = '22222222-2222-4222-8222-222222222222';
const proceso = { id: ID, codigo: 'PR-001', nombre: 'Compras', descripcion: null, duenaId: PERSONA, importancia: 'alta', frecuencia: 'anual', transversal: false, cambioRelevante: null, estado: 'vigente', version: 1, personasRelacionadas: 1, avisos: [] };

describe('validadores de la auditoría interna', () => {
  it('aceptan la forma exacta del contrato', () => {
    expect(validarListaProcesos({ procesos: [proceso], gestionSigVigente: false })).toEqual({ procesos: [proceso], gestionSigVigente: false });
  });

  it('rechazan entera una respuesta con un campo de más, de menos, un valor fuera de lista o un tipo equivocado', () => {
    const lista = (p: unknown) => validarListaProcesos({ procesos: [p], gestionSigVigente: false });
    expect(lista({ ...proceso, extra: 1 })).toBeNull();
    const { avisos: _a, ...sinAvisos } = proceso;
    void _a;
    expect(lista(sinAvisos)).toBeNull();
    expect(lista({ ...proceso, importancia: 'enorme' })).toBeNull();
    expect(lista({ ...proceso, version: '1' })).toBeNull();
    expect(lista({ ...proceso, id: 'no-uuid' })).toBeNull();
    expect(lista({ ...proceso, codigo: 'PR-1' })).toBeNull();
    expect(lista({ ...proceso, avisos: ['inventado'] })).toBeNull();
    expect(validarListaProcesos(null)).toBeNull();
    expect(validarListaProcesos({ procesos: 'x', gestionSigVigente: false })).toBeNull();
    expect(validarListaProcesos({ procesos: Array.from({ length: 201 }, () => proceso), gestionSigVigente: false })).toBeNull();
  });

  it('una auditoría con un estado desconocido o una fecha inexistente no se acepta', () => {
    const a = {
      id: ID, programaId: ID, codigo: 'AI-2027-01', anio: 2027, objetivo: 'x', estado: 'planificada', inicio: '2027-03-01', fin: '2027-03-05', reunionApertura: null, reunionCierre: null,
      reprogramaciones: 0, cancelacionMotivo: null, informeEmitidoEn: null, cerradaEn: null, version: 1, normas: ['iso-27001'], combinada: false, procesosIds: [], procesosDelAlcance: [], capitulos: [], equipo: [],
    };
    expect(validarAuditoria(a)).toEqual(a);
    expect(validarAuditoria({ ...a, estado: 'archivada' })).toBeNull();
    expect(validarAuditoria({ ...a, codigo: 'AI-27-1' })).toBeNull();
    expect(validarAuditoria({ ...a, normas: ['../x'] })).toBeNull();
  });

  it('el informe valida su envoltura y lo que la pantalla usa; no lee el resto de la copia', () => {
    const conteos = { por_evaluar: 0, conforme: 1, no_conforme: 0, observacion: 0, oportunidad: 0, no_aplica: 0, no_verificado: 0, total: 1, cubiertas: 1 };
    const inf = { auditoriaId: ID, codigo: 'AI-2027-01', huella: 'a'.repeat(64), emitidoPor: PERSONA, emitidoEn: '2027-03-05T15:00:00.000Z', contenido: { conclusion: 'Conforme', limitaciones: null, conteos, equipo: [] } };
    expect(validarInforme(inf)).toMatchObject({ conclusion: 'Conforme', limitaciones: null, huella: 'a'.repeat(64) });
    expect(validarInforme({ ...inf, huella: 'zz' })).toBeNull();
    expect(validarInforme({ ...inf, contenido: { ...inf.contenido, conclusion: '' } })).toBeNull();
    expect(validarInforme({ ...inf, contenido: { ...inf.contenido, conteos: { total: 1 } } })).toBeNull();
    expect(validarInforme({ ...inf, extra: true })).toBeNull();
  });

  it('el panel exige el prerrequisito completo', () => {
    expect(validarPanel({ programaAnio: null })).toBeNull();
    expect(validarPanel('x')).toBeNull();
  });
});
