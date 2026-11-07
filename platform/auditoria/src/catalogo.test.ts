import { describe, expect, it } from 'vitest';
import { ACCIONES, CATALOGO, esClaveProhibida, MOTIVOS } from './dominio/catalogo';
import { ejemplos } from './prueba/ejemplos';

describe('catálogo de acciones', () => {
  it('cada acción del catálogo tiene un ejemplo en las pruebas (y viceversa)', () => {
    expect([...ACCIONES].sort()).toEqual(Object.keys(ejemplos).sort());
    expect(Object.keys(CATALOGO).sort()).toEqual([...ACCIONES].sort());
  });

  it('los nombres de acción cumplen el formato que exige la base de datos', () => {
    for (const a of ACCIONES) expect(a, a).toMatch(/^[a-z_]+(\.[a-z_]+)*$/);
  });

  it('los motivos son códigos, nunca texto libre', () => {
    for (const m of MOTIVOS) expect(m, m).toMatch(/^[a-z0-9_]{1,60}$/);
  });

  it('cada motivo permitido por una acción existe en la lista cerrada', () => {
    for (const a of ACCIONES) for (const m of CATALOGO[a].motivos) expect(MOTIVOS, `${a}:${m}`).toContain(m);
  });

  it('ninguna clave permitida en antes/despues es un dato personal ni un secreto', () => {
    for (const a of ACCIONES) {
      const claves = [...Object.keys(CATALOGO[a].antes), ...Object.keys(CATALOGO[a].despues)];
      for (const c of claves) expect(esClaveProhibida(c), `${a}.${c}`).toBe(false);
    }
  });

  it('los hechos de plataforma no admiten empresa y los de empresa la exigen', () => {
    expect(CATALOGO['catalogo.cargado'].empresa).toBe('prohibida');
    expect(CATALOGO['bitacora.verificacion'].empresa).toBe('prohibida');
    expect(CATALOGO['libreria.adoptada'].empresa).toBe('obligatoria');
    expect(CATALOGO['login.fallido'].empresa).toBe('opcional');
  });

  it('detecta nombres de campo prohibidos por palabras, sin confundir "tipo" con "ip"', () => {
    for (const mala of ['correo', 'nombre_completo', 'ip', 'direccion_ip', 'password', 'token_acceso', 'Email']) expect(esClaveProhibida(mala), mala).toBe(true);
    for (const buena of ['tipo', 'adoptada', 'entradas', 'rol', 'descripcion']) expect(esClaveProhibida(buena), buena).toBe(false);
  });
});
