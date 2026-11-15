import { validarEvento, type EventoBitacora, type RegistroBitacora } from '@sig/auditoria';
import type { EmpresaId } from '@sig/tenancy';
import { describe, expect, it } from 'vitest';
import { A, B, USUARIO } from './prueba/datos.js';
import { SinPermisoError } from './adoptar-libreria.use-case.js';
import type { AutorizacionPort } from './autorizacion.port.js';
import type { LectorLibreriaPort } from './libreria-propia.port.js';
import { CargarLibreriaUseCase, TAMANO_MAX_LIBRERIA, type ContextoCarga } from './cargar-libreria.use-case.js';
import type { UnidadDeTrabajoPort } from './unidad-de-trabajo.port.js';

// Datos SINTÉTICOS: ninguna frase proviene de una norma.
const valida = (cambio: Record<string, unknown> = {}) => ({
  esquema: 3,
  codigo: 'propia-prueba',
  nombre: 'Librería propia de prueba',
  version: '1.0.0',
  es_ejemplo: false,
  fuente: 'elaboración propia de la empresa',
  referencias: [{ norma: 'Norma X', edicion: '2022' }],
  entradas: [
    {
      id: 'x-4.1',
      capitulo: 4,
      nivel: 1,
      titulo: 'Primer tema de prueba',
      guia: 'Texto sintético de prueba, sin relación con ninguna norma.',
      alcance_comun: 'comun',
      aplica_a: [{ norma: 'Norma X', edicion: '2022', clausula: '4.1' }],
    },
  ],
  ...cambio,
});
// JSON es YAML válido: así las pruebas no dependen de la librería de YAML.
// Lector falso (el real, con YAML, se prueba en infraestructura): acepta JSON, que es YAML válido, y rechaza lo demás.
const lector: LectorLibreriaPort = {
  // Huella falsa y determinista de 64 hex (FNV-1a con 8 semillas): solo importa que bytes iguales den la misma.
  huellaDe: (b) =>
    Array.from({ length: 8 }, (_, k) => {
      let h = (0x811c9dc5 + k) >>> 0;
      for (const x of b) h = Math.imul(h ^ x, 0x01000193) >>> 0;
      return h.toString(16).padStart(8, '0');
    }).join(''),
  leer: (b) => {
    try {
      return { ok: true, datos: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b)) };
    } catch {
      return { ok: false, motivo: 'formato_invalido', codigo: 'yaml_invalido' };
    }
  },
};
const bytes = (o: unknown, indent = 0) => new TextEncoder().encode(JSON.stringify(o, null, indent));

class Mundo {
  guardadas = new Map<string, { hash: string; entradas: number }>(); // empresa|codigo|version
  bitacora: RegistroBitacora[] = [];
  puede = true;
  falloBitacora = false;
  unidad: UnidadDeTrabajoPort<ContextoCarga> = {
    ejecutar: async (empresaId: EmpresaId, fn) => {
      const copia = new Map(this.guardadas);
      const copiaB = [...this.bitacora];
      const ctx: ContextoCarga = {
        propias: {
          guardar: async (l, huella) => {
            const k = `${empresaId}|${l.codigo}|${l.version}`;
            const previa = this.guardadas.get(k);
            if (previa) return previa.hash === huella ? 'ya' : 'distinto';
            this.guardadas.set(k, { hash: huella, entradas: l.entradas.length });
            return 'nueva';
          },
        },
        bitacora: {
          registrar: async (e: EventoBitacora) => {
            if (this.falloBitacora) throw new Error('bitácora caída');
            this.bitacora.push(validarEvento(e));
          },
        },
      };
      try {
        return await fn(ctx);
      } catch (e) {
        this.guardadas = copia;
        this.bitacora = copiaB;
        throw e;
      }
    },
  };
  autorizacion: AutorizacionPort = { puede: async () => this.puede };
  caso = () => new CargarLibreriaUseCase(this.unidad, this.autorizacion, lector);
}

const entrada = (contenido: Uint8Array, empresaId: EmpresaId = A) => ({ empresaId, usuarioId: USUARIO, contenido });

