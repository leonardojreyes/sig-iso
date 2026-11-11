import { Badge, Button, Card, CardTitle, Checkbox, EstadoVacio, Input, Label, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { ControlMarco, MapeoDeControl, MarcoControles, Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import type { FiltrosControles } from '../certificacion/filtros-controles';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { Alert } from '@sig/ui';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

/** Una entrada de una norma adoptada que se puede relacionar con un control (solo la ve quien puede gestionar). */
export interface OpcionEntrada {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly titulo: string;
  readonly tipo: 'clausula' | 'control';
}

export interface PropsControles {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly marco: MarcoControles;
  readonly opciones: readonly OpcionEntrada[];
  readonly filtros: FiltrosControles;
  readonly filtrosInvalidos: boolean;
  readonly aviso?: AvisoEscritura | null;
}

const ocultosFiltros = (f: FiltrosControles) => (
  <>
    {f.norma && <input type="hidden" name="f_norma" value={f.norma} />}
    {f.retirados && <input type="hidden" name="f_retirados" value="true" />}
  </>
);

const FilaMapeo = ({ empresa, control, mapeo, puedeGestionar, filtros }: { empresa: Empresa; control: ControlMarco; mapeo: MapeoDeControl; puedeGestionar: boolean; filtros: FiltrosControles }) => {
  const t = es.controles;
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-mono text-fg-muted">{mapeo.idEstable}</span>
      {mapeo.entrada ? (
        <span className="text-fg">
          {mapeo.entrada.titulo} · {t.tipos[mapeo.entrada.tipo]} · {mapeo.entrada.aplicaA.map((a) => `${a.norma} ${a.clausula}`).join('; ')}
        </span>
      ) : (
        <Badge tono="warning">{t.entradaNoAdoptada}</Badge>
      )}
      {puedeGestionar && control.estado === 'vigente' && (
        <form method="post" action={`/e/${empresa.id}/controles/desmapear`}>
          <input type="hidden" name="id" value={control.id} />
          <input type="hidden" name="entrada" value={`${mapeo.libreriaCodigo}|${mapeo.idEstable}`} />
          {ocultosFiltros(filtros)}
          <Button type="submit" variante="ghost" aria-label={t.quitarAria(control.codigo, mapeo.idEstable)}>
            {t.quitar}
          </Button>
        </form>
      )}
    </li>
  );
};

const DetalleControl = ({ empresa, control, indice, opciones, puedeGestionar, filtros }: { empresa: Empresa; control: ControlMarco; indice: number; opciones: readonly OpcionEntrada[]; puedeGestionar: boolean; filtros: FiltrosControles }) => {
  const t = es.controles;
  const id = `ctl-${indice}`;
  const ya = new Set(control.mapeos.map((m) => `${m.libreriaCodigo}|${m.idEstable}`));
  const disponibles = opciones.filter((o) => !ya.has(`${o.libreriaCodigo}|${o.idEstable}`));
  const editable = puedeGestionar && control.estado === 'vigente';
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-medium text-primary">{puedeGestionar ? t.abrir : t.abrirSoloLectura}</summary>
      <div className="mt-3 flex flex-col gap-4">
        {control.estado === 'retirado' && <p className="text-sm text-fg-muted">{t.retiradoAviso}</p>}
        <section aria-labelledby={`${id}-entradas`}>
          <h3 id={`${id}-entradas`} className="mb-2 text-sm font-semibold text-fg">
            {t.entradasRelacionadas}
          </h3>
          {control.mapeos.length === 0 ? (
            <p className="text-sm text-fg-muted">{t.sinEntradas}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {control.mapeos.map((m) => (
                <FilaMapeo key={`${m.libreriaCodigo}|${m.idEstable}`} empresa={empresa} control={control} mapeo={m} puedeGestionar={puedeGestionar} filtros={filtros} />
              ))}
            </ul>
          )}
        </section>

        {editable && (
          <form method="post" action={`/e/${empresa.id}/controles/mapear`} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={control.id} />
            {ocultosFiltros(filtros)}
            <div className="flex min-w-64 flex-col gap-1.5">
              <Label htmlFor={`${id}-entrada`}>{t.relacionar}</Label>
              <Select id={`${id}-entrada`} name="entrada" required defaultValue="">
                <option value="" disabled>
                  {t.elegirEntrada}
                </option>
                {disponibles.map((o) => (
                  <option key={`${o.libreriaCodigo}|${o.idEstable}`} value={`${o.libreriaCodigo}|${o.idEstable}`}>
                    {o.titulo} ({o.idEstable})
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variante="secondary">
              {t.relacionarBoton}
            </Button>
          </form>
        )}

        {editable && (
          <form method="post" action={`/e/${empresa.id}/controles/cambiar`} className="flex max-w-xl flex-col gap-3">
            <input type="hidden" name="id" value={control.id} />
            <input type="hidden" name="version" value={control.version} />
            {ocultosFiltros(filtros)}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-nombre`}>{t.nombre}</Label>
              <Input id={`${id}-nombre`} name="nombre" required maxLength={120} defaultValue={control.nombre} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-descripcion`}>{t.descripcion}</Label>
              <Textarea id={`${id}-descripcion`} name="descripcion" maxLength={1000} defaultValue={control.descripcion ?? ''} aria-describedby={`${id}-ayuda`} className="min-h-20" />
              <p id={`${id}-ayuda`} className="text-sm text-fg-muted">
                {t.descripcionAyuda}
              </p>
            </div>
            <div>
              <Button type="submit" aria-label={t.guardarAria(control.codigo)}>
                {t.guardar}
              </Button>
            </div>
          </form>
        )}

        {editable && (
          <form method="post" action={`/e/${empresa.id}/controles/retirar`}>
            <input type="hidden" name="id" value={control.id} />
            <input type="hidden" name="version" value={control.version} />
            {ocultosFiltros(filtros)}
            <Button type="submit" variante="danger" aria-label={t.retirarAria(control.codigo)}>
              {t.retirar}
            </Button>
          </form>
        )}
      </div>
    </details>
  );
};

export const PantallaControles = ({ empresa, persona, marco, opciones, filtros, filtrosInvalidos, aviso = null }: PropsControles) => {
  const t = es.controles;
  const puedeGestionar = persona.roles.includes('administrador_sig');
  const hayFiltros = filtros.norma !== undefined || filtros.retirados === true;
  const sinControles = marco.controles.length === 0 && !hayFiltros;

  return (
    <MarcoApp empresa={empresa} activo="controles" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <AvisoDeEscritura aviso={aviso} />
      {!puedeGestionar && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      {puedeGestionar && (
        <Card className="mb-6" aria-labelledby="nuevo-control">
          <CardTitle id="nuevo-control">{t.nuevo}</CardTitle>
          <form method="post" action={`/e/${empresa.id}/controles/crear`} className="grid max-w-3xl gap-3 md:grid-cols-[10rem_1fr]">
            {ocultosFiltros(filtros)}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-codigo">{t.codigo}</Label>
              <Input id="nuevo-codigo" name="codigo" required maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,19}" aria-describedby="nuevo-codigo-ayuda" />
              <p id="nuevo-codigo-ayuda" className="text-sm text-fg-muted">
                {t.codigoAyuda}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-nombre">{t.nombre}</Label>
              <Input id="nuevo-nombre" name="nombre" required maxLength={120} />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="nuevo-descripcion">{t.descripcion}</Label>
              <Textarea id="nuevo-descripcion" name="descripcion" maxLength={1000} aria-describedby="nuevo-descripcion-ayuda" className="min-h-20" />
              <p id="nuevo-descripcion-ayuda" className="text-sm text-fg-muted">
                {t.descripcionAyuda}
              </p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t.crear}</Button>
            </div>
          </form>
        </Card>
      )}

      {sinControles ? (
        <EstadoVacio titulo={t.sinControlesTitulo} descripcion={puedeGestionar ? t.sinControlesAdmin : t.sinControlesOtros} />
      ) : (
        <>
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
                  {marco.normas.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                <Checkbox id="retirados" name="retirados" value="true" defaultChecked={filtros.retirados === true} />
                <Label htmlFor="retirados">{t.verRetirados}</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{t.aplicar}</Button>
                {hayFiltros && (
                  <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center px-3 text-sm font-medium text-primary underline" href={`/e/${empresa.id}/controles`}>
                    {t.limpiar}
                  </a>
                )}
              </div>
            </form>
          </Card>

          <p className="mb-2 text-sm text-fg-muted" role="status">
            {t.resultados(marco.controles.length)}
          </p>
          {marco.controles.length === 0 ? (
            <EstadoVacio titulo={t.sinResultadosTitulo} descripcion={t.sinResultadosDescripcion} />
          ) : (
            <div className="overflow-x-auto">
              <Tabla aria-describedby="controles-desc">
                <caption id="controles-desc" className="sr-only">
                  {t.tablaDescripcion}
                </caption>
                <thead>
                  <tr>
                    <Th scope="col">{t.columnas.control}</Th>
                    <Th scope="col">{t.columnas.normas}</Th>
                    <Th scope="col">{t.columnas.estado}</Th>
                  </tr>
                </thead>
                <tbody>
                  {marco.controles.map((c, i) => (
                    <tr key={c.id}>
                      <Td>
                        <p className="font-medium text-fg">
                          <span className="font-mono text-fg-muted">{c.codigo}</span> · {c.nombre}
                        </p>
                        {c.descripcion && <p className="mt-1 max-w-xl text-sm text-fg-muted">{c.descripcion}</p>}
                        <DetalleControl empresa={empresa} control={c} indice={i} opciones={opciones} puedeGestionar={puedeGestionar} filtros={filtros} />
                      </Td>
                      <Td>
                        {c.normas.length === 0 ? (
                          <span className="text-sm text-fg-muted">{t.ningunaNorma}</span>
                        ) : (
                          <ul aria-label={t.normasQueCubre} className="flex flex-wrap gap-1.5">
                            {c.normas.map((n) => (
                              <li key={n}>
                                <Badge tono="info">{n}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                      <Td>{c.estado === 'vigente' ? <Badge tono="success">{t.estadoVigente}</Badge> : <Badge>{t.estadoRetirado}</Badge>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </div>
          )}
        </>
      )}
    </MarcoApp>
  );
};
