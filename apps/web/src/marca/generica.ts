import { es } from '../i18n/es-EC';
import type { Empresa } from './tipos';

/** Marca del producto para pantallas sin sesión (ingreso): sin sesión no se puede pedir la marca de ninguna empresa. */
export const MARCA_GENERICA: Empresa = { id: 'sig', nombre: es.app.nombre, primario: '#0E5C42' };
