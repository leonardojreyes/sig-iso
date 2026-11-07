import { describe, expect, it } from 'vitest';
import { DATOS_SIEMBRA, exigirBaseLocal, validarDatosSiembra, type DatosSiembra } from './datos-siembra.js';

const copia = (): DatosSiembra => structuredClone(DATOS_SIEMBRA) as DatosSiembra;

describe('DATOS_SIEMBRA (las dos empresas de prueba)', () => {
  it('son válidos', () => {
    expect(() => validarDatosSiembra(DATOS_SIEMBRA)).not.toThrow();
  });

  it('hay dos empresas y cuatro personas: administrador SIG y colaborador en cada una', () => {
    expect(DATOS_SIEMBRA.empresas.map((e) => e.slug)).toEqual(['empresa-a', 'empresa-b']);
    expect(DATOS_SIEMBRA.usuarios.map((u) => [u.alias, u.rol])).toEqual([
      ['admin-a', 'administrador_sig'], ['colab-a', 'colaborador'], ['admin-b', 'administrador_sig'], ['colab-b', 'colaborador'],
    ]);
    for (const e of DATOS_SIEMBRA.empresas) expect(DATOS_SIEMBRA.usuarios.filter((u) => u.empresaId === e.id)).toHaveLength(2);
  });

  it('todos los correos son de dominio de pruebas (sin datos personales reales)', () => {
    for (const u of DATOS_SIEMBRA.usuarios) expect(u.correo).toMatch(/@example\.test$/);
  });

  it('los colores de las dos empresas son distintos (se distingue la marca de A y de B)', () => {
    expect(new Set(DATOS_SIEMBRA.empresas.map((e) => e.colorPrimario)).size).toBe(2);
  });
});

describe('validarDatosSiembra rechaza', () => {
  const rechaza = (mutar: (d: DatosSiembra) => void, texto: RegExp) => {
    const d = copia();
    mutar(d);
    expect(() => validarDatosSiembra(d)).toThrow(texto);
  };

  it('un correo que no es de pruebas', () => rechaza((d) => { d.usuarios[0]!.correo = 'persona@empresa.com'; }, /example\.test/));
  it('un identificador repetido', () => rechaza((d) => { d.usuarios[1]!.id = d.usuarios[0]!.id; }, /repetid/i));
  it('un slug repetido', () => rechaza((d) => { d.empresas[1]!.slug = d.empresas[0]!.slug; }, /repetid/i));
  it('un alias repetido', () => rechaza((d) => { d.usuarios[1]!.alias = d.usuarios[0]!.alias; }, /repetid/i));
  it('una persona de una empresa que no existe', () => rechaza((d) => { d.usuarios[0]!.empresaId = 'cccccccc-0000-4000-8000-000000000001'; }, /empresa/i));
  it('un UUID mal formado', () => rechaza((d) => { d.empresas[0]!.id = 'no-es-uuid'; }, /uuid/i));
  it('el UUID nulo', () => rechaza((d) => { d.empresas[0]!.id = '00000000-0000-0000-0000-000000000000'; }, /uuid/i));
  it('un rol desconocido', () => rechaza((d) => { (d.usuarios[0] as { rol: string }).rol = 'superusuario'; }, /rol/i));
  it('un color que no es #RRGGBB', () => rechaza((d) => { d.empresas[0]!.colorPrimario = 'rojo'; }, /color/i));
  it('un correo repetido dentro de la misma empresa', () => rechaza((d) => { d.usuarios[1]!.correo = d.usuarios[0]!.correo; }, /repetid/i));
  it('un conjunto sin empresas', () => rechaza((d) => { d.empresas = []; d.usuarios = []; }, /vac/i));
});

describe('exigirBaseLocal (la siembra nunca corre contra una base remota)', () => {
  it.each([
    'postgresql://u:p@127.0.0.1:5432/sigiso',
    'postgresql://u:p@localhost/sigiso',
    'postgres://u:p@[::1]:5432/sigiso_test',
  ])('acepta %s', (url) => {
    expect(() => exigirBaseLocal(url, {})).not.toThrow();
  });

  it.each([
    'postgresql://u:p@db.produccion.example:5432/sigiso',
    'postgresql://u:p@10.0.0.5/sigiso',
    'postgresql://u:p@127.0.0.1.evil.example/sigiso',
    'no-es-url',
  ])('rechaza %s', (url) => {
    expect(() => exigirBaseLocal(url, {})).toThrow(/local/i);
  });

  it('rechaza con NODE_ENV=production aunque la base sea local', () => {
    expect(() => exigirBaseLocal('postgresql://u:p@127.0.0.1/sigiso', { NODE_ENV: 'production' })).toThrow(/producci/i);
  });

  it('el mensaje de error no incluye la contraseña de la URL', () => {
    try {
      exigirBaseLocal('postgresql://usuario:CLAVE-SECRETA@db.remota.example/sigiso', {});
    } catch (e) {
      expect((e as Error).message).not.toContain('CLAVE-SECRETA');
      return;
    }
    throw new Error('debía lanzar');
  });
});
