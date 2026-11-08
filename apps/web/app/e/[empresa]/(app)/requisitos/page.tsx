import { empresaActual } from '../../../../../src/marca/servidor';
import { PantallaRequisitos } from '../../../../../src/pantallas/requisitos';

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const empresa = await empresaActual((await params).empresa);
  const sp = await searchParams;
  return (
    <PantallaRequisitos empresa={empresa} filtros={{ q: uno(sp.q), norma: uno(sp.norma), estado: uno(sp.estado) }} />
  );
}
