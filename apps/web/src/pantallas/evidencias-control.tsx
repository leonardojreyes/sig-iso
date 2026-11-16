import { Alert, Badge, Button, Card, CardTitle, EstadoVacio, Input, Label, Select, Tabla, Td, Th } from '@sig/ui';
import type { ControlMarco, Evidencia, Rol } from '../api/tipos';
import type { AvisoEscritura } from '../certificacion/escribir';
import { huellaCorta, tamanoLegible } from '../certificacion/formato';
import { es } from '../i18n/es-EC';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { MarcoApp } from './marco';

export interface PropsEvidenciasControl {
  readonly empresa: Empresa;
  readonly persona: { readonly nombre: string; readonly roles: readonly Rol[] };
  readonly control: ControlMarco;
  readonly evidencias: readonly Evidencia[];
  readonly historial: boolean;
  /** La fecha de hoy en Ecuador (`AAAA-MM-DD`): tope de la fecha del hecho, que no puede ser futura. */
  readonly hoy: string;
  readonly aviso?: AvisoEscritura | null;
}

const ACEPTADOS = '.pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx,.pptx';

const Oculto = ({ control, historial }: { control: string; historial: boolean }) => (
  <>
    <input type="hidden" name="control" value={control} />
    {historial && <input type="hidden" name="f_historicas" value="true" />}
  </>
);

const Vigencia = ({ e }: { e: Evidencia }) => {
  const t = es.evidencias;
  if (e.estado !== 'activa') return <Badge>{t.estados[e.estado]}</Badge>;
  return (
    <div className="flex flex-col gap-1">
      {e.vencida ? <Badge tono="warning">{t.vencida}</Badge> : e.vigenteHasta === null ? <Badge tono="info">{t.sinVencimiento}</Badge> : <Badge tono="success">{t.vigente}</Badge>}
      {e.vigenteHasta && <span className="text-xs text-fg-muted">{t.vigenteHastaFecha(e.vigenteHasta)}</span>}
    </div>
  );
};

const FormularioReemplazo = ({ empresa, e, indice, hoy, historial }: { empresa: Empresa; e: Evidencia; indice: number; hoy: string; historial: boolean }) => {
  const t = es.evidencias;
  const id = `reem-${indice}`;
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-primary">{t.reemplazar}</summary>
      <form method="post" encType="multipart/form-data" action={`/e/${empresa.id}/evidencias/${e.id}/reemplazar`} className="mt-3 flex min-w-64 max-w-md flex-col gap-3">
        <Oculto control={e.controlId} historial={historial} />
        <p className="text-sm text-fg-muted">{t.reemplazarAyuda}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-titulo`}>{t.titulo_}</Label>
          <Input id={`${id}-titulo`} name="titulo" maxLength={120} defaultValue={e.titulo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-fecha`}>{t.fechaHecho}</Label>
          <Input id={`${id}-fecha`} name="fechaHecho" type="date" required max={hoy} defaultValue={hoy} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-vigencia`}>{t.vigenteHasta}</Label>
          <Input id={`${id}-vigencia`} name="vigenteHasta" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-archivo`}>{t.archivo}</Label>
          <Input id={`${id}-archivo`} name="archivo" type="file" required accept={ACEPTADOS} aria-describedby={`${id}-ayuda`} />
          <p id={`${id}-ayuda`} className="text-sm text-fg-muted">
            {t.archivoAyuda}
          </p>
        </div>
        <div>
          <Button type="submit">{t.guardarReemplazo}</Button>
        </div>
      </form>
    </details>
  );
};

