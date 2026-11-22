// Fakes en memoria del control documental. Igual que `fakes.ts`: separan por empresa y revierten si la acción falla, pero NO emulan las
// claves foráneas, la RLS ni el índice de «una sola vigente»: eso lo demuestran las pruebas con PostgreSQL real.
import type { EmpresaId } from '@sig/tenancy';
import { codigoDeDocumento } from '../../domain/documento.js';
import type {
  CambiosDocumento,
  CambiosVersion,
  DestinatarioRepositoryPort,
  DirectorioPersonasPort,
  DocumentoRepositoryPort,
  FilaDocumento,
  FilaRetencion,
  FilaVersion,
  LecturaDeVersion,
  LecturaRepositoryPort,
  PersonaDirectorio,
  RetencionRepositoryPort,
  VersionDocumentoRepositoryPort,
  VinculoDocumentoRepositoryPort,
} from '../documentos.port.js';

type ConEmpresa<T> = T & { empresaId: EmpresaId };

export class EstadoDocumentosFalso {
  documentos = new Map<string, ConEmpresa<FilaDocumento>>();
  versiones = new Map<string, ConEmpresa<FilaVersion>>();
  /** `empresa|documento` → destinatarios. */
  destinatarios = new Map<string, readonly string[]>();
  /** `empresa|version|persona`. */
  lecturas = new Map<string, ConEmpresa<LecturaDeVersion>>();
  /** `empresa|documento|control`. */
  controles = new Set<string>();
  /** `empresa|documento|librería|idEstable`. */
  entradas = new Set<string>();
  /** `empresa|tipo`. */
  retenciones = new Map<string, FilaRetencion>();
  personas = new Map<EmpresaId, readonly PersonaDirectorio[]>();
  /** Si se pone, la próxima escritura de versión devuelve «falso» (otra persona escribió en medio). */
  carrera = false;

  copiar(): EstadoDocumentosFalso['__copia'] {
    return {
      d: new Map(this.documentos),
      v: new Map(this.versiones),
      de: new Map(this.destinatarios),
      l: new Map(this.lecturas),
      c: new Set(this.controles),
      e: new Set(this.entradas),
      r: new Map(this.retenciones),
    };
  }
  declare __copia: {
    d: Map<string, ConEmpresa<FilaDocumento>>;
    v: Map<string, ConEmpresa<FilaVersion>>;
    de: Map<string, readonly string[]>;
    l: Map<string, ConEmpresa<LecturaDeVersion>>;
    c: Set<string>;
    e: Set<string>;
    r: Map<string, FilaRetencion>;
  };

  restaurar(c: EstadoDocumentosFalso['__copia']): void {
    this.documentos = c.d;
    this.versiones = c.v;
    this.destinatarios = c.de;
    this.lecturas = c.l;
    this.controles = c.c;
    this.entradas = c.e;
    this.retenciones = c.r;
  }
}

