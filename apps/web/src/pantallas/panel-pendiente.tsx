import { EstadoVacio } from '@sig/ui';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { MarcoApp } from './marco';

/** Panel de una empresa real: el módulo de evaluación aún no existe, así que se dice con claridad (sin datos de ejemplo ajenos). */
export const PantallaPanelPendiente = ({ empresa, persona }: { empresa: Empresa; persona: string }) => (
  <MarcoApp empresa={empresa} activo="panel" persona={persona}>
    <h1 className="mb-6 text-2xl font-semibold text-fg">{es.panel.titulo}</h1>
    <EstadoVacio titulo={es.panel.pendienteTitulo} descripcion={es.panel.pendienteDescripcion} />
  </MarcoApp>
);
