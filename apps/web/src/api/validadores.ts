// La respuesta de la API se trata como un dato externo: forma EXACTA (sin campos de más ni de menos), tipos, patrones y topes del
// contrato. Lo que no cumple se rechaza entero (nunca se corrige ni se muestra a medias).
import type { Alcance, Cobertura, CoberturaEntrada, Evidencia, ResumenCobertura, TipoArchivo, ControlMarco, EntradaDeMapeo, MapeoDeControl, MarcoControles, CorrespondenciaNorma, Desglose, Diagnostico, EntradaLibreria, EstadoEvaluacion, EvaluacionVigente, FilaDiagnostico, Identidad, LibreriaResumen, Madurez, Rol, Declaracion, FilaDeclaracion, VersionDeclaracion, VersionDeclaracionConFilas } from './tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: readonly string[] = [
  'administrador_sig',
  'dueno_proceso',
  'auditor_interno',
  'auditor_externo',
  'colaborador',
  'alta_direccion',
];

const objeto = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const claves = (o: Record<string, unknown>, esperadas: readonly string[]): boolean =>
  Object.keys(o).sort().join(',') === [...esperadas].sort().join(',');
const texto = (v: unknown, max: number, patron?: RegExp, min = 0): v is string =>
  typeof v === 'string' && v.length >= min && v.length <= max && (patron === undefined || patron.test(v));

export const validarLibrerias = (cuerpo: unknown): LibreriaResumen[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 200) return null;
  const salida: LibreriaResumen[] = [];
  for (const item of cuerpo) {
    const o = objeto(item);
    if (!o || !claves(o, ['id', 'codigo', 'nombre', 'version', 'esEjemplo', 'fuente', 'adoptada'])) return null;
    if (!texto(o.id, 36, UUID) || !texto(o.codigo, 64, /^[a-z0-9-]+$/, 1) || !texto(o.nombre, 120, undefined, 1))
      return null;
    if (!texto(o.version, 20, /^[0-9]+\.[0-9]+\.[0-9]+$/) || !texto(o.fuente, 200)) return null;
    if (typeof o.esEjemplo !== 'boolean' || typeof o.adoptada !== 'boolean') return null;
    salida.push({
      id: o.id,
      codigo: o.codigo,
      nombre: o.nombre,
      version: o.version,
      esEjemplo: o.esEjemplo,
      fuente: o.fuente,
      adoptada: o.adoptada,
    });
  }
  return salida;
};

const correspondencias = (v: unknown): CorrespondenciaNorma[] | null => {
  if (!Array.isArray(v) || v.length < 1 || v.length > 20) return null;
  const salida: CorrespondenciaNorma[] = [];
  for (const item of v) {
    const o = objeto(item);
    if (!o || !claves(o, ['norma', 'edicion', 'clausula'])) return null;
    if (
      !texto(o.norma, 60, undefined, 1) ||
      !texto(o.edicion, 4, /^[0-9]{4}$/) ||
      !texto(o.clausula, 20, /^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$/)
    )
      return null;
    salida.push({ norma: o.norma, edicion: o.edicion, clausula: o.clausula });
  }
  return salida;
};

