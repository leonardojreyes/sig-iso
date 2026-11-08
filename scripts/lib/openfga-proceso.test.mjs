import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { argumentosEjecucion, argumentosMigracion, entornoOpenfga } from './openfga-proceso.mjs';
import { leerPid, procesoVivo } from './proceso-local.mjs';

const uri = 'postgresql://sigiso_openfga:clave-de-prueba@127.0.0.1:5432/openfga';
const token = 'token-de-prueba-0123456789';
const entorno = (extra = {}, base = {}) => entornoOpenfga({ datastoreUri: uri, apiToken: token, base, ...extra });

describe('argumentos', () => {
  it('ejecución y migración son subcomandos simples, sin secretos en los argumentos', () => {
    expect(argumentosEjecucion()).toEqual(['run']);
    expect(argumentosMigracion()).toEqual(['migrate']);
  });
});

describe('entornoOpenfga (solo local, con autenticación)', () => {
  const e = entorno();
  it('HTTP y gRPC escuchan solo en 127.0.0.1, en puertos distintos', () => {
    expect(e.OPENFGA_HTTP_ADDR).toBe('127.0.0.1:8081');
    expect(e.OPENFGA_GRPC_ADDR).toBe('127.0.0.1:8082');
    for (const [k, v] of Object.entries(e)) if (/_ADDR$/.test(k)) expect(v, k).toMatch(/^127\.0\.0\.1:\d+$/);
  });
  it('acepta otros puertos válidos y rechaza los inválidos', () => {
    expect(entorno({ puertoHttp: 9091, puertoGrpc: 9092 }).OPENFGA_HTTP_ADDR).toBe('127.0.0.1:9091');
    for (const p of [0, 65536, 1.5, '8081', NaN])
      expect(() => entorno({ puertoHttp: p }), String(p)).toThrow(/puerto/i);
    expect(() => entorno({ puertoHttp: 8081, puertoGrpc: 8081 })).toThrow(/distintos/i);
  });
  it('exige la clave compartida (preshared) y no deja un modo sin autenticar', () => {
    expect(e.OPENFGA_AUTHN_METHOD).toBe('preshared');
    expect(e.OPENFGA_AUTHN_PRESHARED_KEYS).toBe(token);
    expect(() => entornoOpenfga({ datastoreUri: uri, apiToken: '', base: {} })).toThrow(/clave/i);
    expect(() => entornoOpenfga({ datastoreUri: uri, apiToken: 'corta', base: {} })).toThrow(/clave/i);
  });
  it('apaga playground, métricas y perfilador (abrirían puertos o interfaces extra)', () => {
    expect(e.OPENFGA_PLAYGROUND_ENABLED).toBe('false');
    expect(e.OPENFGA_METRICS_ENABLED).toBe('false');
    expect(e.OPENFGA_PROFILER_ENABLED).toBe('false');
    expect(e.OPENFGA_TRACE_ENABLED ?? 'false').toBe('false');
  });
  it('usa PostgreSQL con la URI dada, por variable del proceso, y acota las conexiones', () => {
    expect(e.OPENFGA_DATASTORE_ENGINE).toBe('postgres');
    expect(e.OPENFGA_DATASTORE_URI).toBe(uri);
    expect(Number(e.OPENFGA_DATASTORE_MAX_OPEN_CONNS)).toBeLessThanOrEqual(10);
  });
  it('rechaza una URI que no sea de PostgreSQL', () => {
    for (const malo of ['', 'mysql://u:p@h/db', 'http://x', 'no es una url']) {
      expect(() => entornoOpenfga({ datastoreUri: malo, apiToken: token, base: {} }), malo).toThrow(/postgres/i);
    }
  });
  it('no hereda variables OPENFGA_* del entorno del usuario ni otras opciones que cambien el comportamiento', () => {
    const sucio = entorno(
      {},
      {
        OPENFGA_HTTP_ADDR: '0.0.0.0:80',
        OPENFGA_AUTHN_METHOD: 'none',
        OPENFGA_PLAYGROUND_ENABLED: 'true',
        OPENFGA_LOG_LEVEL: 'debug',
        PATH: '/bin',
      },
    );
    expect(sucio.OPENFGA_HTTP_ADDR).toBe('127.0.0.1:8081');
    expect(sucio.OPENFGA_AUTHN_METHOD).toBe('preshared');
    expect(sucio.OPENFGA_PLAYGROUND_ENABLED).toBe('false');
    expect(sucio.OPENFGA_LOG_LEVEL).toBeUndefined();
    expect(sucio.PATH).toBe('/bin');
  });
});

describe('proceso-local', () => {
  let carpeta;
  beforeEach(() => {
    carpeta = mkdtempSync(join(tmpdir(), 'pl-'));
  });
  afterEach(() => rmSync(carpeta, { recursive: true, force: true }));
  it('leerPid lee un entero válido y devuelve null si falta, está vacío, es 1 o no es número', () => {
    const f = join(carpeta, 'x.pid');
    expect(leerPid(f)).toBeNull();
    for (const [texto, esperado] of [
      ['1234\n', 1234],
      ['', null],
      ['1', null],
      ['0', null],
      ['abc', null],
      ['-5', null],
      ['12.5', null],
    ]) {
      writeFileSync(f, texto);
      expect(leerPid(f), JSON.stringify(texto)).toBe(esperado);
    }
  });
  it('procesoVivo distingue el propio proceso de un pid inexistente', () => {
    expect(procesoVivo(process.pid)).toBe(true);
    expect(procesoVivo(2 ** 22 + 12345)).toBe(false);
  });
});
