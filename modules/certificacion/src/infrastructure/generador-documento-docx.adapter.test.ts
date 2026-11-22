import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { TIPO_DOCUMENTO_WORD, type DocumentoDeclaracion, type JustificacionDocumento } from '../application/generador-documento.port.js';
import { sha256Hex } from '../application/prueba/archivos.js';
import { detectarTipoArchivo } from '../domain/deteccion-archivo.js';
import { GeneradorDocumentoDocx } from './generador-documento-docx.adapter.js';

const base: DocumentoDeclaracion = {
  norma: 'ISO/IEC 27001',
  preliminar: true,
  version: null,
  aprobadaEl: null,
  generadaEl: '2026-11-12',
  alcance: 'Desarrollo de software.\nSoporte a clientes.',
  resumen: { total: 3, aplican: 2, noAplican: 1, porDecidir: 0, sinControl: 1 },
  filas: [
    { libreriaCodigo: 'l', idEstable: 'a27-5-1', orden: 1, titulo: 'Políticas de seguridad', grupo: 'Organizacionales', aplicabilidad: 'aplica', implementacion: 'implementado', justificacion: null, controles: ['C-001', 'C-002'], cobertura: 'cubierta' },
    { libreriaCodigo: 'l', idEstable: 'a27-5-2', orden: 2, titulo: 'Roles', grupo: null, aplicabilidad: 'aplica', implementacion: 'parcial', justificacion: null, controles: [], cobertura: 'sin_control' },
    { libreriaCodigo: 'l', idEstable: 'a27-5-3', orden: 3, titulo: 'Separación de funciones', grupo: 'Organizacionales', aplicabilidad: 'no_aplica', implementacion: null, justificacion: 'No hay personal propio', controles: [], cobertura: 'no_aplica' },
  ],
  justificacion: null,
};

