import { describe, expect, it } from 'vitest';
import { validarCoberturaDocumental, validarDirectorio, validarDocumento, validarDocumentoDetalle, validarLecturasPendientes, validarListaDocumentos, validarRetenciones, validarVersionDocumento } from './validadores';

const D1 = 'dddddddd-1111-4111-8111-111111111111';
const V1 = 'eeeeeeee-1111-4111-8111-111111111111';
const V2 = 'eeeeeeee-2222-4222-8222-222222222222';
const U1 = '11111111-1111-4111-8111-1111111111a1';
const SHA = 'a'.repeat(64);

const doc = (o: Record<string, unknown> = {}) => ({
  id: D1, codigo: 'POL-001', tipo: 'politica', titulo: 'Política de acceso', area: null, clasificacion: 'interna', responsableId: U1, emisor: null, edicionFuente: null, estado: 'activo',
  proximaRevision: '2027-11-18', revision: 'al_dia', ultimaRevisionEn: null, vigente: { versionId: V1, numero: 1, aprobadaEn: '2026-11-18T15:00:00.000Z' }, sinVigente: false,
  lecturas: { confirmadas: 1, total: 2 }, lecturaPendiente: false, version: 1, ...o,
});
const version = (o: Record<string, unknown> = {}) => ({
  id: V1, documentoId: D1, numero: 1, estado: 'aprobada', vigente: true, nota: 'versión inicial', archivo: { nombre: 'politica.pdf', tipo: 'application/pdf', bytes: 1200, sha256: SHA },
  autorId: U1, aprobadorId: U1, aprobadaPor: U1, aprobadaEn: '2026-11-18T15:00:00.000Z', porSuAutor: false, motivoExcepcion: null, requiereLectura: false, devueltaMotivo: null, devueltaNota: null,
  obsoletaEn: null, elegibleParaDisposicion: false, lecturas: null, creadaEn: '2026-11-18T14:00:00.000Z', ...o,
});
const detalle = (o: Record<string, unknown> = {}) => ({ ...doc(), versiones: [version()], destinatarios: [U1], controles: [], entradas: [{ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' }], retencion: null, unicoAdministrador: false, ...o });

describe('documento y lista', () => {
  it('acepta un documento y una lista válidos', () => {
    expect(validarDocumento(doc())).not.toBeNull();
    expect(validarListaDocumentos({ hoy: '2026-11-18', documentos: [doc()] })).not.toBeNull();
    expect(validarListaDocumentos({ hoy: '2026-11-18', documentos: [] })).not.toBeNull();
  });
  it('rechaza campos de más o de menos, tipos y listas cerradas', () => {
    expect(validarDocumento({ ...doc(), extra: 1 })).toBeNull();
    const sin: Record<string, unknown> = doc();
    delete sin['titulo'];
    expect(validarDocumento(sin)).toBeNull();
    for (const mal of [{ tipo: 'carta' }, { clasificacion: 'secreta' }, { codigo: 'pol-1' }, { estado: 'borrado' }, { revision: 'tarde' }, { version: 0 }, { titulo: '' }, { responsableId: 'x' }]) expect(validarDocumento(doc(mal)), JSON.stringify(mal)).toBeNull();
    expect(validarListaDocumentos({ hoy: '18/11/2026', documentos: [] })).toBeNull();
  });
  it('rechaza lo incoherente: «sin vigente» que no coincide, revisión sin versión vigente y códigos repetidos', () => {
    expect(validarDocumento(doc({ sinVigente: true }))).toBeNull();
    expect(validarDocumento(doc({ vigente: null, sinVigente: true }))).toBeNull(); // la fecha de revisión no existe sin versión vigente
    expect(validarDocumento(doc({ vigente: null, sinVigente: true, proximaRevision: null, revision: null }))).not.toBeNull();
    expect(validarDocumento(doc({ estado: 'retirado', vigente: null, sinVigente: true, proximaRevision: null, revision: null }))).toBeNull(); // retirado no está «sin vigente»
    expect(validarListaDocumentos({ hoy: '2026-11-18', documentos: [doc(), doc({ id: V2 })] })).toBeNull();
    expect(validarListaDocumentos({ hoy: '2026-11-18', documentos: Array.from({ length: 1001 }, () => doc()) })).toBeNull();
  });
  it('las lecturas no pueden confirmar más de las que hay', () => {
    expect(validarDocumento(doc({ lecturas: { confirmadas: 3, total: 2 } }))).toBeNull();
    expect(validarDocumento(doc({ lecturas: null }))).not.toBeNull();
  });
});

describe('versión y detalle', () => {
  it('acepta una versión válida y rechaza las incoherentes', () => {
    expect(validarVersionDocumento(version())).not.toBeNull();
    for (const mal of [{ vigente: false }, { estado: 'borrador' }, { porSuAutor: true }, { motivoExcepcion: 'x' }, { elegibleParaDisposicion: true }, { estado: 'obsoleta', aprobadaEn: null }, { archivo: { nombre: 'a', tipo: 'application/pdf', bytes: 0, sha256: SHA } }, { archivo: { nombre: 'a', tipo: 'application/pdf', bytes: 5, sha256: 'xyz' } }, { devueltaMotivo: 'quiero' }]) expect(validarVersionDocumento(version(mal)), JSON.stringify(mal)).toBeNull();
    expect(validarVersionDocumento(version({ porSuAutor: true, motivoExcepcion: 'único administrador' }))).not.toBeNull();
    expect(validarVersionDocumento(version({ estado: 'obsoleta', vigente: false, elegibleParaDisposicion: true, obsoletaEn: '2026-11-19T10:00:00.000Z' }))).not.toBeNull();
  });
  it('el detalle acepta uno válido y exige UNA sola vigente que coincida con el encabezado', () => {
    expect(validarDocumentoDetalle(detalle())).not.toBeNull();
    const dos = [version(), version({ id: V2, numero: 2 })];
    expect(validarDocumentoDetalle(detalle({ versiones: dos }))).toBeNull();
    expect(validarDocumentoDetalle(detalle({ versiones: [] }))).toBeNull(); // el encabezado dice que hay vigente
    expect(validarDocumentoDetalle(detalle({ versiones: [version({ documentoId: V2 })] }))).toBeNull();
    expect(validarDocumentoDetalle(detalle({ versiones: [version(), version({ id: V2, estado: 'obsoleta', vigente: false })] }))).toBeNull(); // mismo número repetido
    expect(validarDocumentoDetalle(detalle({ versiones: [version(), version({ id: V2, numero: 2, estado: 'obsoleta', vigente: false })] }))).not.toBeNull();
  });
  it('rechaza destinatarios repetidos, entradas mal formadas y retención rara', () => {
    expect(validarDocumentoDetalle(detalle({ destinatarios: [U1, U1] }))).toBeNull();
    expect(validarDocumentoDetalle(detalle({ entradas: [{ libreriaCodigo: 'Mayúsculas', idEstable: 'x' }] }))).toBeNull();
    expect(validarDocumentoDetalle(detalle({ retencion: { anios: 0, motivo: 'x' } }))).toBeNull();
    expect(validarDocumentoDetalle(detalle({ retencion: { anios: 5, motivo: 'ley' } }))).not.toBeNull();
    expect(validarDocumentoDetalle(detalle({ extra: true }))).toBeNull();
  });
});

describe('lecturas, cobertura, retención y directorio', () => {
  it('lecturas pendientes', () => {
    expect(validarLecturasPendientes([{ versionId: V1, documentoId: D1, codigo: 'POL-001', titulo: 'x', numeroVersion: 1 }])).not.toBeNull();
    expect(validarLecturasPendientes([{ versionId: V1, documentoId: D1, codigo: 'POL-001', titulo: 'x', numeroVersion: 0 }])).toBeNull();
    expect(validarLecturasPendientes({})).toBeNull();
  });
  it('cobertura: «cubierta» debe coincidir con tener documentos', () => {
    const entrada = (o: Record<string, unknown> = {}) => ({ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', tipo: 'control', titulo: 'Políticas', normas: ['ISO/IEC 27001'], documentos: [{ id: D1, codigo: 'POL-001' }], cubierta: true, ...o });
    expect(validarCoberturaDocumental({ normas: ['ISO/IEC 27001'], total: 1, cubiertas: 1, entradas: [entrada()] })).not.toBeNull();
    expect(validarCoberturaDocumental({ normas: [], total: 1, cubiertas: 1, entradas: [entrada({ cubierta: false })] })).toBeNull();
    expect(validarCoberturaDocumental({ normas: [], total: 1, cubiertas: 2, entradas: [] })).toBeNull();
  });
  it('retención: un solo registro por tipo', () => {
    const r = { tipo: 'politica', anios: 5, motivo: 'ley', version: 1 };
    expect(validarRetenciones([r])).not.toBeNull();
    expect(validarRetenciones([r, r])).toBeNull();
    expect(validarRetenciones([{ ...r, anios: 101 }])).toBeNull();
  });
  it('directorio: solo identificador, nombre, activa y puedeAprobar (una persona de baja no aprueba)', () => {
    expect(validarDirectorio([{ id: U1, nombre: 'Ana', activa: true, puedeAprobar: true }])).not.toBeNull();
    expect(validarDirectorio([{ id: U1, nombre: 'Ana', activa: false, puedeAprobar: true }])).toBeNull();
    expect(validarDirectorio([{ id: U1, nombre: 'Ana', activa: true, puedeAprobar: false, correo: 'a@example.test' }])).toBeNull();
    expect(validarDirectorio([{ id: U1, nombre: 'Ana', activa: true, puedeAprobar: false }, { id: U1, nombre: 'Ana', activa: true, puedeAprobar: false }])).toBeNull();
  });
});
