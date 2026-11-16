import { Alert, Badge, Button, Card, CardTitle, EstadoVacio, Tabla, Td, Th } from '@sig/ui';
import type { Declaracion, FilaDeclaracion, Rol, VersionDeclaracion } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import { hoyEnEcuador } from '../certificacion/formato';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

const t = es.declaracion;

const TONO_APLICA = { aplica: 'success', no_aplica: 'neutral', por_decidir: 'warning' } as const;
const TONO_COBERTURA = { cubierta: 'success', evidencia_vencida: 'warning', sin_evidencia: 'warning', sin_control: 'danger', no_aplica: 'neutral' } as const;
const enlaceClase = 'inline-flex min-h-[var(--sig-density-target-min)] items-center px-3 text-sm font-medium text-primary underline';

/** La fecha de una aprobación (ISO en UTC) como la fecha de Ecuador. */
export const fechaDeAprobacion = (iso: string): string => hoyEnEcuador(new Date(iso));

/** Tabla de filas de la declaración: la misma para el borrador de hoy y para una versión congelada. */
export const TablaFilasDeclaracion = ({ filas }: { filas: readonly FilaDeclaracion[] }) => (
    <Tabla aria-describedby="declaracion-desc">
      <caption id="declaracion-desc" className="sr-only">
        {t.tablaDescripcion}
      </caption>
      <thead>
        <tr>
          <Th scope="col">{t.columnas.control}</Th>
          <Th scope="col">{t.columnas.aplicabilidad}</Th>
          <Th scope="col">{t.columnas.implementacion}</Th>
          <Th scope="col">{t.columnas.controles}</Th>
          <Th scope="col">{t.columnas.evidencia}</Th>
          <Th scope="col">{t.columnas.justificacion}</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={`${f.libreriaCodigo}|${f.idEstable}`}>
            <Td>
              <p className="font-medium text-fg">{f.titulo}</p>
              <p className="text-sm text-fg-muted">
                <span className="font-mono">{f.idEstable}</span>
                {f.grupo ? ` · ${f.grupo}` : ''}
              </p>
            </Td>
            <Td>
              <Badge tono={TONO_APLICA[f.aplicabilidad]}>{t.aplicabilidad[f.aplicabilidad]}</Badge>
            </Td>
            <Td>{f.implementacion ? t.implementacion[f.implementacion] : ''}</Td>
            <Td>
              {f.controles.length > 0 ? (
                <ul aria-label={t.columnas.controles} className="flex flex-wrap gap-1.5">
                  {f.controles.map((c) => (
                    <li key={c}>
                      <Badge tono="info">{c}</Badge>
                    </li>
                  ))}
                </ul>
              ) : f.aplicabilidad === 'aplica' ? (
                <span className="text-sm text-fg-muted">{t.sinControlAsignado}</span>
              ) : null}
            </Td>
            <Td>
              <Badge tono={TONO_COBERTURA[f.cobertura]}>{t.cobertura[f.cobertura]}</Badge>
            </Td>
            <Td className="max-w-sm text-sm">{f.justificacion ?? ''}</Td>
          </tr>
        ))}
      </tbody>
    </Tabla>
);

export interface PropsDeclaracion {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly declaracion: Declaracion;
  readonly versiones: readonly VersionDeclaracion[];
  readonly aviso: AvisoEscritura | null;
}

