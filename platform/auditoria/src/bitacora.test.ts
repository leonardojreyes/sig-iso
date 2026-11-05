import { describe, expect, it, vi } from 'vitest';
import { Bitacora } from './servicio/bitacora';
import type { BitacoraPort } from './puertos/bitacora.port';
import { EventoBitacoraInvalidoError } from './dominio/errores';
import { ejemplos } from './prueba/ejemplos';

const puertoFalso = (): BitacoraPort & { registrar: ReturnType<typeof vi.fn> } => ({ registrar: vi.fn(async () => {}) });

describe('Bitacora (servicio)', () => {
  it('valida y entrega al puerto el registro normalizado', async () => {
    const puerto = puertoFalso();
    await new Bitacora(puerto).registrar(ejemplos['libreria.adoptada']);
    expect(puerto.registrar).toHaveBeenCalledTimes(1);
    expect(puerto.registrar.mock.calls[0]?.[0]).toMatchObject({ accion: 'libreria.adoptada', actorTipo: 'usuario', resultado: 'ok', objetoVersion: '1.0.0' });
  });

  it('un evento inválido no llega al puerto y se rechaza', async () => {
    const puerto = puertoFalso();
    await expect(new Bitacora(puerto).registrar({ ...ejemplos['login.ok'], motivo: 'texto libre' } as never)).rejects.toThrow(EventoBitacoraInvalidoError);
    expect(puerto.registrar).not.toHaveBeenCalled();
  });

  it('si el puerto falla, el error sube: la acción que debía registrarse no se completa (H6.8)', async () => {
    const puerto = puertoFalso();
    puerto.registrar.mockRejectedValueOnce(new Error('sin conexión'));
    await expect(new Bitacora(puerto).registrar(ejemplos['login.ok'])).rejects.toThrow('sin conexión');
  });

  it('el puerto solo acepta registros validados (comprobación de tipos)', () => {
    const puerto: BitacoraPort = puertoFalso();
    // @ts-expect-error un objeto armado a mano no es un RegistroBitacora
    void puerto.registrar({ accion: 'login.ok', actorTipo: 'usuario' });
    expect(true).toBe(true);
  });
});
