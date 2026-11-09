import { Alert, BotonEnlace, Button, Card, EstadoVacio, Input, Label, Select, Tabla, Td, Th } from '@sig/ui';
import type { EntradaLibreria, LibreriaResumen, Rol } from '../api/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
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
}

/**
 * Listado de requisitos: las entradas de las librerías que la empresa adoptó. Solo consulta (H5.6): no hay estados de
 * cumplimiento, hallazgos ni evidencias, que pertenecen a la evaluación de cada empresa y no a la librería.
 */
export const PantallaListadoRequisitos = ({
  empresa,
  persona,
  librerias,
  entradas,
  normasDisponibles,
  filtros,
  filtrosInvalidos,
}: PropsListadoRequisitos) => {
  const t = es.listado;
  const adoptadas = librerias.filter((l) => l.adoptada);
  const hayEjemplo = adoptadas.some((l) => l.esEjemplo) || entradas.some((e) => e.esEjemplo);

  if (adoptadas.length === 0) {
    return (
      <MarcoApp empresa={empresa} activo="requisitos" persona={persona.nombre}>
        <h1 className="mb-6 text-2xl font-semibold text-fg">{t.titulo}</h1>
        <EstadoVacio
          titulo={t.sinAdopcionTitulo}
          descripcion={persona.roles.includes('administrador_sig') ? t.sinAdopcionAdmin : t.sinAdopcionOtros}
        />
        <section aria-labelledby="catalogo" className="mt-8">
          <h2 id="catalogo" className="mb-2 text-base font-semibold text-fg">
            {t.catalogo}
          </h2>
          {librerias.length === 0 ? (
            <p className="text-sm text-fg-muted">{t.catalogoVacio}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-fg">
              {librerias.map((l) => (
                <li key={l.id}>
                  {l.nombre} · {t.version} {l.version}
                  {l.esEjemplo ? ` · ${t.ejemplo}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      </MarcoApp>
    );
  }

  return (
    <MarcoApp empresa={empresa} activo="requisitos" persona={persona.nombre}>
      <h1 className="mb-4 text-2xl font-semibold text-fg">{t.titulo}</h1>

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
        <form method="get" aria-label={t.filtros} className="grid items-end gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
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
                  <Td className="tabular-nums">{e.capitulo}</Td>
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
    </MarcoApp>
  );
};
