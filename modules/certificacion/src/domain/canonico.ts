// Serialización canónica (claves ordenadas, sin espacios) para calcular y volver a verificar una huella: PostgreSQL guarda `jsonb` con
// otro orden de claves, así que la huella no puede depender del orden en que se serializó la primera vez.

const ordenar = (valor: unknown): unknown => {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, ordenar(v)]),
    );
  }
  return valor;
};

/** El mismo texto para el mismo contenido, sin importar el orden de las claves ni el almacén que lo guardó. */
export const serializarCanonico = (valor: unknown): string => JSON.stringify(ordenar(valor));
