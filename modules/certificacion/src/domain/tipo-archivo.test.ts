import { describe, expect, it } from 'vitest';
import { esTipoArchivo, extensionDeTipo, NOMBRE_ARCHIVO_MAX, nombreDeDescarga, normalizarNombreArchivo, TIPOS_ARCHIVO } from './tipo-archivo.js';

describe('esTipoArchivo y la lista cerrada', () => {
  it('son exactamente siete y no incluyen SVG, HTML ni formatos con macros', () => {
    expect(TIPOS_ARCHIVO).toHaveLength(7);
    for (const prohibido of ['image/svg+xml', 'text/html', 'application/xml', 'text/xml', 'application/zip', 'application/x-msdownload', 'application/vnd.ms-word.document.macroEnabled.12', 'application/javascript', 'image/gif']) expect(esTipoArchivo(prohibido), prohibido).toBe(false);
    for (const t of TIPOS_ARCHIVO) expect(extensionDeTipo(t)).toMatch(/^[a-z]{3,4}$/);
  });
  it('no acepta lo que no es texto', () => {
    for (const v of [null, undefined, 5, {}, ['application/pdf']]) expect(esTipoArchivo(v)).toBe(false);
  });
});

describe('normalizarNombreArchivo', () => {
  it.each([
    ['informe.pdf', 'informe.pdf'],
    ['Política de accesos (v2).docx', 'Política de accesos (v2).docx'],
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\leo\\Documentos\\acta.pdf', 'acta.pdf'],
    ['/var/www/shell.php', 'shell.php'],
    ['..\\..\\boot.ini', 'boot.ini'],
    ['  espacios   de más  .txt  ', 'espacios de más .txt'],
    ['a<b>c:"d|e?f*g.pdf', 'a_b_c__d_e_f_g.pdf'],
    ['nombre\u0000con\u0007control.pdf', 'nombre_con_control.pdf'],
    ['emoji 🔒 secreto.pdf', 'emoji _ secreto.pdf'],
    ['.htaccess', 'htaccess'],
    ['...', 'archivo'],
    ['', 'archivo'],
    ['   ', 'archivo'],
  ])('%j → %j', (entrada, esperado) => {
    expect(normalizarNombreArchivo(entrada)).toBe(esperado);
  });

  it('lo que no es texto da el nombre por omisión', () => {
    for (const v of [null, undefined, 5, {}, ['a.pdf']]) expect(normalizarNombreArchivo(v)).toBe('archivo');
  });

  it('corta a 120 caracteres y no deja un punto ni un espacio al final', () => {
    const largo = normalizarNombreArchivo(`${'a'.repeat(200)}.pdf`);
    expect(largo.length).toBeLessThanOrEqual(NOMBRE_ARCHIVO_MAX);
    expect(normalizarNombreArchivo(`${'a'.repeat(119)}. x`)).not.toMatch(/[ .]$/);
  });

  it('es idempotente: normalizar dos veces da lo mismo', () => {
    for (const n of ['../x/y z.pdf', 'a<b>.txt', 'Política (1).docx', '  .  ', 'x'.repeat(300)]) expect(normalizarNombreArchivo(normalizarNombreArchivo(n))).toBe(normalizarNombreArchivo(n));
  });

  it('nunca queda una barra, una barra invertida ni un carácter de control', () => {
    for (const n of ['a/b\\c.pdf', 'x\u0001y', '\n\r\t.pdf', 'a%2f..%2fb', '..']) expect(normalizarNombreArchivo(n)).not.toMatch(/[/\\\u0000-\u001f]/);
  });
});

describe('nombreDeDescarga', () => {
  it('cambia la extensión por la que corresponde al tipo detectado', () => {
    expect(nombreDeDescarga('informe.pdf', 'text/plain')).toBe('informe.txt');
    expect(nombreDeDescarga('foto.exe', 'image/png')).toBe('foto.png');
    expect(nombreDeDescarga('acta.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('acta.docx');
  });
  it('agrega la extensión si no traía y no se confunde con un punto que no es extensión', () => {
    expect(nombreDeDescarga('sin extension', 'application/pdf')).toBe('sin extension.pdf');
    expect(nombreDeDescarga('v1.2 final', 'application/pdf')).toBe('v1.2 final.pdf');
  });
  it('no se pasa de 120 caracteres', () => {
    expect(nombreDeDescarga('a'.repeat(120), 'application/pdf').length).toBeLessThanOrEqual(NOMBRE_ARCHIVO_MAX);
  });
});
