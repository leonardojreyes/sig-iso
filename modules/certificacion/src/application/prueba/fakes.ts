// Fakes en memoria para las pruebas de los casos de uso. Separan los datos por empresa con claves `${empresaId}|…` y revierten si la acción
// falla, pero NO emulan las claves foráneas compuestas, las políticas RLS ni los privilegios de la base: eso solo lo demuestran las
// pruebas con PostgreSQL real (`*.integration.test.ts` y `platform/db`). No las tomes como prueba de aislamiento a nivel de datos.
import { validarEvento, type EventoBitacora } from '@sig/auditoria';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import type { Alcance } from '../../domain/alcance.js';
import type { Control } from '../../domain/control.js';
import type { LectorBytes } from '../../domain/deteccion-archivo.js';
import { sha256Hex } from './archivos.js';
import type { FilaDeclaracion } from '../../domain/declaracion.js';
import type { MotivoInclusion } from '../../domain/motivo-inclusion.js';
import type { ReferenciaTratamiento } from '../../domain/referencia-tratamiento.js';
import type { Riesgo } from '../../domain/riesgo.js';
import type { MapeoControl } from '../../domain/mapeo-control.js';
import type { Evaluacion } from '../../domain/evaluacion.js';
import type { AlmacenArchivosPort, ResultadoGuardado } from '../almacen-archivos.port.js';
import type { AutorizacionPort, Permiso } from '../autorizacion.port.js';
import type { CatalogoLecturaPort, EntradaCatalogo } from '../catalogo-lectura.port.js';
import type { ContextoCertificacion } from '../contexto.js';
import type { DocumentoDeclaracion, DocumentoGenerado, DocumentoInformeAuditoria, GeneradorDocumentoPort } from '../generador-documento.port.js';
import type { AlcanceRepositoryPort, ControlRepositoryPort, DeclaracionRepositoryPort, EvaluacionRepositoryPort, EvidenciaRepositoryPort, FilaEvidencia, CopiaJustificacion, MapeoRepositoryPort, MotivoRepositoryPort, ReferenciaRepositoryPort, RiesgoRepositoryPort, VersionDeclaracion, VinculoRiesgoRepositoryPort } from '../repositorios.port.js';
import type { UnidadDeTrabajoPort } from '../unidad-de-trabajo.port.js';
import { crearRepositoriosAuditoriaFalsos, EstadoAuditoriaFalso } from './fakes-auditoria.js';
import { crearRepositoriosRiesgosFalsos, EstadoRiesgosFalso } from './fakes-riesgos.js';
import { crearRepositoriosDocumentosFalsos, EstadoDocumentosFalso } from './fakes-documentos.js';

export const A: EmpresaId = crearEmpresaId('aaaaaaaa-0000-4000-8000-0000000000f1');
export const B: EmpresaId = crearEmpresaId('bbbbbbbb-0000-4000-8000-0000000000f2');
export const ADMIN = '11111111-1111-4111-8111-1111111111a1';
export const COLAB = '22222222-2222-4222-8222-2222222222b2';
export const LIB = '33333333-3333-4333-8333-3333333333c3';
export const LIB_V2 = '44444444-4444-4444-8444-4444444444d4';

