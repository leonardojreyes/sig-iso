export type TipoProblema = 'hueco_en_la_secuencia' | 'enlace_roto' | 'huella_invalida' | 'ancla_perdida';

export interface ProblemaIntegridad {
  /** UUID de la empresa o 'plataforma'. */
  readonly clave: string;
  readonly secuencia: number | null;
  readonly problema: TipoProblema;
}

/** Verifica y ancla las cadenas de la bitácora (funciones SQL `bitacora_verificar` y `bitacora_anclar`). */
export interface IntegridadBitacoraPort {
  verificar(): Promise<readonly ProblemaIntegridad[]>;
  /** Devuelve cuántas anclas nuevas guardó. */
  anclar(): Promise<number>;
}

export interface AlertaIntegridad {
  readonly severidad: 'critica';
  readonly asunto: string;
  /** Solo claves de cadena (UUID de empresa o 'plataforma'), secuencias y tipos de problema: nada de datos personales. */
  readonly problemas: readonly ProblemaIntegridad[];
}

export interface AlertasPort {
  notificar(alerta: AlertaIntegridad): Promise<void>;
}
