import { Alert, Badge, Button, Card, CardTitle, EstadoVacio, Input, Select, Tabla, Td, Textarea, Th } from '@sig/ui';
import type { AvisoEscritura } from '../certificacion/escribir';
import type { PersonaDirectorio } from '../documentos/tipos';
import { CAMBIOS_RELEVANTES, FRECUENCIAS, IMPORTANCIAS, RELACIONES, type ListaProcesos, type Proceso, type RelacionProceso } from '../auditoria/tipos';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { Campo, NavegacionAuditoria, enlaceClase, esAdministrador, nombreDe, t, type PersonaSesion } from './auditoria-comun';
import { MarcoApp } from './marco';

const p = t.procesos;

/** Los campos de un proceso (alta y cambio). `prefijo` distingue los formularios de la misma página. */
const CamposProceso = ({ prefijo, personas, proceso }: { prefijo: string; personas: readonly PersonaDirectorio[]; proceso?: Proceso }) => (
  <>
    <Campo id={`${prefijo}-nombre`} etiqueta={`${p.nombre} ${t.obligatorio}`} ancho>
      <Input id={`${prefijo}-nombre`} name="nombre" required maxLength={120} defaultValue={proceso?.nombre ?? ''} />
    </Campo>
    <Campo id={`${prefijo}-duena`} etiqueta={`${p.duena} ${t.obligatorio}`}>
      <Select id={`${prefijo}-duena`} name="duenaId" required defaultValue={proceso?.duenaId ?? ''}>
        <option value="" disabled>
          {t.seleccione}
        </option>
        {personas
          .filter((x) => x.activa || x.id === proceso?.duenaId)
          .map((x) => (
            <option key={x.id} value={x.id}>
              {x.activa ? x.nombre : `${x.nombre} (${t.personaDeBaja.toLowerCase()})`}
            </option>
          ))}
      </Select>
    </Campo>
    <Campo id={`${prefijo}-importancia`} etiqueta={p.importancia}>
      <Select id={`${prefijo}-importancia`} name="importancia" defaultValue={proceso?.importancia ?? 'media'}>
        {IMPORTANCIAS.map((x) => (
          <option key={x} value={x}>
            {t.importancias[x]}
          </option>
        ))}
      </Select>
    </Campo>
    <Campo id={`${prefijo}-frecuencia`} etiqueta={p.frecuencia}>
      <Select id={`${prefijo}-frecuencia`} name="frecuencia" defaultValue={proceso?.frecuencia ?? 'anual'}>
        {FRECUENCIAS.map((x) => (
          <option key={x} value={x}>
            {t.frecuencias[x]}
          </option>
        ))}
      </Select>
    </Campo>
    <Campo id={`${prefijo}-descripcion`} etiqueta={p.descripcion} ayuda={t.sinTexto} ancho>
      <Textarea id={`${prefijo}-descripcion`} name="descripcion" maxLength={300} rows={2} defaultValue={proceso?.descripcion ?? ''} aria-describedby={`${prefijo}-descripcion-ayuda`} />
    </Campo>
  </>
);

export interface PropsProcesos {
  readonly empresa: Empresa;
  readonly persona: PersonaSesion;
  readonly lista: ListaProcesos;
  readonly personas: readonly PersonaDirectorio[];
  readonly aviso?: AvisoEscritura | null;
}

