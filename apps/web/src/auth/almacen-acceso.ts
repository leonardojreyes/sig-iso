// Memoria del servidor para el access token y el refresh token MÁS RECIENTE de cada sesión (indexados por `sid`). Nada de esto va
// al navegador: la cookie solo lleva el refresh token del momento de emitirla, y el de aquí permite que una cookie rezagada (de
// antes de una rotación) no reutilice un refresh ya usado, lo que Keycloak castiga revocando la sesión (ADR 027).
// También sirve de cerrojo: una sola renovación a la vez por sesión dentro de esta instancia.

export interface EntradaAcceso {
  readonly acceso: string;
  readonly refresco: string;
  /** Milisegundos desde la época en que vence el access token. */
  readonly expiraEn: number;
}

export interface ResultadoRenovacion {
  readonly ok: boolean;
  readonly motivo?: 'expirada' | 'no_disponible';
}

export class AlmacenAcceso {
  private readonly datos = new Map<string, EntradaAcceso>();
  /** Renovaciones en curso por `sid`: las solicitudes simultáneas esperan la misma. */
  readonly renovando = new Map<string, Promise<ResultadoRenovacion>>();

  constructor(private readonly maximo = 5000) {}

  get tamano(): number {
    return this.datos.size;
  }

  obtener(sid: string): EntradaAcceso | undefined {
    return this.datos.get(sid);
  }

  guardar(sid: string, entrada: EntradaAcceso): void {
    // Reinsertar mueve la sesión al final (la más reciente); al pasar el tope sale la más antigua.
    this.datos.delete(sid);
    this.datos.set(sid, entrada);
    while (this.datos.size > this.maximo) {
      const masAntigua = this.datos.keys().next().value;
      if (masAntigua === undefined) break;
      this.datos.delete(masAntigua);
    }
  }

  borrar(sid: string): void {
    this.datos.delete(sid);
  }
}

// Una sola memoria por proceso del servidor (el modo desarrollo recarga módulos y crearía otra).
const CLAVE_GLOBAL = Symbol.for('sig-iso.web.almacen-acceso');
export const almacenCompartido = (): AlmacenAcceso => {
  const global = globalThis as unknown as Record<symbol, AlmacenAcceso | undefined>;
  return (global[CLAVE_GLOBAL] ??= new AlmacenAcceso());
};
