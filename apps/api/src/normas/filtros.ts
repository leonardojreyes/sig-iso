import { ParametroInvalidoError } from '@sig/normas';

/** Filtros de `GET /requisitos` ya en su tipo. Los valores se validan de verdad en el caso de uso; aquí solo se evitan formas raras. */
export interface FiltrosRequisitos {
  q?: string;
  capitulo?: number;
  norma?: string;
}

const texto = (valor: unknown, parametro: string): string => {
  // Un parámetro repetido (`?q=a&q=b`) o con forma de objeto (`?q[x]=y`) llega como lista u objeto: no es un texto.
  if (typeof valor !== 'string') throw new ParametroInvalidoError(parametro);
  return valor;
};

export const leerFiltrosRequisitos = (consulta: Readonly<Record<string, unknown>>): FiltrosRequisitos => {
  const filtros: FiltrosRequisitos = {};
  if (consulta['q'] !== undefined) filtros.q = texto(consulta['q'], 'q');
  if (consulta['norma'] !== undefined) filtros.norma = texto(consulta['norma'], 'norma');
  if (consulta['capitulo'] !== undefined) {
    const t = texto(consulta['capitulo'], 'capitulo');
    // Solo dígitos: «4.5», «abc», «», « 5» y «+5» no son un entero. El rango (4 a 10) lo comprueba el caso de uso.
    if (!/^[0-9]{1,3}$/.test(t)) throw new ParametroInvalidoError('capitulo');
    filtros.capitulo = Number(t);
  }
  return filtros;
};
