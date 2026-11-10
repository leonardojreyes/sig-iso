import { Alert, BotonEnlace, Button, Card, EstadoVacio, Input, Label, Select, Tabla, Td, Th } from '@sig/ui';
import type { EntradaLibreria, LibreriaResumen, Rol } from '../api/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import type { AvisoAdopcion } from '../librerias/avisos';
import type { FiltrosRequisitos } from '../requisitos/filtros';
import { MarcoApp } from './marco';

const CAPITULOS = [4, 5, 6, 7, 8, 9, 10] as const;

export interface PropsListadoRequisitos {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly librerias: readonly LibreriaResumen[];
  readonly entradas: readonly EntradaLibreria[];
  readonly normasDisponibles: readonly string[];
  readonly filtros: FiltrosRequisitos;
  readonly filtrosInvalidos: boolean;
  /** Resultado de la última adopción (de la dirección, ya limitado a valores conocidos). */
  readonly aviso?: AvisoAdopcion | null;
}

/**
 * Listado de requisitos: las entradas de las librerías que la empresa adoptó. Solo consulta (H5.6): no hay estados de
 * cumplimiento, hallazgos ni evidencias, que pertenecen a la evaluación de cada empresa y no a la librería.
 */
const AvisoDeAdopcion = ({
  aviso,
  librerias,
  entradas,
  hayFiltros,
}: {
  aviso: AvisoAdopcion;
  librerias: readonly LibreriaResumen[];
  entradas: readonly EntradaLibreria[];
  hayFiltros: boolean;
}) => {
  const a = es.listado.avisos;
  if (aviso.tipo === 'adoptada' || aviso.tipo === 'ya_adoptada') {
    // Solo se dice que se adoptó si de verdad lo está (una dirección inventada no muestra un éxito).
    const libreria = librerias.find((l) => l.id === aviso.libreriaId && l.adoptada);
    if (!libreria) return null;
    // Con filtros el listado está recortado: no se da un número que engañe.
    const disponibles = hayFiltros ? null : entradas.filter((e) => e.libreriaId === libreria.id).length;
    const detalle = [
      aviso.tipo === 'ya_adoptada' ? a.yaAdoptadaDetalle : null,
      `«${libreria.nombre}»${disponibles === null ? '.' : `: ${a.disponibles(disponibles)}`}`,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <Alert tono="success" titulo={aviso.tipo === 'adoptada' ? a.adoptadaTitulo : a.yaAdoptadaTitulo}>
        {detalle}
      </Alert>
    );
  }
  if (aviso.tipo === 'sin_permiso')
    return (
      <Alert tono="warning" titulo={a.sinPermisoTitulo}>
        {a.sinPermisoDetalle}
      </Alert>
    );
  if (aviso.tipo === 'no_encontrada') return <Alert tono="warning" titulo={a.noEncontradaTitulo} />;
  return (
    <Alert tono="warning" titulo={a.noDisponibleTitulo}>
      {a.noDisponibleDetalle}
    </Alert>
  );
};