/** Entradas de prueba: una cláusula común y dos controles del Anexo A. */
export const entradas = {
  contexto: { libreriaCodigo: 'ejemplo-ha', libreriaId: LIB, idEstable: 'ha-4.1', tipo: 'clausula', capitulo: 4, grupo: null, titulo: 'Contexto', guia: 'Describe el entorno de la organización.', aplicaA: [{ norma: 'ISO 9001', edicion: '2015', clausula: '4.1' }, { norma: 'ISO/IEC 27001', edicion: '2022', clausula: '4.1' }], orden: 1 },
  politicas: { libreriaCodigo: 'iso-27001-2022-anexo-a', libreriaId: LIB, idEstable: 'a27-5-1', tipo: 'control', capitulo: null, grupo: 'Organizacionales', titulo: 'Políticas de seguridad', guia: 'Redacta las reglas generales.', aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.1' }], orden: 1 },
  roles: { libreriaCodigo: 'iso-27001-2022-anexo-a', libreriaId: LIB, idEstable: 'a27-5-2', tipo: 'control', capitulo: null, grupo: 'Organizacionales', titulo: 'Roles y responsabilidades', guia: 'Reparte quién cuida qué.', aplicaA: [{ norma: 'ISO/IEC 27001', edicion: '2022', clausula: 'A.5.2' }], orden: 2 },
} satisfies Record<string, EntradaCatalogo>;

export class EstadoFalso {
  /** Datos del control documental (ADR 039). */
  documentosEstado = new EstadoDocumentosFalso();
  /** Datos de la auditoría interna (ADR 040). */
  auditoriaEstado = new EstadoAuditoriaFalso();
  /** Datos de la gestión de riesgos completa (ADR 038). */
  riesgosEstado = new EstadoRiesgosFalso();
  evaluaciones = new Map<string, Evaluacion & { _por?: string }>();
  alcances = new Map<string, Alcance>();
  controles = new Map<string, Control>();
  mapeos = new Map<string, MapeoControl>();
  riesgos = new Map<string, Riesgo>();
  /** `empresa|riesgoId|controlId` → quién lo vinculó. */
  vinculosControl = new Map<string, string>();
  /** `empresa|riesgoId|libreria|idEstable` → quién lo vinculó. */
  vinculosEntrada = new Map<string, string>();
  /** `empresa|librería|idEstable|tipo` → motivo. */
  motivos = new Map<string, MotivoInclusion>();
  /** `empresa|norma|tipo` → referencia. */
  referencias = new Map<string, ReferenciaTratamiento>();
  evidencias = new Map<string, FilaEvidencia>();
  /** Versiones aprobadas de la declaración, por `empresa|id`. */
  declaraciones = new Map<string, { empresaId: EmpresaId; version: VersionDeclaracion; filas: readonly FilaDeclaracion[]; copia: CopiaJustificacion | null }>();
  eventos: EventoBitacora[] = [];
  /** Entradas adoptadas por empresa. */
  catalogoPorEmpresa = new Map<EmpresaId, readonly EntradaCatalogo[]>();
  permisos = new Set<string>();
  /** Si se pone, la próxima escritura de bitácora falla (para probar que la acción se revierte). */
  fallarBitacora = false;
  /** Si se pone, la próxima escritura de evaluación devuelve «falso» (otra persona escribió en medio). */
  carrera = false;

  conceder(usuarioId: string, empresaId: EmpresaId, ...permisos: Permiso[]): void {
    for (const p of permisos) this.permisos.add(`${usuarioId}|${p}|${empresaId}`);
  }
}

export const crearAutorizacionFalsa = (estado: EstadoFalso): AutorizacionPort => ({
  puede: async (usuarioId, permiso, empresaId) => estado.permisos.has(`${usuarioId}|${permiso}|${empresaId}`),
});

export const crearCatalogoFalso = (estado: EstadoFalso): CatalogoLecturaPort => ({
  listarEntradasVigentes: async (empresaId) => estado.catalogoPorEmpresa.get(empresaId) ?? [],
});

/** Unidad de trabajo en memoria: los datos de cada empresa están separados y, si `fn` falla, todo se revierte. */
export const crearUnidadFalsa = (estado: EstadoFalso): UnidadDeTrabajoPort<ContextoCertificacion> => ({
  ejecutar: async (empresaId, fn) => {
    const clave = (c: string) => `${empresaId}|${c}`;
    const copia = { ev: new Map(estado.evaluaciones), al: new Map(estado.alcances), co: new Map(estado.controles), ma: new Map(estado.mapeos), ri: new Map(estado.riesgos), vc: new Map(estado.vinculosControl), ve: new Map(estado.vinculosEntrada), mo: new Map(estado.motivos), rf: new Map(estado.referencias), evi: new Map(estado.evidencias), de: new Map(estado.declaraciones), ex: [...estado.eventos], doc: estado.documentosEstado.copiar(), aud: estado.auditoriaEstado.copiar(), rc: estado.riesgosEstado.copiar() };
    const evaluaciones: EvaluacionRepositoryPort = {
      listar: async () => [...estado.evaluaciones.entries()].filter(([k]) => k.startsWith(`${empresaId}|`)).map(([, v]) => v),
      obtener: async (codigo, id) => estado.evaluaciones.get(clave(`${codigo}|${id}`)) ?? null,
      crear: async (e) => {
        if (estado.carrera || estado.evaluaciones.has(clave(e.clave))) return false;
        estado.evaluaciones.set(clave(e.clave), e);
        return true;
      },
      actualizar: async (e, _u, _a, esperada) => {
        const actual = estado.evaluaciones.get(clave(e.clave));
        if (estado.carrera || !actual || actual.version !== esperada) return false;
        estado.evaluaciones.set(clave(e.clave), e);
        return true;
      },
    };
    const alcances: AlcanceRepositoryPort = {
      listar: async () => [...estado.alcances.entries()].filter(([k]) => k.startsWith(`${empresaId}|`)).map(([, v]) => v),
      obtener: async (norma) => estado.alcances.get(clave(norma)) ?? null,
      guardar: async (a) => void estado.alcances.set(clave(a.norma), a),
    };
    const propios = <T extends { empresaId: EmpresaId }>(m: Map<string, T>): T[] => [...m.values()].filter((v) => v.empresaId === empresaId);
    const controles: ControlRepositoryPort = {
      listar: async () => propios(estado.controles).sort((a, b) => a.codigo.localeCompare(b.codigo)),
      obtener: async (id) => propios(estado.controles).find((c) => c.id === id) ?? null,
      crear: async (c) => {
        if (propios(estado.controles).some((x) => x.codigo === c.codigo)) return false;
        estado.controles.set(c.id, c);
        return true;
      },
      actualizar: async (c, _u, _a, esperada) => {
        const actual = propios(estado.controles).find((x) => x.id === c.id);
        if (estado.carrera || !actual || actual.version !== esperada) return false;
        estado.controles.set(c.id, c);
        return true;
      },
    };
    const mapeos: MapeoRepositoryPort = {
      listar: async () => propios(estado.mapeos),
      contar: async (controlId) => propios(estado.mapeos).filter((m) => m.controlId === controlId).length,
      agregar: async (m) => {
        if (estado.mapeos.has(`${empresaId}|${m.clave}`)) return false;
        estado.mapeos.set(`${empresaId}|${m.clave}`, m);
        return true;
      },
      quitar: async (m) => estado.mapeos.delete(`${empresaId}|${m.clave}`),
    };
    const riesgos: RiesgoRepositoryPort = {
      listar: async () => propios(estado.riesgos).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })),
      obtener: async (id) => propios(estado.riesgos).find((r) => r.id === id) ?? null,
      siguienteNumero: async () => Math.max(0, ...propios(estado.riesgos).map((r) => Number(r.codigo.slice(2)))) + 1,
      crear: async (r) => {
        if (estado.carrera || propios(estado.riesgos).some((x) => x.codigo === r.codigo)) return false;
        estado.riesgos.set(r.id, r);
        return true;
      },
      actualizar: async (r, _u, _a, esperada) => {
        const actual = propios(estado.riesgos).find((x) => x.id === r.id);
        if (estado.carrera || !actual || actual.version !== esperada) return false;
        estado.riesgos.set(r.id, r);
        return true;
      },
    };
    const claveVC = (r: string, c: string) => `${empresaId}|${r}|${c}`;
    const claveVE = (r: string, l: string, i: string) => `${empresaId}|${r}|${l}|${i}`;
    const vinculosRiesgo: VinculoRiesgoRepositoryPort = {
      listarControles: async () =>
        [...estado.vinculosControl.keys()].filter((k) => k.startsWith(`${empresaId}|`)).map((k) => k.split('|')).map(([, riesgoId, controlId]) => ({ riesgoId: riesgoId as string, controlId: controlId as string })),
      listarEntradas: async () =>
        [...estado.vinculosEntrada.keys()].filter((k) => k.startsWith(`${empresaId}|`)).map((k) => k.split('|')).map(([, riesgoId, libreriaCodigo, idEstable]) => ({ riesgoId: riesgoId as string, libreriaCodigo: libreriaCodigo as string, idEstable: idEstable as string })),
      contar: async (riesgoId) => [...estado.vinculosControl.keys(), ...estado.vinculosEntrada.keys()].filter((k) => k.startsWith(`${empresaId}|${riesgoId}|`)).length,
      agregarControl: async (r, c, u) => {
        if (estado.vinculosControl.has(claveVC(r, c))) return false;
        estado.vinculosControl.set(claveVC(r, c), u);
        return true;
      },
      quitarControl: async (r, c) => estado.vinculosControl.delete(claveVC(r, c)),
      agregarEntrada: async (r, l, i, u) => {
        if (estado.vinculosEntrada.has(claveVE(r, l, i))) return false;
        estado.vinculosEntrada.set(claveVE(r, l, i), u);
        return true;
      },
      quitarEntrada: async (r, l, i) => estado.vinculosEntrada.delete(claveVE(r, l, i)),
    };
    const claveMo = (l: string, i: string, tipo: string) => `${empresaId}|${l}|${i}|${tipo}`;
    const motivos: MotivoRepositoryPort = {
      listar: async () => propios(estado.motivos).sort((a, b) => a.clave.localeCompare(b.clave)),
      obtener: async (l, i, tipo) => estado.motivos.get(claveMo(l, i, tipo)) ?? null,
      crear: async (m) => {
        if (estado.carrera || estado.motivos.has(claveMo(m.libreriaCodigo, m.idEstable, m.tipo))) return false;
        estado.motivos.set(claveMo(m.libreriaCodigo, m.idEstable, m.tipo), m);
        return true;
      },
      actualizar: async (m, _u, _a, esperada) => {
        const actual = estado.motivos.get(claveMo(m.libreriaCodigo, m.idEstable, m.tipo));
        if (estado.carrera || !actual || actual.version !== esperada) return false;
        estado.motivos.set(claveMo(m.libreriaCodigo, m.idEstable, m.tipo), m);
        return true;
      },
      eliminar: async (l, i, tipo, esperada) => {
        const actual = estado.motivos.get(claveMo(l, i, tipo));
        if (estado.carrera || !actual || actual.version !== esperada) return false;
        return estado.motivos.delete(claveMo(l, i, tipo));
      },
    };
    const claveRf = (norma: string, tipo: string) => `${empresaId}|${norma}|${tipo}`;
    const referencias: ReferenciaRepositoryPort = {
      listar: async (norma) => propios(estado.referencias).filter((r) => r.norma === norma),
      obtener: async (norma, tipo) => estado.referencias.get(claveRf(norma, tipo)) ?? null,
      crear: async (r) => {
        if (estado.carrera || estado.referencias.has(claveRf(r.norma, r.tipo))) return false;
        estado.referencias.set(claveRf(r.norma, r.tipo), r);
        return true;
      },
      actualizar: async (r, _u, _a, esperada) => {
        const actual = estado.referencias.get(claveRf(r.norma, r.tipo));
        if (estado.carrera || !actual || actual.version !== esperada) return false;
        estado.referencias.set(claveRf(r.norma, r.tipo), r);
        return true;
      },
      eliminar: async (norma, tipo, esperada) => {
        const actual = estado.referencias.get(claveRf(norma, tipo));
        if (estado.carrera || !actual || actual.version !== esperada) return false;
        return estado.referencias.delete(claveRf(norma, tipo));
      },
    };
    const propiasEvi = (): FilaEvidencia[] => [...estado.evidencias.values()].filter((f) => f.evidencia.empresaId === empresaId);
    const evidencias: EvidenciaRepositoryPort = {
      obtener: async (id) => estado.evidencias.get(`${empresaId}|${id}`) ?? null,
      listarDeControl: async (controlId, historicas) =>
        propiasEvi()
          .filter((f) => f.evidencia.controlId === controlId && (historicas || f.evidencia.activa))
          .sort((a, b) => b.creadaEn.getTime() - a.creadaEn.getTime()),
      listarActivas: async () => propiasEvi().filter((f) => f.evidencia.activa).map((f) => f.evidencia),
      contarActivas: async (controlId) => propiasEvi().filter((f) => f.evidencia.controlId === controlId && f.evidencia.activa).length,
      crear: async (e, _u, ahora) => {
        if (propiasEvi().some((f) => f.evidencia.archivo.id === e.archivo.id)) return false;
        estado.evidencias.set(`${empresaId}|${e.id}`, { evidencia: e, creadaEn: ahora });
        return true;
      },
      cambiarEstado: async (e) => {
        const actual = estado.evidencias.get(`${empresaId}|${e.id}`);
        if (estado.carrera || !actual || !actual.evidencia.activa) return false;
        estado.evidencias.set(`${empresaId}|${e.id}`, { evidencia: e, creadaEn: actual.creadaEn });
        return true;
      },
    };
    const propiasDecl = () => [...estado.declaraciones.values()].filter((d) => d.empresaId === empresaId);
    const declaraciones: DeclaracionRepositoryPort = {
      ultimoNumero: async () => Math.max(0, ...propiasDecl().map((d) => d.version.numero)),
      crear: async (version, filas, copia) => {
        if (estado.carrera || propiasDecl().some((d) => d.version.numero === version.numero)) return false;
        estado.declaraciones.set(`${empresaId}|${version.id}`, { empresaId, version, filas, copia: copia ?? null });
        return true;
      },
      listarVersiones: async () => propiasDecl().map((d) => d.version).sort((a, b) => b.numero - a.numero),
      obtener: async (id) => {
        const d = estado.declaraciones.get(`${empresaId}|${id}`);
        return d ? { version: d.version, filas: d.filas, copia: d.copia } : null;
      },
    };
    const contexto: ContextoCertificacion = {
      declaraciones,
      ...crearRepositoriosDocumentosFalsos(estado.documentosEstado, empresaId),
      ...crearRepositoriosAuditoriaFalsos(estado.auditoriaEstado, empresaId),
      ...crearRepositoriosRiesgosFalsos(estado.riesgosEstado, empresaId),
      evidencias,
      evaluaciones,
      alcances,
      controles,
      mapeos,
      riesgos,
      vinculosRiesgo,
      motivos,
      referencias,
      bitacora: {
        registrar: async (evento) => {
          if (estado.fallarBitacora) throw new Error('bitácora no disponible');
          validarEvento(evento); // un evento mal formado haría fallar la acción real: aquí también
          estado.eventos.push(evento);
        },
      },
    };
    try {
      return await fn(contexto);
    } catch (e) {
      estado.evaluaciones = copia.ev;
      estado.alcances = copia.al;
      estado.controles = copia.co;
      estado.mapeos = copia.ma;
      estado.riesgos = copia.ri;
      estado.vinculosControl = copia.vc;
      estado.vinculosEntrada = copia.ve;
      estado.motivos = copia.mo;
      estado.referencias = copia.rf;
      estado.evidencias = copia.evi;
      estado.declaraciones = copia.de;
      estado.eventos = copia.ex;
      estado.documentosEstado.restaurar(copia.doc);
      estado.auditoriaEstado.restaurar(copia.aud);
      estado.riesgosEstado.restaurar(copia.rc);
      throw e;
    }
  },
});

