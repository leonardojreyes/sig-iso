/** Un parámetro enviado por quien llama no cumple el contrato. Lleva solo su nombre: nunca repite el valor recibido. */
export class ParametroInvalidoError extends Error {
  constructor(readonly parametro: string) {
    super(`Parámetro no válido: ${parametro}`);
    this.name = 'ParametroInvalidoError';
  }
}

// Mismo patrón que `IdRuta` del contrato: UUID en forma canónica (con guiones, sin llaves). Admite mayúsculas.
const UUID_RUTA = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Identificador recibido en la ruta, normalizado a minúsculas. Un UUID bien formado se acepta aunque sea el nulo (se buscará y
 * dará «no encontrado»); lo mal formado lanza `ParametroInvalidoError` sin repetir el valor.
 */
export const parsearIdRuta = (valor: unknown, parametro = 'id'): string => {
  if (typeof valor !== 'string' || valor.length > 36 || !UUID_RUTA.test(valor)) throw new ParametroInvalidoError(parametro);
  return valor.toLowerCase();
};
