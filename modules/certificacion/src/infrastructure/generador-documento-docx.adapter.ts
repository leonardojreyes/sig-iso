import { createHash } from 'node:crypto';
import { AlignmentType, Document, Footer, Header, HeadingLevel, Packer, PageNumber, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { DocumentoDeclaracion, DocumentoGenerado, GeneradorDocumentoPort } from '../application/generador-documento.port.js';
import type { FilaDeclaracion } from '../domain/declaracion.js';

// Genera el .docx de la Declaración de Aplicabilidad con la librería `docx` (ADR 033, MIT). Solo escribe TEXTO plano: nada de
// campos, hipervínculos, macros ni objetos incrustados, así que lo que la empresa escribió no puede ejecutar nada al abrirse.

const TEXTOS = {
  titulo: 'Declaración de Aplicabilidad',
  preliminar: 'DOCUMENTO PRELIMINAR generado por el sistema. Lo revisa y aprueba la empresa antes de presentarlo.',
  aprobada: (n: number, el: string) => `Versión ${n}, aprobada el ${el}.`,
  generada: (el: string) => `Documento generado el ${el}.`,
  alcance: 'Alcance',
  sinAlcance: 'No se registró un alcance para esta norma.',
  resumen: 'Resumen',
  filas: { total: 'Controles', aplican: 'Aplican', noAplican: 'No aplican', porDecidir: 'Por decidir', sinControl: 'Aplican sin control asignado' },
  controlesTitulo: 'Controles',
  columnas: ['Control', 'Título', 'Grupo', 'Aplicabilidad', 'Implementación', 'Controles de la empresa', 'Evidencia', 'Justificación'],
  aplica: { aplica: 'Aplica', no_aplica: 'No aplica', por_decidir: 'Por decidir' },
  implementacion: { implementado: 'Implementado', parcial: 'Parcial', no_implementado: 'No implementado' },
  cobertura: { cubierta: 'Con evidencia vigente', evidencia_vencida: 'Evidencia vencida', sin_evidencia: 'Sin evidencia', sin_control: 'Sin control', no_aplica: 'No aplica' },
  sinControlAsignado: 'Sin control asignado',
  pie: 'Página',
  autor: 'SIG ISO',
} as const;

// Caracteres que XML no admite (y que en un documento no tienen sentido): se quitan, sin cambiar el resto.
const NO_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f￾￿]/g;
const limpio = (t: string): string => t.replace(NO_XML, '');
const enUnaLinea = (t: string): string => limpio(t).replace(/\s+/g, ' ').trim();

const celda = (texto: string, ancho: number, opciones: { negrita?: boolean; fondo?: string } = {}): TableCell =>
  new TableCell({
    width: { size: ancho, type: WidthType.PERCENTAGE },
    ...(opciones.fondo ? { shading: { type: ShadingType.CLEAR, fill: opciones.fondo, color: 'auto' } } : {}),
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold: opciones.negrita === true, size: 18 })] })],
  });

const ANCHOS = [8, 20, 10, 9, 11, 14, 11, 17] as const;

const filaDeTabla = (f: FilaDeclaracion): TableRow => {
  const controles = f.controles.length > 0 ? f.controles.join(', ') : f.aplicabilidad === 'aplica' ? TEXTOS.sinControlAsignado : '';
  const valores = [
    f.idEstable,
    f.titulo,
    f.grupo ?? '',
    TEXTOS.aplica[f.aplicabilidad],
    f.implementacion ? TEXTOS.implementacion[f.implementacion] : '',
    controles,
    TEXTOS.cobertura[f.cobertura],
    f.justificacion ?? '',
  ];
  return new TableRow({ children: valores.map((v, i) => celda(enUnaLinea(v), ANCHOS[i] ?? 10)) });
};

export class GeneradorDocumentoDocx implements GeneradorDocumentoPort {
  async generarDeclaracion(d: DocumentoDeclaracion): Promise<DocumentoGenerado> {
    const resumen = d.resumen;
    const encabezado = new TableRow({ tableHeader: true, children: TEXTOS.columnas.map((c, i) => celda(c, ANCHOS[i] ?? 10, { negrita: true, fondo: 'E7EEF1' })) });
    const parrafosAlcance = (d.alcance ?? '')
      .split(/\r?\n/)
      .map((l) => limpio(l).trim())
      .filter((l) => l.length > 0);

    const documento = new Document({
      creator: TEXTOS.autor,
      title: `${TEXTOS.titulo} ${d.norma}`,
      sections: [
        {
          properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
          headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${TEXTOS.titulo} · ${d.norma}${d.preliminar ? ' · PRELIMINAR' : ''}`, size: 16 })] })] }) },
          footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [`${TEXTOS.pie} `, PageNumber.CURRENT], size: 16 })] })] }) },
          children: [
            new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`${TEXTOS.titulo}`)] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(limpio(d.norma))] }),
            new Paragraph({ children: [new TextRun({ text: d.preliminar ? TEXTOS.preliminar : TEXTOS.aprobada(d.version ?? 0, d.aprobadaEl ?? ''), bold: true })] }),
            new Paragraph({ children: [new TextRun(TEXTOS.generada(d.generadaEl))] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(TEXTOS.alcance)] }),
            ...(parrafosAlcance.length > 0 ? parrafosAlcance.map((l) => new Paragraph({ children: [new TextRun(l)] })) : [new Paragraph({ children: [new TextRun({ text: TEXTOS.sinAlcance, italics: true })] })]),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(TEXTOS.resumen)] }),
            new Paragraph({ children: [new TextRun(`${TEXTOS.filas.total}: ${resumen.total} · ${TEXTOS.filas.aplican}: ${resumen.aplican} · ${TEXTOS.filas.noAplican}: ${resumen.noAplican} · ${TEXTOS.filas.porDecidir}: ${resumen.porDecidir} · ${TEXTOS.filas.sinControl}: ${resumen.sinControl}`)] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(TEXTOS.controlesTitulo)] }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [encabezado, ...d.filas.map(filaDeTabla)] }),
          ],
        },
      ],
    });
    const bytes = new Uint8Array(await Packer.toBuffer(documento));
    return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
}
