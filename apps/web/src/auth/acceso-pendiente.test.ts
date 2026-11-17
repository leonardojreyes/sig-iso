// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { leerCodigoDeAcceso } from './acceso-pendiente';
import { leerConfiguracion } from './configuracion';
import { sellar } from './sellado';

const AHORA = new Date('2026-11-16T10:00:00Z');
const config = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
const sellos = (carga: Record<string, unknown>, vigenciaSegundos = 600) => sellar(carga, { claves: config.clavesSellado, vigenciaSegundos, ahora: AHORA });
const cookie = (valor: string, nombre = config.nombreCookieAcceso) => `${nombre}=${valor}`;
const VENCE = '2026-11-23T10:00:00.000Z';

describe('leerCodigoDeAcceso', () => {
  it('devuelve el código y el plazo de una cookie sellada vigente', async () => {
    const r = await leerCodigoDeAcceso(cookie(await sellos({ v: 1, c: 'K7F2-9QXM', e: VENCE })), config, AHORA);
    expect(r).toEqual({ codigo: 'K7F2-9QXM', venceEn: new Date(VENCE) });
  });

  it('sin cookie, vacía, repetida o ilegible: null', async () => {
    expect(await leerCodigoDeAcceso(null, config, AHORA)).toBeNull();
    expect(await leerCodigoDeAcceso('', config, AHORA)).toBeNull();
    expect(await leerCodigoDeAcceso(cookie(''), config, AHORA)).toBeNull();
    expect(await leerCodigoDeAcceso(cookie('basura'), config, AHORA)).toBeNull();
    const buena = await sellos({ v: 1, c: 'K7F2-9QXM', e: VENCE });
    expect(await leerCodigoDeAcceso(`${cookie(buena)}; ${cookie(buena)}`, config, AHORA)).toBeNull();
  });

  it('alterada o sellada con otra clave: null', async () => {
    const buena = await sellos({ v: 1, c: 'K7F2-9QXM', e: VENCE });
    expect(await leerCodigoDeAcceso(cookie(`${buena.slice(0, -4)}AAAA`), config, AHORA)).toBeNull();
    const otra = leerConfiguracion({ OIDC_CLIENT_SECRET: randomBytes(18).toString('base64url'), SESSION_SEALING_KEY: randomBytes(32).toString('base64url') });
    expect(await leerCodigoDeAcceso(cookie(await sellar({ v: 1, c: 'K7F2-9QXM', e: VENCE }, { claves: otra.clavesSellado, vigenciaSegundos: 600, ahora: AHORA })), config, AHORA)).toBeNull();
  });

  it('vencida (la cookie dura a lo sumo 10 minutos) o con el plazo de la solicitud ya pasado: null', async () => {
    const buena = await cookie(await sellos({ v: 1, c: 'K7F2-9QXM', e: VENCE }, 60));
    expect(await leerCodigoDeAcceso(buena, config, new Date(AHORA.getTime() + 61_000))).toBeNull();
    expect(await leerCodigoDeAcceso(cookie(await sellos({ v: 1, c: 'K7F2-9QXM', e: '2026-11-01T00:00:00.000Z' })), config, AHORA)).toBeNull();
  });

  it.each([
    ['código con caracteres ambiguos', { v: 1, c: '0000-0000', e: VENCE }],
    ['código en minúsculas', { v: 1, c: 'k7f2-9qxm', e: VENCE }],
    ['versión distinta', { v: 2, c: 'K7F2-9QXM', e: VENCE }],
    ['sin plazo', { v: 1, c: 'K7F2-9QXM' }],
    ['plazo que no es fecha', { v: 1, c: 'K7F2-9QXM', e: 'mañana' }],
    ['una cookie de SESIÓN sellada (otra forma)', { v: 1, sid: 'x', rt: 'y', it: 'z', ini: 1 }],
  ])('rechaza %s', async (_c, carga) => {
    expect(await leerCodigoDeAcceso(cookie(await sellos(carga)), config, AHORA)).toBeNull();
  });

  it('solo mira la cookie de acceso: la de sesión no cuenta', async () => {
    const valor = await sellos({ v: 1, c: 'K7F2-9QXM', e: VENCE });
    expect(await leerCodigoDeAcceso(cookie(valor, config.nombreCookieSesion), config, AHORA)).toBeNull();
  });
});