export const crearRepositoriosDocumentosFalsos = (
  s: EstadoDocumentosFalso,
  empresaId: EmpresaId,
): {
  documentos: DocumentoRepositoryPort;
  versionesDocumento: VersionDocumentoRepositoryPort;
  destinatarios: DestinatarioRepositoryPort;
  lecturas: LecturaRepositoryPort;
  vinculosDocumento: VinculoDocumentoRepositoryPort;
  retenciones: RetencionRepositoryPort;
  personas: DirectorioPersonasPort;
} => {
  const docs = (): FilaDocumento[] => [...s.documentos.values()].filter((d) => d.empresaId === empresaId);
  const vers = (): FilaVersion[] => [...s.versiones.values()].filter((v) => v.empresaId === empresaId);
  const k = (...p: string[]): string => [empresaId, ...p].join('|');

  const documentos: DocumentoRepositoryPort = {
    listar: async () => docs(),
    obtener: async (id) => docs().find((d) => d.id === id) ?? null,
    siguienteNumero: async (tipo) =>
      Math.max(
        0,
        ...docs()
          .filter((d) => d.tipo === tipo)
          .map((d) => d.numero),
      ) + 1,
    crear: async (d, usuarioId, ahora) => {
      if (docs().some((x) => x.tipo === d.tipo && x.numero === d.numero)) return false;
      s.documentos.set(d.id, {
        ...d,
        empresaId,
        codigo: codigoDeDocumento(d.tipo, d.numero),
        estado: 'activo',
        proximaRevision: null,
        ultimaRevisionEn: null,
        ultimaRevisionPor: null,
        version: 1,
        creadoPor: usuarioId,
        creadoEn: ahora,
      });
      return true;
    },
    actualizar: async (id, cambios: CambiosDocumento, esperada) => {
      const actual = docs().find((d) => d.id === id);
      if (!actual || actual.version !== esperada) return false;
      const sinIndefinidos = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
      s.documentos.set(id, { ...actual, ...sinIndefinidos, empresaId, version: actual.version + 1 } as ConEmpresa<FilaDocumento>);
      return true;
    },
  };

  const versionesDocumento: VersionDocumentoRepositoryPort = {
    obtener: async (id) => vers().find((v) => v.id === id) ?? null,
    listarDeDocumento: async (documentoId) => vers().filter((v) => v.documentoId === documentoId),
    listarVigentes: async () => vers().filter((v) => v.estado === 'aprobada'),
    listarObsoletas: async () => vers().filter((v) => v.estado === 'obsoleta'),
    siguienteNumero: async (documentoId) =>
      Math.max(
        0,
        ...vers()
          .filter((v) => v.documentoId === documentoId)
          .map((v) => v.numero),
      ) + 1,
    crear: async (v, usuarioId, ahora) => {
      if (vers().some((x) => x.archivo.id === v.archivo.id || (x.documentoId === v.documentoId && x.numero === v.numero))) return false;
      s.versiones.set(v.id, {
        ...v,
        empresaId,
        estado: 'borrador',
        autorId: usuarioId,
        aprobadorId: null,
        enviadaEn: null,
        aprobadaPor: null,
        aprobadaEn: null,
        porSuAutor: false,
        motivoExcepcion: null,
        requiereLectura: false,
        devueltaMotivo: null,
        devueltaNota: null,
        obsoletaEn: null,
        version: 1,
        creadaEn: ahora,
      });
      return true;
    },
    actualizar: async (id, cambios: CambiosVersion, esperada) => {
      const actual = vers().find((v) => v.id === id);
      if (s.carrera || !actual || actual.version !== esperada) return false;
      const sinIndefinidos = Object.fromEntries(Object.entries(cambios).filter(([, x]) => x !== undefined));
      s.versiones.set(id, { ...actual, ...sinIndefinidos, empresaId, version: actual.version + 1 } as ConEmpresa<FilaVersion>);
      return true;
    },
    obsoletizarVigente: async (documentoId, ahora) => {
      const vigente = vers().find((v) => v.documentoId === documentoId && v.estado === 'aprobada');
      if (!vigente) return null;
      s.versiones.set(vigente.id, { ...vigente, empresaId, estado: 'obsoleta', obsoletaEn: ahora, version: vigente.version + 1 });
      return vigente.id;
    },
  };

  const destinatarios: DestinatarioRepositoryPort = {
    listar: async (documentoId) => s.destinatarios.get(k(documentoId)) ?? [],
    reemplazar: async (documentoId, ids) => void s.destinatarios.set(k(documentoId), [...ids]),
  };

  const lecturas: LecturaRepositoryPort = {
    crearPendientes: async (versionId, ids) => {
      for (const u of ids)
        if (!s.lecturas.has(k(versionId, u))) s.lecturas.set(k(versionId, u), { empresaId, versionId, usuarioId: u, confirmadaEn: null });
    },
    listarDeVersion: async (versionId) => [...s.lecturas.values()].filter((l) => l.empresaId === empresaId && l.versionId === versionId),
    listarDeVersiones: async (ids) => [...s.lecturas.values()].filter((l) => l.empresaId === empresaId && ids.includes(l.versionId)),
    confirmar: async (versionId, usuarioId, ahora) => {
      const l = s.lecturas.get(k(versionId, usuarioId));
      if (!l || l.confirmadaEn !== null) return false;
      s.lecturas.set(k(versionId, usuarioId), { ...l, confirmadaEn: ahora });
      return true;
    },
    pendientesDe: async (usuarioId) =>
      [...s.lecturas.values()]
        .filter((l) => l.empresaId === empresaId && l.usuarioId === usuarioId && l.confirmadaEn === null)
        .flatMap((l) => {
          const v = vers().find((x) => x.id === l.versionId && x.estado === 'aprobada');
          const d = v ? docs().find((x) => x.id === v.documentoId) : undefined;
          return v && d ? [{ versionId: v.id, documentoId: d.id, codigo: d.codigo, titulo: d.titulo, numeroVersion: v.numero }] : [];
        }),
  };

  const vinculosDocumento: VinculoDocumentoRepositoryPort = {
    listarControles: async (documentoId) =>
      [...s.controles].filter((x) => x.startsWith(k(documentoId) + '|')).map((x) => x.split('|')[2] as string),
    listarEntradas: async (documentoId) =>
      [...s.entradas]
        .filter((x) => x.startsWith(k(documentoId) + '|'))
        .map((x) => ({ libreriaCodigo: x.split('|')[2] as string, idEstable: x.split('|')[3] as string })),
    listarTodasEntradas: async () =>
      [...s.entradas]
        .filter((x) => x.startsWith(empresaId + '|'))
        .map((x) => ({
          documentoId: x.split('|')[1] as string,
          libreriaCodigo: x.split('|')[2] as string,
          idEstable: x.split('|')[3] as string,
        })),
    agregarControl: async (d, c) => {
      if (s.controles.has(k(d, c))) return false;
      s.controles.add(k(d, c));
      return true;
    },
    quitarControl: async (d, c) => s.controles.delete(k(d, c)),
    agregarEntrada: async (d, l, i) => {
      if (s.entradas.has(k(d, l, i))) return false;
      s.entradas.add(k(d, l, i));
      return true;
    },
    quitarEntrada: async (d, l, i) => s.entradas.delete(k(d, l, i)),
  };

  const retenciones: RetencionRepositoryPort = {
    listar: async () => [...s.retenciones.entries()].filter(([c]) => c.startsWith(empresaId + '|')).map(([, v]) => v),
    crear: async (r) => {
      if (s.retenciones.has(k(r.tipo))) return false;
      s.retenciones.set(k(r.tipo), { ...r, version: 1 });
      return true;
    },
    actualizar: async (tipo, anios, motivo, esperada) => {
      const actual = s.retenciones.get(k(tipo));
      if (!actual || actual.version !== esperada) return false;
      s.retenciones.set(k(tipo), { tipo, anios, motivo, version: actual.version + 1 });
      return true;
    },
  };

  const personas: DirectorioPersonasPort = {
    listar: async () => s.personas.get(empresaId) ?? [],
    existeActiva: async (id) => (s.personas.get(empresaId) ?? []).some((p) => p.id === id && p.activa),
  };

  return { documentos, versionesDocumento, destinatarios, lecturas, vinculosDocumento, retenciones, personas };
};
