export type Entorno = Readonly<Record<string, string | undefined>>;

export interface ConfiguracionFlags {
  readonly adopcionHabilitada: boolean;
}

/**
 * `FEATURE_ADOPCION_HABILITADA` (`true` o `false`, por defecto `true`): interruptor de la adopción de librerías. El error nombra
 * la variable y no repite su valor.
 */
export const leerConfiguracionFlags = (env: Entorno): ConfiguracionFlags => {
  const valor = env.FEATURE_ADOPCION_HABILITADA;
  if (valor === undefined || valor === 'true') return { adopcionHabilitada: true };
  if (valor === 'false') return { adopcionHabilitada: false };
  throw new Error('Configuración no válida en FEATURE_ADOPCION_HABILITADA: use «true» o «false»');
};
