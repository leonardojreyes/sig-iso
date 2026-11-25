import { Alert, Badge, Button, Card, CardTitle, Checkbox, EstadoVacio, Input, Label, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { FiltrosActivos } from '../activos/filtros';
import { CLASIFICACIONES_ACTIVO, TIPOS_ACTIVO, type ActivoListado } from '../activos/tipos';
import type { Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import type { PersonaDirectorio } from '../documentos/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

export interface PropsActivos {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly activos: readonly ActivoListado[];
  readonly personas: readonly PersonaDirectorio[];
  readonly filtros: FiltrosActivos;
  readonly filtrosInvalidos: boolean;
  readonly aviso?: AvisoEscritura | null;
}

const t = es.activos;
const enlaceClase = 'inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline';
/** Nombre de una persona; una dada de baja o desconocida se dice así, nunca se oculta. */
export const nombreDe = (personas: readonly PersonaDirectorio[], id: string): string => {
  const p = personas.find((x) => x.id === id);
  return p && p.activa ? p.nombre : p ? `${p.nombre} (${t.personaDeBaja})` : t.personaDeBaja;
};

/** Los campos de un activo, para crearlo o cambiarlo. `id` distingue los formularios de la misma página. */
export const CamposActivo = ({ id, personas, valores }: { id: string; personas: readonly PersonaDirectorio[]; valores?: { nombre: string; descripcion: string | null; tipo: string; clasificacion: string; responsableId: string } }) => {
  const activas = personas.filter((p) => p.activa || p.id === valores?.responsableId);
  return (
    <>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label htmlFor={`${id}-nombre`}>{`${t.campoNombre} ${t.obligatorio}`}</Label>
        <Input id={`${id}-nombre`} name="nombre" required maxLength={120} defaultValue={valores?.nombre ?? ''} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-tipo`}>{`${t.campoTipo} ${t.obligatorio}`}</Label>
        <Select id={`${id}-tipo`} name="tipo" required defaultValue={valores?.tipo ?? 'informacion'}>
          {TIPOS_ACTIVO.map((x) => (
            <option key={x} value={x}>
              {t.tipos[x]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-3">
        <Label htmlFor={`${id}-descripcion`}>{t.campoDescripcion}</Label>
        <Textarea id={`${id}-descripcion`} name="descripcion" maxLength={500} defaultValue={valores?.descripcion ?? ''} aria-describedby={`${id}-descripcion-ayuda`} className="min-h-20" />
        <p id={`${id}-descripcion-ayuda`} className="text-sm text-fg-muted">
          {t.campoDescripcionAyuda}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-clasificacion`}>{`${t.campoClasificacion} ${t.obligatorio}`}</Label>
        <Select id={`${id}-clasificacion`} name="clasificacion" required defaultValue={valores?.clasificacion ?? 'interna'}>
          {CLASIFICACIONES_ACTIVO.map((x) => (
            <option key={x} value={x}>
              {t.clasificaciones[x]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-responsable`}>{`${t.campoResponsable} ${t.obligatorio}`}</Label>
        <Select id={`${id}-responsable`} name="responsableId" required defaultValue={valores?.responsableId ?? ''}>
          <option value="" disabled>
            {t.seleccione}
          </option>
          {activas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
};

export const PantallaActivos = ({ empresa, persona, activos, personas, filtros, filtrosInvalidos, aviso = null }: PropsActivos) => {
  const puedeGestionar = persona.roles.includes('administrador_sig');
  const hayFiltros = Object.keys(filtros).length > 0;
  const base = `/e/${empresa.id}/activos`;
  return (
    <MarcoApp empresa={empresa} activo="activos" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-2 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.advertencia}</p>
      <AvisoDeEscritura aviso={aviso} />
      {!puedeGestionar && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      {puedeGestionar && (
        <Card className="mb-6" aria-labelledby="nuevo-activo">
          <CardTitle id="nuevo-activo">{t.nuevo}</CardTitle>
          <form method="post" action={`${base}/crear`} className="grid max-w-3xl gap-3 md:grid-cols-3">
            <CamposActivo id="nuevo" personas={personas} />
            <div className="md:col-span-3">
              <Button type="submit">{t.crear}</Button>
            </div>
          </form>
        </Card>
      )}

      {activos.length === 0 && !hayFiltros ? (
        <EstadoVacio titulo={t.sinActivosTitulo} descripcion={puedeGestionar ? t.sinActivosAdmin : t.sinActivosOtros} />
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
                  {TIPOS_ACTIVO.map((x) => (
                    <option key={x} value={x}>
                      {t.tipos[x]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-clasificacion">{t.campoClasificacion}</Label>
                <Select id="f-clasificacion" name="clasificacion" defaultValue={filtros.clasificacion ?? ''}>
                  <option value="">{t.filtroTodos}</option>
                  {CLASIFICACIONES_ACTIVO.map((x) => (
                    <option key={x} value={x}>
                      {t.clasificaciones[x]}
                    </option>
                  ))}
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
              <div className="flex min-h-[var(--sig-density-target-min)] items-center gap-2 self-end">
                <Checkbox id="f-retirados" name="retirados" value="true" defaultChecked={filtros.retirados === true} />
                <Label htmlFor="f-retirados">{t.filtroRetirados}</Label>
              </div>
              <div className="flex gap-2 md:col-span-4">
                <Button type="submit">{t.aplicar}</Button>
                {hayFiltros && (
                  <a className={enlaceClase} href={base}>
                    {t.limpiar}
                  </a>
                )}
              </div>
            </form>
          </Card>

          <p className="mb-2 text-sm text-fg-muted">{t.resultados(activos.length)}</p>
          <Tabla aria-describedby="activos-desc">
            <caption id="activos-desc" className="sr-only">
              {t.tablaDescripcion}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{t.columnas.activo}</Th>
                <Th scope="col">{t.columnas.responsable}</Th>
                <Th scope="col">{t.columnas.riesgos}</Th>
              </tr>
            </thead>
            <tbody>
              {activos.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <p className="font-medium text-fg">
                      <span className="font-mono text-fg-muted">{a.codigo}</span> · {a.nombre}
                    </p>
                    <p className="mt-1 text-sm text-fg-muted">
                      {t.tipos[a.tipo]} · {t.clasificaciones[a.clasificacion]}
                    </p>
                    <a className={`mt-1 ${enlaceClase}`} href={`${base}/${a.id}`} aria-label={t.verDetalleAria(a.codigo)}>
                      {t.verDetalle}
                    </a>
                  </Td>
                  <Td>{nombreDe(personas, a.responsableId)}</Td>
                  <Td>
                    <p className="text-sm text-fg">{t.riesgosLigados(a.riesgos)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {a.estado === 'retirado' ? <Badge>{t.estadoRetirado}</Badge> : <Badge tono="success">{t.estadoVigente}</Badge>}
                      {a.sinRiesgos && <Badge tono="warning">{t.sinRiesgos}</Badge>}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </>
      )}
    </MarcoApp>
  );
};
