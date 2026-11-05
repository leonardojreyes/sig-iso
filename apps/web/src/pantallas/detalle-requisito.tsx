import { Badge, Card, CardTitle, Migas, SemaforoCumplimiento, Tabla, Td, Th } from '@sig/ui';
import type { RequisitoDemo } from '../datos-demo';
import type { Empresa } from '../empresas';
import { es } from '../i18n/es-EC';
import { MarcoApp } from './marco';

/** Pantalla plantilla 5/5: detalle. */
export const PantallaDetalleRequisito = ({ empresa, requisito }: { empresa: Empresa; requisito: RequisitoDemo }) => {
  const t = es.detalle;
  return (
    <MarcoApp empresa={empresa} activo="requisitos">
      <Migas items={[{ texto: es.nav.requisitos, href: `/e/${empresa.id}/requisitos` }, { texto: `${requisito.norma} ${requisito.clausula}` }]} />
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-fg"><span className="font-mono text-fg-muted">{requisito.clausula}</span> {requisito.titulo}</h1>
        <Badge tono="primary">{requisito.norma}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardTitle>{t.guia}</CardTitle><p className="text-fg">{requisito.guia}</p></Card>
        <Card>
          <CardTitle>{t.estado}</CardTitle>
          <SemaforoCumplimiento estado={requisito.estado} />
          {requisito.tambienEn.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-sm font-medium text-fg">{t.mapeos}</p>
              <ul className="flex flex-wrap gap-2">{requisito.tambienEn.map((m) => (<li key={m}><Badge>{m}</Badge></li>))}</ul>
            </>
          )}
        </Card>
        <Card className="lg:col-span-3">
          <CardTitle>{t.controles}</CardTitle>
          {requisito.controles.length === 0 ? <p className="text-sm text-fg-muted">{t.controlesVacio}</p> : <ul className="list-inside list-disc text-fg">{requisito.controles.map((c) => (<li key={c}>{c}</li>))}</ul>}
        </Card>
        {requisito.evidencias.length > 0 && (
          <Card className="lg:col-span-3">
            <CardTitle>{t.evidencias}</CardTitle>
            <Tabla>
              <caption className="sr-only">{t.evidencias}</caption>
              <thead><tr><Th>{t.columnas.evidencia}</Th><Th>{t.columnas.responsable}</Th><Th>{t.columnas.vigencia}</Th></tr></thead>
              <tbody>{requisito.evidencias.map((e) => (<tr key={e.nombre}><Td>{e.nombre}</Td><Td>{e.responsable}</Td><Td>{e.vigenteHasta}</Td></tr>))}</tbody>
            </Tabla>
          </Card>
        )}
      </div>
      <p className="mt-6"><a className="text-primary underline-offset-2 hover:underline" href={`/e/${empresa.id}/requisitos`}>{t.volver}</a></p>
    </MarcoApp>
  );
};
