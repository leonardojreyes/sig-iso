import { Alert, Badge, Button, Card, CardTitle, Checkbox, Input, Label, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import { tamanoLegible } from '../certificacion/formato';
import { CLASIFICACIONES, MOTIVOS_DEVOLUCION, MOTIVOS_REVISION, type DocumentoDetalle, type PersonaDirectorio, type VersionDocumento } from '../documentos/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { dia, InsigniaRevision, nombreDe } from './documentos';
import { MarcoApp } from './marco';

/** Un control de la empresa que se puede ligar al documento. */
export interface OpcionControl {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
}

export interface PropsDocumentoDetalle {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  /** Quién es la persona de la sesión (para saber si es la responsable); nulo si no se pudo saber. */
  readonly personaId: string | null;
  readonly documento: DocumentoDetalle;
  readonly personas: readonly PersonaDirectorio[];
  readonly controles: readonly OpcionControl[];
  readonly aviso?: AvisoEscritura | null;
}

const t = es.documentos;
const enlaceClase = 'inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline';
const ROLES_DISTRIBUCION = ['administrador_sig', 'colaborador'] as const;

const EstadoVersion = ({ v }: { v: VersionDocumento }) => {
  const tono = v.estado === 'aprobada' ? 'success' : v.estado === 'en_revision' ? 'info' : v.estado === 'borrador' ? 'warning' : undefined;
  return <Badge tono={tono}>{t.estadosVersion[v.estado]}</Badge>;
};

export const PantallaDocumentoDetalle = ({ empresa, persona, personaId, documento: d, personas, controles, aviso = null }: PropsDocumentoDetalle) => {
  const esAdmin = persona.roles.includes('administrador_sig');
  const puedeRedactar = esAdmin || persona.roles.includes('colaborador');
  const esResponsable = personaId !== null && personaId === d.responsableId;
  const puedeEditar = d.estado === 'activo' && (esAdmin || esResponsable);
  const base = `/e/${empresa.id}/documentos`;
  const aprobadores = personas.filter((p) => p.puedeAprobar);
  const abierta = d.versiones.some((v) => v.estado === 'borrador' || v.estado === 'en_revision');
  const vigente = d.versiones.find((v) => v.estado === 'aprobada') ?? null;

  return (
    <MarcoApp empresa={empresa} activo="documentos" persona={persona.nombre}>
      <p className="mb-2 text-sm">
        <a className={enlaceClase} href={base}>
          {t.volver}
        </a>
      </p>
      <h1 className="mb-1 text-2xl font-semibold text-fg">
        <span className="font-mono text-fg-muted">{d.codigo}</span> · {d.titulo}
      </h1>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge>{t.tipos[d.tipo]}</Badge>
        <Badge>{t.clasificaciones[d.clasificacion]}</Badge>
        {d.estado === 'retirado' ? <Badge>{t.estadosDocumento.retirado}</Badge> : null}
        {d.sinVigente && <Badge tono="warning">{t.sinVigente}</Badge>}
        <InsigniaRevision d={d} />
      </div>
      <ul className="mb-2 text-sm text-fg-muted">
        <li>{t.responsable(nombreDe(personas, d.responsableId))}</li>
        {d.area && <li>{t.area(d.area)}</li>}
        {(d.emisor || d.edicionFuente) && <li>{t.fuente(d.emisor, d.edicionFuente)}</li>}
        {d.proximaRevision && <li>{t.proximaRevision(d.proximaRevision)}</li>}
        {d.ultimaRevisionEn && <li>{t.ultimaRevision(dia(d.ultimaRevisionEn))}</li>}
      </ul>
      <p className="mb-2 max-w-3xl text-sm text-fg-muted">{t.clasificacionAyuda}</p>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.constanciaLectura}</p>
      <AvisoDeEscritura aviso={aviso} />
      {d.estado === 'retirado' && (
        <div className="mb-4">
          <Alert anunciar={false} tono="info" titulo={t.retirado} />
        </div>
      )}
      {vigente && (
        <p className="mb-4 text-sm text-fg">
          {t.rige(vigente.numero, dia(vigente.aprobadaEn ?? ''))}.{' '}
          <a className={enlaceClase} href={`${base}/versiones/${vigente.id}/descargar`}>
            {t.descargarVigente}
          </a>
        </p>
      )}

      {puedeRedactar && d.estado === 'activo' && !abierta && (
        <Card className="mb-6" aria-labelledby="subir-version">
          <CardTitle id="subir-version">{t.subirTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.subirAyuda}</p>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.advertencia}</p>
          {/* La nota va ANTES del archivo: la API decide antes de leer un solo byte. */}
          <form method="post" action={`${base}/${d.id}/subir`} encType="multipart/form-data" className="grid max-w-3xl gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subir-nota">{`${t.subirNota} ${t.obligatorio}`}</Label>
              <Textarea id="subir-nota" name="nota" required maxLength={500} aria-describedby="subir-nota-ayuda" className="min-h-20" />
              <p id="subir-nota-ayuda" className="text-sm text-fg-muted">
                {t.subirNotaAyuda}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subir-archivo">{`${t.subirArchivo} ${t.obligatorio}`}</Label>
              <Input id="subir-archivo" name="archivo" type="file" required aria-describedby="subir-archivo-ayuda" accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx,.pptx" />
              <p id="subir-archivo-ayuda" className="text-sm text-fg-muted">
                {t.subirArchivoAyuda}
              </p>
            </div>
            <div>
              <Button type="submit">{t.subir}</Button>
            </div>
          </form>
        </Card>
      )}
      {abierta && d.estado === 'activo' && <p className="mb-4 text-sm text-fg-muted">{t.versionAbierta}</p>}

      <h2 className="mb-2 text-xl font-semibold text-fg">{t.versiones}</h2>
      <Tabla aria-describedby="versiones-desc">
        <caption id="versiones-desc" className="sr-only">
          {t.versionesDescripcion}
        </caption>
        <thead>
          <tr>
            <Th scope="col">{t.columnasVersion.version}</Th>
            <Th scope="col">{t.columnasVersion.estado}</Th>
            <Th scope="col">{t.columnasVersion.quien}</Th>
            <Th scope="col">{t.columnasVersion.nota}</Th>
            <Th scope="col">{t.columnasVersion.acciones}</Th>
          </tr>
        </thead>
        <tbody>
          {d.versiones.map((v) => (
            <tr key={v.id}>
              <Td>
                <p className="font-medium text-fg">{t.versionN(v.numero)}</p>
                <p className="text-sm text-fg-muted">{tamanoLegible(v.archivo.bytes)}</p>
                <p className="font-mono text-xs text-fg-muted">{t.huella(v.archivo.sha256)}</p>
              </Td>
              <Td>
                <EstadoVersion v={v} />
                {v.estado !== 'aprobada' && v.estado !== 'descartada' && <p className="mt-1 text-sm text-fg-muted">{t.noVigente}</p>}
                {v.lecturas && <p className="mt-1 text-sm text-fg">{t.lecturasDe(v.lecturas.confirmadas, v.lecturas.total)}</p>}
                {v.elegibleParaDisposicion && (
                  <div className="mt-1">
                    <Badge tono="warning">{t.elegible}</Badge>
                  </div>
                )}
              </Td>
              <Td>
                <p className="text-sm text-fg">{t.redactadaPor(nombreDe(personas, v.autorId))}</p>
                {v.aprobadaPor && v.aprobadaEn && <p className="text-sm text-fg">{t.aprobadaPor(nombreDe(personas, v.aprobadaPor), dia(v.aprobadaEn))}</p>}
                {v.porSuAutor && (
                  <p className="mt-1 text-sm text-fg">
                    <Badge tono="warning">{t.porSuAutor}</Badge>
                    {v.motivoExcepcion && <span className="block text-fg-muted">{`${t.motivoExcepcionDe}: ${v.motivoExcepcion}`}</span>}
                  </p>
                )}
                {v.devueltaMotivo && (
                  <p className="mt-1 text-sm text-fg-muted">
                    {t.devueltaCon(t.devolverMotivos[v.devueltaMotivo])}
                    {v.devueltaNota ? ` — ${v.devueltaNota}` : ''}
                  </p>
                )}
              </Td>
              <Td>
                <p className="max-w-md text-sm text-fg">{v.nota}</p>
              </Td>
              <Td>
                {v.estado !== 'descartada' && (
                  <a className={enlaceClase} href={`${base}/versiones/${v.id}/descargar`} aria-label={t.descargarAria(v.numero)}>
                    {t.descargar}
                  </a>
                )}
                {v.estado !== 'aprobada' && v.estado !== 'descartada' && <p className="text-xs text-fg-muted">{t.noVigenteAyuda}</p>}

                {v.estado === 'borrador' && puedeRedactar && d.estado === 'activo' && (
                  <div className="mt-3 flex flex-col gap-3">
                    <form method="post" action={`${base}/versiones/${v.id}/enviar`} className="flex flex-col gap-1.5">
                      <input type="hidden" name="documento" value={d.id} />
                      <Label htmlFor={`env-${v.id}`}>{t.enviarAprobador}</Label>
                      <Select id={`env-${v.id}`} name="aprobadorId" required defaultValue="" aria-describedby={`env-${v.id}-ayuda`}>
                        <option value="" disabled>
                          {t.seleccione}
                        </option>
                        {aprobadores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </Select>
                      <p id={`env-${v.id}-ayuda`} className="text-xs text-fg-muted">
                        {t.enviarAyuda}
                      </p>
                      <Button type="submit" aria-label={`${t.enviar}: ${t.versionN(v.numero)}`}>
                        {t.enviar}
                      </Button>
                    </form>
                    <form method="post" action={`${base}/versiones/${v.id}/descartar`}>
                      <input type="hidden" name="documento" value={d.id} />
                      <Button type="submit" variante="secondary" aria-label={`${t.descartar}: ${t.versionN(v.numero)}`}>
                        {t.descartar}
                      </Button>
                    </form>
                  </div>
                )}

                {v.estado === 'en_revision' && esAdmin && d.estado === 'activo' && (
                  <div className="mt-3 flex flex-col gap-4">
                    <form method="post" action={`${base}/versiones/${v.id}/aprobar`} className="flex flex-col gap-1.5" aria-label={`${t.aprobarTitulo}: ${t.versionN(v.numero)}`}>
                      <input type="hidden" name="documento" value={d.id} />
                      <p className="text-xs text-fg-muted">{t.aprobarAyuda}</p>
                      <Label htmlFor={`apr-rev-${v.id}`}>{t.aprobarRevision}</Label>
                      <Input id={`apr-rev-${v.id}`} name="proximaRevision" type="date" />
                      <div className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                        <Checkbox id={`apr-lec-${v.id}`} name="requiereLectura" />
                        <Label htmlFor={`apr-lec-${v.id}`}>{t.aprobarRequiereLectura}</Label>
                      </div>
                      {d.unicoAdministrador && v.aprobadorId !== null && v.autorId === v.aprobadorId && (
                        <>
                          <Label htmlFor={`apr-exc-${v.id}`}>{t.aprobarExcepcion}</Label>
                          <Textarea id={`apr-exc-${v.id}`} name="motivoExcepcion" required maxLength={300} className="min-h-16" />
                        </>
                      )}
                      <Button type="submit" aria-label={`${t.aprobar}: ${t.versionN(v.numero)}`}>
                        {t.aprobar}
                      </Button>
                    </form>
                    <form method="post" action={`${base}/versiones/${v.id}/devolver`} className="flex flex-col gap-1.5" aria-label={`${t.devolverTitulo}: ${t.versionN(v.numero)}`}>
                      <input type="hidden" name="documento" value={d.id} />
                      <Label htmlFor={`dev-mot-${v.id}`}>{t.devolverMotivo}</Label>
                      <Select id={`dev-mot-${v.id}`} name="motivo" required defaultValue="incompleta">
                        {MOTIVOS_DEVOLUCION.map((m) => (
                          <option key={m} value={m}>
                            {t.devolverMotivos[m]}
                          </option>
                        ))}
                      </Select>
                      <Label htmlFor={`dev-nota-${v.id}`}>{t.devolverNota}</Label>
                      <Input id={`dev-nota-${v.id}`} name="nota" maxLength={300} />
                      <Button type="submit" variante="secondary" aria-label={`${t.devolver}: ${t.versionN(v.numero)}`}>
                        {t.devolver}
                      </Button>
                    </form>
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabla>
      {d.retencion === null && d.versiones.some((v) => v.estado === 'obsoleta') && <p className="mt-2 text-sm text-fg-muted">{t.retencionNoDefinida}</p>}

      {puedeEditar && vigente && (
        <Card className="mt-8" aria-labelledby="revisar-doc">
          <CardTitle id="revisar-doc">{t.revisionTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.revisionAyuda}</p>
          <form method="post" action={`${base}/${d.id}/revisar`} className="grid max-w-3xl gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rev-motivo">{t.revisionMotivo}</Label>
              <Select id="rev-motivo" name="motivo" defaultValue="">
                <option value="">{t.revisionSinMotivo}</option>
                {MOTIVOS_REVISION.map((m) => (
                  <option key={m} value={m}>
                    {t.revisionMotivos[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rev-fecha">{t.revisionFecha}</Label>
              <Input id="rev-fecha" name="proximaRevision" type="date" />
            </div>
            <div className="flex items-end">
              <Button type="submit">{t.revisionRegistrar}</Button>
            </div>
          </form>
        </Card>
      )}

      {puedeEditar && (
        <Card className="mt-8" aria-labelledby="editar-doc">
          <CardTitle id="editar-doc">{t.editar}</CardTitle>
          <form method="post" action={`${base}/${d.id}/cambiar`} className="grid max-w-3xl gap-3 md:grid-cols-2">
            <input type="hidden" name="version" value={d.version} />
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="ed-titulo">{t.campoTitulo}</Label>
              <Input id="ed-titulo" name="titulo" required maxLength={120} defaultValue={d.titulo} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ed-clasificacion">{t.campoClasificacion}</Label>
              <Select id="ed-clasificacion" name="clasificacion" required defaultValue={d.clasificacion}>
                {CLASIFICACIONES.map((c) => (
                  <option key={c} value={c}>
                    {t.clasificaciones[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ed-area">{t.campoArea}</Label>
              <Input id="ed-area" name="area" maxLength={60} defaultValue={d.area ?? ''} />
            </div>
            {esAdmin && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ed-responsable">{t.campoResponsable}</Label>
                <Select id="ed-responsable" name="responsableId" defaultValue={d.responsableId}>
                  {personas
                    .filter((p) => p.activa || p.id === d.responsableId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </Select>
              </div>
            )}
            {d.tipo === 'externo' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ed-emisor">{t.campoEmisor}</Label>
                  <Input id="ed-emisor" name="emisor" maxLength={120} defaultValue={d.emisor ?? ''} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ed-edicion">{t.campoEdicion}</Label>
                  <Input id="ed-edicion" name="edicionFuente" maxLength={60} defaultValue={d.edicionFuente ?? ''} />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <Button type="submit">{t.guardar}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mt-8" aria-labelledby="distribucion">
        <CardTitle id="distribucion">{t.distribucion}</CardTitle>
        <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.distribucionAyuda}</p>
        {esAdmin && d.estado === 'activo' ? (
          <form method="post" action={`${base}/${d.id}/distribuir`} className="grid max-w-3xl gap-3">
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium text-fg">{t.distribucionRoles}</legend>
              {ROLES_DISTRIBUCION.map((r) => (
                <div key={r} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                  <Checkbox id={`rol-${r}`} name="roles" value={r} />
                  <Label htmlFor={`rol-${r}`}>{t.roles[r]}</Label>
                </div>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium text-fg">{t.distribucionPersonas}</legend>
              {personas
                .filter((p) => p.activa)
                .map((p) => (
                  <div key={p.id} className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                    <Checkbox id={`per-${p.id}`} name="usuarioIds" value={p.id} defaultChecked={d.destinatarios.includes(p.id)} />
                    <Label htmlFor={`per-${p.id}`}>{p.nombre}</Label>
                  </div>
                ))}
            </fieldset>
            <div>
              <Button type="submit">{t.distribucionGuardar}</Button>
            </div>
          </form>
        ) : d.destinatarios.length === 0 ? (
          <p className="text-sm text-fg-muted">{t.sinDestinatarios}</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-fg">
            {d.destinatarios.map((id) => (
              <li key={id}>{nombreDe(personas, id)}</li>
            ))}
          </ul>
        )}
        {esAdmin && d.destinatarios.length === 0 && <p className="mt-2 text-sm text-fg-muted">{t.sinDestinatarios}</p>}
      </Card>

      <Card className="mt-8" aria-labelledby="vinculos">
        <CardTitle id="vinculos">{t.vinculos}</CardTitle>
        <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.vinculosAyuda}</p>
        {d.controles.length === 0 && d.entradas.length === 0 && <p className="mb-3 text-sm text-fg-muted">{t.sinVinculos}</p>}
        <ul className="mb-3 flex flex-col gap-2">
          {d.entradas.map((e) => (
            <li key={`${e.libreriaCodigo}|${e.idEstable}`} className="flex flex-wrap items-center gap-3 text-sm text-fg">
              <span className="font-mono">{`${e.libreriaCodigo} · ${e.idEstable}`}</span>
              {esAdmin && (
                <form method="post" action={`${base}/${d.id}/desvincular`}>
                  <input type="hidden" name="libreriaCodigo" value={e.libreriaCodigo} />
                  <input type="hidden" name="idEstable" value={e.idEstable} />
                  <Button type="submit" variante="secondary" aria-label={`${t.quitar}: ${e.idEstable}`}>
                    {t.quitar}
                  </Button>
                </form>
              )}
            </li>
          ))}
          {d.controles.map((id) => {
            const c = controles.find((x) => x.id === id);
            return (
              <li key={id} className="flex flex-wrap items-center gap-3 text-sm text-fg">
                <span>{c ? `${c.codigo} · ${c.nombre}` : id}</span>
                {esAdmin && (
                  <form method="post" action={`${base}/${d.id}/desvincular`}>
                    <input type="hidden" name="controlId" value={id} />
                    <Button type="submit" variante="secondary" aria-label={`${t.quitar}: ${c?.codigo ?? id}`}>
                      {t.quitar}
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        {esAdmin && d.estado === 'activo' && (
          <div className="grid max-w-3xl gap-4 md:grid-cols-2">
            <form method="post" action={`${base}/${d.id}/vincular`} className="grid gap-2" aria-label={t.vincularEntrada}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vin-lib">{t.vinculoLibreria}</Label>
                <Input id="vin-lib" name="libreriaCodigo" required maxLength={64} pattern="[a-z0-9][a-z0-9\-]*" aria-describedby="vin-formato" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vin-id">{t.vinculoId}</Label>
                <Input id="vin-id" name="idEstable" required maxLength={41} pattern="[a-z0-9][a-z0-9.\-]*" aria-describedby="vin-formato" />
              <p id="vin-formato" className="text-sm text-fg-muted">
                {t.vinculoFormato}
              </p>
              </div>
              <div>
                <Button type="submit" aria-label={t.vincularEntrada}>{t.vincular}</Button>
              </div>
            </form>
            {controles.length > 0 && (
              <form method="post" action={`${base}/${d.id}/vincular`} className="grid gap-2" aria-label={t.vincularControl}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vin-control">{t.vinculoControl}</Label>
                  <Select id="vin-control" name="controlId" required defaultValue="">
                    <option value="" disabled>
                      {t.seleccione}
                    </option>
                    {controles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${c.codigo} · ${c.nombre}`}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Button type="submit" aria-label={t.vincularControl}>{t.vincular}</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>

      {esAdmin && d.estado === 'activo' && (
        <Card className="mt-8" aria-labelledby="retirar-doc">
          <CardTitle id="retirar-doc">{t.retirarTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.retirarAyuda}</p>
          <form method="post" action={`${base}/${d.id}/retirar`}>
            <Button type="submit" variante="secondary">
              {t.retirar}
            </Button>
          </form>
        </Card>
      )}
    </MarcoApp>
  );
};
