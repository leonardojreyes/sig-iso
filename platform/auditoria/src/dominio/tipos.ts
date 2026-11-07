import type { EmpresaId } from '@sig/tenancy';
import type { AccionBitacora, ActorTipo, MotivoBitacora, Resultado } from './catalogo';

export type { AccionBitacora, ActorTipo, MotivoBitacora, Resultado } from './catalogo';

/** Valores que puede llevar `antes`/`despues`: escalares. */
export type ValorBitacora = string | number | boolean;

/** Lo que cuenta quien quiere registrar un hecho. Se valida antes de escribir. */
export interface EventoBitacora {
  /** `null` = hecho de plataforma (sin empresa). */
  readonly empresaId: EmpresaId | null;
  readonly actor: { readonly tipo: ActorTipo; /** Identificador opaco de la cuenta (UUID). */ readonly usuarioId?: string };
  readonly accion: AccionBitacora;
  readonly objeto?: string;
  readonly objetoVersion?: string;
  readonly resultado: Resultado;
  readonly motivo?: MotivoBitacora;
  readonly traceId?: string;
  readonly origenId?: string;
  readonly antes?: Readonly<Record<string, ValorBitacora>>;
  readonly despues?: Readonly<Record<string, ValorBitacora>>;
}

declare const validado: unique symbol;

/** Un registro YA validado. Solo `validarEvento` lo produce: un objeto armado a mano no es de este tipo. */
export interface RegistroBitacora {
  readonly [validado]: true;
  readonly empresaId: EmpresaId | null;
  readonly actorTipo: ActorTipo;
  readonly usuarioId: string | null;
  readonly accion: AccionBitacora;
  readonly objeto: string | null;
  readonly objetoVersion: string | null;
  readonly resultado: Resultado;
  readonly motivo: MotivoBitacora | null;
  readonly traceId: string | null;
  readonly origenId: string | null;
  readonly antes: Readonly<Record<string, ValorBitacora>> | null;
  readonly despues: Readonly<Record<string, ValorBitacora>> | null;
}
