import { Alert, Badge, Button, Card, CardTitle, Checkbox, EstadoVacio, Input, Label, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import { CLASIFICACIONES, TIPOS_DOCUMENTO, type Documento, type LecturaPendiente, type PersonaDirectorio, type Retencion } from '../documentos/tipos';
import type { FiltrosDocumentos } from '../documentos/filtros';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

export interface PropsDocumentos {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly documentos: readonly Documento[];
  readonly personas: readonly PersonaDirectorio[];
  readonly pendientes: readonly LecturaPendiente[];
  readonly retenciones: readonly Retencion[];
  readonly filtros: FiltrosDocumentos;
  readonly filtrosInvalidos: boolean;
  readonly aviso?: AvisoEscritura | null;
}

const t = es.documentos;
export const nombreDe = (personas: readonly PersonaDirectorio[], id: string): string => {
  const p = personas.find((x) => x.id === id);
  return p && p.activa ? p.nombre : p ? `${p.nombre} (${t.personaDeBaja.toLowerCase()})` : t.personaDeBaja;
};
export const dia = (iso: string): string => iso.slice(0, 10);
const enlaceClase = 'inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline';

/** Insignia de revisión: siempre con palabras, nunca solo por color. */
export const InsigniaRevision = ({ d }: { d: Documento }) => {
  if (d.revision === null) return null;
  const tono = d.revision === 'vencida' ? 'danger' : d.revision === 'por_vencer' ? 'warning' : 'success';
  return <Badge tono={tono}>{t.revision[d.revision]}</Badge>;
};

/** Los campos de un documento nuevo. `id` distingue los formularios de la misma página. */
const CamposNuevo = ({ personas }: { personas: readonly PersonaDirectorio[] }) => (
  <>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="nuevo-tipo">{t.campoTipo}</Label>
      <Select id="nuevo-tipo" name="tipo" required defaultValue="politica">
        {TIPOS_DOCUMENTO.map((x) => (
          <option key={x} value={x}>
            {t.tipos[x]}
          </option>
        ))}
      </Select>
    </div>
    <div className="flex flex-col gap-1.5 md:col-span-2">
      <Label htmlFor="nuevo-titulo">{t.campoTitulo}</Label>
      <Input id="nuevo-titulo" name="titulo" required maxLength={120} />
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="nuevo-clasificacion">{t.campoClasificacion}</Label>
      <Select id="nuevo-clasificacion" name="clasificacion" required defaultValue="interna" aria-describedby="nuevo-clasificacion-ayuda">
        {CLASIFICACIONES.map((x) => (
          <option key={x} value={x}>
            {t.clasificaciones[x]}
          </option>
        ))}
      </Select>
      <p id="nuevo-clasificacion-ayuda" className="text-sm text-fg-muted">
        {t.clasificacionAyuda}
      </p>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="nuevo-responsable">{t.campoResponsable}</Label>
      <Select id="nuevo-responsable" name="responsableId" required defaultValue="">
        <option value="" disabled>
          —
        </option>
        {personas
          .filter((p) => p.activa)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
      </Select>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="nuevo-area">{t.campoArea}</Label>
      <Input id="nuevo-area" name="area" maxLength={60} aria-describedby="nuevo-area-ayuda" />
      <p id="nuevo-area-ayuda" className="text-sm text-fg-muted">
        {t.campoAreaAyuda}
      </p>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="nuevo-emisor">{t.campoEmisor}</Label>
      <Input id="nuevo-emisor" name="emisor" maxLength={120} aria-describedby="nuevo-externo-ayuda" />
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="nuevo-edicion">{t.campoEdicion}</Label>
      <Input id="nuevo-edicion" name="edicionFuente" maxLength={60} aria-describedby="nuevo-externo-ayuda" />
    </div>
    <p id="nuevo-externo-ayuda" className="text-sm text-fg-muted md:col-span-3">
      {t.soloExterno}
    </p>
  </>
);

export const PantallaDocumentos = ({ empresa, persona, documentos, personas, pendientes, retenciones, filtros, filtrosInvalidos, aviso = null }: PropsDocumentos) => {
  const esAdmin = persona.roles.includes('administrador_sig');
  const puedeRedactar = esAdmin || persona.roles.includes('colaborador');
  const hayFiltros = Object.keys(filtros).length > 0;
  const sinDocumentos = documentos.length === 0 && !hayFiltros;
  const base = `/e/${empresa.id}/documentos`;

  return (
    <MarcoApp empresa={empresa} activo="documentos" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-2 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <p className="mb-2 max-w-3xl text-sm text-fg-muted">{t.advertencia}</p>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.constanciaLectura}</p>
      <AvisoDeEscritura aviso={aviso} />
      {!esAdmin && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}
      <p className="mb-4 text-sm">
        <a className={enlaceClase} href={`${base}/cobertura`}>
          {t.coberturaEnlace}
        </a>
      </p>

      {pendientes.length > 0 && (
        <Card className="mb-6" aria-labelledby="mis-lecturas">
          <CardTitle id="mis-lecturas">{t.misLecturas}</CardTitle>
          <p className="mb-3 text-sm text-fg-muted">{t.misLecturasAyuda}</p>
          <ul className="flex flex-col gap-3">
            {pendientes.map((p) => (
              <li key={p.versionId} className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-fg">
                  <span className="font-mono text-fg-muted">{p.codigo}</span> · {p.titulo} · {t.versionN(p.numeroVersion)}
                </span>
                <a className={enlaceClase} href={`${base}/versiones/${p.versionId}/descargar`} aria-label={t.leerVersion(p.codigo, p.numeroVersion)}>
                  {t.descargar}
                </a>
                <form method="post" action={`${base}/versiones/${p.versionId}/confirmar`}>
                  <Button type="submit" aria-label={t.confirmarAria(p.codigo, p.numeroVersion)}>
                    {t.confirmarLectura}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {puedeRedactar && (
        <Card className="mb-6" aria-labelledby="nuevo-documento">
          <CardTitle id="nuevo-documento">{t.nuevo}</CardTitle>
          <form method="post" action={`${base}/crear`} className="grid max-w-3xl gap-3 md:grid-cols-3">
            <CamposNuevo personas={personas} />
            <div className="md:col-span-3">
              <Button type="submit">{t.crear}</Button>
            </div>
          </form>
        </Card>
      )}

      {sinDocumentos ? (
        <EstadoVacio titulo={t.sinDocumentosTitulo} descripcion={puedeRedactar ? t.sinDocumentos : t.sinDocumentosOtros} />
      ) : (
        <>
          {filtrosInvalidos && (
            <div className="mb-4">
              <Alert anunciar={false} tono="warning" titulo={t.filtrosInvalidos} />
            </div>
          )}
          <Card className="mb-6">
            <form method="get" aria-label={t.filtros} className="grid gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-tipo">{t.campoTipo}</Label>
                <Select id="f-tipo" name="tipo" defaultValue={filtros.tipo ?? ''}>
                  <option value="">{t.filtroTodos}</option>
                  {TIPOS_DOCUMENTO.map((x) => (
                    <option key={x} value={x}>
                      {t.tipos[x]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-estado">{t.columnas.documento}</Label>
                <Select id="f-estado" name="estado" defaultValue={filtros.estado ?? ''}>
                  <option value="">{t.filtroTodos}</option>
                  <option value="activo">{t.estadosDocumento.activo}</option>
                  <option value="retirado">{t.estadosDocumento.retirado}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-responsable">{t.campoResponsable}</Label>
                <Select id="f-responsable" name="responsable" defaultValue={filtros.responsableId ?? ''}>
                  <option value="">{t.filtroTodos}</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-area">{t.filtroArea}</Label>
                <Input id="f-area" name="area" maxLength={60} defaultValue={filtros.area ?? ''} />
              </div>
              <div className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                <Checkbox id="f-sin" name="sinVigente" value="true" defaultChecked={filtros.sinVigente === true} />
                <Label htmlFor="f-sin">{t.filtroSinVigente}</Label>
              </div>
              <div className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                <Checkbox id="f-venc" name="revisionVencida" value="true" defaultChecked={filtros.revisionVencida === true} />
                <Label htmlFor="f-venc">{t.filtroVencidos}</Label>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">{t.aplicar}</Button>
                {hayFiltros && (
                  <a className={enlaceClase} href={base}>
                    {t.limpiar}
                  </a>
                )}
              </div>
            </form>
          </Card>

          <p className="mb-2 text-sm text-fg-muted">{t.resultados(documentos.length)}</p>
          <Tabla aria-describedby="documentos-desc">
            <caption id="documentos-desc" className="sr-only">
              {t.tablaDescripcion}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{t.columnas.documento}</Th>
                <Th scope="col">{t.columnas.vigente}</Th>
                <Th scope="col">{t.columnas.revision}</Th>
                <Th scope="col">{t.columnas.lecturas}</Th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <p className="font-medium text-fg">
                      <span className="font-mono text-fg-muted">{d.codigo}</span> · {d.titulo}
                    </p>
                    <p className="mt-1 text-sm text-fg-muted">
                      {t.tipos[d.tipo]} · {t.clasificaciones[d.clasificacion]}
                      {d.area ? ` · ${d.area}` : ''}
                    </p>
                    <a className={`mt-1 ${enlaceClase}`} href={`${base}/${d.id}`} aria-label={t.verDetalleAria(d.codigo)}>
                      {t.verDetalle}
                    </a>
                  </Td>
                  <Td>
                    {d.vigente ? <span className="text-sm text-fg">{t.rige(d.vigente.numero, dia(d.vigente.aprobadaEn))}</span> : null}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {d.estado === 'retirado' && <Badge>{t.estadosDocumento.retirado}</Badge>}
                      {d.sinVigente && <Badge tono="warning">{t.sinVigente}</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <InsigniaRevision d={d} />
                    {d.proximaRevision && <p className="mt-1 text-sm text-fg-muted">{t.proximaRevision(d.proximaRevision)}</p>}
                  </Td>
                  <Td>
                    {d.lecturas ? <span className="text-sm text-fg">{t.lecturasDe(d.lecturas.confirmadas, d.lecturas.total)}</span> : <span className="text-sm text-fg-muted">{t.sinLecturas}</span>}
                    {d.lecturaPendiente && (
                      <div className="mt-1">
                        <Badge tono="warning">{t.lecturaPendiente}</Badge>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </>
      )}

      {esAdmin && (
        <Card className="mt-8" aria-labelledby="retencion">
          <CardTitle id="retencion">{t.retencion}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.retencionAyuda}</p>
          <ul className="flex flex-col gap-3">
            {TIPOS_DOCUMENTO.map((tipo) => {
              const r = retenciones.find((x) => x.tipo === tipo);
              return (
                <li key={tipo}>
                  <form method="post" action={`${base}/retencion`} className="grid items-end gap-3 md:grid-cols-[10rem_6rem_1fr_auto]">
                    <input type="hidden" name="tipo" value={tipo} />
                    {r && <input type="hidden" name="version" value={r.version} />}
                    <p className="font-medium text-fg">{t.tipos[tipo]}</p>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`ret-${tipo}-anios`}>{t.retencionAnios}</Label>
                      <Input id={`ret-${tipo}-anios`} name="anios" type="number" min={1} max={100} required defaultValue={r?.anios ?? ''} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`ret-${tipo}-motivo`}>{t.retencionMotivo}</Label>
                      <Textarea id={`ret-${tipo}-motivo`} name="motivo" required maxLength={200} defaultValue={r?.motivo ?? ''} className="min-h-10" />
                    </div>
                    <Button type="submit" aria-label={`${t.retencionGuardar}: ${t.tipos[tipo]}`}>
                      {t.retencionGuardar}
                    </Button>
                    {!r && <p className="text-sm text-fg-muted md:col-span-4">{t.retencionSin}</p>}
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </MarcoApp>
  );
};
