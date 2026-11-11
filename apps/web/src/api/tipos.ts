// Formas de las respuestas de la API que usa la web (espejo de packages/contracts/openapi.yaml). Se validan al recibirlas.
export type AlcanceComun = 'comun' | 'parcial' | 'especifico';
export type Rol =
  'administrador_sig' | 'dueno_proceso' | 'auditor_interno' | 'auditor_externo' | 'colaborador' | 'alta_direccion';

export interface LibreriaResumen {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly version: string;
  readonly esEjemplo: boolean;
  readonly fuente: string;
  readonly adoptada: boolean;
}

export interface CorrespondenciaNorma {
  readonly norma: string;
  readonly edicion: string;
  readonly clausula: string;
}

export interface EntradaLibreria {
  readonly id: string;
  readonly idEstable: string;
  readonly libreriaId: string;
  /** Nulo en un control del Anexo A. */
  readonly capitulo: number | null;
  readonly nivel: 1 | 2;
  readonly tipo: 'clausula' | 'control';
  /** Tema del control; nulo en una cláusula. */
  readonly grupo: string | null;
  readonly titulo: string;
  readonly guia: string;
  readonly alcanceComun: AlcanceComun;
  readonly aplicaA: readonly CorrespondenciaNorma[];
  readonly esEjemplo: boolean;
}

export interface Identidad {
  readonly usuarioId: string;
  readonly nombre: string;
  readonly roles: readonly Rol[];
  readonly empresa: { readonly slug: string; readonly nombre: string };
}

export type EstadoEvaluacion = 'cumple' | 'parcial' | 'no_cumple' | 'no_aplica';

export interface Alcance {
  readonly norma: string;
  /** Nulo mientras el alcance no se haya definido. */
  readonly texto: string | null;
  readonly aprobado: boolean;
  readonly aprobadoEn: string | null;
  readonly actualizadoEn: string | null;
}

export interface EvaluacionVigente {
  readonly estado: EstadoEvaluacion;
  readonly comentario: string | null;
  readonly fechaObjetivo: string | null;
  readonly version: number;
}

export interface FilaDiagnostico {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly tipo: 'clausula' | 'control';
  readonly capitulo: number | null;
  readonly grupo: string | null;
  readonly titulo: string;
  readonly guia: string;
  readonly aplicaA: readonly CorrespondenciaNorma[];
  /** Nulo = sin evaluar. */
  readonly evaluacion: EvaluacionVigente | null;
}

export interface Desglose {
  readonly cumple: number;
  readonly parcial: number;
  readonly noCumple: number;
  readonly noAplica: number;
  readonly sinEvaluar: number;
  readonly total: number;
  /** Nulo si no hay nada evaluado que cuente (no es 0). */
  readonly porcentaje: number | null;
}

export interface Madurez {
  readonly porNorma: readonly { readonly norma: string; readonly desglose: Desglose }[];
  readonly porAgrupador: readonly { readonly tipo: 'capitulo' | 'tema'; readonly nombre: string; readonly desglose: Desglose }[];
  readonly clausulas: Desglose;
}

export interface Diagnostico {
  readonly filas: readonly FilaDiagnostico[];
  readonly madurez: Madurez;
  readonly normas: readonly string[];
}

export type EstadoControl = 'vigente' | 'retirado';

export interface EntradaDeMapeo {
  readonly tipo: 'clausula' | 'control';
  readonly titulo: string;
  readonly aplicaA: readonly CorrespondenciaNorma[];
}

export interface MapeoDeControl {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  /** Nula si la entrada ya no está entre las librerías que la empresa adoptó. */
  readonly entrada: EntradaDeMapeo | null;
}

export interface ControlMarco {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly responsableId: string | null;
  readonly estado: EstadoControl;
  readonly version: number;
  readonly mapeos: readonly MapeoDeControl[];
  /** Normas que alcanza por los mapeos cuyas entradas siguen adoptadas. */
  readonly normas: readonly string[];
}

export interface MarcoControles {
  readonly controles: readonly ControlMarco[];
  readonly normas: readonly string[];
}
