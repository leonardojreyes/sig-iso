import { Alert, Badge, Button, Card, CardTitle, EstadoVacio, Input, Label, Progreso, Select, SemaforoCumplimiento, Tabla, Td, Textarea, Th, type EstadoCumplimiento } from '@sig/ui';
import type { Desglose, Diagnostico, FilaDiagnostico, Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import type { FiltrosDiagnostico } from '../certificacion/filtros';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

export interface PropsDiagnostico {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly diagnostico: Diagnostico;
  readonly filtros: FiltrosDiagnostico;
  readonly filtrosInvalidos: boolean;
  readonly aviso?: AvisoEscritura | null;
}

const SEMAFORO: Record<'cumple' | 'parcial' | 'no_cumple' | 'no_aplica', EstadoCumplimiento> = {
  cumple: 'cumple',
  parcial: 'parcial',
  no_cumple: 'noCumple',
  no_aplica: 'noAplica',
};
const ESTADOS_EVALUABLES = ['cumple', 'parcial', 'no_cumple', 'no_aplica'] as const;

/** Barra con el porcentaje (si lo hay) y el conteo; el valor siempre es visible en texto, no solo en la barra. */
const ResumenMadurez = ({ etiqueta, desglose }: { etiqueta: string; desglose: Desglose }) => {
  const t = es.diagnostico;
  return (
    <li className="grid gap-1 text-sm md:grid-cols-[12rem_1fr_9rem] md:items-center md:gap-3">
      <span className="font-medium text-fg">{etiqueta}</span>
      {desglose.porcentaje === null ? <span className="text-fg-muted">{t.sinDatos}</span> : <Progreso valor={desglose.porcentaje} etiqueta={`${etiqueta}: ${desglose.porcentaje} %`} />}
      <span className="tabular-nums text-fg-muted">
        {desglose.porcentaje === null ? '' : `${desglose.porcentaje} % · `}
        {t.sinEvaluarN(desglose.sinEvaluar)}
      </span>
    </li>
  );
};

const Madurez = ({ diagnostico }: { diagnostico: Diagnostico }) => {
  const t = es.diagnostico;
  const { porNorma, porAgrupador, clausulas } = diagnostico.madurez;
  const capitulos = porAgrupador.filter((a) => a.tipo === 'capitulo');
  const temas = porAgrupador.filter((a) => a.tipo === 'tema');
  return (
    <Card className="mb-6" aria-labelledby="madurez-titulo">
      <CardTitle id="madurez-titulo">{t.madurezTitulo}</CardTitle>
      <ul className="mb-4 flex flex-col gap-3" aria-label={t.madurezNorma}>
        {porNorma.map((n) => (
          <ResumenMadurez key={n.norma} etiqueta={n.norma} desglose={n.desglose} />
        ))}
        <ResumenMadurez etiqueta={t.clausulas} desglose={clausulas} />
      </ul>
      {capitulos.length > 0 && (
        <details className="mb-2">
          <summary className="cursor-pointer text-sm font-medium text-fg">{t.madurezCapitulos}</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {capitulos.map((c) => (
              <ResumenMadurez key={c.nombre} etiqueta={t.capituloN(c.nombre)} desglose={c.desglose} />
            ))}
          </ul>
        </details>
      )}
      {temas.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-fg">{t.madurezTemas}</summary>
          <ul className="mt-3 flex flex-col gap-3">
            {temas.map((c) => (
              <ResumenMadurez key={c.nombre} etiqueta={c.nombre} desglose={c.desglose} />
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
};

const FormularioEvaluacion = ({ empresa, fila, indice, filtros }: { empresa: Empresa; fila: FilaDiagnostico; indice: number; filtros: FiltrosDiagnostico }) => {
  const t = es.diagnostico;
  const id = `ev-${indice}`;
  const ev = fila.evaluacion;
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-primary">{t.abrir}</summary>
      <form method="post" action={`/e/${empresa.id}/diagnostico/evaluar`} className="mt-3 flex min-w-64 flex-col gap-3">
        <input type="hidden" name="libreriaCodigo" value={fila.libreriaCodigo} />
        <input type="hidden" name="idEstable" value={fila.idEstable} />
        {ev && <input type="hidden" name="version" value={ev.version} />}
        {(['q', 'norma', 'tipo', 'estado'] as const).map((k) => (filtros[k] ? <input key={k} type="hidden" name={`f_${k}`} value={filtros[k]} /> : null))}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-estado`}>{t.estado}</Label>
          <Select id={`${id}-estado`} name="estado" required defaultValue={ev?.estado ?? ''}>
            <option value="" disabled>
              {es.estados.sin_evaluar}
            </option>
            {ESTADOS_EVALUABLES.map((e) => (
              <option key={e} value={e}>
                {es.estados[e]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-comentario`}>{t.comentario}</Label>
          <Textarea id={`${id}-comentario`} name="comentario" maxLength={1000} defaultValue={ev?.comentario ?? ''} aria-describedby={`${id}-ayuda`} className="min-h-20" />
          <p id={`${id}-ayuda`} className="text-sm text-fg-muted">
            {t.comentarioAyuda}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-fecha`}>{t.fechaObjetivo}</Label>
          <Input id={`${id}-fecha`} name="fechaObjetivo" type="date" defaultValue={ev?.fechaObjetivo ?? ''} />
        </div>
        <div>
          <Button type="submit" aria-label={t.guardarAria(fila.titulo)}>
            {t.guardar}
          </Button>
        </div>
      </form>
    </details>
  );
};

export const PantallaDiagnostico = ({ empresa, persona, diagnostico, filtros, filtrosInvalidos, aviso = null }: PropsDiagnostico) => {
  const t = es.diagnostico;
  const puedeEvaluar = persona.roles.some((r) => r === 'administrador_sig' || r === 'colaborador');
  const hayFiltros = Object.keys(filtros).length > 0;

  if (diagnostico.normas.length === 0) {
    return (
      <MarcoApp empresa={empresa} activo="diagnostico" persona={persona.nombre}>
        <h1 className="mb-6 text-2xl font-semibold text-fg">{t.titulo}</h1>
        <EstadoVacio titulo={t.sinAdopcionTitulo} descripcion={t.sinAdopcionDescripcion} />
      </MarcoApp>
    );
  }

  return (
    <MarcoApp empresa={empresa} activo="diagnostico" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <AvisoDeEscritura aviso={aviso} />
      {!puedeEvaluar && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}
      <Madurez diagnostico={diagnostico} />

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
            <Label htmlFor="norma">{t.norma}</Label>
            <Select id="norma" name="norma" defaultValue={filtros.norma ?? ''}>
              <option value="">{t.todas}</option>
              {diagnostico.normas.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">{t.tipo}</Label>
            <Select id="tipo" name="tipo" defaultValue={filtros.tipo ?? ''}>
              <option value="">{t.todos}</option>
              <option value="clausula">{t.tipos.clausula}</option>
              <option value="control">{t.tipos.control}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estado">{t.estado}</Label>
            <Select id="estado" name="estado" defaultValue={filtros.estado ?? ''}>
              <option value="">{t.todos}</option>
              {(['sin_evaluar', ...ESTADOS_EVALUABLES] as const).map((e) => (
                <option key={e} value={e}>
                  {es.estados[e]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit">{t.aplicar}</Button>
            {hayFiltros && (
              <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center px-3 text-sm font-medium text-primary underline" href={`/e/${empresa.id}/diagnostico`}>
                {t.limpiar}
              </a>
            )}
          </div>
        </form>
      </Card>

      <p className="mb-2 text-sm text-fg-muted" role="status">
        {t.resultados(diagnostico.filas.length)}
      </p>
      {diagnostico.filas.length === 0 ? (
        <EstadoVacio titulo={t.sinResultadosTitulo} descripcion={t.sinResultadosDescripcion} />
      ) : (
        <div className="overflow-x-auto">
          <Tabla aria-describedby="diagnostico-desc">
            <caption id="diagnostico-desc" className="sr-only">
              {t.tablaDescripcion}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{t.columnas.entrada}</Th>
                <Th scope="col">{t.columnas.estado}</Th>
                {puedeEvaluar && <Th scope="col">{t.columnas.evaluar}</Th>}
              </tr>
            </thead>
            <tbody>
              {diagnostico.filas.map((f, i) => (
                <tr key={`${f.libreriaCodigo}|${f.idEstable}`}>
                  <Td>
                    <p className="font-medium text-fg">{f.titulo}</p>
                    <p className="text-sm text-fg-muted">
                      {t.clausulaDe(f.idEstable, f.capitulo, f.grupo)} · {f.aplicaA.map((a) => `${a.norma} ${a.clausula}`).join('; ')}
                    </p>
                    <p className="mt-1 max-w-xl text-sm text-fg">{f.guia}</p>
                    {f.evaluacion?.comentario && <p className="mt-1 text-sm text-fg-muted">{f.evaluacion.comentario}</p>}
                  </Td>
                  <Td>
                    {f.evaluacion ? <SemaforoCumplimiento estado={SEMAFORO[f.evaluacion.estado]} textos={{ cumple: es.estados.cumple, parcial: es.estados.parcial, noCumple: es.estados.no_cumple, noAplica: es.estados.no_aplica }} /> : <Badge>{es.estados.sin_evaluar}</Badge>}
                    {f.evaluacion?.fechaObjetivo && <p className="mt-1 text-xs text-fg-muted">{f.evaluacion.fechaObjetivo}</p>}
                  </Td>
                  {puedeEvaluar && (
                    <Td>
                      <FormularioEvaluacion empresa={empresa} fila={f} indice={i} filtros={filtros} />
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      )}
    </MarcoApp>
  );
};
