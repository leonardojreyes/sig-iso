import { Alert, Badge, Button, Card, CardTitle, Label, Select } from '@sig/ui';
import type { AvisoRetiroRiesgo, Rol, RiesgoDetalle } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';
import { CamposRiesgo, InsigniaNivel, type OpcionPersona } from './riesgos';

/** Un control vigente de la empresa con el que se puede vincular el riesgo. */
export interface OpcionControl {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
}
/** Un control del Anexo A con el que se puede prever el tratamiento. */
export interface OpcionAnexo {
  readonly libreriaCodigo: string;
  readonly idEstable: string;
  readonly titulo: string;
}

export interface PropsRiesgoDetalle {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly riesgo: RiesgoDetalle;
  /** Qué controles quedarían sin motivo al retirarlo; nulo si no se pudo calcular o no corresponde (retirado o sin permiso). */
  readonly aviso: AvisoRetiroRiesgo | null;
  readonly controlesDisponibles: readonly OpcionControl[];
  readonly opcionesAnexo: readonly OpcionAnexo[];
  readonly personas: readonly OpcionPersona[];
  readonly avisoEscritura?: AvisoEscritura | null;
}

export const PantallaRiesgoDetalle = ({ empresa, persona, riesgo, aviso, controlesDisponibles, opcionesAnexo, personas, avisoEscritura = null }: PropsRiesgoDetalle) => {
  const t = es.riesgos;
  const puedeGestionar = persona.roles.includes('administrador_sig');
  const editable = puedeGestionar && riesgo.estado === 'vigente';
  const yaVinculados = new Set(riesgo.controles.map((c) => c.id));
  const yaPrevistos = new Set(riesgo.tratamientosPrevistos.map((x) => `${x.libreriaCodigo}|${x.idEstable}`));
  const controles = controlesDisponibles.filter((c) => !yaVinculados.has(c.id));
  const anexo = opcionesAnexo.filter((o) => !yaPrevistos.has(`${o.libreriaCodigo}|${o.idEstable}`));

  return (
    <MarcoApp empresa={empresa} activo="riesgos" persona={persona.nombre}>
      <p className="mb-2">
        <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline" href={`/e/${empresa.id}/riesgos`}>
          {t.volver}
        </a>
      </p>
      <h1 className="mb-2 text-2xl font-semibold text-fg">
        {t.detalleTitulo(riesgo.codigo)} · {riesgo.titulo}
      </h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <InsigniaNivel nivel={riesgo.nivel} probabilidad={riesgo.probabilidad} impacto={riesgo.impacto} puntaje={riesgo.puntaje} />
        <Badge tono="info">{t.decisiones[riesgo.decision]}</Badge>
        {riesgo.estado === 'vigente' ? <Badge tono="success">{t.estadoVigente}</Badge> : <Badge>{t.estadoRetirado}</Badge>}
      </div>
      <AvisoDeEscritura aviso={avisoEscritura} />
      {riesgo.estado === 'retirado' && <p className="mb-4 text-sm text-fg-muted">{t.retiradoAviso}</p>}
      {!puedeGestionar && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}
      {riesgo.descripcion && <p className="mb-4 max-w-3xl text-fg">{riesgo.descripcion}</p>}

      <div className="flex flex-col gap-6">
        {editable && (
          <Card aria-labelledby="datos-riesgo">
            <CardTitle id="datos-riesgo">{t.datos}</CardTitle>
            <form method="post" action={`/e/${empresa.id}/riesgos/cambiar`} className="grid max-w-3xl gap-3 md:grid-cols-3">
              <input type="hidden" name="riesgoId" value={riesgo.id} />
              <input type="hidden" name="version" value={riesgo.version} />
              <CamposRiesgo id="cambiar" personas={personas} valores={riesgo} />
              <p id="cambiar-escala" className="text-sm text-fg-muted md:col-span-3">{t.escalaAyuda}</p>
              <div className="md:col-span-3">
                <Button type="submit" aria-label={t.guardarAria(riesgo.codigo)}>
                  {t.guardar}
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card aria-labelledby="controles-riesgo">
          <CardTitle id="controles-riesgo">{t.controlesTitulo}</CardTitle>
          {riesgo.controles.length === 0 ? (
            <p className="text-sm text-fg-muted">{t.sinControles}</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-2">
              {riesgo.controles.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-fg-muted">{c.codigo}</span>
                  <span className="text-fg">{c.nombre}</span>
                  {c.estado === 'retirado' && <Badge tono="warning">{t.controlRetirado}</Badge>}
                  {editable && (
                    <form method="post" action={`/e/${empresa.id}/riesgos/desvincular`}>
                      <input type="hidden" name="riesgoId" value={riesgo.id} />
                      <input type="hidden" name="controlId" value={c.id} />
                      <Button type="submit" variante="ghost" aria-label={t.quitarVinculoAria(riesgo.codigo, c.codigo)}>
                        {t.quitarVinculo}
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editable &&
            (controles.length === 0 ? (
              <p className="text-sm text-fg-muted">{t.sinControlesParaVincular}</p>
            ) : (
              <form method="post" action={`/e/${empresa.id}/riesgos/vincular`} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="riesgoId" value={riesgo.id} />
                <div className="flex min-w-64 flex-col gap-1.5">
                  <Label htmlFor="vincular-control">{t.vincular}</Label>
                  <Select id="vincular-control" name="controlId" required defaultValue="">
                    <option value="" disabled>
                      {t.elegirControl}
                    </option>
                    {controles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} · {c.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variante="secondary">
                  {t.vincularBoton}
                </Button>
              </form>
            ))}
        </Card>

        <Card aria-labelledby="previstos-riesgo">
          <CardTitle id="previstos-riesgo">{t.previstosTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.previstosAyuda}</p>
          {riesgo.tratamientosPrevistos.length === 0 ? (
            <p className="mb-3 text-sm text-fg-muted">{t.sinPrevistos}</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-2">
              {riesgo.tratamientosPrevistos.map((x) => (
                <li key={`${x.libreriaCodigo}|${x.idEstable}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-fg-muted">{x.idEstable}</span>
                  {x.titulo ? <span className="text-fg">{x.titulo}</span> : <Badge tono="warning">{t.entradaNoAdoptada}</Badge>}
                  {editable && (
                    <form method="post" action={`/e/${empresa.id}/riesgos/quitar-prevision`}>
                      <input type="hidden" name="riesgoId" value={riesgo.id} />
                      <input type="hidden" name="entrada" value={`${x.libreriaCodigo}|${x.idEstable}`} />
                      <Button type="submit" variante="ghost" aria-label={t.quitarPrevistoAria(riesgo.codigo, x.idEstable)}>
                        {t.quitarPrevisto}
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editable &&
            (anexo.length === 0 ? (
              <p className="text-sm text-fg-muted">{t.sinOpcionesAnexo}</p>
            ) : (
              <form method="post" action={`/e/${empresa.id}/riesgos/prever`} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="riesgoId" value={riesgo.id} />
                <div className="flex min-w-64 flex-col gap-1.5">
                  <Label htmlFor="prever-entrada">{t.prever}</Label>
                  <Select id="prever-entrada" name="entrada" required defaultValue="">
                    <option value="" disabled>
                      {t.elegirAnexo}
                    </option>
                    {anexo.map((o) => (
                      <option key={`${o.libreriaCodigo}|${o.idEstable}`} value={`${o.libreriaCodigo}|${o.idEstable}`}>
                        {o.titulo} ({o.idEstable})
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variante="secondary">
                  {t.preverBoton}
                </Button>
              </form>
            ))}
        </Card>

        {editable && (
          <Card aria-labelledby="retirar-riesgo">
            <CardTitle id="retirar-riesgo">{t.retirarTitulo}</CardTitle>
            {aviso === null ? (
              <div className="mb-3">
                <Alert anunciar={false} tono="warning" titulo={t.avisoNoDisponible} />
              </div>
            ) : aviso.controlesSinMotivo.length === 0 ? (
              <p className="mb-3 text-sm text-fg-muted">{t.retirarAvisoSinEfecto}</p>
            ) : (
              <div className="mb-3">
                <Alert anunciar={false} tono="warning" titulo={t.retirarAvisoConEfecto(aviso.controlesSinMotivo.length)}>
                  <ul className="mt-2 list-disc pl-5">
                    {aviso.controlesSinMotivo.map((c) => (
                      <li key={`${c.libreriaCodigo}|${c.idEstable}`}>
                        <span className="font-mono">{c.idEstable}</span> · {c.titulo}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">{t.retirarAvisoSiguiente}</p>
                </Alert>
              </div>
            )}
            <form method="post" action={`/e/${empresa.id}/riesgos/retirar`}>
              <input type="hidden" name="riesgoId" value={riesgo.id} />
              <input type="hidden" name="version" value={riesgo.version} />
              <Button type="submit" variante="danger" aria-label={t.retirarAria(riesgo.codigo)}>
                {t.retirar}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </MarcoApp>
  );
};