/** Librerías del catálogo. Solo el administrador SIG ve el botón de adoptar (la API decide de verdad); no manda ningún dato. */
const CatalogoLibrerias = ({
  empresa,
  librerias,
  puedeAdoptar,
  soloPendientes,
  titulo,
}: {
  empresa: Empresa;
  librerias: readonly LibreriaResumen[];
  puedeAdoptar: boolean;
  soloPendientes: boolean;
  titulo: string;
}) => {
  const t = es.listado;
  const visibles = soloPendientes ? librerias.filter((l) => !l.adoptada) : librerias;
  return (
    <section aria-labelledby="catalogo" className="mt-8">
      <h2 id="catalogo" className="mb-2 text-base font-semibold text-fg">
        {titulo}
      </h2>
      {visibles.length === 0 ? (
        <p className="text-sm text-fg-muted">{t.catalogoVacio}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm text-fg">
          {visibles.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3">
              <span>
                {l.nombre} · {t.version} {l.version}
                {l.esEjemplo ? ` · ${t.ejemplo}` : ''} · {l.adoptada ? t.estadoAdoptada : t.estadoNoAdoptada}
              </span>
              {puedeAdoptar && !l.adoptada && (
                <form method="post" action={`/e/${empresa.id}/librerias/${l.id}/adopcion`}>
                  <Button type="submit" aria-label={t.adoptarAria(l.nombre)}>
                    {t.adoptar}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const PantallaListadoRequisitos = ({
  empresa,
  persona,
  librerias,
  entradas,
  normasDisponibles,
  filtros,
  filtrosInvalidos,
  aviso = null,
}: PropsListadoRequisitos) => {
  const t = es.listado;
  const adoptadas = librerias.filter((l) => l.adoptada);
  const hayEjemplo = adoptadas.some((l) => l.esEjemplo) || entradas.some((e) => e.esEjemplo);
  const esAdmin = persona.roles.includes('administrador_sig');
  const hayFiltros = filtros.q !== undefined || filtros.capitulo !== undefined || filtros.norma !== undefined || filtros.tipo !== undefined;
  const avisoPantalla = aviso && (
    <div className="mb-4">
      <AvisoDeAdopcion aviso={aviso} librerias={librerias} entradas={entradas} hayFiltros={hayFiltros} />
    </div>
  );

  if (adoptadas.length === 0) {
    return (
      <MarcoApp empresa={empresa} activo="requisitos" persona={persona.nombre}>
        <h1 className="mb-6 text-2xl font-semibold text-fg">{t.titulo}</h1>
        {avisoPantalla}
        <EstadoVacio titulo={t.sinAdopcionTitulo} descripcion={esAdmin ? t.sinAdopcionAdmin : t.sinAdopcionOtros} />
        <CatalogoLibrerias
          empresa={empresa}
          librerias={librerias}
          puedeAdoptar={esAdmin}
          soloPendientes={false}
          titulo={t.catalogo}
        />
      </MarcoApp>
    );
  }

  return (
    <MarcoApp empresa={empresa} activo="requisitos" persona={persona.nombre}>
      <h1 className="mb-4 text-2xl font-semibold text-fg">{t.titulo}</h1>

      {avisoPantalla}
      {hayEjemplo && (
        <div className="mb-4">
          <Alert tono="info" titulo={t.avisoEjemploTitulo}>
            {t.avisoEjemplo}
          </Alert>
        </div>
      )}
      <p className="mb-6 text-sm text-fg-muted">
        {t.adoptadas}: {adoptadas.map((l) => `${l.nombre} (${t.version} ${l.version})`).join('; ')}
      </p>

      {filtrosInvalidos && (
        <div className="mb-4">
          <Alert tono="warning" titulo={t.filtrosInvalidos} />
        </div>
      )}

      <Card className="mb-6">
        <form method="get" aria-label={t.filtros} className="grid items-end gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q">{t.buscar}</Label>
            <Input id="q" name="q" type="search" defaultValue={filtros.q ?? ''} maxLength={80} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capitulo">{t.capitulo}</Label>
            <Select
              id="capitulo"
              name="capitulo"
              defaultValue={filtros.capitulo === undefined ? '' : String(filtros.capitulo)}
            >
              <option value="">{t.todosCapitulos}</option>
              {CAPITULOS.map((c) => (
                <option key={c} value={c}>
                  {t.capituloN(c)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">{t.tipo}</Label>
            <Select id="tipo" name="tipo" defaultValue={filtros.tipo ?? ''}>
              <option value="">{t.todosTipos}</option>
              <option value="clausula">{t.tipos.clausula}</option>
              <option value="control">{t.tipos.control}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="norma">{t.norma}</Label>
            <Select
              id="norma"
              name="norma"
              defaultValue={filtros.norma && normasDisponibles.includes(filtros.norma) ? filtros.norma : ''}
            >
              <option value="">{t.todasNormas}</option>
              {normasDisponibles.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit">{t.aplicar}</Button>
            <BotonEnlace variante="secondary" href={`/e/${empresa.id}/requisitos`}>
              {t.limpiar}
            </BotonEnlace>
          </div>
        </form>
      </Card>

      <p className="mb-2 text-sm text-fg-muted" aria-live="polite">
        {t.resultados(entradas.length)}
      </p>
      {entradas.length === 0 ? (
        <EstadoVacio titulo={t.sinResultadosTitulo} descripcion={t.sinResultadosDescripcion} />
      ) : (
        <>
          <Tabla>
            <caption className="sr-only">{t.tablaDescripcion}</caption>
            <thead>
              <tr>
                <Th>{t.columnas.capitulo}</Th>
                <Th>{t.columnas.titulo}</Th>
                <Th>{t.columnas.aplicaA}</Th>
                <Th>{t.columnas.alcance}</Th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((e) => (
                <tr key={e.id}>
                  <Td className={e.capitulo === null ? undefined : 'tabular-nums'}>{e.capitulo ?? e.grupo}</Td>
                  <Td>
                    <p className="font-medium">{e.titulo}</p>
                    <p className="mt-1 text-fg-muted">{e.guia}</p>
                  </Td>
                  <Td>
                    <ul className="flex flex-col gap-0.5">
                      {e.aplicaA.map((a) => (
                        <li key={`${a.norma}-${a.edicion}`}>
                          {a.norma}:{a.edicion} · {t.clausula} <span className="font-mono">{a.clausula}</span>
                        </li>
                      ))}
                    </ul>
                  </Td>
                  <Td>{t.alcance[e.alcanceComun]}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <p className="mt-3 text-xs text-fg-muted">{t.alcanceAyuda}</p>
        </>
      )}
      {esAdmin && librerias.some((l) => !l.adoptada) && (
        <CatalogoLibrerias
          empresa={empresa}
          librerias={librerias}
          puedeAdoptar
          soloPendientes
          titulo={t.disponiblesParaAdoptar}
        />
      )}
    </MarcoApp>
  );
};