/** Lee una parte del ZIP por su directorio central (solo para probar; sin librerías). */
const parte = (zip: Uint8Array, nombre: string): string | null => {
  const b = Buffer.from(zip);
  let fin = -1;
  for (let i = b.length - 22; i >= 0; i--) if (b.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  let p = b.readUInt32LE(fin + 16);
  for (let k = 0; k < b.readUInt16LE(fin + 10); k++) {
    const metodo = b.readUInt16LE(p + 10);
    const comp = b.readUInt32LE(p + 20);
    const lNombre = b.readUInt16LE(p + 28);
    const lExtra = b.readUInt16LE(p + 30);
    const lComentario = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const n = b.toString('utf8', p + 46, p + 46 + lNombre);
    if (n === nombre) {
      const datos = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
      const crudo = b.subarray(datos, datos + comp);
      return (metodo === 0 ? crudo : inflateRawSync(crudo)).toString('utf8');
    }
    p += 46 + lNombre + lExtra + lComentario;
  }
  return null;
};
const nombres = (zip: Uint8Array): string[] => {
  const b = Buffer.from(zip);
  let fin = -1;
  for (let i = b.length - 22; i >= 0; i--) if (b.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  const salida: string[] = [];
  let p = b.readUInt32LE(fin + 16);
  for (let k = 0; k < b.readUInt16LE(fin + 10); k++) {
    const l = b.readUInt16LE(p + 28);
    salida.push(b.toString('utf8', p + 46, p + 46 + l));
    p += 46 + l + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  return salida;
};
const generar = (d: DocumentoDeclaracion) => new GeneradorDocumentoDocx().generarDeclaracion(d);
const texto = async (d: DocumentoDeclaracion) => parte((await generar(d)).bytes, 'word/document.xml') ?? '';

describe('GeneradorDocumentoDocx', () => {
  it('produce un Word que el detector de archivos reconoce como DOCX (sin macros ni objetos)', async () => {
    const { bytes } = await generar(base);
    const lector = { tamano: bytes.length, leer: async (d: number, h: number) => bytes.subarray(d, Math.min(h, bytes.length)) };
    expect(await detectarTipoArchivo(lector)).toEqual({ ok: true, tipo: TIPO_DOCUMENTO_WORD });
    const partes = nombres(bytes);
    expect(partes).toContain('word/document.xml');
    expect(partes.filter((n) => /vbaProject|embeddings|activeX|\.bin$|oleObject/i.test(n))).toEqual([]);
  });

  it('devuelve la huella SHA-256 de lo que entrega', async () => {
    const g = await generar(base);
    expect(g.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(g.sha256).toBe(sha256Hex(g.bytes));
  });

  it('el borrador y la versión aprobada llevan la nota de que los controles salen del tratamiento de riesgos (documentos externos)', async () => {
    for (const d of [base, { ...base, preliminar: false, version: 3, aprobadaEl: '2026-11-10' }]) {
      const x = await texto(d);
      expect(x).toContain('tratamiento de riesgos de seguridad de la información');
      expect(x).toContain('documentos externos a este sistema');
    }
  });

  it('el borrador lleva el rótulo de preliminar; una versión aprobada, no', async () => {
    const borrador = await texto(base);
    expect(borrador).toContain('DOCUMENTO PRELIMINAR');
    const aprobada = await texto({ ...base, preliminar: false, version: 3, aprobadaEl: '2026-11-10' });
    expect(aprobada).not.toContain('PRELIMINAR');
    expect(aprobada).toContain('Versión 3, aprobada el 2026-11-10.');
  });

  it('incluye alcance, resumen y cada fila con su aplicabilidad, controles y justificación', async () => {
    const x = await texto(base);
    for (const t of ['Desarrollo de software.', 'Soporte a clientes.', 'a27-5-1', 'Políticas de seguridad', 'C-001, C-002', 'Implementado', 'Con evidencia vigente', 'No hay personal propio', 'Separación de funciones', 'No aplica', 'Aplican sin control asignado: 1']) expect(x, t).toContain(t);
    expect(x).toContain('Sin control asignado'); // la fila que aplica y ningún control cubre
  });

  it('sin alcance lo dice', async () => {
    expect(await texto({ ...base, alcance: null })).toContain('No se registró un alcance');
  });

  it('lo que escribió la empresa sale como texto: nada de campos, enlaces ni marcado activo', async () => {
    const hostil = '<script>alert(1)</script> =HYPERLINK("http://x") ]]> &amp; {{ ${x} }}';
    const x = await texto({ ...base, alcance: hostil, filas: [{ ...(base.filas[2] as DocumentoDeclaracion['filas'][number]), justificacion: hostil }] });
    expect(x).not.toContain('<script>');
    expect(x).toContain('&lt;script&gt;');
    expect(x).not.toMatch(/<w:fldChar|<w:fldSimple|<w:instrText|<w:hyperlink|<w:object|<w:altChunk/);
  });

  it('quita los caracteres de control que XML no admite sin romper el documento', async () => {
    const { bytes } = await generar({ ...base, alcance: 'Con\u0000nulo y\u0008retroceso', filas: [{ ...(base.filas[2] as DocumentoDeclaracion['filas'][number]), justificacion: 'Linea1\nLinea2\u0007' }] });
    const x = parte(bytes, 'word/document.xml') ?? '';
    expect(x).toContain('Connulo');
    expect(x).toMatch(/Linea1 Linea2/);
    expect(x).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
  });

  it('un documento sin filas también se genera', async () => {
    const { bytes } = await generar({ ...base, filas: [], resumen: { total: 0, aplican: 0, noAplican: 0, porDecidir: 0, sinControl: 0 } });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

// ---- Declaración justificada (ADR 037, H6.1 a H6.5)
const justificada: JustificacionDocumento = {
  escala: { escalaMax: 5, corteMedio: 5, corteAlto: 10, corteCritico: 16 },
  conMotivo: 2,
  sinMotivo: 0,
  motivos: [{ libreriaCodigo: 'l', idEstable: 'a27-5-2', tipo: 'contractual', nota: 'Cláusula 7 del contrato con el cliente' }],
  riesgos: [
    { codigo: 'R-001', titulo: 'Pérdida de portátiles', probabilidad: 3, impacto: 4, nivel: 'alto', decision: 'mitigar', responsableId: '22222222-2222-4222-8222-222222222222', controles: ['C-001'] },
    { codigo: 'R-002', titulo: 'Fuga de información', probabilidad: 5, impacto: 5, nivel: 'critico', decision: 'aceptar', responsableId: null, controles: [] },
  ],
  riesgosPorFila: [
    { libreriaCodigo: 'l', idEstable: 'a27-5-1', riesgoCodigo: 'R-001', via: 'control' },
    { libreriaCodigo: 'l', idEstable: 'a27-5-1', riesgoCodigo: 'R-002', via: 'previsto' },
  ],
  referencias: [
    { tipo: 'analisis', titulo: 'Análisis de riesgos 2026', versionDoc: '1.0', fecha: '2026-10-15', ubicacion: 'SIG-AR-001' },
    { tipo: 'plan', titulo: 'Plan de tratamiento 2026', versionDoc: '1.2', fecha: '2026-11-01', ubicacion: 'SIG-PL-004 (carpeta Calidad)' },
  ],
};
const aprobada = { ...base, preliminar: false, version: 3, aprobadaEl: '2026-11-10' };
const con = (j: Partial<JustificacionDocumento> = {}, d: Partial<DocumentoDeclaracion> = {}): DocumentoDeclaracion => ({ ...base, ...d, justificacion: { ...justificada, ...j } });
const AVISOS = ['registro de riesgos de esta herramienta es simplificado', 'no registra el riesgo residual ni su aceptación', 'no incluye controles adicionales', 'no contempla activos de información'];

describe('GeneradorDocumentoDocx con justificación', () => {
  it('cada fila que aplica lleva su motivo con la nota y los códigos de los riesgos, distinguiendo el tratamiento previsto', async () => {
    const x = await texto(con());
    expect(x).toContain('Motivo de inclusión');
    expect(x).toContain('Requisito contractual: Cláusula 7 del contrato con el cliente');
    expect(x).toContain('R-001'); // por un control de la empresa
    expect(x).toMatch(/Tratamiento previsto[^<]*R-002/); // distinguido: sin control de la empresa
    expect(x).toMatch(/Riesgo[^<]*R-001/);
  });

  it('una fila que aplica sin riesgo ni motivo dice «Sin motivo» (borrador); una que no aplica no lo pide', async () => {
    const x = await texto(con({ motivos: [], riesgosPorFila: [], conMotivo: 0, sinMotivo: 2 }));
    expect(x.match(/Sin motivo/g)?.length).toBe(2); // a27-5-1 y a27-5-2 aplican; a27-5-3 no
  });

  it('incluye la sección «Tratamiento de riesgos» con cada riesgo, su nivel en palabras, su decisión, su responsable y sus controles', async () => {
    const x = await texto(con());
    expect(x).toContain('Tratamiento de riesgos');
    for (const t of ['R-001', 'Pérdida de portátiles', 'Alto', 'Mitigar', 'C-001', 'R-002', 'Fuga de información', 'Crítico', 'Aceptar', 'Sin asignar', 'Asignado']) expect(x, t).toContain(t);
    expect(x).toContain('a27-5-1'); // el riesgo R-002 lo trata, como tratamiento previsto, el control a27-5-1
  });

  it('imprime la escala y los cortes congelados y dice que son el método por omisión de la herramienta, no el criterio de la empresa', async () => {
    const x = await texto(con());
    expect(x).toContain('de 1 a 5');
    for (const t of ['Bajo: 1 a 4', 'Medio: 5 a 9', 'Alto: 10 a 15', 'Crítico: 16 a 25']) expect(x, t).toContain(t);
    expect(x).toMatch(/no es el criterio de aceptación de la empresa/);
    const otra = await texto(con({ escala: { escalaMax: 4, corteMedio: 4, corteAlto: 8, corteCritico: 12 } }));
    expect(otra).toContain('Crítico: 12 a 16'); // lo que se congeló, no lo que haya hoy
  });

  it('muestra las referencias al análisis y al plan con título, versión, fecha y ubicación', async () => {
    const x = await texto(con());
    for (const t of ['Análisis de riesgos 2026', 'SIG-AR-001', 'Plan de tratamiento 2026', 'SIG-PL-004 (carpeta Calidad)', '2026-11-01']) expect(x, t).toContain(t);
  });

  it('los avisos fijos salen SIEMPRE, también en una versión aprobada y en una anterior a la Declaración justificada', async () => {
    for (const d of [con(), con({}, aprobada), { ...aprobada, justificacion: null } as DocumentoDeclaracion, base]) {
      const x = (await texto(d)).replace(/\s+/g, ' ');
      for (const a of AVISOS) expect(x, a).toContain(a);
    }
  });

  it('avisa si hay riesgos «mitigar» y falta la referencia al plan de tratamiento, y no si el plan está', async () => {
    const sinPlan = await texto(con({ referencias: [justificada.referencias[0] as never] }));
    expect(sinPlan).toContain('no se registró la referencia al plan de tratamiento');
    expect(await texto(con())).not.toContain('no se registró la referencia al plan de tratamiento');
  });

  it('sin riesgos ni referencias dice que no hay registro de riesgos y conserva la nota de que se gestionan fuera', async () => {
    for (const d of [con({ riesgos: [], riesgosPorFila: [], referencias: [], motivos: [] }), base]) {
      const x = await texto(d);
      expect(x).toContain('No hay registro de riesgos en el sistema');
      expect(x).toContain('documentos externos a este sistema');
    }
  });

  it('una versión anterior a la Declaración justificada lo dice y no muestra motivos ni riesgos', async () => {
    const x = await texto({ ...aprobada, justificacion: null });
    expect(x).toContain('aprobó antes de que el sistema registrara motivos de inclusión');
    expect(x).not.toContain('Motivo de inclusión');
  });

  it('el borrador sigue marcado como preliminar y la versión aprobada no', async () => {
    expect(await texto(con())).toContain('DOCUMENTO PRELIMINAR');
    expect(await texto(con({}, aprobada))).not.toContain('PRELIMINAR');
  });

  it('el resumen incluye cuántos controles tienen y no tienen motivo', async () => {
    const x = await texto(con({ conMotivo: 5, sinMotivo: 1 }));
    expect(x).toContain('Aplican con motivo: 5');
    expect(x).toContain('Aplican sin motivo: 1');
  });

  it('los textos de la empresa (notas, títulos, ubicaciones) salen como texto plano: nada de campos, enlaces ni marcado activo', async () => {
    const hostil = '<script>alert(1)</script> =HYPERLINK("http://x") ]]> &amp; {{ ${x} }}\nsegunda\u0007línea';
    const x = await texto(
      con({
        motivos: [{ libreriaCodigo: 'l', idEstable: 'a27-5-2', tipo: 'otro', nota: hostil }],
        riesgos: [{ ...justificada.riesgos[0]!, titulo: hostil }],
        referencias: [{ tipo: 'plan', titulo: hostil, versionDoc: hostil, fecha: '2026-11-01', ubicacion: hostil }],
      }),
    );
    expect(x).not.toContain('<script>');
    expect(x).toContain('&lt;script&gt;');
    expect(x).not.toMatch(/<w:fldChar|<w:fldSimple|<w:instrText|<w:hyperlink|<w:object|<w:altChunk/);
    expect(x).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
  });

  it('sigue siendo un DOCX válido sin macros ni objetos', async () => {
    const { bytes } = await generar(con());
    const lector = { tamano: bytes.length, leer: async (d: number, h: number) => bytes.subarray(d, Math.min(h, bytes.length)) };
    expect(await detectarTipoArchivo(lector)).toEqual({ ok: true, tipo: TIPO_DOCUMENTO_WORD });
    expect(nombres(bytes).filter((n) => /vbaProject|embeddings|activeX|\.bin$|oleObject/i.test(n))).toEqual([]);
  });
});

// ---- Correcciones de la revisión del hito (experto ISO y seguridad)
describe('GeneradorDocumentoDocx tras la revisión', () => {
  it('la portada dice, siempre y también en una versión aprobada, que el documento no está listo para un auditor sin completarlo', async () => {
    for (const d of [base, aprobada, con(), con({}, aprobada)]) {
      const x = (await texto(d)).replace(/\s+/g, ' ');
      expect(x).toContain('no está listo para presentarse a un auditor');
      expect(x).toContain('Controles del Anexo A de ISO/IEC 27001, edición 2022');
    }
  });

  it('la portada va ANTES de la tabla de controles (no solo al final)', async () => {
    const x = await texto(con());
    expect(x.indexOf('no está listo para presentarse a un auditor')).toBeLessThan(x.indexOf('Estado de implementación'));
  });

  it('la columna de implementación dice que sale del Diagnóstico', async () => {
    for (const d of [base, con()]) expect(await texto(d)).toContain('Estado de implementación (según el Diagnóstico)');
  });

  it('con riesgos, la sección de tratamiento trae las equivalencias con los términos de la norma (a confirmar)', async () => {
    const x = await texto(con());
    expect(x).toContain('mitigar = modificar el riesgo');
    expect(x).toContain('aceptar = retener');
    expect(x).toContain('transferir = compartir');
    expect(x).toContain('a confirmar con su ejemplar');
  });

  it('aclara que el nivel inicial es el de antes del tratamiento y que no es el riesgo residual', async () => {
    expect(await texto(con())).toContain('antes del tratamiento (no es el riesgo residual)');
  });

  it('incluye siempre un bloque de aprobación para la dirección (nombre, cargo, fecha y firma) y dice que no está en el sistema', async () => {
    for (const d of [base, aprobada, con(), con({}, aprobada)]) {
      const x = await texto(d);
      expect(x).toContain('Aprobación');
      expect(x).toContain('no están registradas en el sistema');
      for (const campo of ['Nombre:', 'Cargo:', 'Fecha:', 'Firma:']) expect(x, campo).toContain(campo);
    }
  });

  it('quita los caracteres invisibles o de dirección (U+202E, ancho cero, marca de orden de bytes) para que no disfracen el texto', async () => {
    const x = await texto({ ...base, alcance: 'antes‮después y​un﻿o', filas: [{ ...(base.filas[2] as DocumentoDeclaracion['filas'][number]), justificacion: 'a⁦b⁩c' }] });
    expect(x).not.toMatch(/[​-‏‪-‮⁠-⁤⁦-⁩﻿]/);
    expect(x).toContain('antesdespués');
    expect(x).toContain('abc');
  });
});

describe('informe de auditoría interna en Word', () => {
  const contenido = {
    version: 1,
    auditoria: {
      codigo: 'AI-2026-01',
      anio: 2026,
      objetivo: 'Verificar el SGSI',
      inicio: '2026-11-10',
      fin: '2026-11-25',
      reunionApertura: '2026-11-10',
      reunionCierre: '2026-11-25',
      combinada: true,
      normas: ['iso-27001', 'iso-9001'],
      capitulos: [{ libreriaCodigo: 'iso-27001', capitulo: '9' }],
      procesos: [
        { codigo: 'PR-001', nombre: 'Compras', transversal: false },
        { codigo: 'PR-002', nombre: 'Gestión del SIG', transversal: true },
      ],
    },
    programa: { anio: 2026, objetivo: 'Programa 2026' },
    equipo: [
      { personaId: 'u1', nombre: 'Dora Auditora', rol: 'lider', excepcion: true, autoautorizada: true, excepcionMotivo: 'no hay otra persona', excepcionMedida: 'otra persona revisa el informe' },
      { personaId: 'u2', nombre: 'Eli <Auditor>', rol: 'auditor', excepcion: false, autoautorizada: false, excepcionMotivo: null, excepcionMedida: null },
    ],
    conteos: { por_evaluar: 0, conforme: 1, no_conforme: 1, observacion: 0, oportunidad: 0, no_aplica: 0, no_verificado: 1, total: 3, cubiertas: 2 },
    filas: [
      { libreriaCodigo: 'iso-27001', idEstable: 'c4-1', titulo: 'Contexto', resultado: 'conforme', nota: null },
      { libreriaCodigo: 'iso-27001', idEstable: 'c9-2', titulo: null, resultado: 'no_conforme', nota: 'No hay acta' },
      { libreriaCodigo: 'iso-27001', idEstable: 'c9-3', titulo: 'Revisión', resultado: 'no_verificado', nota: 'sin tiempo\u202e' },
    ],
    noVerificadas: [{ libreriaCodigo: 'iso-27001', idEstable: 'c9-3', nota: 'sin tiempo' }],
    hallazgos: [{ codigo: 'H-001', tipo: 'nc_menor', proceso: 'PR-001', requisito: 'iso-27001:c9-2', enunciado: 'Falta el acta', evidencia: 'Carpeta vacía', justificacionGravedad: null, estado: 'abierto' }],
    conclusion: 'Conforme con una NC menor.\nSegunda línea.',
    limitaciones: null,
    emitidoPor: { personaId: 'u1', nombre: 'Dora Auditora' },
    emitidoEn: '2026-11-19T15:00:00.000Z',
  } as never;
  const generarInforme = () => new GeneradorDocumentoDocx().generarInformeAuditoria({ contenido, huella: 'a'.repeat(64), generadaEl: '2026-11-20' });

  it('es un Word válido (por su contenido), con la huella del documento y sin campos, enlaces ni macros', async () => {
    const r = await generarInforme();
    const lector = { tamano: r.bytes.length, leer: async (d: number, h: number) => r.bytes.subarray(d, Math.min(h, r.bytes.length)) };
    expect(await detectarTipoArchivo(lector)).toEqual({ ok: true, tipo: TIPO_DOCUMENTO_WORD });
    expect(r.sha256).toBe(sha256Hex(r.bytes));
    const todo = nombres(r.bytes);
    expect(todo.filter((n) => /vba|macro|embeddings|oleObject/i.test(n))).toEqual([]);
    const xml = parte(r.bytes, 'word/document.xml')!;
    expect(xml).not.toMatch(/w:fldSimple|w:instrText|w:hyperlink|w:altChunk/);
  });

  it('lleva el aviso de que no es un certificado, la huella de la copia congelada, la conclusión y los hallazgos', async () => {
    const xml = parte((await generarInforme()).bytes, 'word/document.xml')!;
    for (const esperado of ['Informe de auditoría interna', 'no es un certificado', 'a'.repeat(64), 'AI-2026-01', 'Conforme con una NC menor.', 'Segunda línea.', 'H-001', 'No conformidad menor', 'Falta el acta', 'Carpeta vacía', 'proceso transversal', 'Auditoría combinada', 'Excepción de independencia', 'otra persona revisa el informe', 'Lo que no se verificó', 'No se registraron limitaciones.'])
      expect(xml, esperado).toContain(esperado);
    expect(xml).toContain('Resultados de la lista de verificación');
  });

  it('escapa lo que escribió la empresa y quita los caracteres invisibles o de dirección', async () => {
    const xml = parte((await generarInforme()).bytes, 'word/document.xml')!;
    expect(xml).toContain('Eli &lt;Auditor&gt;');
    expect(xml).not.toContain('Eli <Auditor>');
    expect(xml).not.toContain('\u202e');
  });
});