export const validarEntradas = (cuerpo: unknown): EntradaLibreria[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 500) return null;
  const salida: EntradaLibreria[] = [];
  for (const item of cuerpo) {
    const o = objeto(item);
    if (
      !o ||
      !claves(o, [
        'id',
        'idEstable',
        'libreriaId',
        'capitulo',
        'nivel',
        'tipo',
        'grupo',
        'titulo',
        'guia',
        'alcanceComun',
        'aplicaA',
        'esEjemplo',
      ])
    )
      return null;
    if (
      !texto(o.id, 36, UUID) ||
      !texto(o.libreriaId, 36, UUID) ||
      !texto(o.idEstable, 41, /^[a-z0-9][a-z0-9.-]{0,40}$/)
    )
      return null;
    if (o.capitulo !== null && (!Number.isInteger(o.capitulo) || (o.capitulo as number) < 4 || (o.capitulo as number) > 10)) return null;
    if (o.tipo !== 'clausula' && o.tipo !== 'control') return null;
    if (o.grupo !== null && !texto(o.grupo, 60, undefined, 2)) return null;
    // Coherencia: una cláusula lleva capítulo y no grupo; un control, al revés.
    if ((o.tipo === 'clausula') !== (o.capitulo !== null) || (o.tipo === 'control') !== (o.grupo !== null)) return null;
    if (o.nivel !== 1 && o.nivel !== 2) return null;
    if (!texto(o.titulo, 80, undefined, 1) || !texto(o.guia, 280, undefined, 1)) return null;
    if (o.alcanceComun !== 'comun' && o.alcanceComun !== 'parcial' && o.alcanceComun !== 'especifico') return null;
    const aplicaA = correspondencias(o.aplicaA);
    if (!aplicaA || typeof o.esEjemplo !== 'boolean') return null;
    salida.push({
      id: o.id,
      idEstable: o.idEstable,
      libreriaId: o.libreriaId,
      capitulo: o.capitulo as number | null,
      nivel: o.nivel,
      tipo: o.tipo,
      grupo: o.grupo as string | null,
      titulo: o.titulo,
      guia: o.guia,
      alcanceComun: o.alcanceComun,
      aplicaA,
      esEjemplo: o.esEjemplo,
    });
  }
  return salida;
};

export const validarIdentidad = (cuerpo: unknown): Identidad | null => {
  const o = objeto(cuerpo);
  if (!o || !claves(o, ['usuarioId', 'nombre', 'roles', 'empresa'])) return null;
  if (!texto(o.usuarioId, 36, UUID) || !texto(o.nombre, 120, undefined, 1)) return null;
  if (!Array.isArray(o.roles) || o.roles.length < 1 || o.roles.length > 6 || new Set(o.roles).size !== o.roles.length)
    return null;
  if (!o.roles.every((r) => typeof r === 'string' && ROLES.includes(r))) return null;
  const e = objeto(o.empresa);
  if (
    !e ||
    !claves(e, ['slug', 'nombre']) ||
    !texto(e.slug, 32, /^[a-z0-9-]+$/, 1) ||
    !texto(e.nombre, 120, undefined, 1)
  )
    return null;
  return {
    usuarioId: o.usuarioId,
    nombre: o.nombre,
    roles: o.roles as Rol[],
    empresa: { slug: e.slug, nombre: e.nombre },
  };
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}T[0-9:.]+(?:Z|[+-]\d{2}:\d{2})$/;
const ESTADOS: readonly string[] = ['cumple', 'parcial', 'no_cumple', 'no_aplica'];
const entero = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min;

export const validarAlcances = (cuerpo: unknown): Alcance[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 20) return null;
  const salida: Alcance[] = [];
  for (const item of cuerpo) {
    const o = objeto(item);
    if (!o || !claves(o, ['norma', 'texto', 'aprobado', 'aprobadoEn', 'actualizadoEn'])) return null;
    if (!texto(o.norma, 60, /^[A-Za-z0-9 :./-]+$/, 1)) return null;
    if (o.texto !== null && !texto(o.texto, 4000, undefined, 1)) return null;
    if (typeof o.aprobado !== 'boolean') return null;
    for (const f of [o.aprobadoEn, o.actualizadoEn]) if (f !== null && !texto(f, 40, FECHA_HORA)) return null;
    // Coherencia: lo aprobado tiene texto y fecha; lo no definido no está aprobado.
    if (o.aprobado && (o.texto === null || o.aprobadoEn === null)) return null;
    salida.push({ norma: o.norma, texto: o.texto as string | null, aprobado: o.aprobado, aprobadoEn: o.aprobadoEn as string | null, actualizadoEn: o.actualizadoEn as string | null });
  }
  return salida;
};

