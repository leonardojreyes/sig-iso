import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertasConsola } from './infraestructura/alertas-consola.adapter';

describe('AlertasConsola', () => {
  afterEach(() => vi.restoreAllMocks());

  it('escribe una línea JSON con la severidad, el asunto y los problemas', async () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {});
    await new AlertasConsola().notificar({ severidad: 'critica', asunto: 'Problema', problemas: [{ clave: 'plataforma', secuencia: 3, problema: 'enlace_roto' }] });
    expect(espia).toHaveBeenCalledTimes(1);
    expect(JSON.parse(espia.mock.calls[0]![0] as string)).toEqual({ nivel: 'critica', asunto: 'Problema', problemas: [{ clave: 'plataforma', secuencia: 3, problema: 'enlace_roto' }] });
  });
});
