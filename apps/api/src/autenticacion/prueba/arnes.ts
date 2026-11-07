// Arnés de pruebas de la API: aplicación Nest REAL en un puerto local, tokens firmados con claves generadas al vuelo.
import { Controller, Get, ForbiddenException, Module, NotFoundException, type INestApplication, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { validarEvento, type EventoBitacora } from '@sig/auditoria';
import { TokenVerifierJose } from '@sig/autenticacion';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { AutenticacionModule } from '../autenticacion.module.js';
import type { RegistradorHechos } from '../registrador-token-invalido.js';
import { aplicarSeguridadHttp } from '../seguridad-http.js';

export const EMISOR = 'http://127.0.0.1:8080/realms/sigiso';
export const AUDIENCIA = 'sigiso-api';
export const CLIENTE = 'sigiso-web';
const seg = (d: Date) => Math.floor(d.getTime() / 1000);

export interface Arnes {
  readonly app: INestApplication;
  readonly base: string;
  firmar(empresaId: string, usuarioId: string, extra?: Record<string, unknown>): Promise<string>;
  pedir(ruta: string, token?: string): Promise<Response>;
  cerrar(): Promise<void>;
}

export const crearArnes = async (opciones: { controladores: Type[]; hechos: RegistradorHechos; entorno?: Record<string, string> }): Promise<Arnes> => {
  const par = await generateKeyPair('RS256');
  const claves = createLocalJWKSet({ keys: [{ ...(await exportJWK(par.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }] });
  const verificador = new TokenVerifierJose({ emisor: EMISOR, audiencia: AUDIENCIA, clienteAutorizado: CLIENTE, claves });

  @Module({ controllers: opciones.controladores })
  class PruebaModule {}

  const modulo = await Test.createTestingModule({
    imports: [AutenticacionModule.register({ verificador, hechos: opciones.hechos }), PruebaModule],
  }).compile();
  const app = modulo.createNestApplication();
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
    pedir: (ruta, token) => fetch(`${base}${ruta}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }),
    cerrar: () => app.close(),
  };
};

/** Hechos en memoria que se pueden hacer fallar. Validan contra el catálogo cerrado de la bitácora, como la implementación real. */
export const hechosEnMemoria = () => {
  const estado = { eventos: [] as EventoBitacora[], falla: false };
  const hechos: RegistradorHechos = {
    registrar: async (e) => {
      if (estado.falla) throw new Error('bitácora caída');
      validarEvento(e);
      estado.eventos.push(e);
    },
  };
  return { estado, hechos };
};

export { Controller, Get, ForbiddenException, NotFoundException };
