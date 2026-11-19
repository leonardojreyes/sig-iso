// La respuesta de la API se trata como un dato externo: forma EXACTA (sin campos de más ni de menos), tipos, patrones y topes del
// contrato. Lo que no cumple se rechaza entero (nunca se corrige ni se muestra a medias).
import { UUID } from '../validacion/patrones';
import {
  CLASIFICACIONES,
  ESTADOS_VERSION,
  MOTIVOS_DEVOLUCION,
  TIPOS_DOCUMENTO,
  type CoberturaDocumental,
  type Documento,
  type DocumentoDetalle,
  type ListaDocumentos,
  type LecturaPendiente,
  type PersonaDirectorio,
  type Retencion,
  type VersionDocumento,
} from './tipos';

const objeto = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const claves = (o: Record<string, unknown>, esperadas: readonly string[]): boolean => Object.keys(o).sort().join(',') === [...esperadas].sort().join(',');
const texto = (v: unknown, max: number, patron?: RegExp, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max && (patron === undefined || patron.test(v));
const textoONulo = (v: unknown, max: number): boolean => v === null || texto(v, max, undefined, 1);
const entero = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const uuid = (v: unknown): v is string => texto(v, 36, UUID);
const uuidONulo = (v: unknown): boolean => v === null || uuid(v);
const fecha = (v: unknown): v is string => texto(v, 10, /^\d{4}-\d{2}-\d{2}$/);
const fechaHora = (v: unknown): v is string => texto(v, 40, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
const fechaONula = (v: unknown): boolean => v === null || fecha(v);
const fechaHoraONula = (v: unknown): boolean => v === null || fechaHora(v);
const en = (v: unknown, lista: readonly string[]): boolean => typeof v === 'string' && lista.includes(v);
const CODIGO = /^[A-Z]{3}-\d{3,6}$/;
const SHA = /^[0-9a-f]{64}$/;
const LIBRERIA = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_ESTABLE = /^[a-z0-9][a-z0-9.-]{0,40}$/;

const lecturasValidas = (v: unknown): boolean => {
  if (v === null) return true;
  const l = objeto(v);
  return l !== null && claves(l, ['confirmadas', 'total']) && entero(l.confirmadas) && entero(l.total) && l.confirmadas <= l.total;
};

const CAMPOS_DOCUMENTO = ['id', 'codigo', 'tipo', 'titulo', 'area', 'clasificacion', 'responsableId', 'emisor', 'edicionFuente', 'estado', 'proximaRevision', 'revision', 'ultimaRevisionEn', 'vigente', 'sinVigente', 'lecturas', 'lecturaPendiente', 'version'];

const documentoValido = (d: Record<string, unknown>): boolean => {
  if (!uuid(d.id) || !texto(d.codigo, 10, CODIGO) || !en(d.tipo, TIPOS_DOCUMENTO) || !texto(d.titulo, 120, undefined, 1) || !textoONulo(d.area, 60) || !en(d.clasificacion, CLASIFICACIONES)) return false;
  if (!uuid(d.responsableId) || !textoONulo(d.emisor, 120) || !textoONulo(d.edicionFuente, 60) || (d.estado !== 'activo' && d.estado !== 'retirado')) return false;
  if (!fechaONula(d.proximaRevision) || !(d.revision === null || en(d.revision, ['vencida', 'por_vencer', 'al_dia'])) || !fechaHoraONula(d.ultimaRevisionEn)) return false;
  if (typeof d.sinVigente !== 'boolean' || typeof d.lecturaPendiente !== 'boolean' || !lecturasValidas(d.lecturas) || !entero(d.version, 1)) return false;
  if (d.vigente !== null) {
    const v = objeto(d.vigente);
    if (!v || !claves(v, ['versionId', 'numero', 'aprobadaEn']) || !uuid(v.versionId) || !entero(v.numero, 1) || !fechaHora(v.aprobadaEn)) return false;
  }
  // Coherencia: sin vigente solo es cierto para un documento activo sin versión vigente; la revisión solo existe con versión vigente.
  if (d.sinVigente !== (d.estado === 'activo' && d.vigente === null)) return false;
  if (d.vigente === null && (d.revision !== null || d.proximaRevision !== null)) return false;
  return true;
};

export const validarDocumento = (cuerpo: unknown): Documento | null => {
  const d = objeto(cuerpo);
  return d && claves(d, CAMPOS_DOCUMENTO) && documentoValido(d) ? (d as unknown as Documento) : null;
};

export const validarListaDocumentos = (cuerpo: unknown): ListaDocumentos | null => {
  const l = objeto(cuerpo);
  if (!l || !claves(l, ['hoy', 'documentos']) || !fecha(l.hoy) || !Array.isArray(l.documentos) || l.documentos.length > 1000) return null;
  const vistos = new Set<string>();
  for (const item of l.documentos) {
    const d = objeto(item);
    if (!d || !claves(d, CAMPOS_DOCUMENTO) || !documentoValido(d) || vistos.has(d.codigo as string)) return null;
    vistos.add(d.codigo as string);
  }
  return l as unknown as ListaDocumentos;
};

const CAMPOS_VERSION = ['id', 'documentoId', 'numero', 'estado', 'vigente', 'nota', 'archivo', 'autorId', 'aprobadorId', 'aprobadaPor', 'aprobadaEn', 'porSuAutor', 'motivoExcepcion', 'requiereLectura', 'devueltaMotivo', 'devueltaNota', 'obsoletaEn', 'elegibleParaDisposicion', 'lecturas', 'creadaEn'];

const versionValida = (v: Record<string, unknown>): boolean => {
  if (!claves(v, CAMPOS_VERSION) || !uuid(v.id) || !uuid(v.documentoId) || !entero(v.numero, 1) || !en(v.estado, ESTADOS_VERSION) || typeof v.vigente !== 'boolean') return false;
  const a = objeto(v.archivo);
  if (!a || !claves(a, ['nombre', 'tipo', 'bytes', 'sha256']) || !texto(a.nombre, 120, undefined, 1) || !texto(a.tipo, 120, undefined, 1) || !entero(a.bytes, 1, 26_214_400) || !texto(a.sha256, 64, SHA)) return false;
  if (!texto(v.nota, 500, undefined, 1) || !uuid(v.autorId) || !uuidONulo(v.aprobadorId) || !uuidONulo(v.aprobadaPor) || !fechaHoraONula(v.aprobadaEn) || !fechaHoraONula(v.obsoletaEn) || !fechaHora(v.creadaEn)) return false;
  if (typeof v.porSuAutor !== 'boolean' || !textoONulo(v.motivoExcepcion, 300) || typeof v.requiereLectura !== 'boolean' || typeof v.elegibleParaDisposicion !== 'boolean') return false;
  if (!(v.devueltaMotivo === null || en(v.devueltaMotivo, MOTIVOS_DEVOLUCION)) || !textoONulo(v.devueltaNota, 300) || !lecturasValidas(v.lecturas)) return false;
  // Coherencia: solo la aprobada rige; una excepción trae su motivo; solo una obsoleta puede ser elegible para disposición.
  if (v.vigente !== (v.estado === 'aprobada') || v.porSuAutor !== (v.motivoExcepcion !== null)) return false;
  if (v.elegibleParaDisposicion && v.estado !== 'obsoleta') return false;
  if ((v.estado === 'aprobada' || v.estado === 'obsoleta') && (v.aprobadaPor === null || v.aprobadaEn === null)) return false;
  return true;
};

export const validarVersionDocumento = (cuerpo: unknown): VersionDocumento | null => {
  const v = objeto(cuerpo);
  return v && versionValida(v) ? (v as unknown as VersionDocumento) : null;
};

export const validarDocumentoDetalle = (cuerpo: unknown): DocumentoDetalle | null => {
  const d = objeto(cuerpo);
  if (!d || !claves(d, [...CAMPOS_DOCUMENTO, 'versiones', 'destinatarios', 'controles', 'entradas', 'retencion', 'unicoAdministrador']) || !documentoValido(d)) return null;
  if (!Array.isArray(d.versiones) || d.versiones.length > 500 || !Array.isArray(d.destinatarios) || d.destinatarios.length > 500 || !Array.isArray(d.controles) || d.controles.length > 50 || !Array.isArray(d.entradas) || d.entradas.length > 50) return null;
  if (typeof d.unicoAdministrador !== 'boolean') return null;
  const numeros = new Set<number>();
  let aprobadas = 0;
  for (const item of d.versiones) {
    const v = objeto(item);
    if (!v || !versionValida(v) || v.documentoId !== d.id || numeros.has(v.numero as number)) return null;
    numeros.add(v.numero as number);
    if (v.estado === 'aprobada') aprobadas += 1;
  }
  if (aprobadas > 1 || (aprobadas === 1) !== (d.vigente !== null)) return null; // una sola vigente, y coincide con la del encabezado
  if (!d.destinatarios.every(uuid) || new Set(d.destinatarios).size !== d.destinatarios.length || !d.controles.every(uuid)) return null;
  for (const item of d.entradas) {
    const e = objeto(item);
    if (!e || !claves(e, ['libreriaCodigo', 'idEstable']) || !texto(e.libreriaCodigo, 64, LIBRERIA) || !texto(e.idEstable, 41, ID_ESTABLE)) return null;
  }
  if (d.retencion !== null) {
    const r = objeto(d.retencion);
    if (!r || !claves(r, ['anios', 'motivo']) || !entero(r.anios, 1, 100) || !texto(r.motivo, 200, undefined, 1)) return null;
  }
  return d as unknown as DocumentoDetalle;
};

export const validarLecturasPendientes = (cuerpo: unknown): LecturaPendiente[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 1000) return null;
  for (const item of cuerpo) {
    const l = objeto(item);
    if (!l || !claves(l, ['versionId', 'documentoId', 'codigo', 'titulo', 'numeroVersion']) || !uuid(l.versionId) || !uuid(l.documentoId) || !texto(l.codigo, 10, CODIGO) || !texto(l.titulo, 120, undefined, 1) || !entero(l.numeroVersion, 1)) return null;
  }
  return cuerpo as LecturaPendiente[];
};

export const validarCoberturaDocumental = (cuerpo: unknown): CoberturaDocumental | null => {
  const c = objeto(cuerpo);
  if (!c || !claves(c, ['normas', 'total', 'cubiertas', 'entradas']) || !Array.isArray(c.normas) || c.normas.length > 50 || !c.normas.every((n) => texto(n, 60, undefined, 1))) return null;
  if (!entero(c.total) || !entero(c.cubiertas) || c.cubiertas > c.total || !Array.isArray(c.entradas) || c.entradas.length > 500) return null;
  for (const item of c.entradas) {
    const e = objeto(item);
    if (!e || !claves(e, ['libreriaCodigo', 'idEstable', 'tipo', 'titulo', 'normas', 'documentos', 'cubierta']) || !texto(e.libreriaCodigo, 64, LIBRERIA) || !texto(e.idEstable, 41, ID_ESTABLE)) return null;
    if ((e.tipo !== 'clausula' && e.tipo !== 'control') || !texto(e.titulo, 200, undefined, 1) || !Array.isArray(e.normas) || e.normas.length > 20 || !e.normas.every((n) => texto(n, 60, undefined, 1))) return null;
    if (!Array.isArray(e.documentos) || e.documentos.length > 50 || typeof e.cubierta !== 'boolean' || e.cubierta !== e.documentos.length > 0) return null;
    for (const dd of e.documentos) {
      const x = objeto(dd);
      if (!x || !claves(x, ['id', 'codigo']) || !uuid(x.id) || !texto(x.codigo, 10, CODIGO)) return null;
    }
  }
  return c as unknown as CoberturaDocumental;
};

export const validarRetenciones = (cuerpo: unknown): Retencion[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 7) return null;
  const vistos = new Set<string>();
  for (const item of cuerpo) {
    const r = objeto(item);
    if (!r || !claves(r, ['tipo', 'anios', 'motivo', 'version']) || !en(r.tipo, TIPOS_DOCUMENTO) || vistos.has(r.tipo as string) || !entero(r.anios, 1, 100) || !texto(r.motivo, 200, undefined, 1) || !entero(r.version, 1)) return null;
    vistos.add(r.tipo as string);
  }
  return cuerpo as Retencion[];
};

export const validarDirectorio = (cuerpo: unknown): PersonaDirectorio[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 1000) return null;
  const vistos = new Set<string>();
  for (const item of cuerpo) {
    const p = objeto(item);
    if (!p || !claves(p, ['id', 'nombre', 'activa', 'puedeAprobar']) || !uuid(p.id) || vistos.has(p.id) || !texto(p.nombre, 120, undefined, 1) || typeof p.activa !== 'boolean' || typeof p.puedeAprobar !== 'boolean' || (p.puedeAprobar && !p.activa)) return null;
    vistos.add(p.id);
  }
  return cuerpo as PersonaDirectorio[];
};
