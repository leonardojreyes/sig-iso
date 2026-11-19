import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { CoberturaDocumental, Documento, DocumentoDetalle, LecturaPendiente, PersonaDirectorio, Retencion, VersionDocumento } from '../documentos/tipos';
import { PantallaCoberturaDocumental } from './cobertura-documental';
import { PantallaDocumentoDetalle } from './documento-detalle';
import { PantallaDocumentos } from './documentos';

const empresa = { id: 'empresa-a', nombre: 'Empresa A (prueba)', primario: '#0b5fff' };
const admin = { nombre: 'Laura Mena', roles: ['administrador_sig'] as const };
const colab = { nombre: 'Pedro Soto', roles: ['colaborador'] as const };
const D1 = 'dddddddd-1111-4111-8111-111111111111';
const D2 = 'dddddddd-2222-4222-8222-222222222222';
const V1 = 'eeeeeeee-1111-4111-8111-111111111111';
const V2 = 'eeeeeeee-2222-4222-8222-222222222222';
const V3 = 'eeeeeeee-3333-4333-8333-333333333333';
const U1 = '11111111-1111-4111-8111-1111111111a1';
const U2 = '22222222-2222-4222-8222-2222222222b2';
const U3 = '33333333-3333-4333-8333-3333333333c3';
const SHA = 'a'.repeat(64);
const personas: PersonaDirectorio[] = [
  { id: U1, nombre: 'Laura Mena', activa: true, puedeAprobar: true },
  { id: U2, nombre: 'Pedro Soto', activa: true, puedeAprobar: false },
  { id: U3, nombre: 'Dario Retirado', activa: false, puedeAprobar: false },
];

const doc = (o: Partial<Documento> = {}): Documento => ({
  id: D1, codigo: 'POL-001', tipo: 'politica', titulo: 'Política de acceso', area: 'Seguridad', clasificacion: 'interna', responsableId: U1, emisor: null, edicionFuente: null, estado: 'activo',
  proximaRevision: '2027-11-18', revision: 'al_dia', ultimaRevisionEn: null, vigente: { versionId: V1, numero: 1, aprobadaEn: '2026-11-18T15:00:00.000Z' }, sinVigente: false,
  lecturas: { confirmadas: 1, total: 3 }, lecturaPendiente: false, version: 2, ...o,
});
const lista = (): Documento[] => [
  doc(),
  doc({ id: D2, codigo: 'PRO-001', tipo: 'procedimiento', titulo: 'Gestión de cambios', vigente: null, sinVigente: true, proximaRevision: null, revision: null, lecturas: null, area: null }),
  doc({ id: 'dddddddd-3333-4333-8333-333333333333', codigo: 'EXT-001', tipo: 'externo', titulo: 'Reglamento', emisor: 'Un organismo', edicionFuente: '2024', revision: 'vencida', proximaRevision: '2026-01-01', lecturaPendiente: true }),
  doc({ id: 'dddddddd-4444-4444-8444-444444444444', codigo: 'MAN-001', tipo: 'manual', titulo: 'Manual retirado', estado: 'retirado', vigente: null, sinVigente: false, proximaRevision: null, revision: null, lecturas: null }),
];
const pendientes: LecturaPendiente[] = [{ versionId: V1, documentoId: D1, codigo: 'POL-001', titulo: 'Política de acceso', numeroVersion: 1 }];
const retenciones: Retencion[] = [{ tipo: 'politica', anios: 5, motivo: 'Política de la empresa', version: 1 }];
const baseLista = { empresa, persona: admin, documentos: lista(), personas, pendientes, retenciones, filtros: {}, filtrosInvalidos: false, aviso: null };

