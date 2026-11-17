// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AlmacenAcceso } from './almacen-acceso';
import { leerConfiguracion } from './configuracion';
import type { ResultadoCallback } from './flujo';
import { abrirSello } from './sellado';
import { crearServicioSesion, origenValido } from './sesion';

const SECRETO = randomBytes(18).toString('base64url');
const AHORA = new Date('2026-11-08T10:00:00Z');
const SUB = '5eed0001-0000-4000-8000-0000000000a1';
const SID = 'sesion-kc-1';
const config = leerConfiguracion({
  OIDC_CLIENT_SECRET: SECRETO,
  SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
});

type Llamada = { url: string; metodo: string; cuerpo: URLSearchParams | null; autorizacion: string | null };
interface Servidor {
  llamadas: Llamada[];
  api: { estado: number; lanza?: boolean };
  /** Respuesta de `POST /acceso/solicitud` (ADR 036): 201 o 200 traen el código; otro estado, nada. */
  solicitud: { estado: number; cuerpo: unknown };
  keycloak: { refresco: 'ok' | 'invalid_grant' | 'caido'; revocar: number };
  revocados: Set<string>;
  contador: number;
}

// Un Keycloak y una API de mentira que registran lo que reciben. Cada refresco rota el refresh token (reutilización 0).
const montar = () => {
  const s: Servidor = {
    llamadas: [],
    api: { estado: 204 },
    solicitud: { estado: 201, cuerpo: { codigo: 'K7F2-9QXM', venceEn: '2026-11-15T10:00:00.000Z' } },
    keycloak: { refresco: 'ok', revocar: 200 },
    revocados: new Set(),
    contador: 1,
  };
  const vigentes = new Set<string>(['refresco-0']);
  const fetchFn = (async (url: string, init: RequestInit = {}) => {
    const cuerpo = typeof init.body === 'string' ? new URLSearchParams(init.body) : null;
    const cab = new Headers(init.headers);
    s.llamadas.push({ url, metodo: init.method ?? 'GET', cuerpo, autorizacion: cab.get('authorization') });
    if (url.startsWith(config.apiUrl)) {
      if (s.api.lanza) throw new Error('ECONNREFUSED');
      if (url.endsWith('/acceso/solicitud'))
        return new Response([200, 201].includes(s.solicitud.estado) ? JSON.stringify(s.solicitud.cuerpo) : null, { status: s.solicitud.estado, headers: { 'content-type': 'application/json' } });
      return new Response(null, { status: s.api.estado });
    }
    if (url.endsWith('/protocol/openid-connect/revoke')) {
      const t = cuerpo!.get('token')!;
      if (s.keycloak.revocar === 200) {
        s.revocados.add(t);
        vigentes.delete(t);
      }
      return new Response(null, { status: s.keycloak.revocar });
    }
    if (url.endsWith('/protocol/openid-connect/token')) {
      if (s.keycloak.refresco === 'caido') throw new Error('ECONNREFUSED');
      const usado = cuerpo!.get('refresh_token')!;
      if (s.keycloak.refresco === 'invalid_grant' || !vigentes.has(usado)) {
        vigentes.clear(); // reutilizar uno ya usado revoca la sesión entera (reutilización 0)
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
      }
      vigentes.delete(usado);
      const n = s.contador++;
      vigentes.add(`refresco-${n}`);
      return new Response(
        JSON.stringify({
          token_type: 'Bearer',
          access_token: `acceso-${n}`,
          refresh_token: `refresco-${n}`,
          expires_in: 300,
        }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  return { s, fetchFn, vigentes };
};

const callbackOk = (): Extract<ResultadoCallback, { ok: true }> => ({
  ok: true,
  tokens: { acceso: 'acceso-inicial', refresco: 'refresco-0', id: 'id.token.firmado' },
  identidad: { sub: SUB, sid: SID },
  retorno: '/e/empresa-a/panel',
  limpiarCookie: `${config.nombreCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
});

const servicio = (fetchFn: typeof fetch, ahora: () => Date = () => AHORA, almacen = new AlmacenAcceso()) => ({
  almacen,
  svc: crearServicioSesion({ config, ahora, fetchFn, almacen }),
});

const valorCookie = (r: Response, nombre: string): string | null => {
  const sc = r.headers.getSetCookie().find((c) => c.startsWith(`${nombre}=`));
  return sc ? sc.split(';')[0]!.slice(nombre.length + 1) : null;
};
const conCookie = (valor: string, extra: Record<string, string> = {}) =>
  new Request('http://localhost:3000/auth/sesion', {
    headers: { cookie: `${config.nombreCookieSesion}=${valor}`, ...extra },
  });

describe('iniciar: la sesión solo se emite si el inicio quedó registrado (ADR 027)', () => {
  it('llama a POST /sesion/inicio con el token de acceso y, con 204, emite la cookie y vuelve a la ruta pedida', async () => {
    const { s, fetchFn } = montar();
    const { svc } = servicio(fetchFn);
    const r = await svc.iniciar(callbackOk());
    expect(s.llamadas).toHaveLength(1);
    expect(s.llamadas[0]).toMatchObject({
      url: `${config.apiUrl}/sesion/inicio`,
      metodo: 'POST',
      autorizacion: 'Bearer acceso-inicial',
    });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://localhost:3000/e/empresa-a/panel');
    expect(valorCookie(r, config.nombreCookieSesion)).not.toBeNull();
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('la cookie es de sesión del navegador: httpOnly, SameSite=Lax, Path=/, SIN Max-Age ni Expires ni Domain', async () => {
    const { fetchFn } = montar();
    const r = await servicio(fetchFn).svc.iniciar(callbackOk());
    const texto = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!;
    expect(texto).toMatch(/;\s*HttpOnly/i);
    expect(texto).toMatch(/;\s*SameSite=Lax/i);
    expect(texto).toMatch(/;\s*Path=\//i);
    expect(texto).not.toMatch(/Max-Age|Expires|Domain/i);
  });

  it('con HTTPS la cookie es Secure y se llama __Host-…', async () => {
    const seguro = leerConfiguracion({
      OIDC_CLIENT_SECRET: SECRETO,
      SESSION_SEALING_KEY: randomBytes(32).toString('base64url'),
      OIDC_REDIRECT_URI: 'https://sig.ejemplo.ec/auth/callback',
    });
    expect(seguro.nombreCookieSesion).toBe('__Host-sig-sesion');
    const { fetchFn } = montar();
    const r = await crearServicioSesion({
      config: seguro,
      ahora: () => AHORA,
      fetchFn: ((u: string, i: RequestInit) =>
        u.startsWith(seguro.apiUrl) ? new Response(null, { status: 204 }) : fetchFn(u, i)) as never,
      almacen: new AlmacenAcceso(),
    }).iniciar({
      ...callbackOk(),
      limpiarCookie: '__Host-sig-oidc=; Max-Age=0',
    });
    expect(r.headers.getSetCookie().find((c) => c.startsWith('__Host-sig-sesion='))).toMatch(/;\s*Secure/i);
  });

  it('la cookie va sellada: no contiene los tokens en claro, y al abrirla trae sid, refresh, id_token e inicio', async () => {
    const { fetchFn } = montar();
    const r = await servicio(fetchFn).svc.iniciar(callbackOk());
    const valor = valorCookie(r, config.nombreCookieSesion)!;
    for (const claro of ['refresco-0', 'id.token.firmado', SID, 'acceso-inicial']) expect(valor).not.toContain(claro);
    const carga = await abrirSello(valor, { claves: config.clavesSellado, ahora: AHORA });
    expect(carga).toMatchObject({
      sid: SID,
      rt: 'refresco-0',
      it: 'id.token.firmado',
      ini: Math.floor(AHORA.getTime() / 1000),
    });
    expect(JSON.stringify(carga)).not.toContain('acceso-inicial'); // el access token NO va en la cookie
    expect(Object.keys(carga).sort()).toEqual(['ini', 'it', 'rt', 'sid', 'v']); // y no hay más campos que esos
  });

  it('el access token queda en la memoria del servidor, indexado por sid', async () => {
    const { fetchFn } = montar();
    const { svc, almacen } = servicio(fetchFn);
    await svc.iniciar(callbackOk());
    expect(almacen.obtener(SID)).toMatchObject({ acceso: 'acceso-inicial', refresco: 'refresco-0' });
  });

  it.each([
    ['401', { estado: 401 }],
    ['429', { estado: 429 }],
    ['500', { estado: 500 }],
    ['200 (no es el 204 del contrato)', { estado: 200 }],
    ['la API no responde', { estado: 204, lanza: true }],
  ])(
    'si el registro del inicio falla (%s): NO hay sesión, se borra la cookie de la transacción y no queda nada en memoria',
    async (_n, api) => {
      const { s, fetchFn } = montar();
      s.api = api;
      // Un 401 del inicio es el caso de «sin rol» (ADR 036): solo acaba aquí si además la solicitud de acceso no se puede pedir.
      s.solicitud = { estado: 409, cuerpo: null };
      const { svc, almacen } = servicio(fetchFn);
      const r = await svc.iniciar(callbackOk());
      expect(r.status).toBe(303);
      expect(r.headers.get('location')).toBe('http://localhost:3000/?error=ingreso_no_disponible');
      expect(valorCookie(r, config.nombreCookieSesion)).toBeNull();
      expect(r.headers.getSetCookie()).toEqual([callbackOk().limpiarCookie]);
      expect(almacen.obtener(SID)).toBeUndefined();
    },
  );

  it('un ingreso sin sid propio recibe uno aleatorio (nunca se comparte entre personas)', async () => {
    const { fetchFn } = montar();
    const a = await servicio(fetchFn).svc.iniciar({ ...callbackOk(), identidad: { sub: SUB, sid: null } });
    const b = await servicio(fetchFn).svc.iniciar({ ...callbackOk(), identidad: { sub: SUB, sid: null } });
    const sidDe = async (r: Response) =>
      (
        (await abrirSello(valorCookie(r, config.nombreCookieSesion)!, {
          claves: config.clavesSellado,
          ahora: AHORA,
        })) as { sid: string }
      ).sid;
    expect(await sidDe(a)).not.toBe(await sidDe(b));
  });
});

describe('iniciar: una cuenta SIN rol no recibe sesión, pero ve su código de solicitud (ADR 036)', () => {
  const sinRol = (s: Servidor) => {
    s.api.estado = 401; // la API no inicia sesión de una cuenta sin rol: no hay sesión sin rastro
  };

  it('pide la solicitud con SU token y vuelve a /acceso-pendiente con una cookie sellada; NO emite la cookie de sesión ni guarda el token', async () => {
    const { s, fetchFn } = montar();
    sinRol(s);
    const { svc, almacen } = servicio(fetchFn);
    const r = await svc.iniciar(callbackOk());
    expect(s.llamadas.map((l) => [l.metodo, l.url, l.autorizacion])).toEqual([
      ['POST', `${config.apiUrl}/sesion/inicio`, 'Bearer acceso-inicial'],
      ['POST', `${config.apiUrl}/acceso/solicitud`, 'Bearer acceso-inicial'],
    ]);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://localhost:3000/acceso-pendiente');
    expect(valorCookie(r, config.nombreCookieSesion)).toBeNull();
    expect(valorCookie(r, config.nombreCookieAcceso)).not.toBeNull();
    expect(almacen.obtener(SID)).toBeUndefined();
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
    // La cookie de la transacción de ingreso se borra, como siempre.
    expect(r.headers.getSetCookie().some((c) => c.startsWith(`${config.nombreCookie}=;`))).toBe(true);
  });

  it('la cookie va sellada (el código no viaja en claro) y trae solo el código y el plazo', async () => {
    const { s, fetchFn } = montar();
    sinRol(s);
    const r = await servicio(fetchFn).svc.iniciar(callbackOk());
    const valor = valorCookie(r, config.nombreCookieAcceso)!;
    expect(valor).not.toContain('K7F2');
    expect(await abrirSello(valor, { claves: config.clavesSellado, ahora: AHORA })).toEqual({ v: 1, c: 'K7F2-9QXM', e: '2026-11-15T10:00:00.000Z' });
  });

  it('la cookie es httpOnly, SameSite=Lax, Path=/ y dura como máximo 10 minutos (sin Domain)', async () => {
    const { s, fetchFn } = montar();
    sinRol(s);
    const r = await servicio(fetchFn).svc.iniciar(callbackOk());
    const sc = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieAcceso}=`))!;
    expect(sc).toMatch(/; HttpOnly/);
    expect(sc).toMatch(/; SameSite=Lax/);
    expect(sc).toMatch(/; Path=\//);
    expect(sc).not.toMatch(/Domain=/i);
    expect(Number(/Max-Age=(\d+)/.exec(sc)![1])).toBeLessThanOrEqual(600);
  });

  it('si la solicitud vence antes de 10 minutos, la cookie no dura más que ella', async () => {
    const { s, fetchFn } = montar();
    sinRol(s);
    s.solicitud.cuerpo = { codigo: 'K7F2-9QXM', venceEn: new Date(AHORA.getTime() + 90_000).toISOString() };
    const r = await servicio(fetchFn).svc.iniciar(callbackOk());
    const sc = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieAcceso}=`))!;
    expect(Number(/Max-Age=(\d+)/.exec(sc)![1])).toBe(90);
  });

  it.each([
    ['la API la rechaza (409: ya tiene acceso, o demasiadas solicitudes)', { estado: 409, cuerpo: null }],
    ['la API falla (500)', { estado: 500, cuerpo: null }],
    ['la respuesta no cumple el contrato (código mal formado)', { estado: 201, cuerpo: { codigo: '0000-0000', venceEn: '2026-11-15T10:00:00.000Z' } }],
    ['la respuesta no trae plazo válido', { estado: 201, cuerpo: { codigo: 'K7F2-9QXM', venceEn: 'mañana' } }],
    ['el plazo ya pasó', { estado: 201, cuerpo: { codigo: 'K7F2-9QXM', venceEn: '2026-11-01T00:00:00.000Z' } }],
  ])('si %s: sin sesión ni cookie de acceso, y vuelve a la portada con «ingreso_no_disponible»', async (_c, solicitud) => {
    const { s, fetchFn } = montar();
    sinRol(s);
    s.solicitud = solicitud;
    const r = await servicio(fetchFn).svc.iniciar(callbackOk());
    expect(r.headers.get('location')).toBe('http://localhost:3000/?error=ingreso_no_disponible');
    expect(valorCookie(r, config.nombreCookieSesion)).toBeNull();
    expect(valorCookie(r, config.nombreCookieAcceso)).toBeNull();
  });

  it('con la API caída al pedir la solicitud: sin sesión ni cookie', async () => {
    const { s, fetchFn } = montar();
    sinRol(s);
    const original = fetchFn;
    const roto = (async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/acceso/solicitud')) throw new Error('ECONNREFUSED');
      return original(url, init);
    }) as unknown as typeof fetch;
    const r = await servicio(roto).svc.iniciar(callbackOk());
    expect(r.headers.get('location')).toBe('http://localhost:3000/?error=ingreso_no_disponible');
    expect(valorCookie(r, config.nombreCookieAcceso)).toBeNull();
  });

  it('SOLO ante un 401 del inicio: con cualquier otro estado no se pide ninguna solicitud', async () => {
    for (const estado of [403, 404, 500, 503]) {
      const { s, fetchFn } = montar();
      s.api.estado = estado;
      const r = await servicio(fetchFn).svc.iniciar(callbackOk());
      expect(s.llamadas.map((l) => l.url)).toEqual([`${config.apiUrl}/sesion/inicio`]);
      expect(r.headers.get('location')).toBe('http://localhost:3000/?error=ingreso_no_disponible');
    }
  });

  it('la cookie de acceso NO sirve como cookie de sesión (no abre una sesión)', async () => {
    const { s, fetchFn } = montar();
    sinRol(s);
    const { svc } = servicio(fetchFn);
    const valor = valorCookie(await svc.iniciar(callbackOk()), config.nombreCookieAcceso)!;
    expect(await svc.leer(conCookie(valor))).toBeNull();
  });
});

describe('tamaño de la cookie', () => {
  it('con tokens del tamaño de los de Keycloak (refresh ~900, id ~900 caracteres) cabe con margen en los 4 KB (prueba < 3 KB)', async () => {
    const { fetchFn } = montar();
    const grande = { ...callbackOk(), tokens: { acceso: 'a', refresco: 'r'.repeat(900), id: 'i'.repeat(900) } };
    const r = await servicio(fetchFn).svc.iniciar(grande);
    const sc = r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=`))!;
    expect(sc.length).toBeLessThan(3072);
  });
});