const evaluacionVigente = (v: unknown): EvaluacionVigente | null | undefined => {
  if (v === null) return null;
  const o = objeto(v);
  if (!o || !claves(o, ['estado', 'comentario', 'fechaObjetivo', 'version'])) return undefined;
  if (typeof o.estado !== 'string' || !ESTADOS.includes(o.estado)) return undefined;
  if (o.comentario !== null && !texto(o.comentario, 1000)) return undefined;
  if (o.fechaObjetivo !== null && !texto(o.fechaObjetivo, 10, FECHA)) return undefined;
  if (!entero(o.version, 1)) return undefined;
  return { estado: o.estado as EstadoEvaluacion, comentario: o.comentario as string | null, fechaObjetivo: o.fechaObjetivo as string | null, version: o.version };
};

const desglose = (v: unknown): Desglose | null => {
  const o = objeto(v);
  if (!o || !claves(o, ['cumple', 'parcial', 'noCumple', 'noAplica', 'sinEvaluar', 'total', 'porcentaje'])) return null;
  for (const k of ['cumple', 'parcial', 'noCumple', 'noAplica', 'sinEvaluar', 'total'] as const) if (!entero(o[k])) return null;
  if (o.porcentaje !== null && (typeof o.porcentaje !== 'number' || o.porcentaje < 0 || o.porcentaje > 100)) return null;
  return o as unknown as Desglose;
};

const madurez = (v: unknown): Madurez | null => {
  const o = objeto(v);
  if (!o || !claves(o, ['porNorma', 'porAgrupador', 'clausulas'])) return null;
  if (!Array.isArray(o.porNorma) || o.porNorma.length > 20 || !Array.isArray(o.porAgrupador) || o.porAgrupador.length > 100) return null;
  const porNorma: Madurez['porNorma'][number][] = [];
  for (const item of o.porNorma) {
    const n = objeto(item);
    const d = n ? desglose(n.desglose) : null;
    if (!n || !claves(n, ['norma', 'desglose']) || !texto(n.norma, 60, undefined, 1) || !d) return null;
    porNorma.push({ norma: n.norma, desglose: d });
  }
  const porAgrupador: Madurez['porAgrupador'][number][] = [];
  for (const item of o.porAgrupador) {
    const a = objeto(item);
    const d = a ? desglose(a.desglose) : null;
    if (!a || !claves(a, ['tipo', 'nombre', 'desglose']) || (a.tipo !== 'capitulo' && a.tipo !== 'tema') || !texto(a.nombre, 60, undefined, 1) || !d) return null;
    porAgrupador.push({ tipo: a.tipo, nombre: a.nombre, desglose: d });
  }
  const clausulas = desglose(o.clausulas);
  return clausulas ? { porNorma, porAgrupador, clausulas } : null;
};

export const validarDiagnostico = (cuerpo: unknown): Diagnostico | null => {
  const o = objeto(cuerpo);
  if (!o || !claves(o, ['filas', 'madurez', 'normas'])) return null;
  if (!Array.isArray(o.filas) || o.filas.length > 500 || !Array.isArray(o.normas) || o.normas.length > 20) return null;
  if (!o.normas.every((n) => texto(n, 60, undefined, 1))) return null;
  const m = madurez(o.madurez);
  if (!m) return null;
  const filas: FilaDiagnostico[] = [];
  for (const item of o.filas) {
    const f = objeto(item);
    if (!f || !claves(f, ['libreriaCodigo', 'idEstable', 'tipo', 'capitulo', 'grupo', 'titulo', 'guia', 'aplicaA', 'evaluacion'])) return null;
    if (!texto(f.libreriaCodigo, 64, /^[a-z0-9-]+$/, 1) || !texto(f.idEstable, 41, /^[a-z0-9][a-z0-9.-]{0,40}$/)) return null;
    if (f.tipo !== 'clausula' && f.tipo !== 'control') return null;
    if (f.capitulo !== null && (!entero(f.capitulo, 4) || f.capitulo > 10)) return null;
    if (f.grupo !== null && !texto(f.grupo, 60, undefined, 2)) return null;
    if ((f.tipo === 'clausula') !== (f.capitulo !== null) || (f.tipo === 'control') !== (f.grupo !== null)) return null;
    if (!texto(f.titulo, 80, undefined, 1) || !texto(f.guia, 280, undefined, 1)) return null;
    const aplicaA = correspondencias(f.aplicaA);
    const evaluacion = evaluacionVigente(f.evaluacion);
    if (!aplicaA || evaluacion === undefined) return null;
    filas.push({ libreriaCodigo: f.libreriaCodigo, idEstable: f.idEstable, tipo: f.tipo, capitulo: f.capitulo as number | null, grupo: f.grupo as string | null, titulo: f.titulo, guia: f.guia, aplicaA, evaluacion });
  }
  return { filas, madurez: m, normas: o.normas as string[] };
};

