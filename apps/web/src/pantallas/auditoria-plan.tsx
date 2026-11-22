import { Alert, Badge, Button, Card, CardTitle, Checkbox, Input, Select, Textarea } from '@sig/ui';
import type { AvisoEscritura } from '../certificacion/escribir';
import { MOTIVOS_CAMBIO, type Auditoria, type Independencia, type ListaProcesos, type Programa } from '../auditoria/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { Campo, NavegacionAuditoria, enlaceClase, esAdministrador, nombreDe, t, type PersonaSesion } from './auditoria-comun';
import { MarcoApp } from './marco';

const pl = t.plan;

export interface PropsPlan {
  readonly empresa: Empresa;
  readonly persona: PersonaSesion;
  readonly auditoria: Auditoria;
  readonly programa: Programa | null;
  readonly procesos: ListaProcesos;
  readonly personas: readonly PersonaDirectorio[];
  /** Persona cuya independencia se está comprobando (dirección `?persona=`) y el resultado de la API. */
  readonly candidataId?: string | null;
  readonly independencia?: Independencia | null;
  readonly aviso?: AvisoEscritura | null;
}

const nombreProceso = (procesos: ListaProcesos, id: string): string => {
  const x = procesos.procesos.find((p) => p.id === id);
  return x ? `${x.codigo} ${x.nombre}` : id;
};

