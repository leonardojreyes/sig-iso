import { Alert, BotonEnlace, Card } from '@sig/ui';
import { enlaceDeIngreso } from './ingreso';
import { es } from '../i18n/es-EC';
import { MARCA_GENERICA } from '../marca/generica';
import { CodigoSolicitud } from './codigo-solicitud';
import { LogoEmpresa } from './marco';

const t = es.accesoPendiente;
const fecha = (iso: string): string =>
  new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date(iso));

/**
 * Lo ve una cuenta que ingresó pero aún no tiene rol (ADR 036): su código de solicitud, para que se lo entregue al administrador SIG.
 * No hay sesión ni empresa en pantalla. `codigo` es nulo si la cookie ya venció o no está.
 */
export const PantallaAccesoPendiente = ({ codigo }: { codigo: { readonly codigo: string; readonly venceEn: string } | null }) => (
  <main className="flex min-h-screen items-center justify-center bg-bg p-6">
    <Card className="w-full max-w-md p-8">
      <div className="mb-6">
        <LogoEmpresa empresa={MARCA_GENERICA} />
      </div>
      {codigo ? (
        <>
          <h1 className="text-2xl font-semibold text-fg">{t.titulo}</h1>
          <p className="mt-2 text-sm text-fg-muted">{t.descripcion}</p>
          <section aria-labelledby="codigo-etiqueta" className="my-6 rounded-lg border border-line bg-surface-muted p-4 text-center">
            <h2 id="codigo-etiqueta" className="text-sm font-semibold text-fg-muted">
              {t.codigoEtiqueta}
            </h2>
            <p className="mt-2 select-all font-mono text-3xl font-semibold text-fg"><CodigoSolicitud codigo={codigo.codigo} /></p>
          </section>
          <p className="text-sm text-fg">{t.instruccion}</p>
          <p className="mt-2 text-sm text-fg-muted">{t.vence(fecha(codigo.venceEn))}</p>
          <p className="mt-2 text-sm text-fg-muted">{t.despues}</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-fg">{t.sinCodigoTitulo}</h1>
          <div className="my-4">
            <Alert tono="info" titulo={t.sinCodigoAvisoTitulo}>
              {t.sinCodigoDescripcion}
            </Alert>
          </div>
          <BotonEnlace className="w-full" href={enlaceDeIngreso()}>
            {t.reingresar}
          </BotonEnlace>
        </>
      )}
    </Card>
  </main>
);
