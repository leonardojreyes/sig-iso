import { Alert, Badge, Button, Card, CardTitle, Checkbox, EstadoVacio, Input, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { AvisoEscritura } from '../certificacion/escribir';
import { MOTIVOS_CAMBIO, type DetallePrograma, type Programa } from '../auditoria/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { Campo, NavegacionAuditoria, dia, enlaceClase, esAdministrador, nombreDe, t, type PersonaSesion } from './auditoria-comun';
import { MarcoApp } from './marco';

const pr = t.programa;
const ps = t.programas;

export interface PropsAuditoria {
  readonly empresa: Empresa;
  readonly persona: PersonaSesion;
  readonly programas: readonly Programa[];
  /** Códigos de las librerías adoptadas: lo único que se puede elegir como norma. */
  readonly normasAdoptadas: readonly string[];
  readonly aviso?: AvisoEscritura | null;
  /** Panel del prerrequisito de la Etapa 2 (se arma en la pantalla del panel). */
  readonly panel?: React.ReactNode;
}

/** Entrada a la auditoría interna: el panel y los programas anuales. */
export const PantallaAuditoria = ({ empresa, persona, programas, normasAdoptadas, aviso = null, panel = null }: PropsAuditoria) => {
  const admin = esAdministrador(persona);
  const base = `/e/${empresa.id}/auditoria`;
  const anioSiguiente = new Date().getUTCFullYear();
  return (
    <MarcoApp empresa={empresa} activo="auditoria" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.descripcion}</p>
      <NavegacionAuditoria empresa={empresa} actual="panel" />
      <AvisoDeEscritura aviso={aviso} />
      {panel}

      <h2 className="mb-3 text-xl font-semibold text-fg">{ps.titulo}</h2>
      {admin && (
        <Card className="mb-6" aria-labelledby="nuevo-programa">
          <CardTitle id="nuevo-programa">{ps.nuevo}</CardTitle>
          {normasAdoptadas.length === 0 ? (
            <p className="text-sm text-fg-muted">{ps.sinNormas}</p>
          ) : (
            <form method="post" action={`${base}/escribir/programa_crear`} className="grid max-w-3xl gap-3 md:grid-cols-2">
              <Campo id="programa-anio" etiqueta={`${ps.anio} ${t.obligatorio}`}>
                <Input id="programa-anio" name="anio" type="number" inputMode="numeric" min={2000} max={2100} required defaultValue={anioSiguiente} />
              </Campo>
              <Campo id="programa-objetivo" etiqueta={`${ps.objetivo} ${t.obligatorio}`} ayuda={t.sinTexto} ancho>
                <Textarea id="programa-objetivo" name="objetivo" required maxLength={500} rows={2} aria-describedby="programa-objetivo-ayuda" />
              </Campo>
              <fieldset className="md:col-span-2">
                <legend className="mb-1 text-sm font-medium text-fg">{`${ps.normas} ${t.obligatorio}`}</legend>
                <p className="mb-2 text-sm text-fg-muted">{ps.normasAyuda}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {normasAdoptadas.map((n) => (
                    <div key={n} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                      <Checkbox id={`programa-norma-${n}`} name="normas" value={n} />
                      <label htmlFor={`programa-norma-${n}`} className="text-sm text-fg">
                        {n}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <div className="md:col-span-2">
                <Button type="submit">{ps.crear}</Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {programas.length === 0 ? (
        <EstadoVacio titulo={ps.vacio} descripcion={ps.vacioDescripcion} />
      ) : (
        <ul className="flex flex-col gap-3">
          {programas.map((x) => (
            <li key={x.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold text-fg">{pr.titulo(x.anio)}</h3>
                  <Badge tono={x.estado === 'aprobado' ? 'success' : 'warning'}>{t.estadosPrograma[x.estado]}</Badge>
                </div>
                <p className="mt-1 text-sm text-fg-muted">{x.objetivo}</p>
                <p className="mt-1 text-sm text-fg-muted">{x.normas.join(', ')}</p>
                {x.aprobadoEn ? <p className="mt-1 text-sm text-fg-muted">{ps.aprobadoEl(dia(x.aprobadoEn))}</p> : null}
                <a className={`mt-2 ${enlaceClase}`} href={`${base}/programas/${x.id}`} aria-label={ps.abrir(x.anio)}>
                  {t.abrir}
                </a>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </MarcoApp>
  );
};

export interface PropsPrograma {
  readonly empresa: Empresa;
  readonly persona: PersonaSesion;
  readonly detalle: DetallePrograma;
  readonly personas: readonly PersonaDirectorio[];
  readonly normasAdoptadas: readonly string[];
  readonly aviso?: AvisoEscritura | null;
}

/** Un programa anual: calendario, auditorías, lo que falta, motivos, ayudas, aprobación y planificar auditorías. */
export const PantallaPrograma = ({ empresa, persona, detalle, personas, normasAdoptadas, aviso = null }: PropsPrograma) => {
  const admin = esAdministrador(persona);
  const base = `/e/${empresa.id}/auditoria`;
  const p = detalle.programa;
  const escribir = (accion: string): string => `${base}/escribir/${accion}/${p.id}`;
  const aprobado = p.estado === 'aprobado';
  const nombreProceso = (id: string): string => {
    const x = detalle.procesos.find((y) => y.procesoId === id);
    return x ? `${x.codigo} ${x.nombre}` : id;
  };
  const aprobable = detalle.pendientes.procesos.length === 0 && detalle.pendientes.capitulos.length === 0;
  const activas = detalle.auditorias.filter((a) => a.estado !== 'cancelada');
  return (
    <MarcoApp empresa={empresa} activo="auditoria" persona={persona.nombre}>
      <h1 className="mb-2 flex flex-wrap items-center gap-3 text-2xl font-semibold text-fg">
        {pr.titulo(p.anio)}
        <Badge tono={aprobado ? 'success' : 'warning'}>{t.estadosPrograma[p.estado]}</Badge>
      </h1>
      <p className="mb-1 max-w-3xl text-sm text-fg-muted">{p.objetivo}</p>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{pr.ayuda}</p>
      <NavegacionAuditoria empresa={empresa} actual="programa" />
      <AvisoDeEscritura aviso={aviso} />
      {!admin && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      <Card className="mb-6" aria-labelledby="calendario">
        <CardTitle id="calendario">{pr.calendario}</CardTitle>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((q) => {
            const delTrimestre = activas.filter((a) => a.trimestre === q);
            return (
              <section key={q} aria-labelledby={`trimestre-${q}`}>
                <h3 id={`trimestre-${q}`} className="mb-1 text-sm font-semibold text-fg">
                  {pr.trimestre(q)}
                </h3>
                {delTrimestre.length === 0 ? (
                  <p className="text-sm text-fg-muted">{pr.sinAuditoriasTrimestre}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {delTrimestre.map((a) => (
                      <li key={a.id} className="text-sm text-fg">
                        <a className={enlaceClase} href={`${base}/auditorias/${a.id}`} aria-label={pr.abrirAuditoria(a.codigo)}>
                          {a.codigo}
                        </a>{' '}
                        · {t.estadosAuditoria[a.estado]}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </Card>

      <h2 className="mb-3 text-xl font-semibold text-fg">{pr.auditorias}</h2>
      {detalle.auditorias.length === 0 ? (
        <p className="mb-6 text-sm text-fg-muted">{pr.sinAuditorias}</p>
      ) : (
        <div className="mb-6">
          <Tabla aria-describedby="auditorias-desc">
            <caption id="auditorias-desc" className="sr-only">
              {pr.auditorias}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{pr.columnas.auditoria}</Th>
                <Th scope="col">{pr.columnas.fechas}</Th>
                <Th scope="col">{pr.columnas.criterios}</Th>
                <Th scope="col">{pr.columnas.lider}</Th>
                <Th scope="col">{pr.columnas.estado}</Th>
              </tr>
            </thead>
            <tbody>
              {detalle.auditorias.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <p className="font-medium text-fg">
                      <span className="font-mono text-fg-muted">{a.codigo}</span> · {a.objetivo}
                    </p>
                    <a className={`mt-1 ${enlaceClase}`} href={`${base}/auditorias/${a.id}`} aria-label={pr.abrirAuditoria(a.codigo)}>
                      {t.abrir}
                    </a>
                  </Td>
                  <Td>{pr.fechas(a.inicio, a.fin)}</Td>
                  <Td>
                    {a.normas.join(', ')}
                    {a.combinada ? <span className="ml-2"><Badge>{pr.combinada}</Badge></span> : null}
                  </Td>
                  <Td>{a.liderId ? nombreDe(personas, a.liderId) : pr.sinLider}</Td>
                  <Td>
                    <Badge tono={a.estado === 'cerrada' ? 'success' : a.estado === 'cancelada' ? undefined : 'warning'}>{t.estadosAuditoria[a.estado]}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      )}

      <Card className="mb-6" aria-labelledby="pendientes">
        <CardTitle id="pendientes">{pr.pendientes}</CardTitle>
        <p className="mb-2 text-sm text-fg-muted">{pr.incluidos(detalle.pendientes.procesosIncluidos, detalle.pendientes.capitulosIncluidos)}</p>
        {aprobable ? (
          <p className="text-sm text-fg">{pr.sinPendientes}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="pend-procesos">
              <h3 id="pend-procesos" className="mb-1 text-sm font-semibold text-fg">
                {pr.pendientesProcesos}
              </h3>
              <ul className="list-disc pl-5 text-sm text-fg">
                {detalle.pendientes.procesos.map((id) => (
                  <li key={id}>{nombreProceso(id)}</li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="pend-capitulos">
              <h3 id="pend-capitulos" className="mb-1 text-sm font-semibold text-fg">
                {pr.pendientesCapitulos}
              </h3>
              <ul className="list-disc pl-5 text-sm text-fg">
                {detalle.pendientes.capitulos.map((c) => (
                  <li key={`${c.libreriaCodigo}|${c.capitulo}`}>
                    {c.libreriaCodigo} · {c.capitulo}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </Card>

      <Card className="mb-6" aria-labelledby="motivos">
        <CardTitle id="motivos">{pr.motivos}</CardTitle>
        <p className="mb-3 text-sm text-fg-muted">{pr.motivosAyuda}</p>
        {detalle.exclusiones.length === 0 ? (
          <p className="mb-3 text-sm text-fg-muted">{pr.sinMotivos}</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {detalle.exclusiones.map((x) => {
              const que = x.tipo === 'proceso' && x.procesoId ? nombreProceso(x.procesoId) : `${x.libreriaCodigo} · ${x.capitulo}`;
              return (
                <li key={x.id} className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-fg">
                    <span className="font-medium">{que}</span>: {x.motivo}
                  </span>
                  {admin && !aprobado && (
                    <form method="post" action={escribir('exclusion_quitar')}>
                      <input type="hidden" name="exclusionId" value={x.id} />
                      <Button type="submit" variante="secondary" aria-label={pr.motivoQuitar(que)}>
                        {t.quitar}
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {aprobado && <p className="text-sm text-fg-muted">{pr.motivosBloqueados}</p>}
        {admin && !aprobado && (
          <form method="post" action={escribir('exclusion_agregar')} className="grid max-w-3xl gap-3 md:grid-cols-2">
            <Campo id="motivo-tipo" etiqueta={pr.motivoTipo}>
              <Select id="motivo-tipo" name="tipo" defaultValue="proceso">
                <option value="proceso">{pr.motivoProceso}</option>
                <option value="capitulo">{pr.motivoCapitulo}</option>
              </Select>
            </Campo>
            <Campo id="motivo-proceso" etiqueta={pr.motivoProcesoCampo}>
              <Select id="motivo-proceso" name="procesoId" defaultValue="">
                <option value="">{t.seleccione}</option>
                {detalle.procesos.map((x) => (
                  <option key={x.procesoId} value={x.procesoId}>
                    {x.codigo} {x.nombre}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="motivo-capitulo" etiqueta={pr.motivoCapituloCampo}>
              <Select id="motivo-capitulo" name="capitulo" defaultValue="">
                <option value="">{t.seleccione}</option>
                {detalle.pendientes.capitulos.map((c) => (
                  <option key={`${c.libreriaCodigo}|${c.capitulo}`} value={`${c.libreriaCodigo}|${c.capitulo}`}>
                    {c.libreriaCodigo} · {c.capitulo}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="motivo-texto" etiqueta={`${pr.motivoTexto} ${t.obligatorio}`} ayuda={t.sinTexto}>
              <Input id="motivo-texto" name="motivo" required maxLength={300} aria-describedby="motivo-texto-ayuda" />
            </Campo>
            <div className="md:col-span-2">
              <Button type="submit">{pr.motivoAgregar}</Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="mb-6" aria-labelledby="ayudas">
        <CardTitle id="ayudas">{pr.ayudas}</CardTitle>
        <Tabla aria-describedby="ayudas-desc">
          <caption id="ayudas-desc" className="sr-only">
            {pr.ayudasTabla}
          </caption>
          <thead>
            <tr>
              <Th scope="col">{pr.ayudasColumnas.proceso}</Th>
              <Th scope="col">{pr.ayudasColumnas.importancia}</Th>
              <Th scope="col">{pr.ayudasColumnas.ultima}</Th>
              <Th scope="col">{pr.ayudasColumnas.abiertos}</Th>
              <Th scope="col">{pr.ayudasColumnas.incluido}</Th>
            </tr>
          </thead>
          <tbody>
            {detalle.procesos.map((x) => (
              <tr key={x.procesoId}>
                <Td>
                  <span className="font-mono text-fg-muted">{x.codigo}</span> · {x.nombre}
                  {x.cambioRelevante ? <p className="mt-1 text-sm text-fg-muted">{t.cambios[x.cambioRelevante]}</p> : null}
                </Td>
                <Td>
                  {t.importancias[x.importancia]} · {t.frecuencias[x.frecuencia]}
                </Td>
                <Td>{x.ultimaAuditoria ?? pr.nunca}</Td>
                <Td>{x.hallazgosAbiertos}</Td>
                <Td>
                  <Badge tono={x.incluido ? 'success' : 'warning'}>{x.incluido ? pr.incluidoSi : pr.incluidoNo}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Card>

      {admin && (
        <>
          <Card className="mb-6" aria-labelledby="objetivo-normas">
            <CardTitle id="objetivo-normas">{pr.objetivoYNormas}</CardTitle>
            <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pr.objetivoYNormasAyuda}</p>
            <form method="post" action={escribir('programa_cambiar')} className="grid max-w-3xl gap-3 md:grid-cols-2">
              <input type="hidden" name="version" value={p.version} />
              <Campo id="cambiar-objetivo" etiqueta={`${ps.objetivo} ${t.obligatorio}`} ancho>
                <Textarea id="cambiar-objetivo" name="objetivo" required maxLength={500} rows={2} defaultValue={p.objetivo} />
              </Campo>
              <fieldset className="md:col-span-2">
                <legend className="mb-1 text-sm font-medium text-fg">{`${ps.normas} ${t.obligatorio}`}</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {normasAdoptadas.map((n) => (
                    <div key={n} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                      <Checkbox id={`cambiar-norma-${n}`} name="normas" value={n} defaultChecked={p.normas.includes(n)} />
                      <label htmlFor={`cambiar-norma-${n}`} className="text-sm text-fg">
                        {n}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <div className="md:col-span-2">
                <Button type="submit">{t.guardar}</Button>
              </div>
            </form>
          </Card>

          {!aprobado && (
            <Card className="mb-6" aria-labelledby="aprobar-programa">
              <CardTitle id="aprobar-programa">{pr.aprobarTitulo}</CardTitle>
              <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pr.aprobarAyuda}</p>
              {!aprobable && (
                <div className="mb-3">
                  <Alert anunciar={false} tono="warning" titulo={pr.noAprobable} />
                </div>
              )}
              <form method="post" action={escribir('programa_aprobar')}>
                <input type="hidden" name="version" value={p.version} />
                <Button type="submit">{pr.aprobar}</Button>
              </form>
            </Card>
          )}
          {aprobado && p.aprobadoPor && p.aprobadoEn ? <p className="mb-6 text-sm text-fg-muted">{pr.aprobadoPor(nombreDe(personas, p.aprobadoPor), dia(p.aprobadoEn))}</p> : null}

          <Card className="mb-6" aria-labelledby="planificar">
            <CardTitle id="planificar">{pr.nuevaAuditoria}</CardTitle>
            <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pr.nuevaAuditoriaAyuda}</p>
            <form method="post" action={escribir('auditoria_crear')} className="grid max-w-3xl gap-3 md:grid-cols-2">
              <Campo id="aud-objetivo" etiqueta={`${pr.campoObjetivo} ${t.obligatorio}`} ayuda={t.sinTexto} ancho>
                <Textarea id="aud-objetivo" name="objetivo" required maxLength={500} rows={2} aria-describedby="aud-objetivo-ayuda" />
              </Campo>
              <Campo id="aud-inicio" etiqueta={`${pr.campoInicio} ${t.obligatorio}`}>
                <Input id="aud-inicio" name="inicio" type="date" required min={`${p.anio}-01-01`} max={`${p.anio}-12-31`} />
              </Campo>
              <Campo id="aud-fin" etiqueta={`${pr.campoFin} ${t.obligatorio}`}>
                <Input id="aud-fin" name="fin" type="date" required />
              </Campo>
              <Campo id="aud-apertura" etiqueta={pr.campoApertura}>
                <Input id="aud-apertura" name="reunionApertura" type="date" />
              </Campo>
              <Campo id="aud-cierre" etiqueta={pr.campoCierre}>
                <Input id="aud-cierre" name="reunionCierre" type="date" />
              </Campo>
              <fieldset className="md:col-span-2">
                <legend className="mb-1 text-sm font-medium text-fg">{`${pr.campoNormas} ${t.obligatorio}`}</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {p.normas.map((n) => (
                    <div key={n} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                      <Checkbox id={`aud-norma-${n}`} name="normas" value={n} />
                      <label htmlFor={`aud-norma-${n}`} className="text-sm text-fg">
                        {n}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <fieldset className="md:col-span-2">
                <legend className="mb-1 text-sm font-medium text-fg">{pr.campoProcesos}</legend>
                {detalle.procesos.length === 0 ? (
                  <p className="text-sm text-fg-muted">{pr.sinProcesos}</p>
                ) : (
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    {detalle.procesos.map((x) => (
                      <div key={x.procesoId} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                        <Checkbox id={`aud-proceso-${x.procesoId}`} name="procesosIds" value={x.procesoId} />
                        <label htmlFor={`aud-proceso-${x.procesoId}`} className="text-sm text-fg">
                          {x.codigo} {x.nombre}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
              {detalle.pendientes.capitulos.length > 0 && (
                <fieldset className="md:col-span-2">
                  <legend className="mb-1 text-sm font-medium text-fg">{pr.campoCapitulos}</legend>
                  <p className="mb-2 text-sm text-fg-muted">{pr.campoCapitulosAyuda}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    {detalle.pendientes.capitulos.map((c) => (
                      <div key={`${c.libreriaCodigo}|${c.capitulo}`} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                        <Checkbox id={`aud-cap-${c.libreriaCodigo}-${c.capitulo}`} name="capitulos" value={`${c.libreriaCodigo}|${c.capitulo}`} />
                        <label htmlFor={`aud-cap-${c.libreriaCodigo}-${c.capitulo}`} className="text-sm text-fg">
                          {c.libreriaCodigo} · {c.capitulo}
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}
              {aprobado && (
                <>
                  <p className="text-sm text-fg-muted md:col-span-2">{pr.motivoObligatorio}</p>
                  <Campo id="aud-motivo" etiqueta={`${pr.campoMotivo} ${t.obligatorio}`}>
                    <Select id="aud-motivo" name="motivo" required defaultValue="">
                      <option value="" disabled>
                        {t.seleccione}
                      </option>
                      {MOTIVOS_CAMBIO.map((m) => (
                        <option key={m} value={m}>
                          {t.motivosCambio[m]}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo id="aud-nota" etiqueta={pr.campoNota}>
                    <Input id="aud-nota" name="nota" maxLength={300} />
                  </Campo>
                </>
              )}
              <div className="md:col-span-2">
                <Button type="submit">{pr.planificar}</Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </MarcoApp>
  );
};