describe('leer', () => {
  const sesionIniciada = async (almacen?: AlmacenAcceso, ahora: () => Date = () => AHORA) => {
    const { s, fetchFn } = montar();
    const base = servicio(fetchFn, ahora, almacen);
    const r = await base.svc.iniciar(callbackOk());
    return { ...base, s, valor: valorCookie(r, config.nombreCookieSesion)! };
  };

  it('abre una cookie válida', async () => {
    const { svc, valor } = await sesionIniciada();
    expect(await svc.leer(conCookie(valor))).toMatchObject({ sid: SID, refresco: 'refresco-0' });
  });
  it('sin cookie, con basura, alterada o repetida: null', async () => {
    const { svc, valor } = await sesionIniciada();
    expect(await svc.leer(new Request('http://localhost:3000/'))).toBeNull();
    expect(await svc.leer(conCookie('basura'))).toBeNull();
    expect(await svc.leer(conCookie(`${valor.slice(0, -4)}AAAA`))).toBeNull();
    const doble = new Request('http://localhost:3000/', {
      headers: { cookie: `${config.nombreCookieSesion}=${valor}; ${config.nombreCookieSesion}=${valor}` },
    });
    expect(await svc.leer(doble)).toBeNull();
  });
  it('la cookie de la transacción de ingreso no sirve como cookie de sesión', async () => {
    const { svc } = await sesionIniciada();
    const peticion = new Request('http://localhost:3000/', {
      headers: { cookie: `${config.nombreCookieSesion}=${'x'.repeat(50)}` },
    });
    expect(await svc.leer(peticion)).toBeNull();
  });
  it('vence a las 8 horas desde el inicio, aunque se renueve (límite absoluto)', async () => {
    let t = AHORA;
    const { svc, valor } = await sesionIniciada(undefined, () => t);
    t = new Date(AHORA.getTime() + 8 * 3600_000 - 1000);
    expect(await svc.leer(conCookie(valor))).not.toBeNull();
    t = new Date(AHORA.getTime() + 8 * 3600_000 + 1000);
    expect(await svc.leer(conCookie(valor))).toBeNull();
  });
});

