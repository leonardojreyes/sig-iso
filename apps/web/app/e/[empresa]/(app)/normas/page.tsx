import { redirect } from 'next/navigation';
import { consultarApi } from '../../../../../src/api/cliente';
import { validarLibrerias } from '../../../../../src/api/validadores';
import { crearDependencias } from '../../../../../src/auth/dependencias';
import { resultadosCompartidos } from '../../../../../src/librerias/resultados-carga';
import { leerAvisoNormas } from '../../../../../src/librerias/subir';
import { contextoActual } from '../../../../../src/marca/servidor';
import { PantallaNormas } from '../../../../../src/pantallas/normas';

// Normas de la empresa de la sesión: sus librerías (propias y del catálogo) y la subida de nuevas, pedidas a la API con el token de
// la sesión. El resultado de la última subida sale de la memoria del servidor y se muestra UNA vez.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const slug = (await params).empresa;
  const sp = await searchParams;
  const { empresa, persona, acceso } = await contextoActual(slug);
  const deps = crearDependencias(process.env);
  const r = await consultarApi({ acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn, ruta: '/librerias' });
  if (!r.ok && r.motivo === 'no_autenticado') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slug}/normas`)}`);
  const librerias = r.ok ? validarLibrerias(r.json) : null;
  if (!librerias) throw new Error('No se pudo cargar las librerías');
  const resultado = typeof sp.carga === 'string' ? resultadosCompartidos().tomar(sp.carga, slug, deps.ahora().getTime()) : null;
  return <PantallaNormas empresa={empresa} persona={persona} librerias={librerias} resultado={resultado} aviso={leerAvisoNormas(sp)} />;
}
