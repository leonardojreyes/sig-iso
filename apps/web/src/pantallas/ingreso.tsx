import { Alert, BotonEnlace, Card } from '@sig/ui';
import type { ErrorIngreso } from '../auth/errores-ingreso';
import { rutaDeRetornoSegura } from '../auth/retorno';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { LogoEmpresa } from './marco';

/** Enlace de ingreso: lleva a /auth/login recordando a dónde volver (solo rutas propias; cualquier otra cosa se descarta). */
export const enlaceDeIngreso = (retorno?: string): string => {
  if (retorno === undefined) return '/auth/login';
  const seguro = rutaDeRetornoSegura(retorno, 'http://sitio.invalid');
  // `rutaDeRetornoSegura` devuelve «/» cuando descarta algo; si el original no era «/», se trata como descartado.
  return seguro === retorno ? `/auth/login?retorno=${encodeURIComponent(seguro)}` : '/auth/login';
};

export const AvisoDeIngreso = ({ error }: { error: ErrorIngreso }) => {
  const e = es.ingreso.errores[error];
  return (
    <Alert tono="warning" titulo={e.titulo}>
      {e.detalle}
    </Alert>
  );
};

/**
 * Pantalla de ingreso. La aplicación NUNCA pide correo ni contraseña: lo hace el servicio de identidad (Keycloak); aquí solo hay
 * una acción que inicia el flujo seguro de /auth/login.
 */
export const PantallaIngreso = ({
  empresa,
  retorno,
  error = null,
}: {
  empresa: Empresa;
  retorno?: string;
  error?: ErrorIngreso | null;
}) => (
  <main className="flex min-h-screen items-center justify-center bg-bg p-6">
    <Card className="w-full max-w-md p-8">
      <div className="mb-6">
        <LogoEmpresa empresa={empresa} />
      </div>
      <h1 className="text-2xl font-semibold text-fg">{es.ingreso.titulo}</h1>
      <p className="mb-6 mt-1 text-sm text-fg-muted">{es.ingreso.subtitulo}</p>
      {error && (
        <div className="mb-6">
          <AvisoDeIngreso error={error} />
        </div>
      )}
      <BotonEnlace className="w-full" href={enlaceDeIngreso(retorno)}>
        {es.ingreso.sso}
      </BotonEnlace>
    </Card>
  </main>
);