/**
 * Almacén de archivos en memoria que respeta la separación por empresa: lo que una empresa guarda no se puede abrir, confirmar ni
 * descartar con otra. Permite provocar fallos y comprobar que NO se leyó el flujo (para probar que se decide antes de recibir bytes).
 */
export class AlmacenFalso implements AlmacenArchivosPort {
  readonly temporales = new Map<string, Uint8Array>();
  readonly archivos = new Map<string, Uint8Array>();
  /** Cuántos fragmentos de flujo se llegaron a leer en total. */
  fragmentosLeidos = 0;
  fallar: { confirmar?: boolean; abrir?: boolean } = {};

  async guardarTemporal(empresaId: EmpresaId, flujo: AsyncIterable<Uint8Array>, maximoBytes: number): Promise<ResultadoGuardado> {
    const partes: Uint8Array[] = [];
    let total = 0;
    for await (const parte of flujo) {
      this.fragmentosLeidos += 1;
      total += parte.length;
      if (total > maximoBytes) return { ok: false, motivo: 'tamano_excedido' };
      partes.push(parte);
    }
    const bytes = new Uint8Array(total);
    let desde = 0;
    for (const p of partes) {
      bytes.set(p, desde);
      desde += p.length;
    }
    const id = globalThis.crypto.randomUUID();
    this.temporales.set(`${empresaId}|${id}`, bytes);
    return { ok: true, temporal: { id, bytes: total, sha256: sha256Hex(bytes) } };
  }

