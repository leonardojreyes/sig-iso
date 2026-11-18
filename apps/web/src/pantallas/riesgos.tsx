import { Alert, Badge, Button, Card, CardTitle, Checkbox, EstadoVacio, Input, Label, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { NivelRiesgo, Rol, RiesgoListado } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import type { FiltrosRiesgos } from '../certificacion/filtros-riesgos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

/** Una persona de la empresa que puede responder por un riesgo (solo la ve quien administra). */
export interface OpcionPersona {
  readonly id: string;
  readonly nombre: string;
}

export interface PropsRiesgos {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly riesgos: readonly RiesgoListado[];
  readonly personas: readonly OpcionPersona[];
  readonly filtros: FiltrosRiesgos;
  readonly filtrosInvalidos: boolean;
  readonly aviso?: AvisoEscritura | null;
}

const TONO_NIVEL: Record<NivelRiesgo, 'success' | 'info' | 'warning' | 'danger'> = { bajo: 'success', medio: 'info', alto: 'warning', critico: 'danger' };

/** El nivel SIEMPRE con palabras (nunca solo por color) y con el cálculo que lo explica. */
export const InsigniaNivel = ({ nivel, probabilidad, impacto, puntaje }: { nivel: NivelRiesgo; probabilidad: number; impacto: number; puntaje: number }) => (
  <Badge tono={TONO_NIVEL[nivel]}>{es.riesgos.nivelDetalle(es.riesgos.niveles[nivel], probabilidad, impacto, puntaje)}</Badge>
);

const Opciones15 = () => (
  <>
    {[1, 2, 3, 4, 5].map((n) => (
      <option key={n} value={n}>
        {n}
      </option>
    ))}
  </>
);

/** Los campos de un riesgo, para crearlo o cambiarlo. `id` distingue los formularios de la misma página. */
export const CamposRiesgo = ({ id, personas, valores }: { id: string; personas: readonly OpcionPersona[]; valores?: { titulo: string; descripcion: string | null; probabilidad: number; impacto: number; decision: string; responsableId: string | null } }) => {
  const t = es.riesgos;
  const actual = valores?.responsableId ?? '';
  const hayActual = actual === '' || personas.some((p) => p.id === actual);
  return (
    <>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label htmlFor={`${id}-titulo`}>{t.campoTitulo}</Label>
        <Input id={`${id}-titulo`} name="titulo" required maxLength={120} defaultValue={valores?.titulo ?? ''} />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label htmlFor={`${id}-descripcion`}>{t.descripcion}</Label>
        <Textarea id={`${id}-descripcion`} name="descripcion" maxLength={1000} defaultValue={valores?.descripcion ?? ''} aria-describedby={`${id}-descripcion-ayuda`} className="min-h-20" />
        <p id={`${id}-descripcion-ayuda`} className="text-sm text-fg-muted">
          {t.descripcionAyuda} {t.advertencia}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-probabilidad`}>{t.probabilidad}</Label>
        <Select id={`${id}-probabilidad`} name="probabilidad" required aria-describedby={`${id}-escala`} defaultValue={String(valores?.probabilidad ?? 3)}>
          <Opciones15 />
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-impacto`}>{t.impacto}</Label>
        <Select id={`${id}-impacto`} name="impacto" required aria-describedby={`${id}-escala`} defaultValue={String(valores?.impacto ?? 3)}>
          <Opciones15 />
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-decision`}>{t.decision}</Label>
        <Select id={`${id}-decision`} name="decision" required defaultValue={valores?.decision ?? 'mitigar'}>
          {(Object.keys(t.decisiones) as (keyof typeof t.decisiones)[]).map((d) => (
            <option key={d} value={d}>
              {t.decisiones[d]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-responsable`}>{t.responsable}</Label>
        <Select id={`${id}-responsable`} name="responsableId" defaultValue={actual} aria-describedby={`${id}-responsable-ayuda`}>
          <option value="">{t.sinResponsable}</option>
          {!hayActual && <option value={actual}>{t.sinResponsableAsignado}</option>}
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
        <p id={`${id}-responsable-ayuda`} className="text-sm text-fg-muted">
          {t.responsableAyuda}
        </p>
      </div>
    </>
  );
};

