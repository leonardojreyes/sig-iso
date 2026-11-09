// Lista blanca de campos de un evento de usuario de Keycloak (ADR 028, H6.2).
// Se copia SOLO tipo, hora, código de error, cuenta (userId) y aplicación (clientId). La dirección de red,
// el nombre de usuario tecleado y los detalles NUNCA salen de aquí: ni a más código ni a los registros.
export interface EventoKeycloak {
  readonly time: number;
  readonly type: string;
  readonly clientId?: string;
  readonly userId?: string;
  readonly error?: string;
}

const LARGO_MAXIMO = 200;

const texto = (valor: unknown): string | undefined =>
  typeof valor === "string" && valor.length > 0 && valor.length <= LARGO_MAXIMO
    ? valor
    : undefined;

export const proyectarEvento = (crudo: unknown): EventoKeycloak | null => {
  if (crudo === null || typeof crudo !== "object" || Array.isArray(crudo))
    return null;
  const e = crudo as Record<string, unknown>;
  if (typeof e.time !== "number" || !Number.isSafeInteger(e.time)) return null;
  const type = texto(e.type);
  if (type === undefined) return null;
  const clientId = texto(e.clientId);
  const userId = texto(e.userId);
  const error = texto(e.error);
  return {
    time: e.time,
    type,
    ...(clientId !== undefined && { clientId }),
    ...(userId !== undefined && { userId }),
    ...(error !== undefined && { error }),
  };
};