describe('obtenerAcceso: renovación con rotación, serializada por sid', () => {
  const iniciada = async (extra: { ahora?: () => Date } = {}) => {
    const { s, fetchFn } = montar();
    const base = servicio(fetchFn, extra.ahora);
    const r = await base.svc.iniciar(callbackOk());
    const valor = valorCookie(r, config.nombreCookieSesion)!;
    const sesion = (await base.svc.leer(conCookie(valor)))!;
    s.llamadas.length = 0;
    return { ...base, s, valor, sesion };
  };

  it('con el access token vigente no llama a Keycloak ni cambia la cookie', async () => {
    const { svc, s, sesion } = await iniciada();
    const a = await svc.obtenerAcceso(sesion);
    expect(a).toEqual({ ok: true, acceso: 'acceso-inicial', nuevaCookie: null });
    expect(s.llamadas).toHaveLength(0);
  });

  it('si está por vencer (< 30 s) renueva con el refresh token y el secreto del cliente, y reemite la cookie con el NUEVO refresh', async () => {
    let t = AHORA;
    const { svc, s, sesion } = await iniciada({ ahora: () => t });
    t = new Date(AHORA.getTime() + 280_000); // el token inicial dura 300 s en el almacén
    const a = await svc.obtenerAcceso(sesion);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.acceso).toBe('acceso-1');
    expect(s.llamadas).toHaveLength(1);
    expect(Object.fromEntries(s.llamadas[0]!.cuerpo!)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'refresco-0',
      client_id: 'sigiso-web',
      client_secret: SECRETO,
    });
    const nueva = await abrirSello(a.nuevaCookie!.split(';')[0]!.slice(config.nombreCookieSesion.length + 1), {
      claves: config.clavesSellado,
      ahora: t,
    });
    expect(nueva).toMatchObject({ sid: SID, rt: 'refresco-1', it: 'id.token.firmado' });
    expect(a.nuevaCookie).not.toMatch(/Max-Age|Expires/i);
  });

  it('el límite absoluto de 8 h NO se extiende al renovar (la cookie nueva conserva el inicio original)', async () => {
    let t = AHORA;
    const { svc, sesion } = await iniciada({ ahora: () => t });
    t = new Date(AHORA.getTime() + 280_000);
    const a = await svc.obtenerAcceso(sesion);
    if (!a.ok || !a.nuevaCookie) throw new Error('se esperaba cookie nueva');
    const nueva = await abrirSello(a.nuevaCookie.split(';')[0]!.slice(config.nombreCookieSesion.length + 1), {
      claves: config.clavesSellado,
      ahora: t,
    });
    expect(nueva.ini).toBe(Math.floor(AHORA.getTime() / 1000));
    // y esa cookie nueva vence a las 8 h del inicio, no 8 h después de renovar
    const tarde = new Date(AHORA.getTime() + 8 * 3600_000 + 5000);
    await expect(
      abrirSello(a.nuevaCookie.split(';')[0]!.slice(config.nombreCookieSesion.length + 1), {
        claves: config.clavesSellado,
        ahora: tarde,
      }),
    ).rejects.toThrow();
  });

  it('tres solicitudes simultáneas con el token vencido hacen UNA sola renovación (serialización por sid)', async () => {
    let t = AHORA;
    const { svc, s, sesion } = await iniciada({ ahora: () => t });
    t = new Date(AHORA.getTime() + 290_000);
    const [a, b, c] = await Promise.all([
      svc.obtenerAcceso(sesion),
      svc.obtenerAcceso(sesion),
      svc.obtenerAcceso(sesion),
    ]);
    expect(s.llamadas.filter((l) => l.url.endsWith('/token'))).toHaveLength(1);
    for (const x of [a, b, c]) expect(x).toMatchObject({ ok: true, acceso: 'acceso-1' });
  });

  it('una cookie ANTERIOR a la rotación usa el refresh más reciente de la memoria: no reutiliza uno ya usado (que revocaría la sesión)', async () => {
    let t = AHORA;
    const { svc, s, sesion, almacen } = await iniciada({ ahora: () => t });
    t = new Date(AHORA.getTime() + 290_000);
    await svc.obtenerAcceso(sesion); // rota refresco-0 → refresco-1
    t = new Date(AHORA.getTime() + 590_000);
    const rezagada = await svc.obtenerAcceso(sesion); // llega con la cookie vieja (refresco-0)
    expect(rezagada.ok).toBe(true);
    const usados = s.llamadas.filter((l) => l.url.endsWith('/token')).map((l) => l.cuerpo!.get('refresh_token'));
    expect(usados).toEqual(['refresco-0', 'refresco-1']);
    expect(almacen.obtener(SID)!.refresco).toBe('refresco-2');
  });

  it('si Keycloak dice invalid_grant (sesión inactiva, vencida o revocada): expirada, se borra la memoria y la cookie', async () => {
    let t = AHORA;
    const { svc, s, sesion, almacen } = await iniciada({ ahora: () => t });
    s.keycloak.refresco = 'invalid_grant';
    t = new Date(AHORA.getTime() + 290_000);
    const a = await svc.obtenerAcceso(sesion);
    expect(a).toMatchObject({ ok: false, motivo: 'expirada' });
    if (!a.ok) expect(a.limpiarCookie).toMatch(/Max-Age=0/);
    expect(almacen.obtener(SID)).toBeUndefined();
  });

  it('si Keycloak no responde: no_disponible (NO se cierra la sesión ni se borra nada)', async () => {
    let t = AHORA;
    const { svc, s, sesion, almacen } = await iniciada({ ahora: () => t });
    s.keycloak.refresco = 'caido';
    t = new Date(AHORA.getTime() + 290_000);
    const a = await svc.obtenerAcceso(sesion);
    expect(a).toMatchObject({ ok: false, motivo: 'no_disponible' });
    if (!a.ok) expect(a.limpiarCookie).toBeUndefined();
    expect(almacen.obtener(SID)).toBeDefined();
  });

  it('tras reiniciar el servidor (memoria vacía) se recupera con el refresh token de la cookie', async () => {
    const { svc, sesion, almacen } = await iniciada();
    almacen.borrar(SID);
    const a = await svc.obtenerAcceso(sesion);
    expect(a).toMatchObject({ ok: true, acceso: 'acceso-1' });
    expect(a.ok && a.nuevaCookie).toBeTruthy();
  });
});

