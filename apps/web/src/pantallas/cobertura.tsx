import { Alert, Badge, Button, Card, CardTitle, EstadoVacio, Label, Progreso, Select, Tabla, Td, Th } from '@sig/ui';
import type { Cobertura, EstadoCobertura, Rol } from '../api/tipos';
import type { FiltroCobertura } from '../certificacion/filtros-cobertura';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { MarcoApp } from './marco';

export interface PropsCobertura {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly cobertura: Cobertura;
  readonly filtros: FiltroCobertura;
  readonly filtrosInvalidos: boolean;
}

const TONO: Record<EstadoCobertura, 'success' | 'warning' | 'danger' | 'neutral'> = {
  cubierta: 'success',
  evidencia_vencida: 'warning',
  sin_evidencia: 'warning',
  sin_control: 'danger',
  no_aplica: 'neutral',
};

export const PantallaCobertura = ({ empresa, persona, cobertura, filtros, filtrosInvalidos }: PropsCobertura) => {
  const t = es.cobertura;
  if (cobertura.normas.length === 0) {
    return (
      <MarcoApp empresa={empresa} activo="cobertura" persona={persona.nombre}>
        <h1 className="mb-6 text-2xl font-semibold text-fg">{t.titulo}</h1>
        <EstadoVacio titulo={t.sinNormasTitulo} descripcion={t.sinNormasDescripcion} />
      </MarcoApp>
    );
  }
  return (
    <MarcoApp empresa={empresa} activo="cobertura" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-1 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <p className="mb-4 text-sm text-fg-muted">{t.hoy(cobertura.hoy)}</p>

      <Card className="mb-6" aria-labelledby="cobertura-norma">
        <CardTitle id="cobertura-norma">{t.porNorma}</CardTitle>
        <ul className="flex flex-col gap-4">
          {cobertura.porNorma.map((n) => (
            <li key={n.norma} className="grid gap-1 text-sm md:grid-cols-[12rem_1fr] md:items-center md:gap-3">
              <span className="font-medium text-fg">{n.norma}</span>
              <div className="flex flex-col gap-1">
                {n.porcentaje === null ? <span className="text-fg-muted">{t.sinEntradas}</span> : <Progreso valor={n.porcentaje} etiqueta={`${n.norma}: ${n.porcentaje} %`} />}
                <span className="tabular-nums text-fg-muted">
                  {n.porcentaje === null ? '' : `${n.porcentaje} % · `}
                  {t.cubiertasDe(n.cubiertas, n.total)} · {t.detalle(n.evidenciaVencida, n.sinEvidencia, n.sinControl)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {filtrosInvalidos && (
        <div className="mb-4">
          <Alert tono="warning" titulo={t.filtrosInvalidos} />
        </div>
      )}
      <Card className="mb-6">
        <form method="get" aria-label={t.filtros} className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-48 flex-col gap-1.5">
            <Label htmlFor="norma">{t.norma}</Label>
            <Select id="norma" name="norma" defaultValue={filtros.norma ?? ''}>
              <option value="">{t.todas}</option>
              {cobertura.normas.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit">{t.aplicar}</Button>
            {filtros.norma && (
              <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center px-3 text-sm font-medium text-primary underline" href={`/e/${empresa.id}/cobertura`}>
                {t.limpiar}
              </a>
            )}
          </div>
        </form>
      </Card>

      <p className="mb-2 text-sm text-fg-muted">
        {t.resultados(cobertura.entradas.length)}
      </p>
      {cobertura.entradas.length === 0 ? (
        <EstadoVacio titulo={t.sinResultadosTitulo} descripcion={t.sinResultadosDescripcion} />
      ) : (
          <Tabla aria-describedby="cobertura-desc">
            <caption id="cobertura-desc" className="sr-only">
              {t.tablaDescripcion}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{t.columnas.entrada}</Th>
                <Th scope="col">{t.columnas.normas}</Th>
                <Th scope="col">{t.columnas.estado}</Th>
                <Th scope="col">{t.columnas.controles}</Th>
                <Th scope="col">{t.columnas.evidencias}</Th>
              </tr>
            </thead>
            <tbody>
              {cobertura.entradas.map((e) => (
                <tr key={`${e.libreriaCodigo}|${e.idEstable}`}>
                  <Td>
                    <p className="font-medium text-fg">{e.titulo}</p>
                    <p className="text-sm text-fg-muted">
                      <span className="font-mono">{e.idEstable}</span> · {t.tipos[e.tipo]}
                      {t.clausulaDe(e.capitulo, e.grupo) ? ` · ${t.clausulaDe(e.capitulo, e.grupo)}` : ''}
                    </p>
                  </Td>
                  <Td>
                    <ul aria-label={t.columnas.normas} className="flex flex-wrap gap-1.5">
                      {e.normas.map((n) => (
                        <li key={n}>
                          <Badge tono="info">{n}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Td>
                  <Td>
                    <Badge tono={TONO[e.estado]}>{t.estados[e.estado]}</Badge>
                  </Td>
                  <Td className="tabular-nums">{e.controles}</Td>
                  <Td className="tabular-nums">{e.evidencias}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
      )}
    </MarcoApp>
  );
};