describe('PantallaDocumentos', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaDocumentos key="a" {...baseLista} />,
      <PantallaDocumentos key="b" {...baseLista} aviso="documento_creado" />,
      <PantallaDocumentos key="c" {...baseLista} persona={colab} />,
      <PantallaDocumentos key="d" {...baseLista} documentos={[]} pendientes={[]} />,
      <PantallaDocumentos key="e" {...baseLista} documentos={[]} pendientes={[]} persona={colab} />,
      <PantallaDocumentos key="f" {...baseLista} filtros={{ tipo: 'politica', sinVigente: true }} />,
      <PantallaDocumentos key="g" {...baseLista} filtrosInvalidos />,
      <PantallaDocumentos key="h" {...baseLista} aviso="conflicto" />,
      <PantallaDocumentos key="i" {...baseLista} retenciones={[]} pendientes={[]} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
  it('marca con palabras (no solo color) lo sin versión vigente, lo vencido, lo retirado y las lecturas pendientes', () => {
    const { container } = render(<PantallaDocumentos {...baseLista} />);
    for (const t of ['Sin versión vigente', 'Revisión vencida', 'Revisión al día', 'Retirado', 'Tiene una lectura pendiente', '1 de 3']) expect(container.textContent, t).toContain(t);
  });
  it('dice que la clasificación es informativa y que leer es una constancia, no una capacitación', () => {
    const { container } = render(<PantallaDocumentos {...baseLista} />);
    expect(container.textContent).toContain('La clasificación es informativa');
    expect(container.textContent).toContain('constancia de conocimiento, no una capacitación');
  });
  it('«Mis lecturas pendientes» lleva descargar y confirmar con nombres accesibles que dicen cuál documento', () => {
    const { container } = render(<PantallaDocumentos {...baseLista} />);
    expect(container.querySelector('a[aria-label="Descargar POL-001, versión 1"]')).not.toBeNull();
    const confirmar = container.querySelector('form[action="/e/empresa-a/documentos/versiones/' + V1 + '/confirmar"]');
    expect(confirmar?.getAttribute('method')).toBe('post');
    expect(confirmar?.querySelector('button')?.getAttribute('aria-label')).toBe('Confirmo que leí esta versión: POL-001, versión 1');
  });
  it('el formulario de alta y la retención solo los ve quien puede; los formularios son POST a rutas propias', () => {
    const a = render(<PantallaDocumentos {...baseLista} />).container;
    expect(a.querySelector('form[action="/e/empresa-a/documentos/crear"]')?.getAttribute('method')).toBe('post');
    expect(a.querySelectorAll('form[action="/e/empresa-a/documentos/retencion"]')).toHaveLength(7);
    const c = render(<PantallaDocumentos {...baseLista} persona={colab} />).container;
    expect(c.querySelector('form[action="/e/empresa-a/documentos/crear"]')).not.toBeNull(); // el colaborador redacta
    expect(c.querySelector('form[action="/e/empresa-a/documentos/retencion"]')).toBeNull();
    const otro = render(<PantallaDocumentos {...baseLista} persona={{ nombre: 'X', roles: ['auditor_externo'] }} />).container;
    expect(otro.querySelector('form[action="/e/empresa-a/documentos/crear"]')).toBeNull();
  });
  it('cada documento enlaza a su detalle con un nombre accesible', () => {
    const { container } = render(<PantallaDocumentos {...baseLista} />);
    expect(container.querySelector(`a[href="/e/empresa-a/documentos/${D1}"]`)?.getAttribute('aria-label')).toBe('Ver documento POL-001');
  });
});

