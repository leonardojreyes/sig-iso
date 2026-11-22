import { Alert, Badge, Button, Card, CardTitle, Textarea } from '@sig/ui';
import type { AvisoEscritura } from '../certificacion/escribir';
import { RESULTADOS, type Auditoria, type InformeAuditoria, type ListaVerificacion } from '../auditoria/tipos';
import type { PersonaDirectorio } from '../documentos/tipos';
import type { Empresa } from '../marca/tipos';
import { AvisoDeEscritura } from './aviso-escritura';
import { Campo, NavegacionAuditoria, dia, enlaceClase, esAdministrador, nombreDe, t, type PersonaSesion } from './auditoria-comun';
import { MarcoApp } from './marco';

const inf = t.informe;

export interface PropsInforme {
  readonly empresa: Empresa;
  readonly persona: PersonaSesion;
  readonly auditoria: Auditoria;
  /** Nulo si todavía no se emitió. */
  readonly informe: InformeAuditoria | null;
  readonly lista: ListaVerificacion;
  readonly personas: readonly PersonaDirectorio[];
  readonly aviso?: AvisoEscritura | null;
}

/** Informe de una auditoría: lo que falta para emitirlo, la copia congelada, su descarga en Word y el cierre. */
export const PantallaInforme = ({ empresa, persona, auditoria: a, informe, lista, personas, aviso = null }: PropsInforme) => {
  const admin = esAdministrador(persona);
  const audita = admin || persona.roles.includes('auditor_interno');
  const base = `/e/${empresa.id}/auditoria`;
  const escribir = (accion: string): string => `${base}/escribir/${accion}/${a.id}`;
  const porEvaluar = lista.avance.porResultado.por_evaluar;
  const puedeEmitir = audita && a.estado === 'en_ejecucion' && informe === null;
  return (
    <MarcoApp empresa={empresa} activo="auditoria" persona={persona.nombre}>
      <h1 className="mb-2 flex flex-wrap items-center gap-3 text-2xl font-semibold text-fg">
        {inf.titulo(a.codigo)}
        <Badge tono={a.estado === 'cerrada' ? 'success' : undefined}>{t.estadosAuditoria[a.estado]}</Badge>
      </h1>
      <p className="mb-4 max-w-3xl text-sm text-fg-muted">{inf.ayuda}</p>
      <NavegacionAuditoria empresa={empresa} actual="informe" auditoriaId={a.id} />
      <AvisoDeEscritura aviso={aviso} />
      {!audita && <p className="mb-4 text-sm text-fg-muted">{t.soloLectura}</p>}

      {informe === null ? (
        <>
          <Card className="mb-6" aria-labelledby="antes">
            <CardTitle id="antes">{inf.requisitosTitulo}</CardTitle>
            <p className="text-sm text-fg">{porEvaluar > 0 ? inf.filasPorEvaluar(porEvaluar) : inf.listaEvaluada}</p>
            <p className="mt-2 max-w-3xl text-sm text-fg-muted">{inf.requisitos}</p>
            <p className="mt-2 text-sm">
              <a className={enlaceClase} href={`${base}/auditorias/${a.id}/ejecucion`}>
                {inf.irEjecucion}
              </a>
            </p>
          </Card>
          {a.estado !== 'en_ejecucion' && (
            <div className="mb-4">
              <Alert anunciar={false} tono="info" titulo={inf.sinInforme} />
              <p className="mt-2 text-sm text-fg-muted">{inf.noEnEjecucion}</p>
            </div>
          )}
          {puedeEmitir && (
            <Card className="mb-6" aria-labelledby="emitir">
              <CardTitle id="emitir">{inf.emitirTitulo}</CardTitle>
              <p className="mb-3 max-w-3xl text-sm text-fg-muted">{inf.emitirAyuda}</p>
              <form method="post" action={escribir('informe_emitir')} className="grid max-w-3xl gap-3">
                <input type="hidden" name="version" value={a.version} />
                <Campo id="informe-conclusion" etiqueta={`${inf.campoConclusion} ${t.obligatorio}`} ayuda={`${inf.conclusionAyuda} ${t.sinTexto}`}>
                  <Textarea id="informe-conclusion" name="conclusion" required maxLength={1000} rows={4} aria-describedby="informe-conclusion-ayuda" />
                </Campo>
                <Campo id="informe-limitaciones" etiqueta={inf.campoLimitaciones} ayuda={inf.limitacionesAyuda}>
                  <Textarea id="informe-limitaciones" name="limitaciones" maxLength={1000} rows={3} aria-describedby="informe-limitaciones-ayuda" />
                </Campo>
                <div>
                  <Button type="submit">{inf.emitir}</Button>
                </div>
              </form>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card className="mb-6" aria-labelledby="emitido">
            <CardTitle id="emitido">{inf.emitidoTitulo}</CardTitle>
            <p className="text-sm text-fg">{inf.emitidoPor(nombreDe(personas, informe.emitidoPor), dia(informe.emitidoEn))}</p>
            <p className="mt-2 text-sm text-fg-muted">{inf.huella}:</p>
            <p className="break-all font-mono text-sm text-fg">{informe.huella}</p>
            <h3 className="mb-1 mt-4 text-sm font-semibold text-fg">{inf.conclusion}</h3>
            <p className="whitespace-pre-line text-sm text-fg">{informe.conclusion}</p>
            <h3 className="mb-1 mt-4 text-sm font-semibold text-fg">{inf.limitaciones}</h3>
            {informe.limitaciones ? <p className="whitespace-pre-line text-sm text-fg">{informe.limitaciones}</p> : <p className="text-sm text-fg-muted">{inf.sinLimitaciones}</p>}
            <h3 className="mb-1 mt-4 text-sm font-semibold text-fg">{inf.resultados}</h3>
            <p className="text-sm text-fg">
              {RESULTADOS.filter((r) => informe.conteos[r] > 0)
                .map((r) => inf.conteo(t.resultados[r], informe.conteos[r]))
                .join(' · ')}
            </p>
            <p className="text-sm text-fg-muted">{inf.cubiertas(informe.conteos.cubiertas, informe.conteos.total)}</p>
          </Card>
          <Card className="mb-6" aria-labelledby="descarga">
            <CardTitle id="descarga">{inf.descargar}</CardTitle>
            <p className="mb-3 max-w-3xl text-sm text-fg-muted">{inf.descargarAyuda}</p>
            <a className={enlaceClase} href={`${base}/informe/${a.id}/documento`}>
              {inf.descargar}
            </a>
          </Card>
          {a.estado === 'cerrada' && a.cerradaEn ? (
            <p className="mb-6 text-sm text-fg">{inf.cerrada(dia(a.cerradaEn))}</p>
          ) : (
            admin &&
            a.estado === 'informe_emitido' && (
              <Card className="mb-6" aria-labelledby="cerrar">
                <CardTitle id="cerrar">{inf.cerrarTitulo}</CardTitle>
                <p className="mb-3 max-w-3xl text-sm text-fg-muted">{inf.cerrarAyuda}</p>
                <form method="post" action={escribir('auditoria_cerrar')}>
                  <input type="hidden" name="version" value={a.version} />
                  <Button type="submit">{inf.cerrar}</Button>
                </form>
              </Card>
            )
          )}
        </>
      )}
      <p className="text-sm">
        <a className={enlaceClase} href={base}>
          {inf.irPanel}
        </a>
      </p>
    </MarcoApp>
  );
};
