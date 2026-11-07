/**
 * Deja pasar como mucho un hecho por clave en cada ventana de tiempo y cuenta lo que frena. Sirve para que una ráfaga de
 * peticiones con tokens falsos no infle la bitácora inmutable. La memoria está acotada: con más claves vivas que `maxClaves`
 * deja de admitir claves nuevas en vez de crecer.
 */
export class LimitadorPorVentana {
  private readonly ultimo = new Map<string, number>();
  private readonly frenados = new Map<string, number>();

  constructor(
    private readonly ventanaMs: number,
    private readonly ahora: () => number,
    private readonly maxClaves = 1000,
  ) {
    if (!Number.isFinite(ventanaMs) || ventanaMs <= 0) throw new Error('La ventana debe ser un número positivo de milisegundos');
  }

  permitir(clave: string): boolean {
    const t = this.ahora();
    const previo = this.ultimo.get(clave);
    if (previo === undefined) {
      if (this.ultimo.size >= this.maxClaves) this.descartarVencidas(t);
      if (this.ultimo.size >= this.maxClaves) return false;
    } else if (t - previo < this.ventanaMs) {
      this.frenados.set(clave, (this.frenados.get(clave) ?? 0) + 1);
      return false;
    }
    this.ultimo.set(clave, t);
    this.frenados.delete(clave);
    return true;
  }

  /** Intentos frenados de esa clave desde la última vez que se dejó pasar. */
  suprimidos(clave: string): number {
    return this.frenados.get(clave) ?? 0;
  }

  tamano(): number {
    return this.ultimo.size;
  }

  private descartarVencidas(t: number): void {
    for (const [clave, momento] of this.ultimo) {
      if (t - momento >= this.ventanaMs) {
        this.ultimo.delete(clave);
        this.frenados.delete(clave);
      }
    }
  }
}