const entradaDeMapeo = (v: unknown): EntradaDeMapeo | null | undefined => {
  if (v === null) return null;
  const o = objeto(v);
  if (!o || !claves(o, ['tipo', 'titulo', 'aplicaA'])) return undefined;
  if ((o.tipo !== 'clausula' && o.tipo !== 'control') || !texto(o.titulo, 80, undefined, 1)) return undefined;
  const aplicaA = correspondencias(o.aplicaA);
  return aplicaA ? { tipo: o.tipo, titulo: o.titulo, aplicaA } : undefined;
};

export const validarMarcoControles = (cuerpo: unknown): MarcoControles | null => {
  const o = objeto(cuerpo);
  if (!o || !claves(o, ['controles', 'normas'])) return null;
  if (!Array.isArray(o.controles) || o.controles.length > 500 || !Array.isArray(o.normas) || o.normas.length > 20) return null;
  if (!o.normas.every((n) => texto(n, 60, undefined, 1))) return null;
  const controles: ControlMarco[] = [];
  for (const item of o.controles) {
    const c = objeto(item);
    if (!c || !claves(c, ['id', 'codigo', 'nombre', 'descripcion', 'responsableId', 'estado', 'version', 'mapeos', 'normas'])) return null;
    if (!texto(c.id, 36, UUID) || !texto(c.codigo, 20, /^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/, 1) || !texto(c.nombre, 120, undefined, 1)) return null;
    if (c.descripcion !== null && !texto(c.descripcion, 1000, undefined, 1)) return null;
    if (c.responsableId !== null && !texto(c.responsableId, 36, UUID)) return null;
    if (c.estado !== 'vigente' && c.estado !== 'retirado') return null;
    if (!entero(c.version, 1) || !Array.isArray(c.mapeos) || c.mapeos.length > 50 || !Array.isArray(c.normas) || c.normas.length > 20) return null;
    if (!c.normas.every((n) => texto(n, 60, undefined, 1))) return null;
    const mapeos: MapeoDeControl[] = [];
    for (const m of c.mapeos) {
      const mo = objeto(m);
      if (!mo || !claves(mo, ['libreriaCodigo', 'idEstable', 'entrada'])) return null;
      if (!texto(mo.libreriaCodigo, 64, /^[a-z0-9][a-z0-9-]{0,63}$/, 1) || !texto(mo.idEstable, 41, /^[a-z0-9][a-z0-9.-]{0,40}$/)) return null;
      const entrada = entradaDeMapeo(mo.entrada);
      if (entrada === undefined) return null;
      mapeos.push({ libreriaCodigo: mo.libreriaCodigo, idEstable: mo.idEstable, entrada });
    }
    controles.push({ id: c.id, codigo: c.codigo, nombre: c.nombre, descripcion: c.descripcion as string | null, responsableId: c.responsableId as string | null, estado: c.estado, version: c.version, mapeos, normas: c.normas as string[] });
  }
  return { controles, normas: o.normas as string[] };
};

const TIPOS_ARCHIVO: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const SHA256 = /^[0-9a-f]{64}$/;

