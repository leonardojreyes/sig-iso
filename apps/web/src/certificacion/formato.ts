const FORMATO_ECUADOR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' });

/** La fecha de hoy en Ecuador (`AAAA-MM-DD`): la misma con la que la API decide si una evidencia está vigente. */
export const hoyEnEcuador = (ahora: Date = new Date()): string => FORMATO_ECUADOR.format(ahora);

/** Tamaño de un archivo en palabras (con coma decimal): «812 B», «1,4 KB», «3,2 MB». */
export const tamanoLegible = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i += 1;
  }
  return `${valor.toFixed(1).replace('.', ',')} ${unidades[i]}`;
};

/** Los primeros caracteres de una huella SHA-256, para mostrarla sin ocupar toda la fila (la completa va en el `title`). */
export const huellaCorta = (sha256: string): string => `${sha256.slice(0, 12)}…`;