/** Planificación de una auditoría: datos, alcance, equipo con la independencia visible y cambios de estado. */
export const PantallaPlanificacion = ({ empresa, persona, auditoria: a, programa, procesos, personas, candidataId = null, independencia = null, aviso = null }: PropsPlan) => {
  const admin = esAdministrador(persona);
  const base = `/e/${empresa.id}/auditoria`;
  const escribir = (accion: string): string => `${base}/escribir/${accion}/${a.id}`;
  const modificable = a.estado === 'planificada' || a.estado === 'en_preparacion';
  const inmutable = a.estado === 'informe_emitido' || a.estado === 'cerrada' || a.estado === 'cancelada';
  const puedenAuditar = personas.filter((x) => x.activa);
  const procesosVigentes = procesos.procesos.filter((x) => x.estado === 'vigente');
  const tieneLider = a.equipo.some((m) => m.rol === 'lider');
  return (
    <MarcoApp empresa={empresa} activo="auditoria" persona={persona.nombre}>
      <h1 className="mb-2 flex flex-wrap items-center gap-3 text-2xl font-semibold text-fg">
        {pl.titulo(a.codigo)}
        <Badge tono={a.estado === 'cerrada' ? 'success' : a.estado === 'cancelada' ? undefined : 'warning'}>{t.estadosAuditoria[a.estado]}</Badge>
      </h1>
      <p className="mb-1 max-w-3xl text-sm text-fg-muted">{a.objetivo}</p>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{pl.ayuda}</p>
      {programa ? (
        <p className="mb-2 text-sm">
          <a className={enlaceClase} href={`${base}/programas/${programa.id}`}>
            {pl.programaEnlace(programa.anio)}
          </a>
        </p>
      ) : null}
      <NavegacionAuditoria empresa={empresa} actual="planificacion" auditoriaId={a.id} />
      <AvisoDeEscritura aviso={aviso} />
      {!admin && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}
      {a.estado === 'cancelada' && a.cancelacionMotivo ? (
        <div className="mb-4">
          <Alert anunciar={false} tono="warning" titulo={pl.cancelada(t.motivosCambio[a.cancelacionMotivo])} />
        </div>
      ) : inmutable ? (
        <div className="mb-4">
          <Alert anunciar={false} tono="info" titulo={pl.inmutable} />
        </div>
      ) : null}

      <Card className="mb-6" aria-labelledby="datos">
        <CardTitle id="datos">{pl.datos}</CardTitle>
        <p className="text-sm text-fg">{pl.fechas(a.inicio, a.fin)}</p>
        <p className="text-sm text-fg">{pl.reuniones(a.reunionApertura, a.reunionCierre)}</p>
        {a.reprogramaciones > 0 ? <p className="text-sm text-fg-muted">{pl.reprogramaciones(a.reprogramaciones)}</p> : null}
        <h3 className="mb-1 mt-4 text-sm font-semibold text-fg">{pl.criterios}</h3>
        <p className="text-sm text-fg">{a.normas.join(', ')}</p>
        {a.combinada ? <p className="text-sm text-fg-muted">{pl.combinada}</p> : null}
        <h3 className="mb-1 mt-4 text-sm font-semibold text-fg">{pl.alcance}</h3>
        <p className="text-sm font-medium text-fg">{pl.alcanceProcesos}</p>
        {a.procesosDelAlcance.length === 0 ? (
          <p className="text-sm text-fg-muted">{pl.sinProcesos}</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-fg">
            {a.procesosDelAlcance.map((id) => (
              <li key={id}>
                {nombreProceso(procesos, id)}
                {!a.procesosIds.includes(id) ? ` (${pl.transversal})` : ''}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm font-medium text-fg">{pl.alcanceCapitulos}</p>
        {a.capitulos.length === 0 ? (
          <p className="text-sm text-fg-muted">{pl.todosCapitulos}</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-fg">
            {a.capitulos.map((c) => (
              <li key={`${c.libreriaCodigo}|${c.capitulo}`}>
                {c.libreriaCodigo} · {c.capitulo}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6" aria-labelledby="equipo">
        <CardTitle id="equipo">{pl.equipo}</CardTitle>
        {a.equipo.length === 0 ? (
          <p className="text-sm text-fg-muted">{pl.equipoVacio}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {a.equipo.map((m) => {
              const nombre = nombreDe(personas, m.personaId);
              return (
                <li key={m.personaId}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-fg">{nombre}</span>
                    <Badge tono={m.rol === 'lider' ? 'success' : undefined}>{t.roles[m.rol]}</Badge>
                    {m.excepcion ? <Badge tono="warning">{pl.excepcion}</Badge> : null}
                    {admin && modificable && (
                      <form method="post" action={escribir('equipo_quitar')}>
                        <input type="hidden" name="personaId" value={m.personaId} />
                        <Button type="submit" variante="secondary" aria-label={pl.quitarMiembro(nombre)}>
                          {t.quitar}
                        </Button>
                      </form>
                    )}
                  </div>
                  {m.excepcion && m.excepcionMotivo && m.excepcionMedida ? (
                    <p className="mt-1 text-sm text-fg-muted">
                      {pl.excepcionDetalle(m.excepcionMotivo, m.excepcionMedida)}
                      {m.autoautorizada ? ` ${pl.autoautorizada}` : ''}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {modificable && (
        <Card className="mb-6" aria-labelledby="comprobar">
          <CardTitle id="comprobar">{pl.comprobarTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pl.comprobarAyuda}</p>
          <form method="get" className="flex max-w-xl flex-wrap items-end gap-3">
            <Campo id="comprobar-persona" etiqueta={pl.candidata}>
              <Select id="comprobar-persona" name="persona" defaultValue={candidataId ?? ''}>
                <option value="" disabled>
                  {t.seleccione}
                </option>
                {puedenAuditar.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </Select>
            </Campo>
            <Button type="submit" variante="secondary">
              {pl.comprobar}
            </Button>
          </form>
          {independencia ? (
            <div className="mt-4" role="status">
              {independencia.independiente ? (
                <Alert anunciar={false} tono="success" titulo={pl.resultadoIndependiente(nombreDe(personas, independencia.personaId))} />
              ) : (
                <Alert anunciar={false} tono="warning" titulo={pl.resultadoConflicto(nombreDe(personas, independencia.personaId))}>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {independencia.conflictos.map((c) => (
                      <li key={c.procesoId}>{pl.conflicto(nombreProceso(procesos, c.procesoId), c.relaciones.map((r) => t.relaciones[r]).join(', '))}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {independencia.avisos.map((x) => (
                <p key={x.procesoId} className="mt-2 text-sm text-fg-muted">
                  {pl.avisoRepeticion(nombreProceso(procesos, x.procesoId), x.ultimaFecha)}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      )}

      {admin && modificable && (
        <Card className="mb-6" aria-labelledby="designar">
          <CardTitle id="designar">{pl.designarTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pl.designarAyuda}</p>
          <form method="post" action={escribir('equipo_designar')} className="grid max-w-3xl gap-3 md:grid-cols-2">
            <Campo id="designar-persona" etiqueta={`${pl.candidata} ${t.obligatorio}`}>
              <Select id="designar-persona" name="personaId" required defaultValue={candidataId ?? ''}>
                <option value="" disabled>
                  {t.seleccione}
                </option>
                {puedenAuditar.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="designar-rol" etiqueta={`${pl.rol} ${t.obligatorio}`}>
              <Select id="designar-rol" name="rol" required defaultValue={tieneLider ? 'auditor' : 'lider'}>
                <option value="lider">{t.roles.lider}</option>
                <option value="auditor">{t.roles.auditor}</option>
              </Select>
            </Campo>
            <fieldset className="grid gap-3 md:col-span-2 md:grid-cols-2">
              <legend className="mb-1 text-sm font-medium text-fg">{pl.excepcionTitulo}</legend>
              <p className="text-sm text-fg-muted md:col-span-2">{pl.excepcionAyuda}</p>
              <Campo id="excepcion-motivo" etiqueta={pl.excepcionMotivo} ayuda={t.sinTexto}>
                <Input id="excepcion-motivo" name="excepcionMotivo" maxLength={300} aria-describedby="excepcion-motivo-ayuda" />
              </Campo>
              <Campo id="excepcion-medida" etiqueta={pl.excepcionMedida}>
                <Input id="excepcion-medida" name="excepcionMedida" maxLength={300} />
              </Campo>
            </fieldset>
            <div className="md:col-span-2">
              <Button type="submit">{pl.designar}</Button>
            </div>
          </form>
        </Card>
      )}

      {admin && (a.estado === 'planificada' || a.estado === 'en_preparacion') && (
        <Card className="mb-6" aria-labelledby="estado">
          <CardTitle id="estado">{pl.estadoTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pl.avanzarAyuda}</p>
          <form method="post" action={escribir('auditoria_avanzar')}>
            <input type="hidden" name="version" value={a.version} />
            <input type="hidden" name="estado" value={a.estado === 'planificada' ? 'en_preparacion' : 'en_ejecucion'} />
            <Button type="submit">{a.estado === 'planificada' ? pl.avanzarPreparacion : pl.avanzarEjecucion}</Button>
          </form>
        </Card>
      )}

      {admin && modificable && (
        <Card className="mb-6" aria-labelledby="cambiar">
          <CardTitle id="cambiar">{pl.cambiarTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pl.cambiarAyuda}</p>
          <form method="post" action={escribir('auditoria_cambiar')} className="grid max-w-3xl gap-3 md:grid-cols-2">
            <input type="hidden" name="version" value={a.version} />
            <Campo id="cambiar-objetivo" etiqueta={`${t.programa.campoObjetivo} ${t.obligatorio}`} ancho>
              <Textarea id="cambiar-objetivo" name="objetivo" required maxLength={500} rows={2} defaultValue={a.objetivo} />
            </Campo>
            <Campo id="cambiar-inicio" etiqueta={`${t.programa.campoInicio} ${t.obligatorio}`}>
              <Input id="cambiar-inicio" name="inicio" type="date" required defaultValue={a.inicio} />
            </Campo>
            <Campo id="cambiar-fin" etiqueta={`${t.programa.campoFin} ${t.obligatorio}`}>
              <Input id="cambiar-fin" name="fin" type="date" required defaultValue={a.fin} />
            </Campo>
            <Campo id="cambiar-apertura" etiqueta={t.programa.campoApertura}>
              <Input id="cambiar-apertura" name="reunionApertura" type="date" defaultValue={a.reunionApertura ?? ''} />
            </Campo>
            <Campo id="cambiar-cierre" etiqueta={t.programa.campoCierre}>
              <Input id="cambiar-cierre" name="reunionCierre" type="date" defaultValue={a.reunionCierre ?? ''} />
            </Campo>
            <fieldset className="md:col-span-2">
              <legend className="mb-1 text-sm font-medium text-fg">{`${t.programa.campoNormas} ${t.obligatorio}`}</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {(programa?.normas ?? a.normas).map((n) => (
                  <div key={n} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                    <Checkbox id={`cambiar-norma-${n}`} name="normas" value={n} defaultChecked={a.normas.includes(n)} />
                    <label htmlFor={`cambiar-norma-${n}`} className="text-sm text-fg">
                      {n}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset className="md:col-span-2">
              <legend className="mb-1 text-sm font-medium text-fg">{t.programa.campoProcesos}</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {procesosVigentes.map((x) => (
                  <div key={x.id} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                    <Checkbox id={`cambiar-proceso-${x.id}`} name="procesosIds" value={x.id} defaultChecked={a.procesosIds.includes(x.id)} />
                    <label htmlFor={`cambiar-proceso-${x.id}`} className="text-sm text-fg">
                      {x.codigo} {x.nombre}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
            {a.capitulos.length > 0 && (
              <fieldset className="md:col-span-2">
                <legend className="mb-1 text-sm font-medium text-fg">{pl.alcanceCapitulos}</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {a.capitulos.map((c) => (
                    <div key={`${c.libreriaCodigo}|${c.capitulo}`} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                      <Checkbox id={`cambiar-cap-${c.libreriaCodigo}-${c.capitulo}`} name="capitulos" value={`${c.libreriaCodigo}|${c.capitulo}`} defaultChecked />
                      <label htmlFor={`cambiar-cap-${c.libreriaCodigo}-${c.capitulo}`} className="text-sm text-fg">
                        {c.libreriaCodigo} · {c.capitulo}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="md:col-span-2">
              <Button type="submit">{t.guardar}</Button>
            </div>
          </form>
        </Card>
      )}

      {admin && !inmutable && (
        <>
          <Card className="mb-6" aria-labelledby="reprogramar">
            <CardTitle id="reprogramar">{pl.reprogramarTitulo}</CardTitle>
            <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pl.reprogramarAyuda}</p>
            <form method="post" action={escribir('auditoria_reprogramar')} className="grid max-w-3xl gap-3 md:grid-cols-2">
              <input type="hidden" name="version" value={a.version} />
              <Campo id="repro-inicio" etiqueta={`${t.programa.campoInicio} ${t.obligatorio}`}>
                <Input id="repro-inicio" name="inicio" type="date" required defaultValue={a.inicio} />
              </Campo>
              <Campo id="repro-fin" etiqueta={`${t.programa.campoFin} ${t.obligatorio}`}>
                <Input id="repro-fin" name="fin" type="date" required defaultValue={a.fin} />
              </Campo>
              <Campo id="repro-motivo" etiqueta={`${pl.campoMotivo} ${t.obligatorio}`}>
                <Select id="repro-motivo" name="motivo" required defaultValue="reprogramada">
                  {MOTIVOS_CAMBIO.map((m) => (
                    <option key={m} value={m}>
                      {t.motivosCambio[m]}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo id="repro-nota" etiqueta={pl.campoNota}>
                <Input id="repro-nota" name="nota" maxLength={300} />
              </Campo>
              <div className="md:col-span-2">
                <Button type="submit" variante="secondary">
                  {pl.reprogramar}
                </Button>
              </div>
            </form>
          </Card>
          {(a.estado === 'planificada' || a.estado === 'en_preparacion' || a.estado === 'en_ejecucion') && (
            <Card className="mb-6" aria-labelledby="cancelar">
              <CardTitle id="cancelar">{pl.cancelarTitulo}</CardTitle>
              <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pl.cancelarAyuda}</p>
              <form method="post" action={escribir('auditoria_cancelar')} className="grid max-w-3xl gap-3 md:grid-cols-2">
                <input type="hidden" name="version" value={a.version} />
                <Campo id="cancel-motivo" etiqueta={`${pl.campoMotivo} ${t.obligatorio}`}>
                  <Select id="cancel-motivo" name="motivo" required defaultValue="">
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
                <Campo id="cancel-nota" etiqueta={pl.campoNota}>
                  <Input id="cancel-nota" name="nota" maxLength={300} />
                </Campo>
                <div className="md:col-span-2">
                  <Button type="submit" variante="danger">
                    {pl.cancelar}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </>
      )}

      <p className="text-sm">
        <a className={enlaceClase} href={`${base}/auditorias/${a.id}/ejecucion`}>
          {pl.irEjecucion}
        </a>
        {' · '}
        <a className={enlaceClase} href={`${base}/auditorias/${a.id}/informe`}>
          {pl.irInforme}
        </a>
      </p>
    </MarcoApp>
  );
};
