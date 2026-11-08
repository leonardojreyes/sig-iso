// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RETORNO_POR_OMISION, rutaDeRetornoSegura } from './retorno';

const ORIGEN = 'http://localhost:3000';
const seguro = (v: string | null | undefined) => rutaDeRetornoSegura(v, ORIGEN);

describe('rutaDeRetornoSegura (ADR 027: solo rutas relativas propias)', () => {
  it('acepta rutas propias, con consulta y con almohadilla, y las devuelve tal cual', () => {
    expect(seguro('/e/empresa-a/panel')).toBe('/e/empresa-a/panel');
    expect(seguro('/e/empresa-a/requisitos?q=gobierno&capitulo=4')).toBe(
      '/e/empresa-a/requisitos?q=gobierno&capitulo=4',
    );
    expect(seguro('/panel#seccion')).toBe('/panel#seccion');
    expect(seguro('/')).toBe('/');
  });

  it.each([
    ['URL absoluta de otro sitio', 'https://evil.example/robo'],
    ['URL absoluta del mismo sitio (solo se admiten rutas)', 'http://localhost:3000/panel'],
    ['esquema relativo', '//evil.example'],
    ['esquema relativo con ruta', '//evil.example/e/a'],
    ['barra invertida', '/\\evil.example'],
    ['barra invertida doble', '\\\\evil.example'],
    ['barra invertida al inicio', '\\evil.example'],
    ['esquema javascript', 'javascript:alert(1)'],
    ['esquema data', 'data:text/html,<script>1</script>'],
    ['sin barra inicial', 'evil.example/x'],
    ['ruta relativa sin barra', 'e/a/panel'],
    ['barra codificada', '/%2fevil.example'],
    ['barra codificada en mayúsculas', '/%2Fevil.example'],
    ['barra invertida codificada', '/%5cevil.example'],
    ['barra invertida codificada en mayúsculas', '/%5Cevil.example'],
    ['doble codificación de la barra', '/%252fevil.example'],
    ['tabulación que el navegador ignora', '/\t/evil.example'],
    ['salto de línea que el navegador ignora', '/\n/evil.example'],
    ['retorno de carro', '/\r/evil.example'],
    ['carácter de control', '/ruta\u0000x'],
    ['espacio al inicio', ' /panel'],
    ['unicode de ancho completo', '／／evil.example'],
    ['cadena vacía', ''],
    ['solo espacios', '   '],
  ])('rechaza %s', (_nombre, valor) => {
    expect(seguro(valor)).toBe(RETORNO_POR_OMISION);
  });

  it('un valor ausente o no textual vuelve a la ruta por omisión', () => {
    expect(seguro(null)).toBe(RETORNO_POR_OMISION);
    expect(seguro(undefined)).toBe(RETORNO_POR_OMISION);
    expect(rutaDeRetornoSegura(123 as never, ORIGEN)).toBe(RETORNO_POR_OMISION);
  });

  it('rechaza rutas desmesuradas (no se inflan la cookie ni las direcciones)', () => {
    expect(seguro(`/${'a'.repeat(2000)}`)).toBe(RETORNO_POR_OMISION);
    expect(seguro(`/${'a'.repeat(500)}`)).toBe(`/${'a'.repeat(500)}`);
  });

  it('no sale del sitio ni siquiera con puntos: la ruta se queda en el mismo origen', () => {
    expect(seguro('/e/a/../../panel')).toBe('/panel');
    expect(seguro('/..//evil.example')).toBe(RETORNO_POR_OMISION);
  });

  it('el origen de comparación es el configurado, no el recibido', () => {
    expect(rutaDeRetornoSegura('/panel', 'https://sig.ejemplo.ec')).toBe('/panel');
    expect(rutaDeRetornoSegura('https://sig.ejemplo.ec/panel', 'https://sig.ejemplo.ec')).toBe(RETORNO_POR_OMISION);
  });
});
