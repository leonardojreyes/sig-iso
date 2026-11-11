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
