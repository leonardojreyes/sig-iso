import { Alert, Badge, Button, Card, CardTitle, Tabla, Td, Th } from '@sig/ui';
import type { ActivoDetalle, AvisoRetiroActivo } from '../activos/tipos';
import type { Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import type { PersonaDirectorio } from '../documentos/tipos';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { CamposActivo, nombreDe } from './activos';
import { MarcoApp } from './marco';

export interface PropsActivoDetalle {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly activo: ActivoDetalle;
  readonly personas: readonly PersonaDirectorio[];
  /** Qué riesgos quedarían sin activo al retirarlo; nulo si no se pudo calcular o no corresponde (retirado o sin permiso). */
  readonly avisoRetiro: AvisoRetiroActivo | null;
  readonly aviso?: AvisoEscritura | null;
}

const t = es.activos;
const TONO: Record<string, 'success' | 'info' | 'warning' | 'danger'> = { bajo: 'success', medio: 'info', alto: 'warning', critico: 'danger' };

export const PantallaActivoDetalle = ({ empresa, persona, activo: a, personas, avisoRetiro, aviso = null }: PropsActivoDetalle) => {
  const puedeGestionar = persona.roles.includes('administrador_sig');
  const editable = puedeGestionar && a.estado === 'vigente';
  const base = `/e/${empresa.id}/activos`;
  return (
    <MarcoApp empresa={empresa} activo="activos" persona={persona.nombre}>
      <p className="mb-2 text-sm">
        <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline" href={base}>
          {t.volver}
        </a>
      </p>
      <h1 className="mb-1 text-2xl font-semibold text-fg">
        <span className="font-mono text-fg-muted">{a.codigo}</span> · {a.nombre}
      </h1>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge>{t.tipos[a.tipo]}</Badge>
        <Badge>{t.clasificaciones[a.clasificacion]}</Badge>
        {a.estado === 'retirado' ? <Badge>{t.estadoRetirado}</Badge> : <Badge tono="success">{t.estadoVigente}</Badge>}
      </div>
      <ul className="mb-2 text-sm text-fg-muted">
        <li>{t.responsable(nombreDe(personas, a.responsableId))}</li>
        <li>{a.nivelMasAlto ? t.nivelMasAlto(t.niveles[a.nivelMasAlto]) : t.sinNivel}</li>
      </ul>
      {a.descripcion && <p className="mb-4 max-w-3xl text-fg">{a.descripcion}</p>}
      <AvisoDeEscritura aviso={aviso} />
      {a.estado === 'retirado' && (
        <div className="mb-4">
          <Alert anunciar={false} tono="info" titulo={t.retiradoAviso} />
        </div>
      )}
      {!puedeGestionar && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      <h2 className="mb-2 text-xl font-semibold text-fg">{t.riesgosDelActivo}</h2>
      {a.riesgos.length === 0 ? (
        <p className="mb-6 text-sm text-fg-muted">{t.sinRiesgosLigados}</p>
      ) : (
        <Tabla aria-describedby="riesgos-activo-desc" className="mb-6">
          <caption id="riesgos-activo-desc" className="sr-only">
            {t.riesgosDelActivoDescripcion}
          </caption>
          <thead>
            <tr>
              <Th scope="col">{t.columnasRiesgo.riesgo}</Th>
              <Th scope="col">{t.columnasRiesgo.nivel}</Th>
              <Th scope="col">{t.columnasRiesgo.estado}</Th>
            </tr>
          </thead>
          <tbody>
            {a.riesgos.map((r) => (
              <tr key={r.id}>
                <Td>
                  <a className="font-medium text-primary underline" href={`/e/${empresa.id}/riesgos/${r.id}`}>
                    <span className="font-mono">{r.codigo}</span> · {r.titulo}
                  </a>
                </Td>
                <Td>
                  <Badge tono={TONO[r.nivel]}>{t.nivelDetalle(t.niveles[r.nivel], r.puntaje)}</Badge>
                </Td>
                <Td>{r.estado === 'retirado' ? t.estadoRetirado : t.estadoVigente}</Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      {editable && (
        <Card className="mb-6" aria-labelledby="datos-activo">
          <CardTitle id="datos-activo">{t.datos}</CardTitle>
          <form method="post" action={`${base}/${a.id}/cambiar`} className="grid max-w-3xl gap-3 md:grid-cols-3">
            <input type="hidden" name="version" value={a.version} />
            <CamposActivo id="ed" personas={personas} valores={{ nombre: a.nombre, descripcion: a.descripcion, tipo: a.tipo, clasificacion: a.clasificacion, responsableId: a.responsableId }} />
            <div className="md:col-span-3">
              <Button type="submit">{t.guardar}</Button>
            </div>
          </form>
        </Card>
      )}

      {editable && (
        <Card aria-labelledby="retirar-activo">
          <CardTitle id="retirar-activo">{t.retirarTitulo}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{t.retirarAyuda}</p>
          {avisoRetiro && (
            <div className="mb-3 max-w-3xl" role="group" aria-label={t.retirarAvisoTitulo}>
              {avisoRetiro.riesgosSinActivo.length === 0 ? (
                <p className="text-sm text-fg">{t.retirarAvisoSin}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-fg">{t.retirarAvisoCon(avisoRetiro.riesgosSinActivo.length)}</p>
                  <ul className="list-disc pl-5 text-sm text-fg">
                    {avisoRetiro.riesgosSinActivo.map((r) => (
                      <li key={r.id}>
                        <span className="font-mono">{r.codigo}</span> · {r.titulo}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <form method="post" action={`${base}/${a.id}/retirar`}>
            <input type="hidden" name="version" value={a.version} />
            <Button type="submit" variante="secondary">
              {t.retirar}
            </Button>
          </form>
        </Card>
      )}
    </MarcoApp>
  );
};
