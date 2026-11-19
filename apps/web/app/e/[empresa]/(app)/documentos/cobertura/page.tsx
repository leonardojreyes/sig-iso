import { redirect } from 'next/navigation';
import { crearDependencias } from '../../../../../../src/auth/dependencias';
import { cargarCoberturaDocumental } from '../../../../../../src/documentos/cargar';
import { contextoActual } from '../../../../../../src/marca/servidor';
import { PantallaCoberturaDocumental } from '../../../../../../src/pantallas/cobertura-documental';
import { PantallaSinPermiso } from '../../../../../../src/pantallas/sin-permiso';

const NORMA = /^[A-Za-z0-9 :./-]{1,60}$/;

// Cobertura documental REAL de la empresa de la sesión. Informativa: no bloquea nada.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).empresa;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const sp = await searchParams;
  const normaCruda = typeof sp['norma'] === 'string' && sp['norma'] !== '' ? sp['norma'] : undefined;
  const norma = normaCruda !== undefined && NORMA.test(normaCruda) ? normaCruda : undefined;
  const invalidos = (normaCruda !== undefined && norma === undefined) || (sp['soloSinDocumento'] !== undefined && sp['soloSinDocumento'] !== 'true' && sp['soloSinDocumento'] !== 'false' && sp['soloSinDocumento'] !== '');
  const solo = sp['soloSinDocumento'] === 'true';
  const deps = crearDependencias(process.env);
  const r = await cargarCoberturaDocumental({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn, ...(norma ? { norma } : {}), soloSinDocumento: solo });
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/documentos/cobertura`)}`);
  if (r.tipo === 'sin_permiso') return <PantallaSinPermiso empresa={empresa} persona={persona} activo="documentos" />;
  if (r.tipo !== 'ok') throw new Error('No se pudo cargar la cobertura documental');
  return <PantallaCoberturaDocumental empresa={empresa} persona={persona} cobertura={r.datos} filtros={{ ...(norma ? { norma } : {}), soloSinDocumento: solo }} filtrosInvalidos={invalidos} />;
}
