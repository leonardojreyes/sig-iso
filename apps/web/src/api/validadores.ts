// La respuesta de la API se trata como un dato externo: forma EXACTA (sin campos de más ni de menos), tipos, patrones y topes del
// contrato. Lo que no cumple se rechaza entero (nunca se corrige ni se muestra a medias).
import type { CorrespondenciaNorma, EntradaLibreria, Identidad, LibreriaResumen, Rol } from './tipos';

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
    if (!Number.isInteger(o.capitulo) || (o.capitulo as number) < 4 || (o.capitulo as number) > 10) return null;
    if (o.nivel !== 1 && o.nivel !== 2) return null;
    if (!texto(o.titulo, 80, undefined, 1) || !texto(o.guia, 280, undefined, 1)) return null;
    if (o.alcanceComun !== 'comun' && o.alcanceComun !== 'parcial' && o.alcanceComun !== 'especifico') return null;
    const aplicaA = correspondencias(o.aplicaA);
    if (!aplicaA || typeof o.esEjemplo !== 'boolean') return null;
    salida.push({
      id: o.id,
      idEstable: o.idEstable,
      libreriaId: o.libreriaId,
      capitulo: o.capitulo as number,
      nivel: o.nivel,
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
