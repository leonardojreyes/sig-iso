import type { NextRequest } from 'next/server';
import { crearDependencias, registrarEnServidor } from './src/auth/dependencias';
import { decidirAcceso } from './src/auth/proteccion';
import { aRespuesta } from './src/auth/proxy-adaptador';

// Protege las pantallas internas /e/<empresa>/… (ADR 027). Cerrado por omisión: cualquier fallo inesperado responde 503, nunca
// deja pasar.
export async function proxy(peticion: NextRequest) {
  try {
    return aRespuesta(await decidirAcceso(peticion, crearDependencias(process.env)), peticion);
  } catch (e) {
    registrarEnServidor(`proxy: ${e instanceof Error ? e.message : 'error desconocido'}`);
    return aRespuesta({ tipo: 'no_disponible' }, peticion);
  }
}

export const config = { matcher: ['/e/:path*'] };
