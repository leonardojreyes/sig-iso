import { Alert, Badge, Button, Card, Checkbox, EstadoVacio, Label, Select, Tabla, Td, Th } from '@sig/ui';
import type { Rol } from '../api/tipos';
import type { CoberturaDocumental } from '../documentos/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { MarcoApp } from './marco';

export interface PropsCoberturaDocumental {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly cobertura: CoberturaDocumental;
  readonly filtros: { readonly norma?: string; readonly soloSinDocumento: boolean };
  readonly filtrosInvalidos: boolean;
}

const t = es.documentos;

/** Entradas de las normas adoptadas con y sin un documento vigente. Informativa: no bloquea nada. */
export const PantallaCoberturaDocumental = ({ empresa, persona, cobertura: c, filtros, filtrosInvalidos }: PropsCoberturaDocumental) => {
  const base = `/e/${empresa.id}/documentos`;
  return (
    <MarcoApp empresa={empresa} activo="documentos" persona={persona.nombre}>
      <p className="mb-2 text-sm">
        <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline" href={base}>
          {t.volver}
        </a>
      </p>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.coberturaTitulo}</h1>
      <p className="mb-2 max-w-3xl text-sm text-fg-muted">{t.coberturaAyuda}</p>
      <p className="mb-4 text-sm text-fg">{t.coberturaResumen(c.cubiertas, c.total)}</p>
      {filtrosInvalidos && (
        <div className="mb-4">
          <Alert anunciar={false} tono="warning" titulo={t.filtrosInvalidos} />
        </div>
      )}
      <Card className="mb-6">
        <form method="get" aria-label={t.filtros} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cd-norma">{t.filtroNorma}</Label>
            <Select id="cd-norma" name="norma" defaultValue={filtros.norma ?? ''}>
              <option value="">{t.filtroTodos}</option>
              {c.normas.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
            <Checkbox id="cd-solo" name="soloSinDocumento" value="true" defaultChecked={filtros.soloSinDocumento} />
            <Label htmlFor="cd-solo">{t.coberturaSolo}</Label>
          </div>
          <Button type="submit">{t.aplicar}</Button>
        </form>
      </Card>
      {c.entradas.length === 0 ? (
        <EstadoVacio titulo={t.coberturaVacia} descripcion={t.coberturaAyuda} />
      ) : (
        <Tabla aria-describedby="cobertura-doc-desc">
          <caption id="cobertura-doc-desc" className="sr-only">
            {t.coberturaAyuda}
          </caption>
          <thead>
            <tr>
              <Th scope="col">{t.coberturaColumnas.entrada}</Th>
              <Th scope="col">{t.coberturaColumnas.normas}</Th>
              <Th scope="col">{t.coberturaColumnas.documentos}</Th>
            </tr>
          </thead>
          <tbody>
            {c.entradas.map((e) => (
              <tr key={`${e.libreriaCodigo}|${e.idEstable}`}>
                <Td>
                  <p className="font-medium text-fg">{e.titulo}</p>
                  <p className="font-mono text-xs text-fg-muted">{e.idEstable}</p>
                </Td>
                <Td>{e.normas.join(', ')}</Td>
                <Td>
                  {e.cubierta ? (
                    <>
                      <Badge tono="success">{t.coberturaCubierta}</Badge>
                      <ul className="mt-1 text-sm">
                        {e.documentos.map((d) => (
                          <li key={d.id}>
                            <a className="font-medium text-primary underline" href={`${base}/${d.id}`}>
                              {d.codigo}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <Badge tono="warning">{t.coberturaSin}</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </MarcoApp>
  );
};
