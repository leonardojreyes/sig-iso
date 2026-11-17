import { headers } from 'next/headers';
import { leerCodigoDeAcceso } from '../../src/auth/acceso-pendiente';
import { crearDependencias } from '../../src/auth/dependencias';
import { PantallaAccesoPendiente } from '../../src/pantallas/acceso-pendiente';

// Lo que ve quien ingresó sin rol (ADR 036): su código de solicitud, leído de una cookie sellada de corta vida. No hay sesión.
// Siempre dinámica: depende de la cookie de cada persona.
export const dynamic = 'force-dynamic';

export default async function AccesoPendiente() {
  let codigo: { codigo: string; venceEn: string } | null = null;
  try {
    const deps = crearDependencias(process.env);
    const c = await leerCodigoDeAcceso((await headers()).get('cookie'), deps.config, deps.ahora());
    codigo = c && { codigo: c.codigo, venceEn: c.venceEn.toISOString() };
  } catch {
    codigo = null; // sin configuración: se muestra «no hay una solicitud a la vista»
  }
  return <PantallaAccesoPendiente codigo={codigo} />;
}
