// Nombre y correo de una persona, tal como los escribe el administrador SIG al aprobar una solicitud (ADR 036). Son datos personales:
// nunca salen del token (la API no los conoce) ni van a la bitácora, y el mensaje de error no repite lo recibido.

/** Lo enviado no es un nombre y un correo válidos. No repite el valor. La API lo responde como 400. */
export class ErrorDatosPersona extends Error {
  constructor() {
    super('Los datos de la persona no son válidos');
    this.name = 'ErrorDatosPersona';
  }
}

export interface DatosPersona {
  readonly nombre: string;
  readonly correo: string;
}

// Un solo `@`, sin espacios, con un punto en el dominio. La verificación de verdad es que la persona pueda ingresar con su cuenta.
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Cualquier carácter de control o de formato (saltos de línea, ceros de ancho cero, etc.).
const CONTROL = /\p{C}/u;

export const validarDatosPersona = (entrada: { readonly nombre: unknown; readonly correo: unknown }): DatosPersona => {
  const { nombre: n, correo: c } = entrada;
  if (typeof n !== 'string' || typeof c !== 'string') throw new ErrorDatosPersona();
  const nombre = n.trim();
  const correo = c.trim().toLowerCase();
  if (nombre.length < 1 || nombre.length > 120 || CONTROL.test(nombre)) throw new ErrorDatosPersona();
  if (correo.length < 3 || correo.length > 254 || !CORREO.test(correo) || CONTROL.test(correo)) throw new ErrorDatosPersona();
  return { nombre, correo };
};
