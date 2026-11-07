/**
 * El evento no cumple el catálogo. Los problemas nombran campos y códigos, NUNCA el valor recibido ni el nombre de una
 * clave desconocida: cualquiera de los dos podría ser el dato personal que la bitácora no debe guardar.
 */
export class EventoBitacoraInvalidoError extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Evento de bitácora no válido (${problemas.length} problema${problemas.length === 1 ? '' : 's'}): ${problemas.join('; ')}`);
    this.name = 'EventoBitacoraInvalidoError';
  }
}
