import { BotonEnlace, Card } from '@sig/ui';
import type { ErrorIngreso } from '../auth/errores-ingreso';
import { es } from '../i18n/es-EC';
import { MARCA_GENERICA } from '../marca/generica';
import { AvisoDeIngreso, enlaceDeIngreso } from './ingreso';
import { LogoEmpresa } from './marco';

/** Portada para quien no tiene sesión: el nombre del producto y una sola acción, ingresar. */
export const PantallaInicio = ({ error }: { error: ErrorIngreso | null }) => (
  <main className="flex min-h-screen items-center justify-center bg-bg p-6">
    <Card className="w-full max-w-md p-8">
      <div className="mb-6">
        <LogoEmpresa empresa={MARCA_GENERICA} />
      </div>
      <h1 className="text-3xl font-semibold text-fg">{es.app.nombre}</h1>
      <p className="mt-1 text-fg-muted">{es.app.lema}</p>
      <p className="mb-6 mt-4 text-sm text-fg-muted">{es.inicio.descripcion}</p>
      {error && (
        <div className="mb-6">
          <AvisoDeIngreso error={error} />
        </div>
      )}
      <BotonEnlace className="w-full" href={enlaceDeIngreso()}>
        {es.ingreso.sso}
      </BotonEnlace>
    </Card>
  </main>
);
