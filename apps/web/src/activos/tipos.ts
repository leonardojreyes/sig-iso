// Formas de los activos de información (contrato openapi.yaml, ADR 038) tal como las usa la web. Todo viene validado por `validadores.ts`.
export const TIPOS_ACTIVO = ['informacion', 'aplicacion_sistema', 'infraestructura', 'persona', 'servicio_terceros', 'instalacion'] as const;
export type TipoActivo = (typeof TIPOS_ACTIVO)[number];
export const CLASIFICACIONES_ACTIVO = ['publica', 'interna', 'confidencial', 'restringida'] as const;
export type ClasificacionActivo = (typeof CLASIFICACIONES_ACTIVO)[number];
export type NivelActivo = 'bajo' | 'medio' | 'alto' | 'critico';

export interface Activo {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly tipo: TipoActivo;
  readonly clasificacion: ClasificacionActivo;
  readonly responsableId: string;
  readonly estado: 'vigente' | 'retirado';
  readonly version: number;
}
export interface ActivoListado extends Activo {
  readonly riesgos: number;
  readonly sinRiesgos: boolean;
}
export interface ActivoDetalle extends Activo {
  readonly riesgos: readonly { readonly id: string; readonly codigo: string; readonly titulo: string; readonly nivel: NivelActivo; readonly puntaje: number; readonly estado: 'vigente' | 'retirado' }[];
  readonly nivelMasAlto: NivelActivo | null;
}
export interface AvisoRetiroActivo {
  readonly activoId: string;
  readonly codigo: string;
  readonly riesgosSinActivo: readonly { readonly id: string; readonly codigo: string; readonly titulo: string }[];
}
