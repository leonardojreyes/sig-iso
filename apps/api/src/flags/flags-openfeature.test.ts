import { InMemoryProvider, type JsonValue, type Provider, type ResolutionDetails } from '@openfeature/server-sdk';
import { describe, expect, it } from 'vitest';
import { leerConfiguracionFlags } from './configuracion.js';
import { FlagsOpenFeature } from './flags-openfeature.js';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const configuracion = (variante: 'on' | 'off', evaluador?: (contexto: { targetingKey?: string }) => string) => ({
  'adopcion-habilitada': { disabled: false, variants: { on: true, off: false }, defaultVariant: variante, ...(evaluador ? { contextEvaluator: evaluador } : {}) },
});

describe('FlagsOpenFeature (proveedor en memoria)', () => {
  it('por defecto la adopción está habilitada', async () => {
    expect(await new FlagsOpenFeature().habilitado('adopcion-habilitada', A as never)).toBe(true);
  });

  it('se puede apagar por configuración, para todas las empresas', async () => {
    const flags = new FlagsOpenFeature({ adopcionHabilitada: false });
    expect(await flags.habilitado('adopcion-habilitada', A as never)).toBe(false);
    expect(await flags.habilitado('adopcion-habilitada', B as never)).toBe(false);
  });

  it('evalúa con la empresa como clave de segmentación: puede estar apagado solo para una', async () => {
    const proveedor = new InMemoryProvider(configuracion('on', (c) => (c.targetingKey === A ? 'off' : 'on')));
    const flags = new FlagsOpenFeature({ proveedor });
    expect(await flags.habilitado('adopcion-habilitada', A as never)).toBe(false);
    expect(await flags.habilitado('adopcion-habilitada', B as never)).toBe(true);
  });

  it('un cambio en caliente del flag se refleja en la siguiente consulta', async () => {
    const proveedor = new InMemoryProvider(configuracion('on'));
    const flags = new FlagsOpenFeature({ proveedor });
    expect(await flags.habilitado('adopcion-habilitada', A as never)).toBe(true);
    await proveedor.putConfiguration(configuracion('off'));
    expect(await flags.habilitado('adopcion-habilitada', A as never)).toBe(false);
  });

  it('dos instancias no se pisan (cada una tiene su propio dominio en el SDK)', async () => {
    const apagado = new FlagsOpenFeature({ adopcionHabilitada: false });
    const encendido = new FlagsOpenFeature({ adopcionHabilitada: true });
    expect(await apagado.habilitado('adopcion-habilitada', A as never)).toBe(false);
    expect(await encendido.habilitado('adopcion-habilitada', A as never)).toBe(true);
    expect(await apagado.habilitado('adopcion-habilitada', A as never)).toBe(false);
  });

  it('si el proveedor no conoce el flag, devuelve el valor por omisión (encendido) sin fallar', async () => {
    const flags = new FlagsOpenFeature({ proveedor: new InMemoryProvider({}) });
    expect(await flags.habilitado('adopcion-habilitada', A as never)).toBe(true);
  });

  it('si el proveedor falla al evaluar, devuelve el valor por omisión sin fallar', async () => {
    const roto = new InMemoryProvider(configuracion('off', () => { throw new Error('evaluador roto'); }));
    expect(await new FlagsOpenFeature({ proveedor: roto }).habilitado('adopcion-habilitada', A as never)).toBe(true);
  });

  it('si el proveedor no arranca, también devuelve el valor por omisión (aunque diría lo contrario)', async () => {
    const resolver = async <T>(valor: T): Promise<ResolutionDetails<T>> => ({ value: valor, reason: 'STATIC' });
    // Un proveedor que, si arrancara, respondería «apagado»; pero falla al inicializar.
    const roto: Provider = {
      metadata: { name: 'roto' },
      runsOn: 'server',
      initialize: async () => { throw new Error('no arranca'); },
      resolveBooleanEvaluation: () => resolver(false),
      resolveStringEvaluation: () => resolver(''),
      resolveNumberEvaluation: () => resolver(0),
      resolveObjectEvaluation: <T extends JsonValue>() => resolver({} as T),
    };
    const flags = new FlagsOpenFeature({ proveedor: roto });
    await new Promise((r) => setTimeout(r, 50)); // deja que el SDK termine de intentar arrancar el proveedor
    expect(await flags.habilitado('adopcion-habilitada', A as never)).toBe(true);
  });

  it('un nombre de flag que no existe es un error de programación: se rechaza', async () => {
    await expect(new FlagsOpenFeature().habilitado('otro-flag' as never, A as never)).rejects.toThrow(/desconocido/i);
  });
});

describe('leerConfiguracionFlags', () => {
  it('por defecto: la adopción está habilitada', () => {
    expect(leerConfiguracionFlags({})).toEqual({ adopcionHabilitada: true });
  });
  it.each([['true', true], ['false', false]])('FEATURE_ADOPCION_HABILITADA=%s', (v, esperado) => {
    expect(leerConfiguracionFlags({ FEATURE_ADOPCION_HABILITADA: v })).toEqual({ adopcionHabilitada: esperado });
  });
  it.each(['', '0', '1', 'si', 'TRUE', ' true', 'verdadero', 'yes'])('rechaza %j nombrando la variable y sin repetir el valor', (v) => {
    let mensaje = '';
    try {
      leerConfiguracionFlags({ FEATURE_ADOPCION_HABILITADA: v });
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toContain('FEATURE_ADOPCION_HABILITADA');
    if (v.trim()) expect(mensaje).not.toContain(v);
  });
});
