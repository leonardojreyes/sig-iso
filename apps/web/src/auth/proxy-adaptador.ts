// Traduce la decisión de acceso a la respuesta del proxy de Next. Todo lo de /e/… va sin caché (H1.4).
import { NextResponse, type NextRequest } from 'next/server';
import type { DecisionProxy } from './proteccion';

/** Encabezado de solicitud con la empresa VERIFICADA de la sesión. Lo pone solo el proxy: el que mande el cliente se descarta. */
export const ENCABEZADO_EMPRESA = 'x-sig-empresa';

export const aRespuesta = (decision: DecisionProxy, peticion: NextRequest): NextResponse => {
  let respuesta: NextResponse;
  switch (decision.tipo) {
    case 'pasar': {
      const cabeceras = new Headers(peticion.headers);
      cabeceras.delete(ENCABEZADO_EMPRESA);
      if (decision.empresa) cabeceras.set(ENCABEZADO_EMPRESA, decision.empresa);
      respuesta = NextResponse.next({ request: { headers: cabeceras } });
      break;
    }
    case 'login': {
      const destino = new URL('/auth/login', peticion.url);
      destino.searchParams.set('retorno', decision.retorno);
      // Un POST (p. ej. adoptar con la sesión vencida) se redirige con 303: el navegador pide /auth/login con GET (con 307 repetiría el POST).
      respuesta = NextResponse.redirect(destino, peticion.method === 'GET' || peticion.method === 'HEAD' ? 307 : 303);
      break;
    }
    case 'no_encontrado':
      // Ruta que no existe: Next responde su 404 normal, igual que para una empresa inexistente.
      respuesta = NextResponse.rewrite(new URL('/no-encontrado', peticion.url));
      break;
    case 'no_disponible':
      respuesta = new NextResponse('El servicio no está disponible en este momento.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
      break;
  }
  respuesta.headers.set('Cache-Control', 'no-store');
  if (decision.tipo !== 'no_disponible') for (const c of decision.cookies) respuesta.headers.append('Set-Cookie', c);
  return respuesta;
};