describe('CargarLibreriaUseCase', () => {
  it('carga una librería válida y deja el hecho en la bitácora sin contenido', async () => {
    const m = new Mundo();
    const r = await m.caso().ejecutar(entrada(bytes(valida())));
    expect(r).toMatchObject({ estado: 'cargada', codigo: 'propia-prueba', version: '1.0.0', entradas: 1, motivo: null, errores: [] });
    expect(r.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(m.bitacora).toHaveLength(1);
    expect(m.bitacora[0]).toMatchObject({ accion: 'libreria.cargada', resultado: 'ok', objeto: 'libreria:propia-prueba', objetoVersion: r.huella });
    expect(JSON.stringify(m.bitacora)).not.toContain('Texto sintético');
  });

  it('sin permiso lanza SinPermisoError antes de mirar el archivo y no registra nada', async () => {
    const m = new Mundo();
    m.puede = false;
    await expect(m.caso().ejecutar(entrada(new Uint8Array([0, 1, 2])))).rejects.toBeInstanceOf(SinPermisoError);
    expect(m.bitacora).toEqual([]);
    expect(m.guardadas.size).toBe(0);
  });

  it('la misma versión con el mismo contenido es «ya cargada» (aunque cambie el formato del archivo)', async () => {
    const m = new Mundo();
    const primera = await m.caso().ejecutar(entrada(bytes(valida())));
    const otra = bytes(valida(), 4);
    const r = await m.caso().ejecutar(entrada(otra));
    expect(r).toMatchObject({ estado: 'ya_cargada', huella: primera.huella });
    expect(m.guardadas.size).toBe(1);
    expect(m.bitacora[1]).toMatchObject({ resultado: 'ok', motivo: 'ya_cargada' });
  });

  it('la misma versión con otro contenido se rechaza (las versiones son inmutables)', async () => {
    const m = new Mundo();
    await m.caso().ejecutar(entrada(bytes(valida())));
    const r = await m.caso().ejecutar(entrada(bytes(valida({ nombre: 'Otro nombre' }))));
    expect(r).toMatchObject({ estado: 'rechazada', motivo: 'hash_distinto' });
    expect(m.bitacora[1]).toMatchObject({ resultado: 'rechazado', motivo: 'hash_distinto' });
  });

  it('cada empresa guarda lo suyo: el mismo código en A y en B son dos librerías', async () => {
    const m = new Mundo();
    await m.caso().ejecutar(entrada(bytes(valida()), A));
    const r = await m.caso().ejecutar(entrada(bytes(valida({ nombre: 'Distinta' })), B));
    expect(r.estado).toBe('cargada');
    expect(m.guardadas.size).toBe(2);
  });

  describe('rechazos (resultado con códigos, registrado en la bitácora, nada guardado)', () => {
    const caso = async (contenido: Uint8Array) => {
      const m = new Mundo();
      const r = await m.caso().ejecutar(entrada(contenido));
      return { m, r };
    };
    const esperaRechazo = (c: { m: Mundo; r: Awaited<ReturnType<CargarLibreriaUseCase['ejecutar']>> }, motivo: string) => {
      expect(c.r).toMatchObject({ estado: 'rechazada', motivo, entradas: null });
      expect(c.m.guardadas.size).toBe(0);
      expect(c.m.bitacora).toHaveLength(1);
      expect(c.m.bitacora[0]).toMatchObject({ accion: 'libreria.cargada', resultado: 'rechazado', motivo, objeto: 'libreria:archivo', objetoVersion: c.r.huella });
    };

    it('archivo vacío', async () => esperaRechazo(await caso(new Uint8Array()), 'tipo_no_permitido'));
    it('más de 1 MB', async () => esperaRechazo(await caso(new Uint8Array(TAMANO_MAX_LIBRERIA + 1).fill(97)), 'tamano_excedido'));
    it('YAML mal formado, sin repetir el contenido', async () => {
      const c = await caso(new TextEncoder().encode('a: [1, 2\nsecreto: SECRETO-XYZ'));
      esperaRechazo(c, 'formato_invalido');
      expect(JSON.stringify(c)).not.toContain('SECRETO-XYZ');
    });
    it('esquema incompleto, con la ruta y el código del error', async () => {
      const sinEntradas: Record<string, unknown> = valida();
      delete sinEntradas.entradas;
      const c = await caso(bytes(sinEntradas));
      esperaRechazo(c, 'formato_invalido');
      expect(c.r.errores.length).toBeGreaterThan(0);
    });
    it('código sin el prefijo propia-', async () => {
      const c = await caso(bytes(valida({ codigo: 'mi-norma' })));
      esperaRechazo(c, 'codigo_no_permitido');
      expect(c.r.errores).toEqual([{ entrada: null, indice: null, ruta: 'codigo', codigo: 'prefijo_obligatorio' }]);
    });
    it('librería marcada como ejemplo', async () => esperaRechazo(await caso(bytes(valida({ es_ejemplo: true }))), 'codigo_no_permitido'));
    it('texto que parece copiado de una norma', async () => {
      const copiado = valida();
      (copiado.entradas as { guia: string }[])[0]!.guia =
        'La organización debe determinar las cuestiones externas e internas que son pertinentes para su propósito; debe establecer el alcance.';
      esperaRechazo(await caso(bytes(copiado)), 'contenido_no_permitido');
    });
  });

  it('si la bitácora falla, no queda la librería (todo o nada)', async () => {
    const m = new Mundo();
    m.falloBitacora = true;
    await expect(m.caso().ejecutar(entrada(bytes(valida())))).rejects.toThrow('bitácora caída');
    expect(m.guardadas.size).toBe(0);
  });

  it('si no se puede registrar un rechazo, el error sale (no se traga)', async () => {
    const m = new Mundo();
    m.falloBitacora = true;
    await expect(m.caso().ejecutar(entrada(new Uint8Array()))).rejects.toThrow('bitácora caída');
  });

  it('rechaza una empresa o un usuario mal formados', async () => {
    const m = new Mundo();
    await expect(m.caso().ejecutar({ empresaId: A, usuarioId: 'no-uuid', contenido: bytes(valida()) })).rejects.toThrow();
  });
});
