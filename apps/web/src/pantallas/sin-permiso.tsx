import { EstadoVacio } from '@sig/ui';
import type { Rol } from '../api/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { MarcoApp } from './marco';

/** El rol de la persona no incluye esta consulta (la API respondió 403). No distingue qué existe o no. */
export const PantallaSinPermiso = ({ empresa, persona, activo }: { empresa: Empresa; persona: { readonly nombre: string; readonly roles: readonly Rol[] }; activo: 'diagnostico' | 'alcance' | 'controles' }) => (
  <MarcoApp empresa={empresa} activo={activo} persona={persona.nombre}>
    <EstadoVacio titulo={es.sinPermiso.titulo} descripcion={es.sinPermiso.descripcion} />
  </MarcoApp>
);
