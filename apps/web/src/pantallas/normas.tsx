import { Alert, Badge, Button, Card, CardTitle, EstadoVacio, Input, Label } from '@sig/ui';
import type { ErrorCargaLibreria, LibreriaResumen, Rol } from '../api/tipos';
import { es } from '../i18n/es-EC';
import { ARCHIVOS_MAX, type AvisoNormas } from '../librerias/subir';
import type { ResultadoArchivo, ResultadoCarga } from '../librerias/resultados-carga';
import type { Empresa } from '../marca/tipos';
import { MarcoApp } from './marco';

const t = es.normas;
const enlaceClase = 'inline-flex min-h-[var(--sig-density-target-min)] items-center px-3 text-sm font-medium text-primary underline';
/** Cuántos errores se muestran por archivo (el resto se resume). */
const ERRORES_VISIBLES = 15;

export interface PropsNormas {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly librerias: readonly LibreriaResumen[];
  /** Lo que guardó el servidor de la última subida (se muestra una vez). */
  readonly resultado?: ResultadoCarga | null;
  readonly aviso?: AvisoNormas | null;
}

/** Un error en palabras: dónde y qué; nunca el contenido del archivo. */
export const textoDeError = (e: ErrorCargaLibreria): string => {
  const que = (t.errores as Record<string, string>)[e.codigo] ?? t.errorDesconocido;
  const donde = t.errorEn(e.ruta);
  const entrada = e.entrada ? ` (${t.errorEntrada(e.entrada)})` : '';
  return `${donde}${entrada}: ${que}.`;
};

const ErroresDe = ({ errores }: { errores: readonly ErrorCargaLibreria[] }) =>
  errores.length === 0 ? null : (
    <div className="mt-2">
      <p className="text-sm font-medium text-fg">{t.erroresTitulo}</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-fg-muted">
        {errores.slice(0, ERRORES_VISIBLES).map((e, i) => (
          <li key={`${e.ruta}|${e.codigo}|${i}`}>{textoDeError(e)}</li>
        ))}
        {errores.length > ERRORES_VISIBLES && <li>… y {errores.length - ERRORES_VISIBLES} más.</li>}
      </ul>
    </div>
  );

const ResultadoDeArchivo = ({ r }: { r: ResultadoArchivo }) => {
  if (r.tipo === 'fallo') {
    return (
      <Alert tono="danger" titulo={t.archivo(r.nombre)}>
        {t.fallos[r.motivo]}
      </Alert>
    );
  }
  const c = r.carga;
  if (c.estado === 'rechazada' && c.motivo) {
    return (
      <Alert tono="danger" titulo={t.archivo(r.nombre)}>
        {t.motivos[c.motivo]}
        <ErroresDe errores={c.errores} />
      </Alert>
    );
  }
  const detalle = c.estado === 'cargada' ? t.estados.cargada(c.codigo ?? '', c.version ?? '', c.entradas ?? 0) : t.estados.ya_cargada(c.codigo ?? '', c.version ?? '');
  return (
    <Alert tono="success" titulo={t.archivo(r.nombre)}>
      {detalle}
    </Alert>
  );
};

const Resultado = ({ resultado }: { resultado: ResultadoCarga }) => (
  <section aria-labelledby="resultado-titulo" className="mb-6 flex flex-col gap-3">
    <h2 id="resultado-titulo" className="text-lg font-semibold text-fg">
      {t.resultadoTitulo}
    </h2>
    {resultado.archivos.map((r, i) => (
      <ResultadoDeArchivo key={`${r.nombre}|${i}`} r={r} />
    ))}
    {resultado.omitidos > 0 && <p className="text-sm text-fg-muted">{t.omitidos(resultado.omitidos)}</p>}
    {resultado.recortado && <p className="text-sm text-fg-muted">{t.recortado(ARCHIVOS_MAX)}</p>}
  </section>
);

const AvisoDeNormas = ({ aviso }: { aviso: AvisoNormas | null }) => {
  if (!aviso) return null;
  const a = t.avisos[aviso];
  return (
    <div className="mb-4">
      <Alert tono={a.tono} titulo={a.titulo}>
        {a.detalle}
      </Alert>
    </div>
  );
};

/** Subir librerías: archivos o una carpeta del navegador. Los campos no llevan la empresa: sale del token. */
const FormularioSubida = ({ empresa }: { empresa: Empresa }) => (
  <Card>
    <CardTitle>{t.subirTitulo}</CardTitle>
    <form method="post" action={`/e/${empresa.id}/normas/subir`} encType="multipart/form-data" className="mt-3 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="normas-archivos">{t.archivosEtiqueta}</Label>
        <Input id="normas-archivos" name="archivos" type="file" multiple accept=".yaml,.yml" aria-describedby="normas-ayuda" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="normas-carpeta">{t.carpetaEtiqueta}</Label>
        {/* `webkitdirectory` hace que el navegador envíe cada archivo de la carpeta bajo el mismo campo. */}
        <Input id="normas-carpeta" name="archivos" type="file" multiple aria-describedby="normas-ayuda" {...({ webkitdirectory: '' } as Record<string, string>)} />
        <p id="normas-ayuda" className="text-sm text-fg-muted">
          {t.subirAyuda(ARCHIVOS_MAX)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{t.subir}</Button>
        <a className={enlaceClase} href={`/e/${empresa.id}/normas/plantilla`}>
          {t.plantilla}
        </a>
        <span className="text-sm text-fg-muted">{t.plantillaAyuda}</span>
      </div>
    </form>
  </Card>
);

const ListaDeLibrerias = ({ empresa, librerias, puedeAdoptar }: { empresa: Empresa; librerias: readonly LibreriaResumen[]; puedeAdoptar: boolean }) => (
  <section aria-labelledby="lista-titulo" className="mt-6">
    <h2 id="lista-titulo" className="mb-3 text-lg font-semibold text-fg">
      {t.listaTitulo}
    </h2>
    {librerias.length === 0 ? (
      <EstadoVacio titulo={t.sinLibrerias} descripcion="" />
    ) : (
      <ul className="flex flex-col gap-3">
        {librerias.map((l) => (
          <li key={l.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-fg">{l.nombre}</p>
                  <p className="text-sm text-fg-muted">
                    {l.codigo} · {t.version} {l.version} · {l.fuente}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tono={l.propia ? 'info' : 'neutral'}>{l.propia ? t.propias : t.catalogo}</Badge>
                  <Badge tono={l.adoptada ? 'success' : 'neutral'}>{l.adoptada ? t.adoptada : t.noAdoptada}</Badge>
                  {puedeAdoptar && !l.adoptada && (
                    <form method="post" action={`/e/${empresa.id}/librerias/${l.id}/adopcion`}>
                      <Button type="submit" aria-label={t.adoptarAria(l.nombre)}>
                        {t.adoptar}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const PantallaNormas = ({ empresa, persona, librerias, resultado = null, aviso = null }: PropsNormas) => {
  const esAdmin = persona.roles.includes('administrador_sig');
  return (
    <MarcoApp empresa={empresa} activo="normas" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <AvisoDeNormas aviso={aviso} />
      {resultado && <Resultado resultado={resultado} />}
      {esAdmin ? <FormularioSubida empresa={empresa} /> : <Alert tono="info" titulo={t.soloAdmin} />}
      <ListaDeLibrerias empresa={empresa} librerias={librerias} puedeAdoptar={esAdmin} />
    </MarcoApp>
  );
};
