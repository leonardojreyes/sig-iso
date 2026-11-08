// Sesión de la web (ADR 027): cookie sellada de sesión del navegador, access token solo en memoria del servidor, renovación con
// rotación serializada por `sid` y cierre que registra, revoca y cierra también la sesión de Keycloak.
// - La sesión SOLO se emite si la API registró el inicio (`POST /sesion/inicio` → 204): sin rastro no hay sesión.
// - El límite absoluto de 8 h cuenta desde el inicio y no se extiende al renovar.
import { randomBytes } from 'node:crypto';
import type { AlmacenAcceso } from './almacen-acceso';
import type { ConfiguracionIngreso } from './configuracion';
import { leerCookie, type ResultadoCallback } from './flujo';
import { abrirSello, sellar } from './sellado';

export interface DependenciasSesion {
  readonly config: ConfiguracionIngreso;
  readonly ahora: () => Date;
  readonly fetchFn: typeof fetch;
  readonly almacen: AlmacenAcceso;
}

export interface SesionLeida {
  readonly sid: string;
  readonly refresco: string;
  readonly idToken: string;
  /** Inicio de la sesión, en segundos desde la época. */
  readonly inicio: number;
}

export type ResultadoAcceso =
  | { readonly ok: true; readonly acceso: string; readonly nuevaCookie: string | null }
  | { readonly ok: false; readonly motivo: 'expirada' | 'no_disponible'; readonly limpiarCookie?: string };

const SESION_MAXIMA_SEGUNDOS = 8 * 3600;
const MARGEN_RENOVACION_MS = 30_000;
const TIEMPO_API_MS = 5_000;
const SIN_CACHE = 'no-store';

export const origenValido = (peticion: Request, origenPropio: string): boolean => {
  const origen = peticion.headers.get('origin');
  return origen !== null && origen === origenPropio;
};