export const validarEvidencias = (cuerpo: unknown): Evidencia[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 100) return null;
  const salida: Evidencia[] = [];
  for (const item of cuerpo) {
    const o = objeto(item);
    if (!o || !claves(o, ['id', 'controlId', 'tipo', 'titulo', 'fechaHecho', 'vigenteHasta', 'estado', 'reemplazaId', 'vigente', 'vencida', 'creadaEn', 'archivo'])) return null;
    if (!texto(o.id, 36, UUID) || !texto(o.controlId, 36, UUID)) return null;
    if (o.tipo !== 'documento' && o.tipo !== 'registro') return null;
    if (!texto(o.titulo, 120, undefined, 1) || !texto(o.fechaHecho, 10, FECHA)) return null;
    if (o.vigenteHasta !== null && !texto(o.vigenteHasta, 10, FECHA)) return null;
    if (o.estado !== 'activa' && o.estado !== 'reemplazada' && o.estado !== 'eliminada') return null;
    if (o.reemplazaId !== null && !texto(o.reemplazaId, 36, UUID)) return null;
    if (typeof o.vigente !== 'boolean' || typeof o.vencida !== 'boolean' || (o.vigente && o.vencida)) return null;
    // Coherencia: solo una evidencia activa puede estar vigente o vencida.
    if (o.estado !== 'activa' && (o.vigente || o.vencida)) return null;
    if (!texto(o.creadaEn, 40, FECHA_HORA)) return null;
    const a = objeto(o.archivo);
    if (!a || !claves(a, ['nombre', 'tipo', 'bytes', 'sha256'])) return null;
    if (!texto(a.nombre, 120, undefined, 1) || typeof a.tipo !== 'string' || !TIPOS_ARCHIVO.includes(a.tipo)) return null;
    if (!entero(a.bytes, 1) || a.bytes > 26_214_400 || !texto(a.sha256, 64, SHA256)) return null;
    salida.push({
      id: o.id, controlId: o.controlId, tipo: o.tipo, titulo: o.titulo, fechaHecho: o.fechaHecho, vigenteHasta: o.vigenteHasta as string | null,
      estado: o.estado, reemplazaId: o.reemplazaId as string | null, vigente: o.vigente, vencida: o.vencida, creadaEn: o.creadaEn,
      archivo: { nombre: a.nombre, tipo: a.tipo as TipoArchivo, bytes: a.bytes, sha256: a.sha256 },
    });
  }
  return salida;
};

const resumen = (o: Record<string, unknown>, extra: readonly string[] = []): boolean => {
  if (!claves(o, [...extra, 'total', 'cubiertas', 'evidenciaVencida', 'sinEvidencia', 'sinControl', 'porcentaje'])) return false;
  for (const k of ['total', 'cubiertas', 'evidenciaVencida', 'sinEvidencia', 'sinControl'] as const) if (!entero(o[k])) return false;
  if (o.porcentaje !== null && (!entero(o.porcentaje) || (o.porcentaje as number) > 100)) return false;
  // Las cuentas suman el total.
  return (o.cubiertas as number) + (o.evidenciaVencida as number) + (o.sinEvidencia as number) + (o.sinControl as number) === o.total;
};

const ESTADOS_COBERTURA: readonly string[] = ['cubierta', 'evidencia_vencida', 'sin_evidencia', 'sin_control', 'no_aplica'];