  async abrirLector(empresaId: EmpresaId, temporalId: string): Promise<LectorBytes> {
    const b = this.temporales.get(`${empresaId}|${temporalId}`);
    if (!b) throw new Error('temporal inexistente');
    return { tamano: b.length, leer: async (d, h) => b.subarray(d, Math.min(h, b.length)) };
  }

  async confirmar(empresaId: EmpresaId, temporalId: string, archivoId: string): Promise<void> {
    if (this.fallar.confirmar) throw new Error('el almacén no pudo confirmar el archivo');
    const b = this.temporales.get(`${empresaId}|${temporalId}`);
    if (!b) throw new Error('temporal inexistente');
    if (this.archivos.has(`${empresaId}|${archivoId}`)) throw new Error('el archivo ya existe');
    this.archivos.set(`${empresaId}|${archivoId}`, b);
    this.temporales.delete(`${empresaId}|${temporalId}`);
  }

  async descartar(empresaId: EmpresaId, temporalId: string): Promise<void> {
    this.temporales.delete(`${empresaId}|${temporalId}`);
  }

  async abrir(empresaId: EmpresaId, archivoId: string): Promise<AsyncIterable<Uint8Array>> {
    if (this.fallar.abrir) throw new Error('el almacén no pudo abrir el archivo');
    const b = this.archivos.get(`${empresaId}|${archivoId}`);
    if (!b) throw new Error('archivo inexistente');
    return (async function* () {
      yield b;
    })();
  }
}

/** Generador de documentos de prueba: «escribe» un texto con lo que recibió y deja las llamadas a la vista. */
export class GeneradorFalso implements GeneradorDocumentoPort {
  llamadas: DocumentoDeclaracion[] = [];
  fallar = false;
  llamadasInforme: DocumentoInformeAuditoria[] = [];
  async generarDeclaracion(documento: DocumentoDeclaracion): Promise<DocumentoGenerado> {
    if (this.fallar) throw new Error('generador no disponible');
    this.llamadas.push(documento);
    const bytes = new TextEncoder().encode(JSON.stringify(documento));
    return { bytes, sha256: sha256Hex(bytes) };
  }
  async generarInformeAuditoria(documento: DocumentoInformeAuditoria): Promise<DocumentoGenerado> {
    if (this.fallar) throw new Error('generador no disponible');
    this.llamadasInforme.push(documento);
    const bytes = new TextEncoder().encode(JSON.stringify(documento));
    return { bytes, sha256: sha256Hex(bytes) };
  }
}