/** Procesos de la empresa: base de la independencia de quien audita. */
export const PantallaProcesos = ({ empresa, persona, lista, personas, aviso = null }: PropsProcesos) => {
  const admin = esAdministrador(persona);
  const base = `/e/${empresa.id}/auditoria`;
  return (
    <MarcoApp empresa={empresa} activo="auditoria" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">{p.titulo}</h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{p.ayuda}</p>
      <NavegacionAuditoria empresa={empresa} actual="procesos" />
      <AvisoDeEscritura aviso={aviso} />
      {!admin && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      <Card className="mb-6" aria-labelledby="gestion-sig">
        <CardTitle id="gestion-sig">{p.gestionSigTitulo}</CardTitle>
        <p className="mb-3 max-w-3xl text-sm text-fg-muted">{p.gestionSigAyuda}</p>
        {lista.gestionSigVigente ? (
          <p className="text-sm text-fg">{p.gestionSigListo}</p>
        ) : admin ? (
          <form method="post" action={`${base}/escribir/proceso_gestion_sig`}>
            <Button type="submit">{p.gestionSigCrear}</Button>
          </form>
        ) : null}
      </Card>

      {admin && (
        <Card className="mb-6" aria-labelledby="nuevo-proceso">
          <CardTitle id="nuevo-proceso">{p.nuevo}</CardTitle>
          <form method="post" action={`${base}/escribir/proceso_crear`} className="grid max-w-3xl gap-3 md:grid-cols-2">
            <CamposProceso prefijo="nuevo" personas={personas} />
            <div className="md:col-span-2">
              <Button type="submit">{p.crear}</Button>
            </div>
          </form>
        </Card>
      )}

      {lista.procesos.length === 0 ? (
        <EstadoVacio titulo={p.vacio} descripcion={p.vacioDescripcion} />
      ) : (
        <Tabla aria-describedby="procesos-desc">
          <caption id="procesos-desc" className="sr-only">
            {p.titulo}
          </caption>
          <thead>
            <tr>
              <Th scope="col">{p.columnas.nombre}</Th>
              <Th scope="col">{p.columnas.duena}</Th>
              <Th scope="col">{p.columnas.importancia}</Th>
              <Th scope="col">{p.columnas.personas}</Th>
              <Th scope="col">{p.columnas.estado}</Th>
            </tr>
          </thead>
          <tbody>
            {lista.procesos.map((x) => (
              <tr key={x.id}>
                <Td>
                  <p className="font-medium text-fg">
                    <span className="font-mono text-fg-muted">{x.codigo}</span> · {x.nombre}
                    {x.transversal ? <span className="ml-2"><Badge>{p.transversal}</Badge></span> : null}
                  </p>
                  {x.descripcion ? <p className="mt-1 text-sm text-fg-muted">{x.descripcion}</p> : null}
                  <a className={`mt-1 ${enlaceClase}`} href={`${base}/procesos/${x.id}`} aria-label={`${p.detalle}: ${x.nombre}`}>
                    {p.detalle}
                  </a>
                </Td>
                <Td>{nombreDe(personas, x.duenaId)}</Td>
                <Td>
                  <p className="text-sm text-fg">
                    {t.importancias[x.importancia]} · {t.frecuencias[x.frecuencia]}
                  </p>
                  {x.cambioRelevante ? <p className="mt-1 text-sm text-fg-muted">{t.cambios[x.cambioRelevante]}</p> : null}
                </Td>
                <Td>{x.personasRelacionadas}</Td>
                <Td>
                  <div className="flex flex-col gap-1.5">
                    <Badge tono={x.estado === 'vigente' ? 'success' : undefined}>{x.estado === 'vigente' ? p.vigente : p.retirado}</Badge>
                    {x.avisos.map((a) => (
                      <Badge key={a} tono="warning">
                        {p.avisos[a]}
                      </Badge>
                    ))}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </MarcoApp>
  );
};

export interface PropsProceso {
  readonly empresa: Empresa;
  readonly persona: PersonaSesion;
  readonly proceso: Proceso;
  readonly relaciones: readonly RelacionProceso[];
  readonly personas: readonly PersonaDirectorio[];
  readonly aviso?: AvisoEscritura | null;
}

/** Un proceso: sus datos, su retiro y las personas relacionadas con él. */
export const PantallaProceso = ({ empresa, persona, proceso, relaciones, personas, aviso = null }: PropsProceso) => {
  const admin = esAdministrador(persona);
  const base = `/e/${empresa.id}/auditoria`;
  const escribir = (accion: string): string => `${base}/escribir/${accion}/${proceso.id}`;
  const vigente = proceso.estado === 'vigente';
  return (
    <MarcoApp empresa={empresa} activo="auditoria" persona={persona.nombre}>
      <h1 className="mb-2 text-2xl font-semibold text-fg">
        <span className="font-mono text-fg-muted">{proceso.codigo}</span> · {proceso.nombre}
      </h1>
      <NavegacionAuditoria empresa={empresa} actual="procesos" />
      <AvisoDeEscritura aviso={aviso} />
      {!vigente && (
        <div className="mb-4">
          <Alert anunciar={false} tono="warning" titulo={p.retirado} />
        </div>
      )}
      {!admin && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      {admin && vigente && (
        <Card className="mb-6" aria-labelledby="datos-proceso">
          <CardTitle id="datos-proceso">{p.detalle}</CardTitle>
          <form method="post" action={escribir('proceso_cambiar')} className="grid max-w-3xl gap-3 md:grid-cols-2">
            <input type="hidden" name="version" value={proceso.version} />
            <CamposProceso prefijo="cambiar" personas={personas} proceso={proceso} />
            <Campo id="cambiar-marca" etiqueta={p.cambioRelevante} ayuda={p.cambioAyuda}>
              <Select id="cambiar-marca" name="cambioRelevante" defaultValue={proceso.cambioRelevante ?? ''} aria-describedby="cambiar-marca-ayuda">
                <option value="">{t.sinMarca}</option>
                {CAMBIOS_RELEVANTES.map((x) => (
                  <option key={x} value={x}>
                    {t.cambios[x]}
                  </option>
                ))}
              </Select>
            </Campo>
            <div className="md:col-span-2">
              <Button type="submit">{t.guardar}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="mb-6" aria-labelledby="relaciones-proceso">
        <CardTitle id="relaciones-proceso">{p.relaciones(proceso.nombre)}</CardTitle>
        {relaciones.length === 0 ? (
          <p className="mb-3 text-sm text-fg-muted">{p.relacionesVacio}</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {relaciones.map((r) => {
              const nombre = nombreDe(personas, r.personaId);
              const fija = r.relacion === 'duena' && r.personaId === proceso.duenaId && vigente;
              return (
                <li key={`${r.personaId}-${r.relacion}`} className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-fg">
                    {nombre} · {t.relaciones[r.relacion]}
                  </span>
                  {admin && !fija && (
                    <form method="post" action={escribir('relacion_quitar')}>
                      <input type="hidden" name="personaId" value={r.personaId} />
                      <input type="hidden" name="relacion" value={r.relacion} />
                      <Button type="submit" variante="secondary" aria-label={p.relacionQuitar(nombre, t.relaciones[r.relacion])}>
                        {t.quitar}
                      </Button>
                    </form>
                  )}
                  {fija && <span className="text-sm text-fg-muted">{p.relacionDuenaFija}</span>}
                </li>
              );
            })}
          </ul>
        )}
        {admin && vigente && (
          <form method="post" action={escribir('relacion_agregar')} className="grid max-w-2xl gap-3 md:grid-cols-3">
            <Campo id="rel-persona" etiqueta={`${p.relacionPersona} ${t.obligatorio}`}>
              <Select id="rel-persona" name="personaId" required defaultValue="">
                <option value="" disabled>
                  {t.seleccione}
                </option>
                {personas
                  .filter((x) => x.activa)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
              </Select>
            </Campo>
            <Campo id="rel-tipo" etiqueta={`${p.relacionTipo} ${t.obligatorio}`}>
              <Select id="rel-tipo" name="relacion" required defaultValue="participa">
                {RELACIONES.map((x) => (
                  <option key={x} value={x}>
                    {t.relaciones[x]}
                  </option>
                ))}
              </Select>
            </Campo>
            <div className="flex items-end">
              <Button type="submit">{p.relacionAgregar}</Button>
            </div>
          </form>
        )}
      </Card>

      {admin && vigente && (
        <Card aria-labelledby="retirar-proceso">
          <CardTitle id="retirar-proceso">{p.retirar(proceso.nombre)}</CardTitle>
          <p className="mb-3 max-w-3xl text-sm text-fg-muted">{p.retirarAyuda}</p>
          <form method="post" action={escribir('proceso_retirar')}>
            <Button type="submit" variante="danger">
              {p.retirar(proceso.nombre)}
            </Button>
          </form>
        </Card>
      )}
    </MarcoApp>
  );
};