const version = (o: Partial<VersionDocumento> = {}): VersionDocumento => ({
  id: V1, documentoId: D1, numero: 1, estado: 'aprobada', vigente: true, nota: 'versión inicial', archivo: { nombre: 'politica.pdf', tipo: 'application/pdf', bytes: 120000, sha256: SHA },
  autorId: U2, aprobadorId: U1, aprobadaPor: U1, aprobadaEn: '2026-11-18T15:00:00.000Z', porSuAutor: false, motivoExcepcion: null, requiereLectura: false, devueltaMotivo: null, devueltaNota: null,
  obsoletaEn: null, elegibleParaDisposicion: false, lecturas: { confirmadas: 1, total: 3 }, creadaEn: '2026-11-18T14:00:00.000Z', ...o,
});
const detalle = (o: Partial<DocumentoDetalle> = {}): DocumentoDetalle => ({
  ...doc(), versiones: [version()], destinatarios: [U1, U2], controles: ['cccccccc-1111-4111-8111-111111111111'], entradas: [{ libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' }],
  retencion: null, unicoAdministrador: false, ...o,
});
const controles = [{ id: 'cccccccc-1111-4111-8111-111111111111', codigo: 'C-001', nombre: 'Cifrado de discos' }];
const baseDetalle = { empresa, persona: admin, personaId: U1, documento: detalle(), personas, controles, aviso: null };

const conVersiones = () =>
  detalle({
    versiones: [
      version({ id: V3, numero: 3, estado: 'en_revision', vigente: false, aprobadaPor: null, aprobadaEn: null, aprobadorId: U1, lecturas: null }),
      version({ id: V2, numero: 2, estado: 'borrador', vigente: false, aprobadaPor: null, aprobadaEn: null, aprobadorId: null, devueltaMotivo: 'incompleta', devueltaNota: 'falta el alcance', lecturas: null }),
      version({ id: V1, numero: 1, estado: 'obsoleta', vigente: false, obsoletaEn: '2026-12-01T10:00:00.000Z', elegibleParaDisposicion: true, porSuAutor: true, motivoExcepcion: 'único administrador' }),
    ],
    vigente: null,
    sinVigente: true,
    proximaRevision: null,
    revision: null,
  });

describe('PantallaDocumentoDetalle', () => {
  it('no tiene violaciones de accesibilidad (axe) en ninguno de sus estados', async () => {
    const estados = [
      <PantallaDocumentoDetalle key="a" {...baseDetalle} />,
      <PantallaDocumentoDetalle key="b" {...baseDetalle} documento={conVersiones()} />,
      <PantallaDocumentoDetalle key="c" {...baseDetalle} documento={conVersiones()} persona={colab} personaId={U2} />,
      <PantallaDocumentoDetalle key="d" {...baseDetalle} persona={colab} personaId={U2} />,
      <PantallaDocumentoDetalle key="e" {...baseDetalle} documento={detalle({ estado: 'retirado', vigente: null, sinVigente: false, versiones: [version({ estado: 'obsoleta', vigente: false })], proximaRevision: null, revision: null })} />,
      <PantallaDocumentoDetalle key="f" {...baseDetalle} documento={detalle({ tipo: 'externo', emisor: 'Un organismo', edicionFuente: '2024', destinatarios: [] })} aviso="version_aprobada" />,
      <PantallaDocumentoDetalle key="g" {...baseDetalle} documento={{ ...conVersiones(), unicoAdministrador: true, versiones: [version({ id: V3, numero: 3, estado: 'en_revision', vigente: false, autorId: U1, aprobadorId: U1, aprobadaPor: null, aprobadaEn: null })], destinatarios: [] }} />,
      <PantallaDocumentoDetalle key="h" {...baseDetalle} documento={detalle({ versiones: [], vigente: null, sinVigente: true, proximaRevision: null, revision: null, controles: [], entradas: [], destinatarios: [] })} controles={[]} />,
    ];
    for (const e of estados) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
  it('muestra el historial con quién redactó, quién aprobó y la excepción del único administrador, y rotula lo que no rige', () => {
    const { container } = render(<PantallaDocumentoDetalle {...baseDetalle} documento={conVersiones()} />);
    for (const t of ['Redactada por Pedro Soto', 'Aprobada por su propio autor', 'Motivo registrado: único administrador', 'Devuelta: Está incompleta — falta el alcance', 'Elegible para disposición', 'En revisión', 'Obsoleta', 'No vigente', 'Huella SHA-256']) expect(container.textContent, t).toContain(t);
  });
  it('una persona dada de baja se muestra como tal', () => {
    const { container } = render(<PantallaDocumentoDetalle {...baseDetalle} documento={detalle({ responsableId: U3 })} />);
    expect(container.textContent).toContain('Dario Retirado (persona dada de baja)');
  });
  it('el administrador aprueba y devuelve una versión en revisión; el colaborador no ve esas acciones y sí puede subir y enviar', () => {
    const a = render(<PantallaDocumentoDetalle {...baseDetalle} documento={conVersiones()} />).container;
    expect(a.querySelector(`form[action="/e/empresa-a/documentos/versiones/${V3}/aprobar"]`)).not.toBeNull();
    expect(a.querySelector(`form[action="/e/empresa-a/documentos/versiones/${V3}/devolver"]`)).not.toBeNull();
    const c = render(<PantallaDocumentoDetalle {...baseDetalle} persona={colab} personaId={U2} documento={conVersiones()} />).container;
    expect(c.querySelector(`form[action="/e/empresa-a/documentos/versiones/${V3}/aprobar"]`)).toBeNull();
    expect(c.querySelector(`form[action="/e/empresa-a/documentos/versiones/${V2}/enviar"]`)).not.toBeNull();
    expect(c.querySelector('form[action$="/retirar"]')).toBeNull();
    expect(c.querySelector('form[action$="/distribuir"]')).toBeNull();
  });
  it('solo se puede subir una versión cuando no hay otra abierta; la nota va ANTES del archivo', () => {
    const abierta = render(<PantallaDocumentoDetalle {...baseDetalle} documento={conVersiones()} />).container;
    expect(abierta.querySelector('form[action$="/subir"]')).toBeNull();
    expect(abierta.textContent).toContain('Ya hay una versión abierta');
    const libre = render(<PantallaDocumentoDetalle {...baseDetalle} />).container;
    const f = libre.querySelector('form[action$="/subir"]')!;
    expect(f.getAttribute('enctype')).toBe('multipart/form-data');
    expect([...f.querySelectorAll('[name]')].map((x) => x.getAttribute('name'))).toEqual(['nota', 'archivo']);
  });
  it('el motivo de la excepción solo se pide al único administrador que aprueba su propia versión', () => {
    const v = version({ id: V3, numero: 3, estado: 'en_revision', vigente: false, autorId: U1, aprobadorId: U1, aprobadaPor: null, aprobadaEn: null });
    const unico = render(<PantallaDocumentoDetalle {...baseDetalle} documento={{ ...detalle({ versiones: [v] }), unicoAdministrador: true }} />).container;
    expect(unico.querySelector(`textarea[name="motivoExcepcion"]`)).not.toBeNull();
    const normal = render(<PantallaDocumentoDetalle {...baseDetalle} documento={detalle({ versiones: [v] })} />).container;
    expect(normal.querySelector(`textarea[name="motivoExcepcion"]`)).toBeNull();
  });
  it('cada versión se descarga con un nombre accesible; los formularios de cambio son POST', () => {
    const { container } = render(<PantallaDocumentoDetalle {...baseDetalle} documento={conVersiones()} />);
    expect(container.querySelector(`a[aria-label="Descargar archivo, versión 2"]`)?.getAttribute('href')).toBe(`/e/empresa-a/documentos/versiones/${V2}/descargar`);
    for (const f of container.querySelectorAll('form')) if (f.getAttribute('method') !== 'get') expect(f.getAttribute('method')).toBe('post');
  });
});

describe('PantallaCoberturaDocumental', () => {
  const cobertura: CoberturaDocumental = {
    normas: ['ISO/IEC 27001'],
    total: 2,
    cubiertas: 1,
    entradas: [
      { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1', tipo: 'control', titulo: 'Políticas de seguridad', normas: ['ISO/IEC 27001'], documentos: [{ id: D1, codigo: 'POL-001' }], cubierta: true },
      { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-2', tipo: 'control', titulo: 'Roles y responsabilidades', normas: ['ISO/IEC 27001'], documentos: [], cubierta: false },
    ],
  };
  const base = { empresa, persona: colab, cobertura, filtros: { soloSinDocumento: false }, filtrosInvalidos: false };
  it('no tiene violaciones de accesibilidad (axe) y dice con palabras qué está cubierto', async () => {
    for (const e of [<PantallaCoberturaDocumental key="a" {...base} />, <PantallaCoberturaDocumental key="b" {...base} filtrosInvalidos />, <PantallaCoberturaDocumental key="c" {...base} cobertura={{ ...cobertura, entradas: [], total: 0, cubiertas: 0 }} />, <PantallaCoberturaDocumental key="d" {...base} filtros={{ norma: 'ISO/IEC 27001', soloSinDocumento: true }} />]) {
      const { container, unmount } = render(e);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
    const { container } = render(<PantallaCoberturaDocumental {...base} />);
    for (const t of ['1 de 2 entradas tienen un documento vigente', 'Con documento vigente', 'Sin documento vigente', 'POL-001']) expect(container.textContent, t).toContain(t);
  });
});
