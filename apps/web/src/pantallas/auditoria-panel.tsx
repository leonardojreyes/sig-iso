import { Alert, Badge, Card, CardTitle } from '@sig/ui';
import { ESTADOS_AUDITORIA, type PanelAuditoria } from '../auditoria/tipos';
import { t } from './auditoria-comun';

const pn = t.panel;

/** Prerrequisito de la Etapa 2: informa si se cumple y qué falta, con palabras. No decide la etapa. */
export const PanelPrerrequisito = ({ panel }: { panel: PanelAuditoria }) => {
  const { prerrequisito: p, cobertura12Meses: c } = panel;
  const b = p.brechas;
  const hayBrechas = b.clausulas.length > 0 || b.procesos.length > 0 || b.controles.length > 0 || b.sinDeclaracion;
  return (
    <Card className="mb-6" aria-labelledby="panel-prerrequisito">
      <CardTitle id="panel-prerrequisito">{pn.titulo}</CardTitle>
      <p className="mb-3 max-w-3xl text-sm text-fg-muted">{pn.ayuda}</p>
      {panel.programaAnio === null ? (
        <p className="text-sm text-fg-muted">{pn.sinPrograma}</p>
      ) : (
        <>
          <div className="mb-3">
            <Alert anunciar={false} tono={p.cumple ? 'success' : 'warning'} titulo={p.cumple ? pn.cumple : pn.noCumple}>
              {pn.cerradas(p.auditoriasCerradas)}
            </Alert>
          </div>
          <h3 className="mb-1 text-sm font-semibold text-fg">{pn.brechasTitulo}</h3>
          {!hayBrechas ? (
            <p className="text-sm text-fg">{pn.sinBrechas}</p>
          ) : (
            <ul className="mb-3 list-disc pl-5 text-sm text-fg">
              {b.sinDeclaracion ? <li>{pn.sinDeclaracion}</li> : null}
              {b.clausulas.length > 0 ? <li>{pn.clausulas(b.clausulas.length)}</li> : null}
              {b.procesos.length > 0 ? <li>{pn.procesos(b.procesos.length)}</li> : null}
              {b.controles.length > 0 ? <li>{pn.controles(b.controles.length)}</li> : null}
            </ul>
          )}
          <h3 className="mb-1 mt-3 text-sm font-semibold text-fg">{pn.cobertura}</h3>
          <ul className="text-sm text-fg">
            <li>{pn.coberturaClausulas(c.clausulas.cubiertas, c.clausulas.total)}</li>
            <li>{c.controles.sinDeclaracion ? pn.sinDeclaracion : pn.coberturaControles(c.controles.cubiertos, c.controles.total)}</li>
            <li>{pn.coberturaProcesos(c.procesos.cubiertos, c.procesos.total)}</li>
          </ul>
          <h3 className="mb-1 mt-3 text-sm font-semibold text-fg">{pn.auditorias}</h3>
          <div className="flex flex-wrap gap-2">
            {ESTADOS_AUDITORIA.filter((e) => panel.auditorias.porEstado[e] > 0).map((e) => (
              <Badge key={e}>{pn.estadoCuenta(t.estadosAuditoria[e], panel.auditorias.porEstado[e])}</Badge>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
