import { Alert, Badge, Button, Card, CardTitle, Input, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { AvisoEscritura } from '../certificacion/escribir';
import { MOTIVOS_ANULACION, RESULTADOS, TIPOS_HALLAZGO, type Auditoria, type FilaLista, type Hallazgo, type ListaHallazgos, type ListaProcesos, type ListaVerificacion } from '../auditoria/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { Campo, NavegacionAuditoria, enlaceClase, esAdministrador, t, type PersonaSesion } from './auditoria-comun';
import { MarcoApp } from './marco';

const ej = t.ejecucion;
const MAX_PREGUNTAS = 5;
const RESULTADOS_EVALUABLES = RESULTADOS.filter((r) => r !== 'por_evaluar');

export interface PropsEjecucion {
  readonly empresa: Empresa;
  readonly persona: PersonaSesion;
  readonly auditoria: Auditoria;
  readonly lista: ListaVerificacion;
  readonly hallazgos: ListaHallazgos;
  readonly procesos: ListaProcesos;
  readonly personas: readonly PersonaDirectorio[];
  readonly aviso?: AvisoEscritura | null;
}

const toneResultado = (r: FilaLista['resultado']): 'success' | 'warning' | 'danger' | undefined =>
  r === 'conforme' ? 'success' : r === 'no_conforme' ? 'danger' : r === 'observacion' || r === 'oportunidad' || r === 'no_verificado' ? 'warning' : undefined;
const toneHallazgo = (h: Hallazgo): 'danger' | 'warning' | undefined => (h.estado === 'anulado' ? undefined : h.tipo === 'nc_mayor' ? 'danger' : h.tipo === 'nc_menor' ? 'warning' : undefined);

/** Lista de verificación y hallazgos de una auditoría en ejecución. */
export const PantallaEjecucion = ({ empresa, persona, auditoria: a, lista, hallazgos, procesos, personas: _personas, aviso = null }: PropsEjecucion) => {
  void _personas;
  const admin = esAdministrador(persona);
  const audita = admin || persona.roles.includes('auditor_interno');
  const base = `/e/${empresa.id}/auditoria`;
  const escribir = (accion: string): string => `${base}/escribir/${accion}/${a.id}`;
  const enEjecucion = a.estado === 'en_ejecucion';
  const puedeEscribir = audita && enEjecucion;
  const puedePreguntar = audita && (a.estado === 'en_preparacion' || enEjecucion);
  const nombreProceso = (id: string | null): string => {
    if (id === null) return '—';
    const x = procesos.procesos.find((p) => p.id === id);
    return x ? `${x.codigo} ${x.nombre}` : id;
  };
  const nombreFila = (f: FilaLista): string => `${f.libreriaCodigo} ${f.idEstable}`;
  const tituloFila = (f: FilaLista): string => f.titulo ?? ej.sinTitulo;
  return (
    <MarcoApp empresa={empresa} activo="auditoria" persona={persona.nombre}>
      <h1 className="mb-2 flex flex-wrap items-center gap-3 text-2xl font-semibold text-fg">
        {ej.titulo(a.codigo)}
        <Badge tono={enEjecucion ? 'warning' : a.estado === 'cerrada' ? 'success' : undefined}>{t.estadosAuditoria[a.estado]}</Badge>
      </h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{ej.ayuda}</p>
      <NavegacionAuditoria empresa={empresa} actual="ejecucion" auditoriaId={a.id} />
      <AvisoDeEscritura aviso={aviso} />
      {!audita && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}
      {!enEjecucion && (
        <div className="mb-4">
          <Alert anunciar={false} tono="info" titulo={ej.noEnEjecucion} />
        </div>
      )}
      {puedeEscribir && <p className="mb-4 text-sm text-fg-muted">{ej.soloEquipo}</p>}

      <Card className="mb-6" aria-labelledby="avance">
        <CardTitle id="avance">{ej.avance}</CardTitle>
        <p className="text-sm text-fg">{ej.avanceTexto(lista.avance.evaluadas, lista.avance.total)}</p>
        <p className="mt-1 text-sm text-fg-muted">
          {RESULTADOS.filter((r) => lista.avance.porResultado[r] > 0)
            .map((r) => ej.avanceCuenta(t.resultados[r], lista.avance.porResultado[r]))
            .join(' · ')}
        </p>
        {admin && a.estado === 'en_preparacion' && (
          <form method="post" action={escribir('lista_regenerar')} className="mt-3">
            <p className="mb-2 max-w-3xl text-sm text-fg-muted">{ej.regenerarAyuda}</p>
            <Button type="submit" variante="secondary">
              {ej.regenerar}
            </Button>
          </form>
        )}
      </Card>

      <h2 className="mb-3 text-xl font-semibold text-fg">{ej.listaTitulo}</h2>
      {lista.filas.length === 0 ? (
        <p className="mb-6 text-sm text-fg-muted">{ej.listaVacia}</p>
      ) : (
        <div className="mb-6">
          <Tabla aria-describedby="lista-desc">
            <caption id="lista-desc" className="sr-only">
              {ej.listaTitulo}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{ej.columnas.requisito}</Th>
                <Th scope="col">{ej.columnas.resultado}</Th>
                <Th scope="col">{ej.columnas.diagnostico}</Th>
              </tr>
            </thead>
            <tbody>
              {lista.filas.map((f) => (
                <tr key={f.id} id={`fila-${f.id}`}>
                  <Td>
                    <p className="font-medium text-fg">
                      <span className="font-mono text-fg-muted">{nombreFila(f)}</span> · {tituloFila(f)}
                    </p>
                    {f.guia ? (
                      <details className="mt-1">
                        <summary className={`cursor-pointer ${enlaceClase}`}>{ej.guia}</summary>
                        <p className="mt-1 text-sm text-fg-muted">{f.guia}</p>
                      </details>
                    ) : null}
                    <div className="mt-2">
                      <p className="text-sm font-medium text-fg">{ej.preguntas}</p>
                      {f.preguntas.length === 0 ? (
                        <p className="text-sm text-fg-muted">{ej.sinPreguntas}</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {f.preguntas.map((q) => (
                            <li key={q.id} className="flex flex-wrap items-center gap-2 text-sm text-fg">
                              {q.texto}
                              {puedePreguntar && (
                                <form method="post" action={escribir('pregunta_quitar')}>
                                  <input type="hidden" name="preguntaId" value={q.id} />
                                  <Button type="submit" variante="secondary" aria-label={ej.preguntaQuitar(q.texto)}>
                                    {t.quitar}
                                  </Button>
                                </form>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {puedePreguntar && f.preguntas.length >= MAX_PREGUNTAS && <p className="mt-2 text-sm text-fg-muted">{ej.limitePreguntas}</p>}
                      {puedePreguntar && f.preguntas.length < MAX_PREGUNTAS && (
                        <form method="post" action={escribir('pregunta_agregar')} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="filaId" value={f.id} />
                          <Campo id={`pregunta-${f.id}`} etiqueta={`${ej.preguntaNueva}: ${nombreFila(f)}`}>
                            <Input id={`pregunta-${f.id}`} name="texto" required maxLength={300} />
                          </Campo>
                          <Button type="submit" variante="secondary">
                            {ej.preguntaAgregar}
                          </Button>
                        </form>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge tono={toneResultado(f.resultado)}>{t.resultados[f.resultado]}</Badge>
                    {f.nota ? <p className="mt-1 text-sm text-fg-muted">{f.nota}</p> : null}
                    {puedeEscribir && (
                      <form method="post" action={escribir('fila_evaluar')} className="mt-2 grid gap-2">
                        <input type="hidden" name="filaId" value={f.id} />
                        <input type="hidden" name="version" value={f.version} />
                        <Campo id={`resultado-${f.id}`} etiqueta={`${ej.evaluar(nombreFila(f))}: ${ej.campoResultado}`}>
                          <Select id={`resultado-${f.id}`} name="resultado" required defaultValue={f.resultado === 'por_evaluar' ? '' : f.resultado}>
                            <option value="" disabled>
                              {t.seleccione}
                            </option>
                            {RESULTADOS_EVALUABLES.map((r) => (
                              <option key={r} value={r}>
                                {t.resultados[r]}
                              </option>
                            ))}
                          </Select>
                        </Campo>
                        <Campo id={`nota-${f.id}`} etiqueta={ej.campoNota} ayuda={ej.notaAyuda}>
                          <Textarea id={`nota-${f.id}`} name="nota" maxLength={500} rows={2} defaultValue={f.nota ?? ''} aria-describedby={`nota-${f.id}-ayuda`} />
                        </Campo>
                        <div>
                          <Button type="submit">{ej.guardarResultado}</Button>
                        </div>
                      </form>
                    )}
                  </Td>
                  <Td>
                    {f.diagnostico ? t.diagnostico[f.diagnostico] : '—'}
                    {f.diagnostico ? <p className="mt-1 text-sm text-fg-muted">{ej.diagnosticoContexto}</p> : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      )}

      <h2 className="mb-2 text-xl font-semibold text-fg">{ej.hallazgosTitulo}</h2>
      <p className="mb-3 max-w-3xl text-sm text-fg-muted">{ej.hallazgosAyuda}</p>
      <p className="mb-3 text-sm text-fg">
        {ej.abiertosTitulo}: {TIPOS_HALLAZGO.map((x) => ej.abiertos(t.tiposHallazgo[x], hallazgos.abiertos[x])).join(' · ')}
      </p>
      {hallazgos.hallazgos.length === 0 ? (
        <p className="mb-6 text-sm text-fg-muted">{ej.hallazgosVacio}</p>
      ) : (
        <div className="mb-6">
          <Tabla aria-describedby="hallazgos-desc">
            <caption id="hallazgos-desc" className="sr-only">
              {ej.hallazgosTitulo}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{ej.columnasHallazgos.hallazgo}</Th>
                <Th scope="col">{ej.columnasHallazgos.requisito}</Th>
                <Th scope="col">{ej.columnasHallazgos.evidencia}</Th>
                <Th scope="col">{ej.columnasHallazgos.estado}</Th>
              </tr>
            </thead>
            <tbody>
              {hallazgos.hallazgos.map((h) => (
                <tr key={h.id}>
                  <Td>
                    <p className="font-medium text-fg">
                      <span className="font-mono text-fg-muted">{h.codigo}</span> · {h.enunciado}
                    </p>
                    <div className="mt-1">
                      <Badge tono={toneHallazgo(h)}>{t.tiposHallazgo[h.tipo]}</Badge>
                    </div>
                    {h.justificacionGravedad ? (
                      <p className="mt-1 text-sm text-fg-muted">
                        {ej.gravedad}: {h.justificacionGravedad}
                      </p>
                    ) : null}
                  </Td>
                  <Td>
                    <p className="text-sm text-fg">{nombreProceso(h.procesoId)}</p>
                    <p className="text-sm text-fg-muted">{h.libreriaCodigo ? `${h.libreriaCodigo} ${h.idEstable}` : '—'}</p>
                  </Td>
                  <Td>{h.evidencia}</Td>
                  <Td>
                    <Badge tono={h.estado === 'abierto' ? 'warning' : undefined}>{t.estadosHallazgo[h.estado]}</Badge>
                    {h.anulacionMotivo ? <p className="mt-1 text-sm text-fg-muted">{ej.anulado(t.motivosAnulacion[h.anulacionMotivo])}</p> : null}
                    {puedeEscribir && h.estado === 'abierto' && (
                      <>
                        <details className="mt-2">
                          <summary className={`cursor-pointer ${enlaceClase}`}>{ej.cambiar(h.codigo)}</summary>
                          <form method="post" action={escribir('hallazgo_cambiar')} className="mt-2 grid gap-2">
                            <input type="hidden" name="hallazgoId" value={h.id} />
                            <input type="hidden" name="version" value={h.version} />
                            <CamposHallazgo prefijo={`cambiar-${h.id}`} lista={lista} a={a} procesos={procesos} hallazgo={h} />
                            <div>
                              <Button type="submit">{ej.guardarCambios}</Button>
                            </div>
                          </form>
                        </details>
                        <details className="mt-2">
                          <summary className={`cursor-pointer ${enlaceClase}`}>{ej.anular(h.codigo)}</summary>
                          <form method="post" action={escribir('hallazgo_anular')} className="mt-2 grid gap-2">
                            <input type="hidden" name="hallazgoId" value={h.id} />
                            <input type="hidden" name="version" value={h.version} />
                            <p className="text-sm text-fg-muted">{ej.anularAyuda}</p>
                            <Campo id={`anular-${h.id}`} etiqueta={`${ej.campoMotivo} ${t.obligatorio}`}>
                              <Select id={`anular-${h.id}`} name="motivo" required defaultValue="">
                                <option value="" disabled>
                                  {t.seleccione}
                                </option>
                                {MOTIVOS_ANULACION.map((m) => (
                                  <option key={m} value={m}>
                                    {t.motivosAnulacion[m]}
                                  </option>
                                ))}
                              </Select>
                            </Campo>
                            <div>
                              <Button type="submit" variante="danger">
                                {ej.anular(h.codigo)}
                              </Button>
                            </div>
                          </form>
                        </details>
                      </>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      )}

      {puedeEscribir && (
        <Card className="mb-6" aria-labelledby="nuevo-hallazgo">
          <CardTitle id="nuevo-hallazgo">{ej.nuevoHallazgo}</CardTitle>
          <form method="post" action={escribir('hallazgo_registrar')} className="grid max-w-3xl gap-3">
            <CamposHallazgo prefijo="nuevo" lista={lista} a={a} procesos={procesos} conFila />
            <div>
              <Button type="submit">{ej.registrar}</Button>
            </div>
          </form>
        </Card>
      )}

      <p className="text-sm">
        <a className={enlaceClase} href={`${base}/auditorias/${a.id}`}>
          {ej.irPlan}
        </a>
        {' · '}
        <a className={enlaceClase} href={`${base}/auditorias/${a.id}/informe`}>
          {ej.irInforme}
        </a>
      </p>
    </MarcoApp>
  );
};

/** Los campos de un hallazgo (alta y cambio). El proceso se elige entre los del alcance y el requisito entre las filas de la lista. */
const CamposHallazgo = ({ prefijo, lista, a, procesos, hallazgo, conFila = false }: { prefijo: string; lista: ListaVerificacion; a: Auditoria; procesos: ListaProcesos; hallazgo?: Hallazgo; conFila?: boolean }) => {
  const requisitoActual = hallazgo?.libreriaCodigo ? `${hallazgo.libreriaCodigo}|${hallazgo.idEstable}` : '';
  return (
    <>
      <Campo id={`${prefijo}-tipo`} etiqueta={`${ej.campoTipo} ${t.obligatorio}`}>
        <Select id={`${prefijo}-tipo`} name="tipo" required defaultValue={hallazgo?.tipo ?? 'nc_menor'}>
          {TIPOS_HALLAZGO.map((x) => (
            <option key={x} value={x}>
              {t.tiposHallazgo[x]}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo id={`${prefijo}-proceso`} etiqueta={ej.campoProceso}>
        <Select id={`${prefijo}-proceso`} name="procesoId" defaultValue={hallazgo?.procesoId ?? ''}>
          <option value="">{t.seleccione}</option>
          {a.procesosDelAlcance.map((id) => {
            const x = procesos.procesos.find((p) => p.id === id);
            return (
              <option key={id} value={id}>
                {x ? `${x.codigo} ${x.nombre}` : id}
              </option>
            );
          })}
        </Select>
      </Campo>
      {conFila && (
        <Campo id={`${prefijo}-fila`} etiqueta={ej.campoFila}>
          <Select id={`${prefijo}-fila`} name="itemId" defaultValue="">
            <option value="">{ej.sinFila}</option>
            {lista.filas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.libreriaCodigo} {f.idEstable} · {f.titulo ?? ej.sinTitulo}
              </option>
            ))}
          </Select>
        </Campo>
      )}
      {!conFila && (
        <Campo id={`${prefijo}-requisito`} etiqueta={ej.campoRequisito}>
          <Select id={`${prefijo}-requisito`} name="requisito" defaultValue={requisitoActual}>
            <option value="">{t.seleccione}</option>
            {lista.filas.map((f) => (
              <option key={f.id} value={`${f.libreriaCodigo}|${f.idEstable}`}>
                {f.libreriaCodigo} {f.idEstable} · {f.titulo ?? ej.sinTitulo}
              </option>
            ))}
          </Select>
        </Campo>
      )}
      <Campo id={`${prefijo}-enunciado`} etiqueta={`${ej.campoEnunciado} ${t.obligatorio}`} ayuda={t.sinTexto}>
        <Textarea id={`${prefijo}-enunciado`} name="enunciado" required maxLength={500} rows={2} defaultValue={hallazgo?.enunciado ?? ''} aria-describedby={`${prefijo}-enunciado-ayuda`} />
      </Campo>
      <Campo id={`${prefijo}-evidencia`} etiqueta={`${ej.campoEvidencia} ${t.obligatorio}`}>
        <Textarea id={`${prefijo}-evidencia`} name="evidencia" required maxLength={1000} rows={3} defaultValue={hallazgo?.evidencia ?? ''} />
      </Campo>
      <Campo id={`${prefijo}-gravedad`} etiqueta={ej.campoGravedad} ayuda={ej.gravedadAyuda}>
        <Input id={`${prefijo}-gravedad`} name="justificacionGravedad" maxLength={500} defaultValue={hallazgo?.justificacionGravedad ?? ''} aria-describedby={`${prefijo}-gravedad-ayuda`} />
      </Campo>
    </>
  );
};
