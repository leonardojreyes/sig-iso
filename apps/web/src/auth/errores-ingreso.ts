// Código GENÉRICO con el que /auth/callback devuelve a la portada cuando el ingreso falla (nunca el motivo interno).
export type ErrorIngreso = 'ingreso_invalido' | 'ingreso_cancelado' | 'ingreso_no_disponible';

const CONOCIDOS: readonly string[] = ['ingreso_invalido', 'ingreso_cancelado', 'ingreso_no_disponible'];

export const leerErrorIngreso = (
  sp: Readonly<Record<string, string | readonly string[] | undefined>>,
): ErrorIngreso | null => {
  const e = sp.error;
  return typeof e === 'string' && CONOCIDOS.includes(e) ? (e as ErrorIngreso) : null;
};