describe('cerrar: registra, revoca, borra y cierra la sesión de Keycloak', () => {
  const POST = (valor: string | null, origen: string | null = 'http://localhost:3000') =>
    new Request('http://localhost:3000/auth/logout', {
      method: 'POST',
      headers: {
        ...(valor ? { cookie: `${config.nombreCookieSesion}=${valor}` } : {}),
        ...(origen === null ? {} : { origin: origen }),
      },
    });
  const iniciada = async () => {
    const { s, fetchFn, vigentes } = montar();
    const base = servicio(fetchFn);
    const r = await base.svc.iniciar(callbackOk());
    s.llamadas.length = 0;
    return { ...base, s, vigentes, valor: valorCookie(r, config.nombreCookieSesion)! };
  };

  it('en orden: POST /sesion/cierre (con el token de acceso), revocación del refresh token (RFC 7009) y redirección al cierre de Keycloak con id_token_hint', async () => {
    const { svc, s, valor } = await iniciada();
    const r = await svc.cerrar(POST(valor));
    expect(
      s.llamadas.map((l) => `${l.metodo} ${l.url.replace(config.apiUrl, 'API').replace(config.emisor, 'KC')}`),
    ).toEqual(['POST API/sesion/cierre', 'POST KC/protocol/openid-connect/revoke']);
    expect(s.llamadas[0]!.autorizacion).toBe('Bearer acceso-inicial');
    expect(Object.fromEntries(s.llamadas[1]!.cuerpo!)).toEqual({
      token: 'refresco-0',
      token_type_hint: 'refresh_token',
      client_id: 'sigiso-web',
      client_secret: SECRETO,
    });
    expect(r.status).toBe(303);
    const destino = new URL(r.headers.get('location')!);
    expect(`${destino.origin}${destino.pathname}`).toBe(`${config.emisor}/protocol/openid-connect/logout`);
    expect(destino.searchParams.get('id_token_hint')).toBe('id.token.firmado');
    expect(destino.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000/');
    expect(destino.searchParams.get('client_id')).toBe('sigiso-web');
  });

  it('si el refresh rotó, revoca el VIGENTE (el de la memoria) aunque llegue una cookie con el anterior', async () => {
    let t = AHORA;
    const { s, fetchFn } = montar();
    const { svc } = servicio(fetchFn, () => t);
    const r = await svc.iniciar(callbackOk());
    const valor = valorCookie(r, config.nombreCookieSesion)!;
    t = new Date(AHORA.getTime() + 290_000); // el access token inicial ya está por vencer
    const cierre = await svc.cerrar(POST(valor)); // la cookie sigue siendo la original (refresco-0)
    const revocadas = s.llamadas.filter((l) => l.url.endsWith('/revoke')).map((l) => l.cuerpo!.get('token'));
    expect(revocadas).toEqual(['refresco-1']);
    expect(cierre.status).toBe(303);
  });

  it('pide al navegador olvidar su caché (Clear-Site-Data) para que «atrás» no muestre la sesión cerrada (H1.4)', async () => {
    const { svc, valor } = await iniciada();
    const r = await svc.cerrar(POST(valor));
    expect(r.headers.get('clear-site-data')).toBe('"cache"');
  });

  it('borra la cookie de sesión y el access token de la memoria', async () => {
    const { svc, almacen, valor } = await iniciada();
    const r = await svc.cerrar(POST(valor));
    expect(r.headers.getSetCookie().find((c) => c.startsWith(`${config.nombreCookieSesion}=;`))).toMatch(/Max-Age=0/);
    expect(almacen.obtener(SID)).toBeUndefined();
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('REPRODUCIR la cookie robada después del cierre: el refresh ya está revocado → expirada (401)', async () => {
    const { svc, s, valor } = await iniciada();
    await svc.cerrar(POST(valor));
    s.llamadas.length = 0;
    const sesion = (await svc.leer(conCookie(valor)))!; // la cookie sellada sigue abriéndose…
    expect(sesion).not.toBeNull();
    const a = await svc.obtenerAcceso(sesion); // …pero ya no sirve para nada
    expect(a).toMatchObject({ ok: false, motivo: 'expirada' });
  });

  it('exige Origin propio: ausente, «null» o ajeno → 403 SIN llamar a nadie ni cerrar nada', async () => {
    for (const origen of [
      null,
      'null',
      'https://evil.example',
      'http://localhost:3001',
      'http://localhost:3000.evil.example',
    ]) {
      const { svc, s, almacen, valor } = await iniciada();
      const r = await svc.cerrar(POST(valor, origen));
      expect(r.status, String(origen)).toBe(403);
      expect(s.llamadas, String(origen)).toEqual([]);
      expect(almacen.obtener(SID), String(origen)).toBeDefined();
    }
  });

  it('un GET nunca cierra sesión', async () => {
    const { svc, s, valor } = await iniciada();
    const r = await svc.cerrar(
      new Request('http://localhost:3000/auth/logout', {
        method: 'GET',
        headers: { cookie: `${config.nombreCookieSesion}=${valor}`, origin: 'http://localhost:3000' },
      }),
    );
    expect(r.status).toBe(405);
    expect(s.llamadas).toEqual([]);
  });

  it('sin sesión: igual redirige al inicio y borra la cookie (idempotente), sin llamadas', async () => {
    const { svc, s } = await iniciada();
    const r = await svc.cerrar(POST(null));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://localhost:3000/');
    expect(s.llamadas).toEqual([]);
  });

  it('si el registro del cierre falla, la sesión SE CIERRA igual (revoca y borra): no se deja abierta por un fallo de la bitácora', async () => {
    const { svc, s, almacen, valor } = await iniciada();
    s.api = { estado: 500 };
    const r = await svc.cerrar(POST(valor));
    expect(s.revocados.has('refresco-0')).toBe(true);
    expect(almacen.obtener(SID)).toBeUndefined();
    expect(r.status).toBe(303);
  });

  it('si Keycloak no revoca (error o caído), borra la cookie y la memoria de todos modos y aun así cierra la sesión SSO', async () => {
    const { svc, s, almacen, valor } = await iniciada();
    s.keycloak.revocar = 500;
    const r = await svc.cerrar(POST(valor));
    expect(almacen.obtener(SID)).toBeUndefined();
    expect(r.headers.get('location')).toContain('/protocol/openid-connect/logout');
  });
});

describe('origenValido', () => {
  const peticion = (origen: string | null) =>
    new Request('http://localhost:3000/x', { method: 'POST', headers: origen === null ? {} : { origin: origen } });
  it('acepta solo el origen propio exacto', () => {
    expect(origenValido(peticion('http://localhost:3000'), 'http://localhost:3000')).toBe(true);
    for (const o of [
      null,
      'null',
      '',
      'http://localhost:3000/',
      'https://localhost:3000',
      'http://localhost:3000.evil.example',
      'http://evil.example',
    ]) {
      expect(origenValido(peticion(o), 'http://localhost:3000'), String(o)).toBe(false);
    }
  });
});

describe('AlmacenAcceso: empresa de la sesión', () => {
  it('guarda la empresa por sesión y vence a la hora indicada', () => {
    const a = new AlmacenAcceso();
    a.guardarEmpresa('s1', 'empresa-a', 1000);
    expect(a.empresaDe('s1', 999)).toBe('empresa-a');
    expect(a.empresaDe('s1', 1000)).toBeUndefined();
    expect(a.empresaDe('s1', 500)).toBeUndefined(); // al vencer se descartó
    expect(a.empresaDe('otra', 0)).toBeUndefined();
  });
  it('borrar la sesión también olvida su empresa', () => {
    const a = new AlmacenAcceso();
    a.guardarEmpresa('s1', 'empresa-a', 10_000);
    a.borrar('s1');
    expect(a.empresaDe('s1', 0)).toBeUndefined();
  });
  it('tiene tope y expulsa la más antigua', () => {
    const a = new AlmacenAcceso(2);
    a.guardarEmpresa('s1', 'a', 10_000);
    a.guardarEmpresa('s2', 'b', 10_000);
    a.guardarEmpresa('s3', 'c', 10_000);
    expect(a.empresaDe('s1', 0)).toBeUndefined();
    expect(a.empresaDe('s3', 0)).toBe('c');
  });
  it('actualizar la empresa de una sesión la marca como la más reciente', () => {
    const a = new AlmacenAcceso(2);
    a.guardarEmpresa('s1', 'a', 10_000);
    a.guardarEmpresa('s2', 'b', 10_000);
    a.guardarEmpresa('s1', 'a2', 10_000);
    a.guardarEmpresa('s3', 'c', 10_000);
    expect(a.empresaDe('s2', 0)).toBeUndefined();
    expect(a.empresaDe('s1', 0)).toBe('a2');
  });
});

describe('AlmacenAcceso', () => {
  it('guarda, devuelve y borra; tiene tope y expulsa lo más antiguo', () => {
    const a = new AlmacenAcceso(3);
    a.guardar('s1', { acceso: 'a1', refresco: 'r1', expiraEn: 1 });
    a.guardar('s2', { acceso: 'a2', refresco: 'r2', expiraEn: 1 });
    a.guardar('s3', { acceso: 'a3', refresco: 'r3', expiraEn: 1 });
    a.guardar('s4', { acceso: 'a4', refresco: 'r4', expiraEn: 1 });
    expect(a.obtener('s1')).toBeUndefined();
    expect(a.obtener('s4')).toMatchObject({ acceso: 'a4' });
    a.borrar('s4');
    expect(a.obtener('s4')).toBeUndefined();
    expect(a.tamano).toBe(2);
  });
  it('actualizar una sesión la marca como la más reciente: al llegar otra, se expulsa la más antigua, no la actualizada', () => {
    const a = new AlmacenAcceso(2);
    a.guardar('s1', { acceso: 'a1', refresco: 'r1', expiraEn: 1 });
    a.guardar('s2', { acceso: 'a2', refresco: 'r2', expiraEn: 1 });
    a.guardar('s1', { acceso: 'a1b', refresco: 'r1b', expiraEn: 2 });
    a.guardar('s3', { acceso: 'a3', refresco: 'r3', expiraEn: 1 });
    expect(a.obtener('s2')).toBeUndefined();
    expect(a.obtener('s1')).toMatchObject({ acceso: 'a1b' });
    expect(a.obtener('s3')).toBeDefined();
  });
  it('actualizar una sesión existente no la expulsa ni crece', () => {
    const a = new AlmacenAcceso(2);
    a.guardar('s1', { acceso: 'a1', refresco: 'r1', expiraEn: 1 });
    a.guardar('s2', { acceso: 'a2', refresco: 'r2', expiraEn: 1 });
    a.guardar('s1', { acceso: 'a1b', refresco: 'r1b', expiraEn: 2 });
    expect(a.tamano).toBe(2);
    expect(a.obtener('s2')).toBeDefined();
    expect(a.obtener('s1')).toMatchObject({ acceso: 'a1b' });
  });
});
