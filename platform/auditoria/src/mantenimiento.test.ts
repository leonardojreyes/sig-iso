import { describe, expect, it, vi } from 'vitest';
import { Bitacora } from './servicio/bitacora';
import { MantenimientoBitacora } from './servicio/mantenimiento';
import type { RegistroBitacora } from './dominio/tipos';
import type { BitacoraPort } from './puertos/bitacora.port';
import type { AlertasPort, IntegridadBitacoraPort, ProblemaIntegridad, TipoProblema } from './puertos/integridad.port';

const problema = (tipo: TipoProblema, secuencia: number | null = 2, clave = 'plataforma'): ProblemaIntegridad => ({ clave, secuencia, problema: tipo });

const montar = (problemas: readonly ProblemaIntegridad[] = [], nuevasAnclas = 3) => {
  const llamadas: string[] = [];
  const registrados: RegistroBitacora[] = [];
  const integridad: IntegridadBitacoraPort = {
    verificar: vi.fn(async () => {
      llamadas.push('verificar');
      return problemas;
    }),
    anclar: vi.fn(async () => {
      llamadas.push('anclar');
      return nuevasAnclas;
    }),
  };
  const puerto: BitacoraPort = {
    registrar: vi.fn(async (r) => {
      llamadas.push('registrar');
      registrados.push(r);
    }),
    registrarUnaVez: vi.fn(async () => 'registrado' as const),
  };
  const alertas: AlertasPort = {
    notificar: vi.fn(async () => {
      llamadas.push('alertar');
    }),
  };
  // Se usa el servicio REAL de la bitácora: así el evento que emite el mantenimiento se valida contra el catálogo.
  const servicio = new MantenimientoBitacora(integridad, new Bitacora(puerto), alertas);
  return { servicio, integridad, puerto, alertas, llamadas, registrados };
};

describe('MantenimientoBitacora', () => {
  it('sin problemas: verifica, ancla y registra el resultado, en ese orden, y no alerta', async () => {
    const m = montar([], 3);
    const r = await m.servicio.ejecutar();
    expect(m.llamadas).toEqual(['verificar', 'anclar', 'registrar']);
    expect(r).toEqual({ ok: true, problemas: [], anclasNuevas: 3 });
    expect(m.registrados[0]).toMatchObject({ accion: 'bitacora.verificacion', actorTipo: 'sistema', empresaId: null, resultado: 'ok', motivo: null, despues: { problemas: 0 } });
    expect(m.alertas.notificar).not.toHaveBeenCalled();
  });

  it('con problemas: NO ancla (no se da por buena una cadena rota), registra el error y alerta', async () => {
    const m = montar([problema('huella_invalida', 7)]);
    const r = await m.servicio.ejecutar();
    expect(m.integridad.anclar).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    expect(r.anclasNuevas).toBe(0);
    expect(m.registrados[0]).toMatchObject({ resultado: 'error', motivo: 'huella_invalida', despues: { problemas: 1 } });
    expect(m.alertas.notificar).toHaveBeenCalledTimes(1);
    expect(m.alertas.notificar).toHaveBeenCalledWith(expect.objectContaining({ severidad: 'critica', problemas: [problema('huella_invalida', 7)] }));
  });

  it.each([
    ['hueco_en_la_secuencia', 'secuencia_con_huecos'],
    ['enlace_roto', 'enlace_roto'],
    ['huella_invalida', 'huella_invalida'],
    ['ancla_perdida', 'ancla_perdida'],
  ] as const)('el problema %s se registra con el motivo %s', async (tipo, motivo) => {
    const m = montar([problema(tipo)]);
    await m.servicio.ejecutar();
    expect(m.registrados[0]?.motivo).toBe(motivo);
  });

  it('varios tipos de problema se registran como cadena_rota, con el total', async () => {
    const m = montar([problema('enlace_roto', 3), problema('hueco_en_la_secuencia', 3), problema('huella_invalida', 9, 'e'.repeat(8))]);
    await m.servicio.ejecutar();
    expect(m.registrados[0]).toMatchObject({ motivo: 'cadena_rota', despues: { problemas: 3 } });
  });

  it('varios problemas del mismo tipo conservan ese motivo', async () => {
    const m = montar([problema('ancla_perdida', 1), problema('ancla_perdida', 5)]);
    await m.servicio.ejecutar();
    expect(m.registrados[0]).toMatchObject({ motivo: 'ancla_perdida', despues: { problemas: 2 } });
  });

  it('si no se puede registrar el resultado, igualmente alerta y el error sube', async () => {
    const m = montar([problema('enlace_roto')]);
    vi.mocked(m.puerto.registrar).mockRejectedValueOnce(new Error('sin conexión'));
    await expect(m.servicio.ejecutar()).rejects.toThrow('sin conexión');
    expect(m.alertas.notificar).toHaveBeenCalledTimes(1);
  });

  it('si la alerta falla, el resultado ya quedó registrado y el error sube', async () => {
    const m = montar([problema('enlace_roto')]);
    vi.mocked(m.alertas.notificar).mockRejectedValueOnce(new Error('canal caído'));
    await expect(m.servicio.ejecutar()).rejects.toThrow('canal caído');
    expect(m.registrados).toHaveLength(1);
  });

  it('si la verificación no puede ejecutarse, no ancla ni registra un falso "ok"', async () => {
    const m = montar();
    vi.mocked(m.integridad.verificar).mockRejectedValueOnce(new Error('base caída'));
    await expect(m.servicio.ejecutar()).rejects.toThrow('base caída');
    expect(m.integridad.anclar).not.toHaveBeenCalled();
    expect(m.puerto.registrar).not.toHaveBeenCalled();
  });

  it('la alerta no lleva datos personales: solo claves de cadena, secuencias y tipos', async () => {
    const m = montar([problema('huella_invalida', 4, '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c')]);
    await m.servicio.ejecutar();
    const alerta = vi.mocked(m.alertas.notificar).mock.calls[0]![0];
    expect(JSON.stringify(alerta)).not.toMatch(/@|nombre|correo|password/i);
  });
});
