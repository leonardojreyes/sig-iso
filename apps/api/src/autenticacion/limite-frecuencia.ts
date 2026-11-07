export interface OpcionesLimite {
  /** Solicitudes que admite una persona por ventana (y la ráfaga máxima que acumula). */
  readonly persona: number;
  /** Solicitudes que admite una empresa por ventana, sumadas todas sus personas. */
  readonly empresa: number;
  /** Duración de la ventana en milisegundos. Por defecto, un minuto. */
  readonly ventanaMs?: number;
  /** Reloj en milisegundos. */
  readonly ahora: () => number;
  /** Máximo de cubos en memoria (personas + empresas). */
  readonly maxClaves?: number;
}

interface Cubo {
  fichas: number;
  momento: number;
}

const exigirEntero = (nombre: string, valor: number): void => {
  if (!Number.isInteger(valor) || valor < 1) throw new Error(`La capacidad de ${nombre} debe ser un entero positivo`);
};

/**
 * Límite de frecuencia por persona y por empresa con cubos de fichas: cada cubo se llena a ritmo constante (capacidad por
 * ventana) y cada solicitud gasta una ficha de la persona Y otra de su empresa. Se comprueban los dos antes de gastar
 * ninguna: quien es rechazado no vacía el cubo de los demás. Memoria acotada y sin datos personales (solo identificadores).
 */
export class LimiteFrecuencia {
  private readonly cubos = new Map<string, Cubo>();
  private readonly ventanaMs: number;
  private readonly maxClaves: number;

  constructor(private readonly o: OpcionesLimite) {
    exigirEntero('persona', o.persona);
    exigirEntero('empresa', o.empresa);
    this.ventanaMs = o.ventanaMs ?? 60_000;
    if (!Number.isFinite(this.ventanaMs) || this.ventanaMs <= 0) throw new Error('La ventana debe ser un número positivo de milisegundos');
    this.maxClaves = o.maxClaves ?? 10_000;
  }

  /** `0` si la solicitud se admite (y gasta sus fichas); si no, los segundos (entero, mínimo 1) que faltan para poder reintentar. */
  intentar(usuarioId: string, empresaId: string): number {
    const t = this.o.ahora();
    const clavePersona = `p:${usuarioId}`;
    const claveEmpresa = `e:${empresaId}`;
    const usadas = new Set([clavePersona, claveEmpresa]);
    const persona = this.reponer(clavePersona, this.o.persona, t, usadas);
    const empresa = this.reponer(claveEmpresa, this.o.empresa, t, usadas);
    const espera = Math.max(this.esperaSegundos(persona, this.o.persona), this.esperaSegundos(empresa, this.o.empresa));
    if (espera > 0) return espera;
    persona.fichas -= 1;
    empresa.fichas -= 1;
    return 0;
  }

  tamano(): number {
    return this.cubos.size;
  }

  private capacidadDe(clave: string): number {
    return clave.startsWith('p:') ? this.o.persona : this.o.empresa;
  }

  /** Fichas que tendría el cubo en `t` (sin pasar de la capacidad). Si el reloj retrocede no se inventan fichas. */
  private fichasEn(cubo: Cubo, capacidad: number, t: number): number {
    return Math.min(capacidad, cubo.fichas + (Math.max(0, t - cubo.momento) * capacidad) / this.ventanaMs);
  }

  private reponer(clave: string, capacidad: number, t: number, usadas: ReadonlySet<string>): Cubo {
    let cubo = this.cubos.get(clave);
    if (!cubo) {
      if (this.cubos.size >= this.maxClaves) this.expulsar(t, usadas);
      cubo = { fichas: capacidad, momento: t };
    } else {
      cubo.fichas = this.fichasEn(cubo, capacidad, t);
      cubo.momento = Math.max(cubo.momento, t);
      this.cubos.delete(clave);
    }
    this.cubos.set(clave, cubo);
    return cubo;
  }

  private esperaSegundos(cubo: Cubo, capacidad: number): number {
    if (cubo.fichas >= 1) return 0;
    const msPorFicha = this.ventanaMs / capacidad;
    return Math.max(1, Math.ceil(((1 - cubo.fichas) * msPorFicha) / 1000));
  }

  /**
   * Hace sitio quitando primero los cubos llenos (inactivos) y, si hace falta, los MÁS llenos: expulsar a quien casi no ha
   * gastado apenas le cambia nada, y a quien está castigado (cubo vacío) se le conserva. Nunca quita los de la solicitud en curso.
   */
  private expulsar(t: number, usadas: ReadonlySet<string>): void {
    for (const [clave, cubo] of this.cubos) {
      const capacidad = this.capacidadDe(clave);
      if (!usadas.has(clave) && this.fichasEn(cubo, capacidad, t) >= capacidad) this.cubos.delete(clave);
    }
    while (this.cubos.size >= this.maxClaves) {
      let elegida: string | undefined;
      let mejor = -1;
      for (const [clave, cubo] of this.cubos) {
        if (usadas.has(clave)) continue;
        const llenura = this.fichasEn(cubo, this.capacidadDe(clave), t) / this.capacidadDe(clave);
        if (llenura > mejor) {
          mejor = llenura;
          elegida = clave;
        }
      }
      if (elegida === undefined) break;
      this.cubos.delete(elegida);
    }
  }
}
