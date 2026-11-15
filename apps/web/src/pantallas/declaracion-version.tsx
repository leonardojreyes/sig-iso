import { Alert, Badge } from '@sig/ui';
import type { Rol, VersionDeclaracionConFilas } from '../api/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { fechaDeAprobacion, TablaFilasDeclaracion } from './declaracion';
import { MarcoApp } from './marco';

const t = es.declaracion;

export interface PropsVersionDeclaracion {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly version: VersionDeclaracionConFilas;
}

/** Una versión aprobada: todo sale de su copia congelada. */
export const PantallaVersionDeclaracion = ({ empresa, persona, version }: PropsVersionDeclaracion) => {
  const base = `/e/${empresa.id}`;
  const enlace = 'inline-flex min-h-[var(--sig-density-target-min)] items-center px-3 text-sm font-medium text-primary underline';
  return (
    <MarcoApp empresa={empresa} activo="declaracion" persona={persona.nombre}>
      <p className="mb-2">
        <a className="text-sm font-medium text-primary underline" href={`${base}/declaracion`}>
          {t.volver}
        </a>
      </p>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.versionTitulo(version.numero)}</h1>
      <p className="mb-1 max-w-3xl text-sm text-fg-muted">{t.versionAyuda}</p>
      <p className="mb-4 text-sm text-fg-muted">
        {t.aprobadaEl(fechaDeAprobacion(version.aprobadaEn))} · {t.conteos(version.total, version.aplican, version.noAplican, version.sinControl)}
      </p>
      <p className="mb-6">
        <a className={enlace} href={`${base}/declaracion/versiones/${version.id}/documento`}>
          {t.descargar}
        </a>
      </p>
      <section className="mb-6" aria-labelledby="version-alcance">
        <h2 id="version-alcance" className="mb-2 text-lg font-semibold text-fg">
          {t.alcanceTitulo}
        </h2>
        {version.alcance ? <p className="whitespace-pre-line text-sm text-fg">{version.alcance}</p> : <Alert tono="info" titulo={t.sinAlcance} />}
      </section>
      <div className="mb-2">
        <Badge tono="success">{t.versionNumero(version.numero)}</Badge>
      </div>
      <TablaFilasDeclaracion filas={version.filas} />
    </MarcoApp>
  );
};
