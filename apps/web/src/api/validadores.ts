// La respuesta de la API se trata como un dato externo: forma EXACTA (sin campos de más ni de menos), tipos, patrones y topes del
// contrato. Lo que no cumple se rechaza entero (nunca se corrige ni se muestra a medias).
import type { Alcance, CorrespondenciaNorma, Desglose, Diagnostico, EntradaLibreria, EstadoEvaluacion, EvaluacionVigente, FilaDiagnostico, Identidad, LibreriaResumen, Madurez, Rol } from './tipos';

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
