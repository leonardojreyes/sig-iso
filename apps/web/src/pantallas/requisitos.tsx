import { Plus } from 'lucide-react';
import { BotonEnlace, Button, Card, EstadoVacio, Input, Label, Select, SemaforoCumplimiento, Tabla, Td, Th, textosUi } from '@sig/ui';
import { normasDemo, requisitosDe, type RequisitoDemo } from '../datos-demo';
import type { Empresa } from '../empresas';
import { es } from '../i18n/es-EC';
import { MarcoApp } from './marco';

export interface FiltrosRequisitos { q?: string; norma?: string; estado?: string }

export const filtrarRequisitos = (empresaId: string, f: FiltrosRequisitos): RequisitoDemo[] =>
  requisitosDe(empresaId).filter(
    (r) =>
      (!f.norma || r.norma === f.norma) &&
      (!f.estado || r.estado === f.estado) &&
      (!f.q || `${r.clausula} ${r.titulo}`.toLowerCase().includes(f.q.toLowerCase())),
  );

const estados = Object.entries(textosUi.semaforo);

/** Pantalla plantilla 3/5: listado con filtros (filtrado por URL, funciona sin JavaScript). */
export const PantallaRequisitos = ({ empresa, filtros }: { empresa: Empresa; filtros: FiltrosRequisitos }) => {
  const filas = filtrarRequisitos(empresa.id, filtros);
  const t = es.requisitos;
  return (
    <MarcoApp empresa={empresa} activo="requisitos">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-fg">{t.titulo}</h1>
        <BotonEnlace href={`/e/${empresa.id}/requisitos/nuevo`}><Plus aria-hidden="true" className="size-4" />{t.nuevo}</BotonEnlace>
      </div>

      <Card className="mb-6">
        <form method="get" aria-label={t.filtros} className="grid items-end gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q">{t.buscar}</Label>
            <Input id="q" name="q" type="search" defaultValue={filtros.q ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="norma">{t.norma}</Label>
            <Select id="norma" name="norma" defaultValue={filtros.norma ?? ''}>
              <option value="">{t.todas}</option>
              {normasDemo.map((n) => (<option key={n} value={n}>{n}</option>))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estado">{t.estado}</Label>
            <Select id="estado" name="estado" defaultValue={filtros.estado ?? ''}>
              <option value="">{t.todos}</option>
              {estados.map(([v, n]) => (<option key={v} value={v}>{n}</option>))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit">{t.aplicar}</Button>
            <BotonEnlace variante="secondary" href={`/e/${empresa.id}/requisitos`}>{t.limpiar}</BotonEnlace>
          </div>
        </form>
      </Card>

      <p className="mb-2 text-sm text-fg-muted" aria-live="polite">{t.resultados(filas.length)}</p>
      {filas.length === 0 ? (
        <EstadoVacio titulo={t.vacioTitulo} descripcion={t.vacioDescripcion} />
      ) : (
        <Tabla>
          <caption className="sr-only">{t.tablaDescripcion}</caption>
          <thead>
            <tr><Th>{t.columnas.clausula}</Th><Th>{t.columnas.titulo}</Th><Th>{t.columnas.norma}</Th><Th>{t.columnas.estado}</Th><Th>{t.columnas.controles}</Th></tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono">{r.clausula}</Td>
                <Td><a className="font-medium text-primary underline underline-offset-2 hover:no-underline" href={`/e/${empresa.id}/requisitos/${r.id}`}>{r.titulo}</a></Td>
                <Td>{r.norma}</Td>
                <Td><SemaforoCumplimiento estado={r.estado} /></Td>
                <Td className="tabular-nums">{r.controles.length}</Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </MarcoApp>
  );
};
