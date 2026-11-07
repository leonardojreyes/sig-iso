import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { empresaActual, empresaActualOpcional } from '@sig/tenancy/contexto';
import { TokenVerifierJose, VerificadorNoDisponibleError } from '@sig/autenticacion';
import type { EventoBitacora } from '@sig/auditoria';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AutenticacionModule } from './autenticacion.module.js';
import { Publico } from './publico.decorator.js';
import { aplicarSeguridadHttp } from './seguridad-http.js';

// Pruebas de la guardia de autenticación con una aplicación Nest REAL escuchando en un puerto local.
const EMISOR = 'http://127.0.0.1:8080/realms/sigiso';
const AUDIENCIA = 'sigiso-api';
const CLIENTE = 'sigiso-web';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USUARIO_A = '44444444-4444-4444-8444-444444444444';
const USUARIO_B = '55555555-5555-4555-8555-555555555555';
const seg = (d: Date) => Math.floor(d.getTime() / 1000);

@Controller('prueba')
class PruebaController {
  /** Protegida por omisión (sin @Publico). Devuelve lo que ve el código de negocio. */
  @Get('empresa')
  async empresa() {
    await new Promise((r) => setTimeout(r, Math.random() * 15));
    return { empresa: empresaActual() };
  }

  @Publico()
  @Get('publica')
  publica() {
    return { contexto: empresaActualOpcional() ?? null };
  }

  @Get('explota')
  explota(): never {
    throw new Error('detalle-interno-que-no-debe-salir postgres://usuario:clave@host/base');
  }
}

@Module({ controllers: [PruebaController] })
class PruebaModule {}

