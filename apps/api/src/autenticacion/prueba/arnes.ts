// Arnés de pruebas de la API: aplicación Nest REAL en un puerto local, tokens firmados con claves generadas al vuelo.
import { Controller, Get, ForbiddenException, Module, NotFoundException, type DynamicModule, type INestApplication, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { validarEvento, type EventoBitacora } from '@sig/auditoria';
import { TokenVerifierJose } from '@sig/autenticacion';
import type { Tracer } from '@opentelemetry/api';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { AutenticacionModule } from '../autenticacion.module.js';
import type { RegistradorHechos } from '../registrador-token-invalido.js';
import { aplicarSeguridadHttp } from '../seguridad-http.js';
import { crearMiddlewareTrazas } from '../../telemetria/middleware-trazas.js';

export const EMISOR = 'http://127.0.0.1:8080/realms/sigiso';
export const AUDIENCIA = 'sigiso-api';
export const CLIENTE = 'sigiso-web';
const seg = (d: Date) => Math.floor(d.getTime() / 1000);

export interface Arnes {
  readonly app: INestApplication;
  readonly base: string;
  firmar(empresaId: string, usuarioId: string, extra?: Record<string, unknown>): Promise<string>;
  pedir(ruta: string, token?: string, metodo?: string, cuerpo?: unknown): Promise<Response>;
  cerrar(): Promise<void>;
}

export const crearArnes = async (opciones: {
  controladores?: Type[];
  modulos?: DynamicModule[];
  hechos: RegistradorHechos;
  entorno?: Record<string, string>;
  /** Límites de frecuencia; por omisión altísimos para que no estorben a las demás pruebas. */
  limites?: { persona: number; empresa: number };
  /** Reloj en milisegundos del limitador y de `token.invalido`. */
  ahora?: () => number;
  /** Si se indica, las solicitudes se trazan con este trazador (como en `main.ts`). */
  trazador?: Tracer;
}): Promise<Arnes> => {
  const par = await generateKeyPair('RS256');
  const claves = createLocalJWKSet({ keys: [{ ...(await exportJWK(par.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] });
  const verificador = new TokenVerifierJose({ emisor: EMISOR, audiencia: AUDIENCIA, clienteAutorizado: CLIENTE, claves });

  @Module({ controllers: opciones.controladores ?? [] })
  class PruebaModule {}

  const modulo = await Test.createTestingModule({
    imports: [
      AutenticacionModule.register({ verificador, hechos: opciones.hechos, limites: opciones.limites ?? { persona: 100_000, empresa: 100_000 }, ...(opciones.ahora ? { ahora: opciones.ahora } : {}) }),
      PruebaModule,
      ...(opciones.modulos ?? []),
    ],
  }).compile();
  const app = modulo.createNestApplication();
  if (opciones.trazador) app.use(crearMiddlewareTrazas(opciones.trazador));
  aplicarSeguridadHttp(app, opciones.entorno ?? {});
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');

  return {
    app,
    base,
    firmar: (empresaId, usuarioId, extra = {}) => {
      const ahora = new Date();
      const payload: JWTPayload = { iss: EMISOR, aud: AUDIENCIA, azp: CLIENTE, typ: 'Bearer', sub: usuarioId, empresa_id: empresaId, iat: seg(ahora) - 5, exp: seg(ahora) + 290, ...extra };
      return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).sign(par.privateKey);
    },
    pedir: (ruta, token, metodo = 'GET', cuerpo) =>
      fetch(`${base}${ruta}`, {
        method: metodo,
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
      }),
    cerrar: () => app.close(),
  };
};

/** Hechos en memoria que se pueden hacer fallar. Validan contra el catálogo cerrado de la bitácora, como la implementación real. */
export const hechosEnMemoria = () => {
  const estado = { eventos: [] as EventoBitacora[], falla: false, origenes: new Set<string>() };
  const hechos: RegistradorHechos = {
    registrar: async (e) => {
      if (estado.falla) throw new Error('bitácora caída');
      validarEvento(e);
      estado.eventos.push(e);
    },
    registrarUnaVez: async (e) => {
      if (estado.falla) throw new Error('bitácora caída');
      const registro = validarEvento(e);
      if (registro.origenId === null) throw new Error('registrarUnaVez exige origenId');
      if (estado.origenes.has(registro.origenId)) return 'ya_existia';
      estado.origenes.add(registro.origenId);
      estado.eventos.push(e);
      return 'registrado';
    },
  };
  return { estado, hechos };
};

export { Controller, Get, ForbiddenException, NotFoundException };