export const PantallaDeclaracion = ({ empresa, persona, declaracion, versiones, aviso }: PropsDeclaracion) => {
  const { resumen } = declaracion;
  const aprueba = persona.roles.includes('administrador_sig');
  const base = `/e/${empresa.id}`;
  return (
    <MarcoApp empresa={empresa} activo="declaracion" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-1 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <p className="mb-4 text-sm text-fg-muted">{t.hoy(declaracion.hoy)}</p>
      <AvisoDeEscritura aviso={aviso} />

      {resumen.total === 0 ? (
        <EstadoVacio titulo={t.sinFilasTitulo} descripcion={t.sinFilasDescripcion} />
      ) : (
        <>
          <Card className="mb-6" aria-labelledby="declaracion-resumen">
            <CardTitle id="declaracion-resumen">{t.resumenTitulo}</CardTitle>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
              {(
                [
                  ['total', resumen.total],
                  ['aplican', resumen.aplican],
                  ['noAplican', resumen.noAplican],
                  ['porDecidir', resumen.porDecidir],
                  ['sinControl', resumen.sinControl],
                ] as const
              ).map(([clave, valor]) => (
                <div key={clave}>
                  <dt className="text-fg-muted">{t.resumen[clave]}</dt>
                  <dd className="text-2xl font-semibold tabular-nums text-fg">{valor}</dd>
                </div>
              ))}
            </dl>
            {resumen.porDecidir > 0 && (
              <div className="mt-4">
                <Alert tono="warning" titulo={t.incompletaTitulo}>
                  {t.incompleta(resumen.porDecidir)}
                </Alert>
              </div>
            )}
            {resumen.sinControl > 0 && <p className="mt-4 text-sm text-fg-muted">{t.sinControlAviso(resumen.sinControl)}</p>}
          </Card>

          <Card className="mb-6" aria-labelledby="declaracion-alcance">
            <CardTitle id="declaracion-alcance">{t.alcanceTitulo}</CardTitle>
            {declaracion.alcance ? (
              <>
                <p className="mb-2 whitespace-pre-line text-sm text-fg">{declaracion.alcance.texto}</p>
                <Badge tono={declaracion.alcance.aprobado ? 'success' : 'warning'}>{declaracion.alcance.aprobado ? t.alcanceAprobado : t.alcanceSinAprobar}</Badge>
              </>
            ) : (
              <p className="text-sm text-fg-muted">{t.sinAlcance}</p>
            )}
            <p className="mt-3">
              <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline" href={`${base}/alcance`}>
                {t.irAlAlcance}
              </a>
            </p>
          </Card>

          <Card className="mb-6" aria-labelledby="declaracion-acciones">
            <CardTitle id="declaracion-acciones">{t.acciones}</CardTitle>
            <div className="flex flex-wrap items-center gap-4">
              <a className={enlaceClase} href={`${base}/declaracion/documento`}>
                {t.descargarBorrador}
              </a>
              {aprueba ? (
                <form method="post" action={`${base}/declaracion/aprobar`} className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={!resumen.aprobable} aria-describedby="declaracion-aprobar-ayuda">
                    {t.aprobar}
                  </Button>
                  <span id="declaracion-aprobar-ayuda" className="text-sm text-fg-muted">
                    {resumen.aprobable ? t.aprobarAyuda : t.incompleta(resumen.porDecidir)}
                  </span>
                </form>
              ) : (
                <p className="text-sm text-fg-muted">{t.soloAdministrador}</p>
              )}
            </div>
          </Card>

          <h2 className="mb-1 text-lg font-semibold text-fg">{t.borradorTitulo}</h2>
          <p className="mb-3 text-sm text-fg-muted">{t.preliminar}</p>
          <TablaFilasDeclaracion filas={declaracion.filas} />
        </>
      )}

      <section className="mt-8" aria-labelledby="declaracion-versiones">
        <h2 id="declaracion-versiones" className="mb-3 text-lg font-semibold text-fg">
          {t.versionesTitulo}
        </h2>
        {versiones.length === 0 ? (
          <p className="text-sm text-fg-muted">{t.sinVersiones}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {versiones.map((v) => (
              <li key={v.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-fg">
                        {t.versionNumero(v.numero)} · <span className="font-normal text-fg-muted">{t.aprobadaEl(fechaDeAprobacion(v.aprobadaEn))}</span>
                      </p>
                      <p className="text-sm text-fg-muted">{t.conteos(v.total, v.aplican, v.noAplican, v.sinControl)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a className={enlaceClase} href={`${base}/declaracion/versiones/${v.id}`} aria-label={`${t.ver} ${t.versionAria(v.numero)}`}>
                        {t.ver}
                      </a>
                      <a className={enlaceClase} href={`${base}/declaracion/versiones/${v.id}/documento`} aria-label={`${t.descargar}, ${t.versionAria(v.numero)}`}>
                        {t.descargar}
                      </a>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MarcoApp>
  );
};
