// Datos del listado de requisitos (entradas de las librerías ADOPTADAS por la empresa de la sesión). Todo sale de la API con el
// token de la sesión; la empresa nunca es un parámetro. Si algo falla no se muestra una lista a medias.
import { consultarApi } from '../api/cliente';
import type { EntradaLibreria, LibreriaResumen } from '../api/tipos';
import { validarEntradas, validarLibrerias } from '../api/validadores';
import { construirConsulta, type FiltrosRequisitos } from './filtros';

export type ResultadoListado =
  | {
      readonly tipo: 'ok';
      readonly librerias: LibreriaResumen[];
      readonly entradas: EntradaLibreria[];
      readonly normasDisponibles: string[];
    }
  | { readonly tipo: 'ingresar' }
  | { readonly tipo: 'no_disponible' };

const normasDe = (entradas: readonly EntradaLibreria[]): string[] =>
  [...new Set(entradas.flatMap((e) => e.aplicaA.map((a) => a.norma)))].sort();

export const cargarListado = async (p: {
  acceso: string;
  apiUrl: string;
  fetchFn: typeof fetch;
  filtros: FiltrosRequisitos;
}): Promise<ResultadoListado> => {
  const base = { acceso: p.acceso, apiUrl: p.apiUrl, fetchFn: p.fetchFn };
  const primera = await consultarApi({ ...base, ruta: '/librerias' });
  if (!primera.ok) return primera.motivo === 'no_autenticado' ? { tipo: 'ingresar' } : { tipo: 'no_disponible' };
  const librerias = validarLibrerias(primera.json);
  if (!librerias) return { tipo: 'no_disponible' };
  // Sin librerías adoptadas no hay entradas que pedir.
  if (!librerias.some((l) => l.adoptada)) return { tipo: 'ok', librerias, entradas: [], normasDisponibles: [] };

  const consulta = construirConsulta(p.filtros);
  // Con filtros hace falta además la lista SIN filtrar, solo para ofrecer todas las normas en el selector.
  const [filtradas, todas] = await Promise.all([
    consultarApi({ ...base, ruta: `/requisitos${consulta}` }),
    consulta === '' ? Promise.resolve(null) : consultarApi({ ...base, ruta: '/requisitos' }),
  ]);
  const respuestas = [filtradas, todas].filter((r) => r !== null);
  if (respuestas.some((r) => !r.ok && r.motivo === 'no_autenticado')) return { tipo: 'ingresar' };
  if (respuestas.some((r) => !r.ok)) return { tipo: 'no_disponible' };

  const listaFiltrada = filtradas.ok ? validarEntradas(filtradas.json) : null;
  const listaTodas = todas === null ? listaFiltrada : todas.ok ? validarEntradas(todas.json) : null;
  if (!listaFiltrada || !listaTodas) return { tipo: 'no_disponible' };

  return { tipo: 'ok', librerias, entradas: listaFiltrada, normasDisponibles: normasDe(listaTodas) };
};