describe('autenticación en la API (ADR 027)', () => {
  let app: INestApplication;
  let base = '';
  let par: Awaited<ReturnType<typeof generateKeyPair>>;
  let otraClave: Awaited<ReturnType<typeof generateKeyPair>>;
  let ahora = new Date('2026-11-07T12:00:00.000Z');
  let eventos: EventoBitacora[] = [];
  let hechosFallan = false;
  let claves: JWTVerifyGetKey;

  const firmar = (extra: Record<string, unknown> = {}, quitar: string[] = [], clave = par) => {
    const p: Record<string, unknown> = {
      iss: EMISOR, aud: AUDIENCIA, azp: CLIENTE, typ: 'Bearer', sub: USUARIO_A, empresa_id: A,
      iat: seg(ahora) - 10, exp: seg(ahora) + 290, ...extra,
    };
    for (const q of quitar) delete p[q];
    return new SignJWT(p as JWTPayload).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).sign(clave.privateKey);
  };

  const pedir = (ruta: string, cabeceras: Record<string, string> = {}, metodo = 'GET') => fetch(`${base}${ruta}`, { method: metodo, headers: cabeceras });
  const conToken = async (ruta: string, token?: string, extra: Record<string, string> = {}) =>
    pedir(ruta, { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra });

  beforeAll(async () => {
    par = await generateKeyPair('RS256');
    otraClave = await generateKeyPair('RS256');
    claves = createLocalJWKSet({ keys: [{ ...(await exportJWK(par.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] });
    const verificador = new TokenVerifierJose({
      emisor: EMISOR, audiencia: AUDIENCIA, clienteAutorizado: CLIENTE, ahora: () => ahora,
      claves: (cabecera, entrada) => claves(cabecera, entrada),
    });
    const modulo = await Test.createTestingModule({
      imports: [
        AutenticacionModule.register({
          verificador,
          hechos: {
            registrar: async (e) => { if (hechosFallan) throw new Error('bitácora caída'); eventos.push(e); },
            registrarUnaVez: async (e) => { if (hechosFallan) throw new Error('bitácora caída'); eventos.push(e); return 'registrado'; },
          },
          ahora: () => ahora.getTime(),
          ventanaTokenInvalidoMs: 60_000,
        }),
        PruebaModule,
      ],
    }).compile();
    app = modulo.createNestApplication();
    aplicarSeguridadHttp(app, { CORS_ORIGINS: 'http://localhost:3000' });
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => { await app?.close(); });

  let numeroDePrueba = 0;
  beforeEach(() => {
    // El limitador de `token.invalido` es del módulo y se comparte entre pruebas: cada una arranca una hora más tarde.
    ahora = new Date(new Date('2026-11-07T12:00:00.000Z').getTime() + ++numeroDePrueba * 3_600_000);
    eventos = [];
    hechosFallan = false;
  });

  const esProblema = async (r: Response, status: number, codigo: string) => {
    expect(r.status).toBe(status);
    expect(r.headers.get('content-type')).toMatch(/^application\/problem\+json/);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const cuerpo = (await r.json()) as Record<string, unknown>;
    expect(Object.keys(cuerpo).sort()).toEqual(['codigo', 'status', 'title', 'type']);
    expect(cuerpo).toMatchObject({ type: 'about:blank', status, codigo });
    return cuerpo;
  };

  describe('rutas protegidas por omisión', () => {
    it('sin token → 401 no_autenticado, sin registrar nada', async () => {
      await esProblema(await conToken('/prueba/empresa'), 401, 'no_autenticado');
      expect(eventos).toEqual([]);
    });

    it('con token válido → 200 y la empresa del token', async () => {
      const r = await conToken('/prueba/empresa', await firmar());
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(await r.json()).toEqual({ empresa: A });
    });

    it('la empresa del token MANDA aunque el cliente envíe otra por encabezado, consulta o cuerpo', async () => {
      const token = await firmar();
      for (const ruta of [`/prueba/empresa?empresa=${B}`, `/prueba/empresa?tenant=${B}`, `/prueba/empresa?empresaId=${B}&empresa_id=${B}`]) {
        expect(await (await conToken(ruta, token)).json()).toEqual({ empresa: A });
      }
      const conEncabezados = await conToken('/prueba/empresa', token, { 'x-empresa': B, 'x-tenant-id': B, 'x-empresa-id': B, host: `${B}.ejemplo.test` });
      expect(await conEncabezados.json()).toEqual({ empresa: A });
    });

    it('peticiones concurrentes de A y B no mezclan su empresa', async () => {
      const [ta, tb] = [await firmar(), await firmar({ empresa_id: B, sub: USUARIO_B })];
      const pares = await Promise.all(Array.from({ length: 40 }, (_, i) => conToken('/prueba/empresa', i % 2 === 0 ? ta : tb).then((r) => r.json())));
      expect(pares.map((p) => (p as { empresa: string }).empresa)).toEqual(Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? A : B)));
    });

    it('el contexto de empresa no se filtra a la petición siguiente', async () => {
      await conToken('/prueba/empresa', await firmar());
      const r = await (await pedir('/prueba/publica')).json();
      expect(r).toEqual({ contexto: null });
    });
  });

  describe('token inválido → 401 y un hecho `token.invalido`', () => {
    const casos: [string, () => Promise<string>, string][] = [
      ['vencido', () => firmar({ iat: seg(ahora) - 600, exp: seg(ahora) - 300 }), 'token_vencido'],
      ['firmado con otra clave', () => firmar({}, [], otraClave), 'token_alterado'],
      ['sin empresa', () => firmar({}, ['empresa_id']), 'sin_empresa'],
      ['con otra audiencia', () => firmar({ aud: 'account' }), 'token_alterado'],
    ];

    it.each(casos)('%s', async (_n, crear, motivo) => {
      const token = await crear();
      await esProblema(await conToken('/prueba/empresa', token), 401, 'no_autenticado');
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toEqual({ empresaId: null, actor: { tipo: 'sistema' }, accion: 'token.invalido', resultado: 'rechazado', motivo });
      expect(JSON.stringify(eventos)).not.toContain(token.split('.')[1]);
    });

    it('todas las respuestas 401 son idénticas: no revelan por qué falló', async () => {
      const cuerpos = new Set<string>();
      for (const [, crear] of casos) cuerpos.add(JSON.stringify(await (await conToken('/prueba/empresa', await crear())).json()));
      cuerpos.add(JSON.stringify(await (await conToken('/prueba/empresa')).json()));
      expect(cuerpos.size).toBe(1);
    });

    it.each([
      ['esquema Basic', 'Basic YWJjOmRlZg=='],
      ['sin token', 'Bearer'],
      ['dos valores', 'Bearer a b'],
      ['caracteres ajenos', 'Bearer no.es.un-token!'],
      ['token enorme (9000 caracteres)', `Bearer ${'a'.repeat(9000)}`],
      ['no es un JWT', 'Bearer a.b.c'],
    ])('una cabecera presente pero inválida (%s) → 401 con hecho token_alterado', async (_nombre, cab) => {
      await esProblema(await pedir('/prueba/empresa', { authorization: cab }), 401, 'no_autenticado');
      expect(eventos.map((e) => e.motivo)).toEqual(['token_alterado']);
    });

    it('el hecho se registra una vez por motivo y ventana: 30 intentos no inflan la bitácora', async () => {
      const malo = await firmar({}, [], otraClave);
      const vencido = await firmar({ iat: seg(ahora) - 600, exp: seg(ahora) - 300 });
      for (let i = 0; i < 15; i++) {
        await conToken('/prueba/empresa', malo);
        await conToken('/prueba/empresa', vencido);
      }
      expect(eventos.map((e) => e.motivo).sort()).toEqual(['token_alterado', 'token_vencido']);
    });

    it('pasada la ventana vuelve a registrarse', async () => {
      const malo = await firmar({}, [], otraClave);
      await conToken('/prueba/empresa', malo);
      await conToken('/prueba/empresa', malo);
      expect(eventos).toHaveLength(1);
      ahora = new Date(ahora.getTime() + 60_000);
      await conToken('/prueba/empresa', await firmar({}, [], otraClave));
      expect(eventos).toHaveLength(2);
    });

    it('si NO se puede registrar el rechazo, responde 500 (no se traga el error ni se deja pasar)', async () => {
      hechosFallan = true;
      await esProblema(await conToken('/prueba/empresa', await firmar({}, [], otraClave)), 500, 'error_interno');
    });
  });

  describe('si no se puede verificar (servicio de claves caído)', () => {
    it('responde 500 error_interno, no se acepta nada y NO se registra como token.invalido', async () => {
      const token = await firmar();
      const anterior = claves;
      claves = (async () => { throw new TypeError('fetch failed http://127.0.0.1:8080/secreto'); }) as unknown as JWTVerifyGetKey;
      try {
        const cuerpo = await esProblema(await conToken('/prueba/empresa', token), 500, 'error_interno');
        expect(JSON.stringify(cuerpo)).not.toContain('secreto');
      } finally {
        claves = anterior;
      }
      expect(eventos).toEqual([]);
    });
    it('el error es VerificadorNoDisponibleError (no un token inválido)', () => {
      expect(new VerificadorNoDisponibleError()).toBeInstanceOf(Error);
    });
  });

  describe('rutas públicas', () => {
    it('/prueba/publica responde sin token y sin contexto de empresa', async () => {
      const r = await pedir('/prueba/publica');
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ contexto: null });
      expect(eventos).toEqual([]);
    });
    it('una ruta pública no valida un token presente (no se registra nada)', async () => {
      expect((await conToken('/prueba/publica', 'basura')).status).toBe(200);
      expect(eventos).toEqual([]);
    });
  });

  describe('errores y rutas inexistentes (problem+json cerrado)', () => {
    it('una ruta inexistente da 404 no_encontrado', async () => {
      await esProblema(await pedir('/no-existe'), 404, 'no_encontrado');
    });
    it('un error interno da 500 error_interno sin detalles ni cadenas de conexión', async () => {
      const r = await conToken('/prueba/explota', await firmar());
      const cuerpo = await esProblema(r, 500, 'error_interno');
      expect(JSON.stringify(cuerpo)).not.toMatch(/detalle-interno|postgres|clave/);
    });
    it('el título es un texto fijo en español', async () => {
      const c = await (await conToken('/prueba/empresa')).json();
      expect(c).toMatchObject({ title: 'No autenticado' });
    });
  });

  describe('cabeceras de seguridad y CORS', () => {
    it('las respuestas llevan nosniff, no-referrer, no-store y una política de contenido cerrada', async () => {
      const r = await conToken('/prueba/empresa', await firmar());
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('no-referrer');
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
      expect(r.headers.get('x-powered-by')).toBeNull();
    });

    it('admite solo el origen de la lista blanca', async () => {
      const permitido = await pedir('/prueba/publica', { origin: 'http://localhost:3000' });
      expect(permitido.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
      const ajeno = await pedir('/prueba/publica', { origin: 'http://evil.example' });
      expect(ajeno.headers.get('access-control-allow-origin')).toBeNull();
      const preAjeno = await pedir('/prueba/empresa', { origin: 'http://evil.example', 'access-control-request-method': 'GET' }, 'OPTIONS');
      expect(preAjeno.headers.get('access-control-allow-origin')).toBeNull();
    });
  });
});
