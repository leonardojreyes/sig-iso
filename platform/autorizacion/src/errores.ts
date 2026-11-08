/** Un dato de la consulta de autorización no es válido, así que NO se puede decidir. Nunca repite el valor recibido. */
export class ErrorAutorizacion extends Error {
  constructor(readonly campo: string) {
    super(`Valor no válido en «${campo}»: no se puede decidir el permiso`);
    this.name = 'ErrorAutorizacion';
  }
}
