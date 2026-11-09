// Pegamento con Next para las pantallas internas: lee lo que el proxy verificó (empresa) y la cookie de sesión, y entrega la marca
// REAL de esa empresa, la persona con sesión y el token para más consultas a la API en esta misma solicitud. Una sola vez por
// solicitud (React `cache`). Sin sesión válida manda a ingresar; nunca inventa una marca.
// El token de acceso NO debe pasarse a componentes del navegador: solo se usa aquí, en el servidor.
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { crearDependencias } from '../auth/dependencias';
import { ENCABEZADO_EMPRESA } from '../auth/proxy-adaptador';
import { cargarEmpresaActual } from './empresa-actual';

export const contextoActual = cache(async (slugDeLaDireccion: string) => {
  const h = await headers();
  const r = await cargarEmpresaActual(
    { slugDeLaDireccion, slugVerificado: h.get(ENCABEZADO_EMPRESA), cookie: h.get('cookie') },
    crearDependencias(process.env),
  );
  if (r.tipo === 'ok') return { empresa: r.empresa, persona: r.persona, acceso: r.acceso };
  if (r.tipo === 'no_encontrado') notFound();
  if (r.tipo === 'ingresar') redirect(`/auth/login?retorno=${encodeURIComponent(`/e/${slugDeLaDireccion}/panel`)}`);
  throw new Error('No se pudo cargar la marca de la empresa');
});