export const PantallaRiesgos = ({ empresa, persona, riesgos, personas, filtros, filtrosInvalidos, aviso = null }: PropsRiesgos) => {
  const t = es.riesgos;
  const puedeGestionar = persona.roles.includes('administrador_sig');
  const hayFiltros = filtros.retirados === true;
  const sinRiesgos = riesgos.length === 0 && !hayFiltros;

  return (
    <MarcoApp empresa={empresa} activo="riesgos" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{t.titulo}</h1>
      <p className="mb-2 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.advertencia}</p>
      <AvisoDeEscritura aviso={aviso} />
      {!puedeGestionar && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      {puedeGestionar && (
        <Card className="mb-6" aria-labelledby="nuevo-riesgo">
          <CardTitle id="nuevo-riesgo">{t.nuevo}</CardTitle>
          <form method="post" action={`/e/${empresa.id}/riesgos/crear`} className="grid max-w-3xl gap-3 md:grid-cols-3">
            {hayFiltros && <input type="hidden" name="f_retirados" value="true" />}
            <CamposRiesgo id="nuevo" personas={personas} />
            <p id="nuevo-escala" className="text-sm text-fg-muted md:col-span-3">{t.escalaAyuda}</p>
            <div className="md:col-span-3">
              <Button type="submit">{t.crear}</Button>
            </div>
          </form>
        </Card>
      )}

      {sinRiesgos ? (
        <EstadoVacio titulo={t.sinRiesgosTitulo} descripcion={puedeGestionar ? t.sinRiesgosAdmin : t.sinRiesgosOtros} />
      ) : (
        <>
          {filtrosInvalidos && (
            <div className="mb-4">
              <Alert anunciar={false} tono="warning" titulo={t.filtrosInvalidos} />
            </div>
          )}
          <Card className="mb-6">
            <form method="get" aria-label={t.filtros} className="flex flex-wrap items-end gap-4">
              <div className="flex min-h-[var(--sig-density-target-min)] items-center gap-2">
                <Checkbox id="retirados" name="retirados" value="true" defaultChecked={hayFiltros} />
                <Label htmlFor="retirados">{t.verRetirados}</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{t.aplicar}</Button>
                {hayFiltros && (
                  <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center px-3 text-sm font-medium text-primary underline" href={`/e/${empresa.id}/riesgos`}>
                    {t.limpiar}
                  </a>
                )}
              </div>
            </form>
          </Card>

          <p className="mb-2 text-sm text-fg-muted">{t.resultados(riesgos.length)}</p>
          <Tabla aria-describedby="riesgos-desc">
            <caption id="riesgos-desc" className="sr-only">
              {t.tablaDescripcion}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{t.columnas.riesgo}</Th>
                <Th scope="col">{t.columnas.nivel}</Th>
                <Th scope="col">{t.columnas.decision}</Th>
                <Th scope="col">{t.columnas.tratamiento}</Th>
              </tr>
            </thead>
            <tbody>
              {riesgos.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <p className="font-medium text-fg">
                      <span className="font-mono text-fg-muted">{r.codigo}</span> · {r.titulo}
                    </p>
                    {r.descripcion && <p className="mt-1 max-w-xl text-sm text-fg-muted">{r.descripcion}</p>}
                    <a className="mt-1 inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline" href={`/e/${empresa.id}/riesgos/${r.id}`} aria-label={t.verDetalleAria(r.codigo)}>
                      {t.verDetalle}
                    </a>
                  </Td>
                  <Td>
                    <InsigniaNivel nivel={r.nivel} probabilidad={r.probabilidad} impacto={r.impacto} puntaje={r.puntaje} />
                  </Td>
                  <Td>{t.decisiones[r.decision]}</Td>
                  <Td>
                    <p className="text-sm text-fg">{t.tratamientoResumen(r.controles, r.tratamientosPrevistos)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.estado === 'retirado' ? <Badge>{t.estadoRetirado}</Badge> : <Badge tono="success">{t.estadoVigente}</Badge>}
                      {r.sinTratamiento && <Badge tono="warning">{t.sinTratamiento}</Badge>}
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