export const crearServicioSesion = (deps: DependenciasSesion) => {
  const { config, almacen } = deps;
  const ahoraSeg = (): number => Math.floor(deps.ahora().getTime() / 1000);

  const atributosCookie = `Path=/; HttpOnly; SameSite=Lax${config.seguro ? '; Secure' : ''}`;
  const cookieDeSesion = (valor: string): string => `${config.nombreCookieSesion}=${valor}; ${atributosCookie}`;
  const borrarCookie = (): string => `${config.nombreCookieSesion}=; ${atributosCookie}; Max-Age=0`;

  const sellarSesion = async (s: SesionLeida, refresco: string): Promise<string> => {
    const restante = s.inicio + SESION_MAXIMA_SEGUNDOS - ahoraSeg();
    if (restante <= 0) throw new Error('La sesión ya superó su límite absoluto');
    return sellar(
      { v: 1, sid: s.sid, rt: refresco, it: s.idToken, ini: s.inicio },
      { claves: config.clavesSellado, vigenciaSegundos: restante, ahora: deps.ahora() },
    );
  };

  const llamarApi = async (ruta: string, acceso: string): Promise<number | null> => {
    try {
      const r = await deps.fetchFn(`${config.apiUrl}${ruta}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${acceso}`, accept: 'application/json' },
        signal: AbortSignal.timeout(TIEMPO_API_MS),
        redirect: 'error',
        cache: 'no-store',
      });
      return r.status;
    } catch {
      return null;
    }
  };

  const iniciar = async (resultado: Extract<ResultadoCallback, { ok: true }>): Promise<Response> => {
    const sid = resultado.identidad.sid ?? randomBytes(18).toString('base64url');
    const fallo = (): Response => {
      const c = new Headers({ Location: `${config.origen}/?error=ingreso_no_disponible`, 'Cache-Control': SIN_CACHE });
      c.append('Set-Cookie', resultado.limpiarCookie);
      return new Response(null, { status: 303, headers: c });
    };
    // Primero el rastro, después la sesión (regla 4): si la bitácora no lo registró, no se emite nada.
    if ((await llamarApi('/sesion/inicio', resultado.tokens.acceso)) !== 204) return fallo();

    const inicio = ahoraSeg();
    const vida = (resultado.tokens.accesoExpiraEnSegundos ?? 300) * 1000;
    const sesion: SesionLeida = { sid, refresco: resultado.tokens.refresco, idToken: resultado.tokens.id, inicio };
    const valor = await sellarSesion(sesion, resultado.tokens.refresco);
    almacen.guardar(sid, {
      acceso: resultado.tokens.acceso,
      refresco: resultado.tokens.refresco,
      expiraEn: deps.ahora().getTime() + vida,
    });

    const cabeceras = new Headers({ Location: `${config.origen}${resultado.retorno}`, 'Cache-Control': SIN_CACHE });
    cabeceras.append('Set-Cookie', cookieDeSesion(valor));
    cabeceras.append('Set-Cookie', resultado.limpiarCookie);
    return new Response(null, { status: 303, headers: cabeceras });
  };

  const leer = async (peticion: Request): Promise<SesionLeida | null> => {
    const valor = leerCookie(peticion, config.nombreCookieSesion);
    if (valor === null || valor === 'repetida' || valor === '') return null;
    try {
      const c = await abrirSello<{ v?: unknown; sid?: unknown; rt?: unknown; it?: unknown; ini?: unknown }>(valor, {
        claves: config.clavesSellado,
        ahora: deps.ahora(),
      });
      if (
        c.v !== 1 ||
        typeof c.sid !== 'string' ||
        typeof c.rt !== 'string' ||
        typeof c.it !== 'string' ||
        typeof c.ini !== 'number'
      )
        return null;
      if (c.ini + SESION_MAXIMA_SEGUNDOS <= ahoraSeg()) return null;
      return { sid: c.sid, refresco: c.rt, idToken: c.it, inicio: c.ini };
    } catch {
      return null;
    }
  };

  // Una renovación: refresh token → tokens nuevos. Actualiza la memoria ANTES de resolver para que los demás la vean.
  const renovar = async (
    sid: string,
    refrescoActual: string,
  ): Promise<{ ok: boolean; motivo?: 'expirada' | 'no_disponible' }> => {
    let cuerpo: Record<string, unknown>;
    try {
      const r = await deps.fetchFn(`${config.emisor}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refrescoActual,
          client_id: config.clienteId,
          client_secret: config.clienteSecreto,
        }).toString(),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
        cache: 'no-store',
      });
      if (r.status === 400 || r.status === 401) {
        almacen.borrar(sid);
        return { ok: false, motivo: 'expirada' };
      }
      if (!r.ok) return { ok: false, motivo: 'no_disponible' };
      cuerpo = (await r.json()) as Record<string, unknown>;
    } catch {
      return { ok: false, motivo: 'no_disponible' };
    }
    const acceso = cuerpo?.access_token;
    const refresco = cuerpo?.refresh_token;
    const vida =
      typeof cuerpo?.expires_in === 'number' && cuerpo.expires_in > 0 && cuerpo.expires_in <= 3600
        ? cuerpo.expires_in
        : 300;
    if (typeof acceso !== 'string' || !acceso || typeof refresco !== 'string' || !refresco)
      return { ok: false, motivo: 'no_disponible' };
    almacen.guardar(sid, { acceso, refresco, expiraEn: deps.ahora().getTime() + vida * 1000 });
    return { ok: true };
  };

  const obtenerAcceso = async (sesion: SesionLeida): Promise<ResultadoAcceso> => {
    let entrada = almacen.obtener(sesion.sid);
    if (!entrada || entrada.expiraEn - deps.ahora().getTime() <= MARGEN_RENOVACION_MS) {
      // Solo una renovación a la vez por sesión: las demás esperan el mismo resultado. Se usa el refresh más reciente de la
      // memoria (una cookie rezagada no debe reutilizar uno ya usado) y, si no hay, el de la cookie.
      let en = almacen.renovando.get(sesion.sid);
      if (!en) {
        en = renovar(sesion.sid, entrada?.refresco ?? sesion.refresco).finally(() =>
          almacen.renovando.delete(sesion.sid),
        );
        almacen.renovando.set(sesion.sid, en);
      }
      const resultado = await en;
      if (!resultado.ok) {
        return resultado.motivo === 'expirada'
          ? { ok: false, motivo: 'expirada', limpiarCookie: borrarCookie() }
          : { ok: false, motivo: 'no_disponible' };
      }
      entrada = almacen.obtener(sesion.sid);
      if (!entrada) return { ok: false, motivo: 'no_disponible' };
    }
    // Si el refresh vigente ya no es el de la cookie recibida, se reemite la cookie con el nuevo (misma fecha de inicio).
    let nuevaCookie: string | null = null;
    if (entrada.refresco !== sesion.refresco)
      nuevaCookie = cookieDeSesion(await sellarSesion(sesion, entrada.refresco));
    return { ok: true, acceso: entrada.acceso, nuevaCookie };
  };

  const cerrar = async (peticion: Request): Promise<Response> => {
    if (peticion.method !== 'POST')
      return new Response('Método no permitido', {
        status: 405,
        headers: { Allow: 'POST', 'Cache-Control': SIN_CACHE },
      });
    if (!origenValido(peticion, config.origen))
      return new Response('Origen no permitido', { status: 403, headers: { 'Cache-Control': SIN_CACHE } });

    const cabeceras = new Headers({ 'Cache-Control': SIN_CACHE });
    cabeceras.append('Set-Cookie', borrarCookie());
    const sesion = await leer(peticion);
    if (!sesion) {
      cabeceras.set('Location', `${config.origen}/`);
      return new Response(null, { status: 303, headers: cabeceras });
    }

    // 1) El hecho `logout` en la bitácora. Si falla, la sesión se cierra igual: no se deja abierta por un fallo del registro.
    const acceso = await obtenerAcceso(sesion);
    if (acceso.ok) await llamarApi('/sesion/cierre', acceso.acceso);

    // 2) Revocar el refresh token vigente (RFC 7009), aunque no se haya podido registrar o renovar.
    const vigente = almacen.obtener(sesion.sid)?.refresco ?? sesion.refresco;
    try {
      await deps.fetchFn(`${config.emisor}/protocol/openid-connect/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: vigente,
          token_type_hint: 'refresh_token',
          client_id: config.clienteId,
          client_secret: config.clienteSecreto,
        }).toString(),
        signal: AbortSignal.timeout(5_000),
        redirect: 'error',
        cache: 'no-store',
      });
    } catch {
      // Sin respuesta de Keycloak: igual se borra todo lo local y se cierra su sesión SSO por el navegador.
    }
    almacen.borrar(sesion.sid);

    // 3) Cerrar también la sesión SSO de Keycloak (con id_token_hint) y volver al inicio.
    const fin = new URL(`${config.emisor}/protocol/openid-connect/logout`);
    fin.search = new URLSearchParams({
      id_token_hint: sesion.idToken,
      post_logout_redirect_uri: `${config.origen}/`,
      client_id: config.clienteId,
    }).toString();
    cabeceras.set('Location', fin.toString());
    return new Response(null, { status: 303, headers: cabeceras });
  };

  return { iniciar, leer, obtenerAcceso, cerrar };
};
