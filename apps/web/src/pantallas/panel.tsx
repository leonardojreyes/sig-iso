import { Alert, BarraMadurez, Card, CardTitle, LineaTiempoCertificacion, MatrizRiesgos, Progreso, Tabla, Td, Th } from '@sig/ui';
import { panelDe } from '../datos-demo';
import type { Empresa } from '../empresas';
import { es } from '../i18n/es-EC';
import { MarcoApp } from './marco';

/** Pantalla plantilla 2/5: panel. */
export const PantallaPanel = ({ empresa }: { empresa: Empresa }) => {
  const d = panelDe(empresa.id);
  if (!d) return null;
  const { cumplimientoPorNorma, madurez: madurezDemo, etapas: etapasDemo, riesgos: riesgosDemo, vencimientos: vencimientosDemo } = d;
  return (
  <MarcoApp empresa={empresa} activo="panel">
    <h1 className="text-2xl font-semibold text-fg">{es.panel.titulo}</h1>
    <p className="mb-6 mt-1 text-sm text-fg-muted">{es.panel.resumen}</p>
    <div className="mb-6"><Alert tono="info" titulo={es.panel.avisoDatos} /></div>

    <div className="mb-6 grid gap-4 md:grid-cols-3">
      {cumplimientoPorNorma.map((n) => (
        <Card key={n.norma}>
          <p className="text-sm text-fg-muted">{es.panel.cumplimientoNorma}</p>
          <p className="text-lg font-semibold text-fg">{n.norma}</p>
          <p className="my-2 text-3xl font-bold tabular-nums text-fg">{n.porcentaje}%</p>
          <Progreso valor={n.porcentaje} etiqueta={`${es.panel.cumplimientoNorma} ${n.norma}`} />
        </Card>
      ))}
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardTitle>{es.panel.madurez}</CardTitle><BarraMadurez etiqueta={es.panel.madurezEtiqueta} items={madurezDemo} /></Card>
      <Card><CardTitle>{es.panel.ciclo}</CardTitle><LineaTiempoCertificacion etapas={etapasDemo} /></Card>
      <Card><CardTitle>{es.panel.riesgos}</CardTitle><MatrizRiesgos celdas={riesgosDemo} /></Card>
      <Card>
        <CardTitle>{es.panel.vencimientos}</CardTitle>
        <Tabla>
          <caption className="sr-only">{es.panel.vencimientos}</caption>
          <thead><tr><Th>{es.panel.evidencia}</Th><Th>{es.panel.vence}</Th><Th>{es.panel.responsable}</Th></tr></thead>
          <tbody>
            {vencimientosDemo.map((v) => (<tr key={v.evidencia}><Td>{v.evidencia}</Td><Td>{v.vence}</Td><Td>{v.responsable}</Td></tr>))}
          </tbody>
        </Tabla>
      </Card>
    </div>
  </MarcoApp>
  );
};
