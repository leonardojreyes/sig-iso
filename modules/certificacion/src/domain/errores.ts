/** Un valor no cumple una regla del dominio. `campo` nombra el dato (nunca incluye el valor recibido). */
export class ErrorCertificacion extends Error {
  constructor(
    readonly campo: string,
    readonly motivos: readonly string[] = [],
  ) {
    super(`valor no válido: ${campo}${motivos.length > 0 ? ` (${motivos.join(', ')})` : ''}`);
    this.name = 'ErrorCertificacion';
  }
}
