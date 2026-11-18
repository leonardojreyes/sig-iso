import { Badge, Button, Card, CardTitle, Input, Label, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { FilaDeclaracion, JustificacionBorrador, JustificacionVersion, MotivoDeclaracion, NivelRiesgo, ReferenciaDeclaracion, TipoMotivo, TipoReferencia, ViaRiesgo } from '../api/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';

// Lo que justifica la Declaración (ADR 037): el motivo de inclusión de cada control, las referencias al tratamiento de riesgos y, en una
// versión aprobada, lo que se congeló. Todo sale de la API; aquí solo se muestra y se piden cambios (la API decide).
const t = es.declaracion;

export interface RiesgoDeFilaVista {
  readonly codigo: string;
  readonly titulo: string;
  readonly nivel: NivelRiesgo;
  readonly via: ViaRiesgo;
}
/** El motivo de inclusión de una fila que aplica: los motivos registrados y los riesgos que la tratan (derivado). */
export interface JustificacionDeFila {
  readonly motivos: readonly { readonly tipo: TipoMotivo; readonly nota: string }[];
  readonly riesgos: readonly RiesgoDeFilaVista[];
  readonly sinMotivo: boolean;
}
export type JustificacionPorFila = ReadonlyMap<string, JustificacionDeFila>;

const claveDe = (f: { libreriaCodigo: string; idEstable: string }): string => `${f.libreriaCodigo}|${f.idEstable}`;

/** Del borrador: lo derivado hoy. */
export const justificacionDelBorrador = (j: JustificacionBorrador): JustificacionPorFila =>
  new Map(j.filas.map((f) => [claveDe(f), { motivos: f.motivos, riesgos: f.riesgos, sinMotivo: f.sinMotivo }]));

/** De una versión aprobada: lo que se congeló (nunca lo que haya hoy). */
export const justificacionDeLaVersion = (j: JustificacionVersion, filas: readonly FilaDeclaracion[]): JustificacionPorFila => {
  const riesgo = new Map(j.riesgos.map((r) => [r.codigo, r]));
  return new Map(
    filas.map((f) => {
      const k = claveDe(f);
      const motivos = j.motivos.filter((m) => claveDe(m) === k).map((m) => ({ tipo: m.tipo, nota: m.nota }));
      const riesgos = j.riesgosPorFila
        .filter((x) => claveDe(x) === k)
        .flatMap((x) => {
          const r = riesgo.get(x.riesgoCodigo);
          return r ? [{ codigo: r.codigo, titulo: r.titulo, nivel: r.nivel, via: x.via }] : [];
        });
      return [k, { motivos, riesgos, sinMotivo: false }] as const;
    }),
  );
};

/** La celda «Motivo de inclusión» de una fila: lo derivado (riesgos) y lo registrado, o «Sin motivo». Una fila que no aplica no lo pide. */
export const CeldaMotivo = ({ fila, justificacion }: { fila: FilaDeclaracion; justificacion: JustificacionDeFila | undefined }) => {
  if (fila.aplicabilidad !== 'aplica' || !justificacion) return null;
  if (justificacion.sinMotivo) return <Badge tono="warning">{t.sinMotivo}</Badge>;
  return (
    <ul aria-label={t.columnasMotivo} className="flex flex-col gap-1.5 text-sm">
      {justificacion.riesgos.map((r) => (
        <li key={r.codigo} className="text-fg">
          <span className="font-medium">{t.motivoRiesgo}:</span>{' '}
          {t.motivoRiesgoDetalle(r.codigo, r.titulo, t.niveles[r.nivel], r.via === 'control' ? t.viaControl : t.viaPrevisto)}
        </li>
      ))}
      {justificacion.motivos.map((m) => (
        <li key={m.tipo} className="text-fg">
          <span className="font-medium">{t.tiposMotivo[m.tipo]}:</span> {m.nota}
        </li>
      ))}
    </ul>
  );
};

const TIPOS: readonly TipoMotivo[] = ['legal', 'contractual', 'negocio', 'otro'];

/** Para el administrador: agregar, cambiar o quitar los motivos registrados de una fila que aplica. La API decide (409 si otra persona lo cambió). */
export const EditorMotivos = ({ empresa, fila, motivos }: { empresa: Empresa; fila: FilaDeclaracion; motivos: readonly MotivoDeclaracion[] }) => {
  const propios = motivos.filter((m) => m.libreriaCodigo === fila.libreriaCodigo && m.idEstable === fila.idEstable);
  const libres = TIPOS.filter((tipo) => !propios.some((m) => m.tipo === tipo));
  const entrada = `${fila.libreriaCodigo}|${fila.idEstable}`;
  const id = `motivo-${fila.idEstable}`;
  const base = `/e/${empresa.id}/declaracion/motivo`;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-medium text-primary" aria-label={t.motivosEditarAria(fila.idEstable)}>
        {t.motivosEditar}
      </summary>
      <div className="mt-3 flex max-w-xl flex-col gap-4">
        {propios.map((m) => (
          <div key={m.tipo} className="flex flex-col gap-2">
            <form method="post" action={`${base}/guardar`} className="flex flex-col gap-2">
              <input type="hidden" name="entrada" value={entrada} />
              <input type="hidden" name="tipo" value={m.tipo} />
              <input type="hidden" name="version" value={m.version} />
              <Label htmlFor={`${id}-${m.tipo}`}>
                {t.motivoNota} · {t.tiposMotivo[m.tipo]}
              </Label>
              <Textarea id={`${id}-${m.tipo}`} name="nota" required maxLength={500} defaultValue={m.nota} className="min-h-16" />
              <div>
                <Button type="submit" variante="secondary" aria-label={t.motivoGuardarAria(t.tiposMotivo[m.tipo], fila.idEstable)}>
                  {t.motivoGuardar}
                </Button>
              </div>
            </form>
            <form method="post" action={`${base}/quitar`}>
              <input type="hidden" name="entrada" value={entrada} />
              <input type="hidden" name="tipo" value={m.tipo} />
              <input type="hidden" name="version" value={m.version} />
              <Button type="submit" variante="ghost" aria-label={t.motivoQuitarAria(t.tiposMotivo[m.tipo], fila.idEstable)}>
                {t.motivoQuitar}
              </Button>
            </form>
          </div>
        ))}
        {libres.length === 0 ? (
          <p className="text-sm text-fg-muted">{t.motivosCompletos}</p>
        ) : (
          <form method="post" action={`${base}/guardar`} className="flex flex-col gap-2">
            <input type="hidden" name="entrada" value={entrada} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-nuevo-tipo`}>{t.motivoTipo}</Label>
              <Select id={`${id}-nuevo-tipo`} name="tipo" required defaultValue={libres[0]}>
                {libres.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {t.tiposMotivo[tipo]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-nuevo-nota`}>{t.motivoNota}</Label>
              <Textarea id={`${id}-nuevo-nota`} name="nota" required maxLength={500} aria-describedby={`${id}-nuevo-ayuda`} className="min-h-16" />
              <p id={`${id}-nuevo-ayuda`} className="text-sm text-fg-muted">
                {t.motivoNotaAyuda}
              </p>
            </div>
            <div>
              <Button type="submit" variante="secondary">
                {t.motivoAgregar}
              </Button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
};

const TIPOS_REFERENCIA: readonly TipoReferencia[] = ['analisis', 'plan'];

/** Las dos referencias opcionales al tratamiento de riesgos: el administrador las registra, cambia o quita; los demás las consultan. */
export const SeccionReferencias = ({ empresa, referencias, puedeGestionar }: { empresa: Empresa; referencias: readonly ReferenciaDeclaracion[]; puedeGestionar: boolean }) => {
  const base = `/e/${empresa.id}/declaracion/referencia`;
  return (
    <Card className="mb-6" aria-labelledby="declaracion-referencias">
      <CardTitle id="declaracion-referencias">{t.referenciasTitulo}</CardTitle>
      <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.referenciasAyuda}</p>
      {!puedeGestionar && <p className="mb-3 text-sm text-fg-muted">{t.soloLecturaJustificacion}</p>}
      <div className="flex flex-col gap-4">
        {TIPOS_REFERENCIA.map((tipo) => {
          const r = referencias.find((x) => x.tipo === tipo);
          const etiqueta = t.tiposReferencia[tipo];
          return (
            <section key={tipo} aria-labelledby={`ref-${tipo}`}>
              <h3 id={`ref-${tipo}`} className="text-sm font-semibold text-fg">
                {etiqueta}
              </h3>
              <p className="text-sm text-fg">{r ? t.referenciaDetalle(r.titulo, r.versionDoc, r.fecha, r.ubicacion) : <span className="text-fg-muted">{t.referenciaNoRegistrada}</span>}</p>
              {puedeGestionar && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-primary" aria-label={t.referenciaEditarAria(etiqueta)}>
                    {t.referenciaEditar}
                  </summary>
                  <div className="mt-3 flex flex-col gap-3">
                    <form method="post" action={`${base}/guardar`} className="grid max-w-3xl gap-3 md:grid-cols-2">
                      <input type="hidden" name="tipo" value={tipo} />
                      {r && <input type="hidden" name="version" value={r.version} />}
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <Label htmlFor={`ref-${tipo}-titulo`}>{t.referenciaTitulo}</Label>
                        <Input id={`ref-${tipo}-titulo`} name="titulo" required maxLength={120} defaultValue={r?.titulo ?? ''} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`ref-${tipo}-version`}>{t.referenciaVersion}</Label>
                        <Input id={`ref-${tipo}-version`} name="versionDoc" required maxLength={40} defaultValue={r?.versionDoc ?? ''} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`ref-${tipo}-fecha`}>{t.referenciaFecha}</Label>
                        <Input id={`ref-${tipo}-fecha`} name="fecha" type="date" required defaultValue={r?.fecha ?? ''} />
                      </div>
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <Label htmlFor={`ref-${tipo}-ubicacion`}>{t.referenciaUbicacion}</Label>
                        <Input id={`ref-${tipo}-ubicacion`} name="ubicacion" required maxLength={200} defaultValue={r?.ubicacion ?? ''} />
                      </div>
                      <div className="md:col-span-2">
                        <Button type="submit" variante="secondary" aria-label={t.referenciaGuardarAria(etiqueta)}>
                          {t.referenciaGuardar}
                        </Button>
                      </div>
                    </form>
                    {r && (
                      <form method="post" action={`${base}/quitar`}>
                        <input type="hidden" name="tipo" value={tipo} />
                        <input type="hidden" name="version" value={r.version} />
                        <Button type="submit" variante="ghost" aria-label={t.referenciaQuitarAria(etiqueta)}>
                          {t.referenciaQuitar}
                        </Button>
                      </form>
                    )}
                  </div>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
};

/** Lo que justificaba una versión aprobada, tal como se congeló: escala, riesgos y referencias. Una versión anterior lo dice. */
export const SeccionJustificacionVersion = ({ justificacion }: { justificacion: JustificacionVersion | null }) => (
  <section className="mb-6" aria-labelledby="version-justificacion">
    <h2 id="version-justificacion" className="mb-2 text-lg font-semibold text-fg">
      {t.justificacionVersionTitulo}
    </h2>
    {justificacion === null ? (
      <p className="text-sm text-fg-muted">{t.versionSinJustificacion}</p>
    ) : (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-fg">{t.riesgosCongeladosTitulo}</h3>
          {justificacion.riesgos.length === 0 ? (
            <p className="text-sm text-fg-muted">{t.sinRiesgosCongelados}</p>
          ) : (
            <Tabla aria-describedby="riesgos-congelados-desc">
              <caption id="riesgos-congelados-desc" className="sr-only">
                {t.tablaRiesgosDescripcion}
              </caption>
              <thead>
                <tr>
                  <Th scope="col">{t.columnasRiesgo.codigo}</Th>
                  <Th scope="col">{t.columnasRiesgo.riesgo}</Th>
                  <Th scope="col">{t.columnasRiesgo.nivel}</Th>
                  <Th scope="col">{t.columnasRiesgo.decision}</Th>
                  <Th scope="col">{t.columnasRiesgo.controles}</Th>
                  <Th scope="col">{t.columnasRiesgo.responsable}</Th>
                </tr>
              </thead>
              <tbody>
                {justificacion.riesgos.map((r) => (
                  <tr key={r.codigo}>
                    <Td className="font-mono text-sm">{r.codigo}</Td>
                    <Td>{r.titulo}</Td>
                    <Td>{`${t.niveles[r.nivel]} (${r.probabilidad} × ${r.impacto} = ${r.probabilidad * r.impacto})`}</Td>
                    <Td>{t.decisiones[r.decision]}</Td>
                    <Td className="text-sm">{r.controles.join(', ')}</Td>
                    <Td>{r.responsableId === null ? t.sinAsignar : t.asignado}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-fg">{t.escalaTitulo}</h3>
          <p className="max-w-3xl text-sm text-fg">{t.escalaTexto(justificacion.escala.escalaMax, justificacion.escala.corteMedio, justificacion.escala.corteAlto, justificacion.escala.corteCritico)}</p>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-fg">{t.referenciasTitulo}</h3>
          <ul className="flex flex-col gap-1 text-sm text-fg">
            {TIPOS_REFERENCIA.map((tipo) => {
              const r = justificacion.referencias.find((x) => x.tipo === tipo);
              return (
                <li key={tipo}>
                  <span className="font-medium">{t.tiposReferencia[tipo]}:</span> {r ? t.referenciaDetalle(r.titulo, r.versionDoc, r.fecha, r.ubicacion) : t.referenciaNoRegistrada}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="max-w-3xl text-sm text-fg-muted">{t.avisoAlcanceRiesgos}</p>
      </div>
    )}
  </section>
);
