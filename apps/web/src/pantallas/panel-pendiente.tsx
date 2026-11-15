import { Alert, EstadoVacio } from '@sig/ui';
import type { AvisoCambio } from '../cambio-empresa/cambiar';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { MarcoApp } from './marco';

/** Panel de una empresa real: el módulo de evaluación aún no existe, así que se dice con claridad (sin datos de ejemplo ajenos). */
export const PantallaPanelPendiente = ({ empresa, persona, aviso = null }: { empresa: Empresa; persona: string; aviso?: AvisoCambio | null }) => (
  <MarcoApp empresa={empresa} activo="panel" persona={persona}>
    {aviso && (
      <div className="mb-4">
        <Alert tono={es.empresas.avisos[aviso].tono} titulo={es.empresas.avisos[aviso].titulo}>
          {es.empresas.avisos[aviso].detalle}
        </Alert>
      </div>
    )}
    <h1 className="mb-6 text-2xl font-semibold text-fg">{es.panel.titulo}</h1>
    <EstadoVacio titulo={es.panel.pendienteTitulo} descripcion={es.panel.pendienteDescripcion} />
  </MarcoApp>
);