export const validarCobertura = (cuerpo: unknown): Cobertura | null => {
  const o = objeto(cuerpo);
  if (!o || !claves(o, ['hoy', 'entradas', 'porNorma', 'total', 'normas'])) return null;
  if (!texto(o.hoy, 10, FECHA) || !Array.isArray(o.entradas) || o.entradas.length > 500 || !Array.isArray(o.porNorma) || o.porNorma.length > 20 || !Array.isArray(o.normas) || o.normas.length > 20) return null;
  if (!o.normas.every((n) => texto(n, 60, undefined, 1))) return null;
  const total = objeto(o.total);
  if (!total || !resumen(total)) return null;
  const porNorma: Cobertura['porNorma'][number][] = [];
  for (const item of o.porNorma) {
    const n = objeto(item);
    if (!n || !resumen(n, ['norma']) || !texto(n.norma, 60, undefined, 1)) return null;
    porNorma.push(n as unknown as Cobertura['porNorma'][number]);
  }
  const entradas: CoberturaEntrada[] = [];
  for (const item of o.entradas) {
    const e = objeto(item);
    if (!e || !claves(e, ['libreriaCodigo', 'idEstable', 'tipo', 'capitulo', 'grupo', 'titulo', 'normas', 'estado', 'controles', 'evidencias'])) return null;
    if (!texto(e.libreriaCodigo, 64, /^[a-z0-9-]+$/, 1) || !texto(e.idEstable, 41, /^[a-z0-9][a-z0-9.-]{0,40}$/)) return null;
    if (e.tipo !== 'clausula' && e.tipo !== 'control') return null;
    if (e.capitulo !== null && (!entero(e.capitulo, 4) || e.capitulo > 10)) return null;
    if (e.grupo !== null && !texto(e.grupo, 60, undefined, 2)) return null;
    if ((e.tipo === 'clausula') !== (e.capitulo !== null) || (e.tipo === 'control') !== (e.grupo !== null)) return null;
    if (!texto(e.titulo, 80, undefined, 1) || !Array.isArray(e.normas) || e.normas.length < 1 || e.normas.length > 20 || !e.normas.every((n) => texto(n, 60, undefined, 1))) return null;
    if (typeof e.estado !== 'string' || !ESTADOS_COBERTURA.includes(e.estado) || !entero(e.controles) || !entero(e.evidencias)) return null;
    entradas.push(e as unknown as CoberturaEntrada);
  }
  return { hoy: o.hoy, entradas, porNorma, total: total as unknown as ResumenCobertura, normas: o.normas as string[] };
};

// ---- Declaración de Aplicabilidad (M5)
const IMPLEMENTACIONES: readonly string[] = ['implementado', 'parcial', 'no_implementado'];
const CONTROL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/;

const validarFilasDeclaracion = (filas: unknown): FilaDeclaracion[] | null => {
  if (!Array.isArray(filas) || filas.length > 500) return null;
  const salida: FilaDeclaracion[] = [];
  const vistas = new Set<string>();
  for (const item of filas) {
    const f = objeto(item);
    if (!f || !claves(f, ['libreriaCodigo', 'idEstable', 'orden', 'titulo', 'grupo', 'aplicabilidad', 'implementacion', 'justificacion', 'controles', 'cobertura'])) return null;
    if (!texto(f.libreriaCodigo, 64, /^[a-z0-9][a-z0-9-]*$/, 1) || !texto(f.idEstable, 41, /^[a-z0-9][a-z0-9.-]{0,40}$/) || !entero(f.orden) || !texto(f.titulo, 200, undefined, 1)) return null;
    if (f.grupo !== null && !texto(f.grupo, 80, undefined, 1)) return null;
    if (f.aplicabilidad !== 'aplica' && f.aplicabilidad !== 'no_aplica' && f.aplicabilidad !== 'por_decidir') return null;
    if (f.implementacion !== null && (typeof f.implementacion !== 'string' || !IMPLEMENTACIONES.includes(f.implementacion))) return null;
    if (f.justificacion !== null && !texto(f.justificacion, 1000, undefined, 1)) return null;
    if (!Array.isArray(f.controles) || f.controles.length > 50 || !f.controles.every((c) => texto(c, 20, CONTROL_RE))) return null;
    if (typeof f.cobertura !== 'string' || !ESTADOS_COBERTURA.includes(f.cobertura)) return null;
    // Coherencia: lo que aplica trae su implementación; lo que no aplica, su justificación; lo que está por decidir, nada de las dos.
    if (f.aplicabilidad === 'aplica' && (f.implementacion === null || f.justificacion !== null)) return null;
    if (f.aplicabilidad === 'no_aplica' && (f.implementacion !== null || f.justificacion === null || f.cobertura !== 'no_aplica')) return null;
    if (f.aplicabilidad === 'por_decidir' && (f.implementacion !== null || f.justificacion !== null)) return null;
    const k = `${f.libreriaCodigo}|${f.idEstable}`;
    if (vistas.has(k)) return null;
    vistas.add(k);
    salida.push(f as unknown as FilaDeclaracion);
  }
  return salida;
};

