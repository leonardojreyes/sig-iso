import type { EvaluarEntradaEntrada } from '@sig/certificacion';

// Lectura TOLERANTE del cuerpo y de la consulta: aquí solo se extraen los campos conocidos (los demás se ignoran). Qué es válido
// lo decide el caso de uso DESPUÉS de comprobar el permiso (orden 401 → 403 → 400 → 404), así que un valor de tipo equivocado
// pasa tal cual y el caso de uso responde 400 sin repetirlo. El dominio es la única fuente de verdad de rangos y formatos.

const campos = (cuerpo: unknown): Record<string, unknown> => (typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : {});

export const leerAlcanceNorma = (cuerpo: unknown): { norma: string } => ({ norma: campos(cuerpo)['norma'] as string });

export const leerAlcanceEntrada = (cuerpo: unknown): { norma: string; texto: string } => {
  const o = campos(cuerpo);
  return { norma: o['norma'] as string, texto: o['texto'] as string };
};

type CuerpoEvaluacion = Pick<EvaluarEntradaEntrada, 'libreriaCodigo' | 'idEstable' | 'estado' | 'comentario' | 'responsableId' | 'fechaObjetivo' | 'versionEsperada'>;

export const leerEvaluacionEntrada = (cuerpo: unknown): CuerpoEvaluacion => {
  const o = campos(cuerpo);
  const r = { libreriaCodigo: o['libreriaCodigo'], idEstable: o['idEstable'], estado: o['estado'] } as CuerpoEvaluacion;
  for (const k of ['comentario', 'responsableId', 'fechaObjetivo', 'versionEsperada'] as const) if (o[k] !== undefined) (r as unknown as Record<string, unknown>)[k] = o[k];
  return r;
};

export interface FiltrosDiagnostico {
  q?: string;
  norma?: string;
  tipo?: 'clausula' | 'control';
  estado?: 'cumple' | 'parcial' | 'no_cumple' | 'no_aplica' | 'sin_evaluar';
}

/** Un parámetro repetido (`?q=a&q=b`) llega como lista: pasa tal cual y el caso de uso lo rechaza con 400. */
export const leerFiltrosDiagnostico = (consulta: Readonly<Record<string, unknown>>): FiltrosDiagnostico => {
  const f: Record<string, unknown> = {};
  for (const k of ['q', 'norma', 'tipo', 'estado']) if (consulta[k] !== undefined) f[k] = consulta[k];
  return f as FiltrosDiagnostico;
};

// ---- Controles de la empresa y mapeos (M3)

/** Copia solo las claves conocidas que vengan presentes (los demás campos se ignoran; el caso de uso valida lo que pasa). */
const elegir = (o: Record<string, unknown>, claves: readonly string[]): Record<string, unknown> => {
  const r: Record<string, unknown> = {};
  for (const k of claves) if (o[k] !== undefined) r[k] = o[k];
  return r;
};

export const leerControlEntrada = (cuerpo: unknown): { codigo: string; nombre: string; descripcion?: string | null; responsableId?: string | null } =>
  elegir(campos(cuerpo), ['codigo', 'nombre', 'descripcion', 'responsableId']) as { codigo: string; nombre: string; descripcion?: string | null; responsableId?: string | null };

export const leerControlCambios = (cuerpo: unknown): { versionEsperada?: number; nombre?: string; descripcion?: string | null; responsableId?: string | null } =>
  elegir(campos(cuerpo), ['versionEsperada', 'nombre', 'descripcion', 'responsableId']);

export const leerControlVersion = (cuerpo: unknown): { versionEsperada?: number } => elegir(campos(cuerpo), ['versionEsperada']);

export const leerMapeoEntrada = (cuerpo: unknown): { libreriaCodigo: string; idEstable: string } =>
  elegir(campos(cuerpo), ['libreriaCodigo', 'idEstable']) as { libreriaCodigo: string; idEstable: string };

/** `?incluirRetirados=true|false`; cualquier otra cosa pasa tal cual y el caso de uso la rechaza con 400. */
export const leerFiltrosControles = (consulta: Readonly<Record<string, unknown>>): { norma?: string; incluirRetirados?: boolean } => {
  const f: Record<string, unknown> = {};
  if (consulta['norma'] !== undefined) f['norma'] = consulta['norma'];
  const r = consulta['incluirRetirados'];
  if (r !== undefined) f['incluirRetirados'] = r === 'true' ? true : r === 'false' ? false : r;
  return f as { norma?: string; incluirRetirados?: boolean };
};