export const PantallaEvidenciasControl = ({ empresa, persona, control, evidencias, historial, hoy, aviso = null }: PropsEvidenciasControl) => {
  const t = es.evidencias;
  const registra = persona.roles.some((r) => r === 'administrador_sig' || r === 'colaborador');
  const elimina = persona.roles.includes('administrador_sig');
  const vigente = control.estado === 'vigente';
  const puedeSubir = registra && vigente;

  return (
    <MarcoApp empresa={empresa} activo="controles" persona={persona.nombre}>
      <a className="mb-3 inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline" href={`/e/${empresa.id}/controles`}>
        {t.volver}
      </a>
      <h1 className="mb-1 text-2xl font-semibold text-fg">{t.titulo(control.codigo)}</h1>
      <p className="mb-2 text-lg text-fg">{control.nombre}</p>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{t.ayuda}</p>
      <AvisoDeEscritura aviso={aviso} />
      {!vigente && (
        <div className="mb-4">
          <Alert tono="info" titulo={t.controlRetirado} />
        </div>
      )}
      {!registra && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      {puedeSubir && (
        <Card className="mb-6" aria-labelledby="subir-evidencia">
          <CardTitle id="subir-evidencia">{t.subirTitulo}</CardTitle>
          <form method="post" encType="multipart/form-data" action={`/e/${empresa.id}/controles/${control.id}/evidencias/subir`} className="grid max-w-3xl gap-3 md:grid-cols-2">
            {historial && <input type="hidden" name="f_historicas" value="true" />}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evi-tipo">{t.tipo}</Label>
              <Select id="evi-tipo" name="tipo" required defaultValue="documento">
                <option value="documento">{t.tipos.documento}</option>
                <option value="registro">{t.tipos.registro}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evi-titulo">{t.titulo_}</Label>
              <Input id="evi-titulo" name="titulo" required maxLength={120} aria-describedby="evi-titulo-ayuda" />
              <p id="evi-titulo-ayuda" className="text-sm text-fg-muted">
                {t.tituloAyuda}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evi-fecha">{t.fechaHecho}</Label>
              <Input id="evi-fecha" name="fechaHecho" type="date" required max={hoy} defaultValue={hoy} aria-describedby="evi-fecha-ayuda" />
              <p id="evi-fecha-ayuda" className="text-sm text-fg-muted">
                {t.fechaHechoAyuda}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evi-vigencia">{t.vigenteHasta}</Label>
              <Input id="evi-vigencia" name="vigenteHasta" type="date" aria-describedby="evi-vigencia-ayuda" />
              <p id="evi-vigencia-ayuda" className="text-sm text-fg-muted">
                {t.vigenteHastaAyuda}
              </p>
            </div>
            {/* El archivo va al final: la API decide los campos antes de leer un solo byte del archivo. */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="evi-archivo">{t.archivo}</Label>
              <Input id="evi-archivo" name="archivo" type="file" required accept={ACEPTADOS} aria-describedby="evi-archivo-ayuda" />
              <p id="evi-archivo-ayuda" className="text-sm text-fg-muted">
                {t.archivoAyuda}
              </p>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t.subir}</Button>
            </div>
          </form>
        </Card>
      )}

      <p className="mb-2 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
        <span>{t.resultados(evidencias.length)}</span>
        <a className="font-medium text-primary underline" href={`/e/${empresa.id}/controles/${control.id}${historial ? '' : '?historicas=true'}`}>
          {historial ? t.sinHistorial : t.historial}
        </a>
      </p>

      {evidencias.length === 0 ? (
        <EstadoVacio titulo={t.sinEvidenciasTitulo} descripcion={puedeSubir ? t.sinEvidenciasAdmin : t.sinEvidenciasOtros} />
      ) : (
          <Tabla aria-describedby="evidencias-desc">
            <caption id="evidencias-desc" className="sr-only">
              {t.tablaDescripcion}
            </caption>
            <thead>
              <tr>
                <Th scope="col">{t.columnas.evidencia}</Th>
                <Th scope="col">{t.columnas.vigencia}</Th>
                <Th scope="col">{t.columnas.archivo}</Th>
                <Th scope="col">{t.columnas.acciones}</Th>
              </tr>
            </thead>
            <tbody>
              {evidencias.map((e, i) => (
                <tr key={e.id}>
                  <Td>
                    <p className="font-medium text-fg">{e.titulo}</p>
                    <p className="text-sm text-fg-muted">
                      {t.tipos[e.tipo]} · {t.hecho(e.fechaHecho)}
                    </p>
                    {e.reemplazaId && <p className="text-xs text-fg-muted">{t.reemplazaA}</p>}
                  </Td>
                  <Td>
                    <Vigencia e={e} />
                  </Td>
                  <Td>
                    <p className="break-all text-sm text-fg">{e.archivo.nombre}</p>
                    <p className="text-sm text-fg-muted">
                      {t.tiposArchivo[e.archivo.tipo]} · {tamanoLegible(e.archivo.bytes)}
                    </p>
                    <p className="font-mono text-xs text-fg-muted" title={`${t.huella}: ${e.archivo.sha256}`}>
                      {t.huella}: {huellaCorta(e.archivo.sha256)}
                    </p>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-3">
                      {e.estado !== 'eliminada' && (
                        <a className="inline-flex min-h-[var(--sig-density-target-min)] items-center text-sm font-medium text-primary underline" href={`/e/${empresa.id}/evidencias/${e.id}/descargar`} aria-label={t.descargarAria(e.titulo)}>
                          {t.descargar}
                        </a>
                      )}
                      {e.estado === 'activa' && puedeSubir && <FormularioReemplazo empresa={empresa} e={e} indice={i} hoy={hoy} historial={historial} />}
                      {e.estado === 'activa' && elimina && (
                        <form method="post" action={`/e/${empresa.id}/evidencias/${e.id}/eliminar`}>
                          <Oculto control={e.controlId} historial={historial} />
                          <Button type="submit" variante="danger" aria-label={t.eliminarAria(e.titulo)}>
                            {t.eliminar}
                          </Button>
                        </form>
                      )}
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
