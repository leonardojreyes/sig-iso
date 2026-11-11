import { Alert } from '@sig/ui';
import { es } from '../i18n/es-EC';
import type { AvisoEscritura } from '../certificacion/escribir';

/** Resultado de la última escritura (de una lista cerrada; nunca texto de la API ni de la dirección). */
export const AvisoDeEscritura = ({ aviso }: { aviso: AvisoEscritura | null }) => {
  if (!aviso) return null;
  const a = es.avisosEscritura[aviso];
  return (
    <div className="mb-4">
      <Alert tono={a.tono} titulo={a.titulo}>
        {'detalle' in a ? a.detalle : undefined}
      </Alert>
    </div>
  );
};
