// Resultado de una adopción, que viaja en la dirección al volver al listado. Solo valores CONOCIDOS; los dos de éxito llevan la
// librería (la pantalla comprueba que de verdad esté adoptada antes de decir nada: una dirección inventada no muestra un éxito).
import { UUID } from '../validacion/patrones';

export type TipoAviso = 'adoptada' | 'ya_adoptada' | 'sin_permiso' | 'no_encontrada' | 'no_disponible';
export type AvisoAdopcion =
  | { readonly tipo: 'adoptada' | 'ya_adoptada'; readonly libreriaId: string }
  | { readonly tipo: 'sin_permiso' | 'no_encontrada' | 'no_disponible' };

type Parametros = Readonly<Record<string, string | readonly string[] | undefined>>;

export const leerAviso = (sp: Parametros): AvisoAdopcion | null => {
  const tipo = sp.adopcion;
  if (typeof tipo !== 'string') return null;
  if (tipo === 'sin_permiso' || tipo === 'no_encontrada' || tipo === 'no_disponible') return { tipo };
  if (tipo === 'adoptada' || tipo === 'ya_adoptada') {
    const libreria = sp.libreria;
    return typeof libreria === 'string' && UUID.test(libreria) ? { tipo, libreriaId: libreria } : null;
  }
  return null;
};
