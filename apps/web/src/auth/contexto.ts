// Empresa de la sesión, verificada por el proxy, para quien la necesite (pantallas, comprobaciones). Segunda capa: aunque alguien
// se saltara el proxy, esta ruta solo contesta si el encabezado verificado coincide con la dirección; si no, 404 sin nada.
import { ENCABEZADO_EMPRESA } from './proxy-adaptador';

const SLUG = /^[a-z0-9-]{1,32}$/;

export const responderContexto = (empresaDeLaDireccion: string, cabeceras: Headers): Response => {
  const verificada = cabeceras.get(ENCABEZADO_EMPRESA);
  if (!verificada || !SLUG.test(verificada) || verificada !== empresaDeLaDireccion) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  return Response.json({ empresa: verificada }, { headers: { 'Cache-Control': 'no-store' } });
};
