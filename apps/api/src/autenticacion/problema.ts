// Errores de la API según el contrato (RFC 9457 cerrado): sin `detail` ni campos libres, para no filtrar datos de la solicitud.

export type CodigoProblema = 'no_autenticado' | 'sin_permiso' | 'no_encontrado' | 'parametro_invalido' | 'limite_excedido' | 'error_interno';

export interface Problema {
  readonly type: 'about:blank';
  readonly title: string;
  readonly status: number;
  readonly codigo: CodigoProblema;
}

const TITULOS: Readonly<Record<CodigoProblema, string>> = {
  no_autenticado: 'No autenticado',
  sin_permiso: 'Sin permiso',
  no_encontrado: 'No encontrado',
  parametro_invalido: 'Parámetros no válidos',
  limite_excedido: 'Límite de solicitudes excedido',
  error_interno: 'Error interno',
};

/** Estado HTTP → código del contrato. Todo 5xx se presenta como 500 `error_interno`; los demás 4xx, como `parametro_invalido`. */
export const problemaDeEstado = (estado: number): Problema => {
  const codigo: CodigoProblema =
    estado === 401 ? 'no_autenticado' : estado === 403 ? 'sin_permiso' : estado === 404 ? 'no_encontrado' : estado === 429 ? 'limite_excedido' : estado >= 400 && estado < 500 ? 'parametro_invalido' : 'error_interno';
  const status = estado >= 400 && estado < 500 ? estado : 500;
  return { type: 'about:blank', title: TITULOS[codigo], status, codigo };
};
