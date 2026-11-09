// La empresa y la persona de la sesión para las pantallas internas, con la marca REAL. Defensa en profundidad: aunque el proxy ya
// comprobó la sesión, aquí se vuelve a exigir que la empresa de la dirección sea la verificada por él, y que la API (con el token)
// confirme la misma empresa. El token de acceso se devuelve solo para que el servidor haga más consultas en esta misma solicitud:
// nunca debe pasar a un componente del navegador.
import { consultarApi } from '../api/cliente';
import type { Rol } from '../api/tipos';
import { validarIdentidad } from '../api/validadores';
import type { DependenciasSesion } from '../auth/sesion';
import { crearServicioSesion } from '../auth/sesion';
import { cargarMarca } from './marca';
import type { Empresa } from './tipos';

export interface PersonaActual {
  readonly nombre: string;
  readonly roles: readonly Rol[];
}

export type EmpresaActual =
  | { readonly tipo: 'ok'; readonly empresa: Empresa; readonly persona: PersonaActual; readonly acceso: string }
  | { readonly tipo: 'no_encontrado' }
  | { readonly tipo: 'ingresar' }
  | { readonly tipo: 'no_disponible' };

export const cargarEmpresaActual = async (
  entrada: { slugDeLaDireccion: string; slugVerificado: string | null; cookie: string | null },
  deps: DependenciasSesion,
): Promise<EmpresaActual> => {
  if (!entrada.slugVerificado || entrada.slugVerificado !== entrada.slugDeLaDireccion) return { tipo: 'no_encontrado' };

  const servicio = crearServicioSesion(deps);
  const sesion = await servicio.leer(
    new Request('http://interno.invalid/', { headers: entrada.cookie ? { cookie: entrada.cookie } : {} }),
  );
  if (!sesion) return { tipo: 'ingresar' };

  const acceso = await servicio.obtenerAcceso(sesion);
  if (!acceso.ok) return acceso.motivo === 'expirada' ? { tipo: 'ingresar' } : { tipo: 'no_disponible' };

  const [marca, me] = await Promise.all([
    cargarMarca({
      slug: entrada.slugVerificado,
      acceso: acceso.acceso,
      apiUrl: deps.config.apiUrl,
      fetchFn: deps.fetchFn,
    }),
    consultarApi({ ruta: '/me', acceso: acceso.acceso, apiUrl: deps.config.apiUrl, fetchFn: deps.fetchFn }),
  ]);
  const rechazada =
    (marca.ok === false && marca.motivo === 'no_autenticado') || (me.ok === false && me.motivo === 'no_autenticado');
  if (rechazada) {
    deps.almacen.borrar(sesion.sid);
    return { tipo: 'ingresar' };
  }
  if (!marca.ok || !me.ok) return { tipo: 'no_disponible' };
  const identidad = validarIdentidad(me.json);
  if (!identidad) return { tipo: 'no_disponible' };
  // La API debe confirmar la MISMA empresa que verificó el proxy; si no, nada se muestra.
  if (identidad.empresa.slug !== entrada.slugVerificado) return { tipo: 'no_encontrado' };
  return {
    tipo: 'ok',
    empresa: marca.empresa,
    persona: { nombre: identidad.nombre, roles: identidad.roles },
    acceso: acceso.acceso,
  };
};