const CAMPOS_VERSION = ['id', 'numero', 'total', 'aplican', 'noAplican', 'sinControl', 'aprobadaPor', 'aprobadaEn'] as const;
const versionValida = (v: Record<string, unknown>): boolean =>
  texto(v.id, 36, UUID) && entero(v.numero, 1) && entero(v.total) && entero(v.aplican) && entero(v.noAplican) && entero(v.sinControl) && texto(v.aprobadaPor, 36, UUID) && texto(v.aprobadaEn, 40, FECHA_HORA) &&
  (v.aplican as number) + (v.noAplican as number) === v.total && (v.sinControl as number) <= (v.aplican as number);

export const validarVersionDeclaracion = (cuerpo: unknown): VersionDeclaracion | null => {
  const v = objeto(cuerpo);
  return v && claves(v, CAMPOS_VERSION) && versionValida(v) ? (v as unknown as VersionDeclaracion) : null;
};

export const validarVersionesDeclaracion = (cuerpo: unknown): VersionDeclaracion[] | null => {
  if (!Array.isArray(cuerpo) || cuerpo.length > 100) return null;
  const salida: VersionDeclaracion[] = [];
  for (const item of cuerpo) {
    const v = validarVersionDeclaracion(item);
    // De la más nueva a la más antigua, sin repetir números.
    if (!v || (salida.length > 0 && v.numero >= (salida[salida.length - 1] as VersionDeclaracion).numero)) return null;
    salida.push(v);
  }
  return salida;
};

export const validarVersionDeclaracionConFilas = (cuerpo: unknown): VersionDeclaracionConFilas | null => {
  const v = objeto(cuerpo);
  if (!v || !claves(v, [...CAMPOS_VERSION, 'alcance', 'filas']) || !versionValida(v)) return null;
  if (v.alcance !== null && !texto(v.alcance, 4000, undefined, 1)) return null;
  const filas = validarFilasDeclaracion(v.filas);
  if (!filas || filas.length !== v.total || filas.some((f) => f.aplicabilidad === 'por_decidir')) return null;
  if (filas.filter((f) => f.aplicabilidad === 'aplica').length !== v.aplican) return null;
  return { ...(v as unknown as VersionDeclaracion), alcance: v.alcance as string | null, filas };
};

export const validarDeclaracion = (cuerpo: unknown): Declaracion | null => {
  const o = objeto(cuerpo);
  if (!o || !claves(o, ['norma', 'hoy', 'resumen', 'filas', 'alcance', 'ultimaVersion'])) return null;
  if (!texto(o.norma, 60, undefined, 1) || !texto(o.hoy, 10, FECHA)) return null;
  const filas = validarFilasDeclaracion(o.filas);
  const r = objeto(o.resumen);
  if (!filas || !r || !claves(r, ['total', 'aplican', 'noAplican', 'porDecidir', 'sinControl', 'aprobable'])) return null;
  for (const k of ['total', 'aplican', 'noAplican', 'porDecidir', 'sinControl'] as const) if (!entero(r[k])) return null;
  // El resumen tiene que decir lo mismo que las filas: si no, no se muestra nada a medias.
  const cuenta = (a: string) => filas.filter((f) => f.aplicabilidad === a).length;
  if (r.total !== filas.length || r.aplican !== cuenta('aplica') || r.noAplican !== cuenta('no_aplica') || r.porDecidir !== cuenta('por_decidir')) return null;
  if ((r.sinControl as number) > (r.aplican as number) || r.aprobable !== (filas.length > 0 && r.porDecidir === 0)) return null;
  let alcance: Declaracion['alcance'] = null;
  if (o.alcance !== null) {
    const a = objeto(o.alcance);
    if (!a || !claves(a, ['texto', 'aprobado']) || !texto(a.texto, 4000, undefined, 1) || typeof a.aprobado !== 'boolean') return null;
    alcance = { texto: a.texto, aprobado: a.aprobado };
  }
  let ultimaVersion: VersionDeclaracion | null = null;
  if (o.ultimaVersion !== null) {
    ultimaVersion = validarVersionDeclaracion(o.ultimaVersion);
    if (!ultimaVersion) return null;
  }
  return { norma: o.norma, hoy: o.hoy, resumen: r as unknown as Declaracion['resumen'], filas, alcance, ultimaVersion };
};
