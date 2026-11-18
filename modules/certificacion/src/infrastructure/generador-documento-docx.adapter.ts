import { createHash } from 'node:crypto';
import { AlignmentType, Document, Footer, Header, HeadingLevel, Packer, PageNumber, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { DocumentoDeclaracion, DocumentoGenerado, GeneradorDocumentoPort, JustificacionDocumento } from '../application/generador-documento.port.js';
import type { FilaDeclaracion } from '../domain/declaracion.js';
import { nombreDeNivel, type DecisionTratamiento, type NivelRiesgo } from '../domain/riesgo.js';

// Genera el .docx de la Declaración de Aplicabilidad con la librería `docx` (ADR 033, MIT). Solo escribe TEXTO plano: nada de
// campos, hipervínculos, macros ni objetos incrustados, así que lo que la empresa escribió no puede ejecutar nada al abrirse.
// Con la justificación (ADR 037) suma el motivo de inclusión de cada control, los riesgos, la sección «Tratamiento de riesgos» y los
// avisos fijos de lo que el registro NO cubre; esos avisos salen siempre, también en una versión aprobada.

const TEXTOS = {
  titulo: 'Declaración de Aplicabilidad',
  preliminar: 'DOCUMENTO PRELIMINAR generado por el sistema. Lo revisa y aprueba la empresa antes de presentarlo.',
  aprobada: (n: number, el: string) => `Versión ${n}, aprobada el ${el}.`,
  generada: (el: string) => `Documento generado el ${el}.`,
  notaRiesgos: 'Nota: los controles de esta declaración se determinan a partir del tratamiento de riesgos de seguridad de la información de la organización. El análisis de riesgos y el plan de tratamiento son documentos externos a este sistema y deben citarse al presentar la declaración.',
  alcance: 'Alcance',
  sinAlcance: 'No se registró un alcance para esta norma.',
  resumen: 'Resumen',
  filas: { total: 'Controles', aplican: 'Aplican', noAplican: 'No aplican', porDecidir: 'Por decidir', sinControl: 'Aplican sin control asignado', conMotivo: 'Aplican con motivo', sinMotivo: 'Aplican sin motivo' },
  controlesTitulo: 'Controles',
  columnas: ['Control', 'Título', 'Grupo', 'Aplicabilidad', 'Implementación', 'Controles de la empresa', 'Evidencia', 'Justificación'],
  columnasJustificadas: ['Control', 'Título', 'Grupo', 'Aplicabilidad', 'Implementación', 'Controles de la empresa', 'Evidencia', 'Motivo de inclusión', 'Riesgos', 'Justificación de exclusión'],
  aplica: { aplica: 'Aplica', no_aplica: 'No aplica', por_decidir: 'Por decidir' },
  implementacion: { implementado: 'Implementado', parcial: 'Parcial', no_implementado: 'No implementado' },
  cobertura: { cubierta: 'Con evidencia vigente', evidencia_vencida: 'Evidencia vencida', sin_evidencia: 'Sin evidencia', sin_control: 'Sin control', no_aplica: 'No aplica' },
  sinControlAsignado: 'Sin control asignado',
  pie: 'Página',
  autor: 'SIG ISO',
  // Motivo de inclusión (ADR 037)
  motivo: { legal: 'Requisito legal', contractual: 'Requisito contractual', negocio: 'Necesidad del negocio', otro: 'Otro' },
  motivoRiesgo: 'Riesgo (ver columna Riesgos)',
  sinMotivo: 'Sin motivo',
  riesgoPorControl: 'Riesgo',
  riesgoPrevisto: 'Tratamiento previsto, sin control de la empresa',
  // Sección de tratamiento de riesgos
  tratamiento: 'Tratamiento de riesgos',
  sinRegistro: 'No hay registro de riesgos en el sistema.',
  versionAnterior: 'Esta versión se aprobó antes de que el sistema registrara motivos de inclusión ni riesgos; se muestra como se aprobó, sin ellos.',
  sinRiesgos: 'No hay riesgos vigentes registrados.',
  columnasRiesgos: ['Código', 'Riesgo', 'Nivel inicial', 'Probabilidad × impacto', 'Decisión', 'Responsable', 'Controles que lo tratan'],
  decision: { mitigar: 'Mitigar', aceptar: 'Aceptar', transferir: 'Transferir', evitar: 'Evitar' } satisfies Record<DecisionTratamiento, string>,
  responsable: { asignado: 'Asignado', sin: 'Sin asignar' },
  previsto: 'Previsto',
  escalaTitulo: 'Escala del nivel de riesgo',
  escala: (max: number) => `Probabilidad e impacto de 1 a ${max}; el nivel inicial es la probabilidad por el impacto. Es el método por omisión de la herramienta y no es el criterio de aceptación de la empresa.`,
  referenciasTitulo: 'Referencias al tratamiento de riesgos',
  referencia: { analisis: 'Análisis de riesgos', plan: 'Plan de tratamiento de riesgos' },
  sinReferencia: 'No se registró',
  // Avisos fijos: salen siempre (H6.3), también en versiones aprobadas.
  avisosTitulo: 'Lo que este documento no cubre',
  avisos: [
    'El registro de riesgos de esta herramienta es simplificado.',
    'Este documento no registra el riesgo residual ni su aceptación por los responsables; la empresa debe conservarlos aparte.',
    'Este documento no incluye controles adicionales fuera del Anexo A (los que el tratamiento de riesgos haya determinado y no estén en el Anexo A).',
    'Este documento no contempla activos de información.',
  ],
  avisoSinPlan: 'Hay riesgos con decisión «mitigar» y no se registró la referencia al plan de tratamiento.',
} as const;

// Caracteres que XML no admite (y que en un documento no tienen sentido): se quitan, sin cambiar el resto.
const NO_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f￾￿]/g;
const limpio = (t: string): string => t.replace(NO_XML, '');
const enUnaLinea = (t: string): string => limpio(t).replace(/\s+/g, ' ').trim();

/** Una celda con uno o varios renglones (cada uno, un párrafo de texto plano). */
const celda = (texto: string | readonly string[], ancho: number, opciones: { negrita?: boolean; fondo?: string } = {}): TableCell =>
  new TableCell({
    width: { size: ancho, type: WidthType.PERCENTAGE },
    ...(opciones.fondo ? { shading: { type: ShadingType.CLEAR, fill: opciones.fondo, color: 'auto' } } : {}),
    children: (typeof texto === 'string' ? [texto] : texto).map((l) => new Paragraph({ children: [new TextRun({ text: enUnaLinea(l), bold: opciones.negrita === true, size: 18 })] })),
  });

const tabla = (columnas: readonly string[], anchos: readonly number[], filas: readonly (readonly (string | readonly string[])[])[]): Table =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: columnas.map((c, i) => celda(c, anchos[i] ?? 10, { negrita: true, fondo: 'E7EEF1' })) }),
      ...filas.map((f) => new TableRow({ children: f.map((v, i) => celda(v, anchos[i] ?? 10)) })),
    ],
  });

const ANCHOS = [8, 20, 10, 9, 11, 14, 11, 17] as const;
const ANCHOS_JUSTIFICADOS = [6, 15, 7, 8, 9, 10, 8, 17, 9, 11] as const;
const ANCHOS_RIESGOS = [8, 24, 10, 12, 10, 12, 24] as const;

const texto = (t: string, opciones: { negrita?: boolean; cursiva?: boolean } = {}): Paragraph =>
  new Paragraph({ children: [new TextRun({ text: limpio(t), ...(opciones.negrita ? { bold: true } : {}), ...(opciones.cursiva ? { italics: true } : {}) })] });
const titulo1 = (t: string): Paragraph => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const mayuscula = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const nivel = (n: NivelRiesgo): string => mayuscula(nombreDeNivel(n));

/** Los renglones de motivo y de riesgos de una fila que aplica, según la justificación. */
const justificacionDeFila = (f: FilaDeclaracion, j: JustificacionDocumento): { motivo: string[]; riesgos: string[] } => {
  if (f.aplicabilidad !== 'aplica') return { motivo: [], riesgos: [] };
  const porControl = j.riesgosPorFila.filter((x) => x.idEstable === f.idEstable && x.libreriaCodigo === f.libreriaCodigo && x.via === 'control').map((x) => x.riesgoCodigo);
  const previstos = j.riesgosPorFila.filter((x) => x.idEstable === f.idEstable && x.libreriaCodigo === f.libreriaCodigo && x.via === 'previsto').map((x) => x.riesgoCodigo);
  const registrados = j.motivos.filter((m) => m.idEstable === f.idEstable && m.libreriaCodigo === f.libreriaCodigo).map((m) => `${TEXTOS.motivo[m.tipo]}: ${m.nota}`);
  const motivo = [...(porControl.length + previstos.length > 0 ? [TEXTOS.motivoRiesgo] : []), ...registrados];
  return {
    motivo: motivo.length > 0 ? motivo : [TEXTOS.sinMotivo],
    riesgos: [...(porControl.length > 0 ? [`${TEXTOS.riesgoPorControl}: ${porControl.join(', ')}`] : []), ...(previstos.length > 0 ? [`${TEXTOS.riesgoPrevisto}: ${previstos.join(', ')}`] : [])],
  };
};

const filaDeTabla = (f: FilaDeclaracion, j: JustificacionDocumento | null): (string | readonly string[])[] => {
  const controles = f.controles.length > 0 ? f.controles.join(', ') : f.aplicabilidad === 'aplica' ? TEXTOS.sinControlAsignado : '';
  const base = [f.idEstable, f.titulo, f.grupo ?? '', TEXTOS.aplica[f.aplicabilidad], f.implementacion ? TEXTOS.implementacion[f.implementacion] : '', controles, TEXTOS.cobertura[f.cobertura]];
  if (j === null) return [...base, f.justificacion ?? ''];
  const { motivo, riesgos } = justificacionDeFila(f, j);
  return [...base, motivo, riesgos, f.justificacion ?? ''];
};

/** Rango de puntajes de cada nivel a partir de la escala congelada: «Bajo: 1 a 4», «Crítico: 16 a 25»… */
const cortes = (e: JustificacionDocumento['escala']): string[] => {
  const tope = e.escalaMax * e.escalaMax;
  return [`Bajo: 1 a ${e.corteMedio - 1}`, `Medio: ${e.corteMedio} a ${e.corteAlto - 1}`, `Alto: ${e.corteAlto} a ${e.corteCritico - 1}`, `Crítico: ${e.corteCritico} a ${tope}`];
};

/** La sección «Tratamiento de riesgos»: riesgos, escala y referencias; o la constancia de que no hay registro. */
const seccionTratamiento = (d: DocumentoDeclaracion): Paragraph[] | (Paragraph | Table)[] => {
  const j = d.justificacion;
  const salida: (Paragraph | Table)[] = [titulo1(TEXTOS.tratamiento)];
  if (j === null) {
    salida.push(texto(d.preliminar ? TEXTOS.sinRegistro : TEXTOS.versionAnterior, { negrita: true }), texto(TEXTOS.notaRiesgos, { cursiva: true }));
    return salida;
  }
  if (j.riesgos.length === 0 && j.referencias.length === 0) {
    salida.push(texto(TEXTOS.sinRegistro, { negrita: true }), texto(TEXTOS.notaRiesgos, { cursiva: true }));
    return salida;
  }
  if (j.riesgos.length === 0) salida.push(texto(TEXTOS.sinRiesgos, { cursiva: true }));
  else {
    const previstosDe = (codigo: string): string[] => [...new Set(j.riesgosPorFila.filter((x) => x.riesgoCodigo === codigo && x.via === 'previsto').map((x) => x.idEstable))];
    salida.push(
      tabla(
        TEXTOS.columnasRiesgos,
        ANCHOS_RIESGOS,
        j.riesgos.map((r) => {
          const controles = [...r.controles, ...previstosDe(r.codigo).map((id) => `${TEXTOS.previsto} ${id}`)];
          return [r.codigo, r.titulo, nivel(r.nivel), `${r.probabilidad} × ${r.impacto} = ${r.probabilidad * r.impacto}`, TEXTOS.decision[r.decision], r.responsableId === null ? TEXTOS.responsable.sin : TEXTOS.responsable.asignado, controles.length > 0 ? controles.join(', ') : '—'];
        }),
      ),
    );
    salida.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(TEXTOS.escalaTitulo)] }), texto(TEXTOS.escala(j.escala.escalaMax)), texto(cortes(j.escala).join(' · ')));
  }
  salida.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(TEXTOS.referenciasTitulo)] }));
  for (const tipo of ['analisis', 'plan'] as const) {
    const r = j.referencias.find((x) => x.tipo === tipo);
    salida.push(texto(r ? `${TEXTOS.referencia[tipo]}: ${r.titulo}, versión ${r.versionDoc}, fecha ${r.fecha}, ubicación ${r.ubicacion}.` : `${TEXTOS.referencia[tipo]}: ${TEXTOS.sinReferencia}.`));
  }
  return salida;
};

/** Los avisos fijos de lo que el documento no cubre (H6.3). Salen siempre, también en una versión aprobada. */
const seccionAvisos = (d: DocumentoDeclaracion): Paragraph[] => {
  const j = d.justificacion;
  const sinPlan = j !== null && j.riesgos.some((r) => r.decision === 'mitigar') && !j.referencias.some((r) => r.tipo === 'plan');
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(TEXTOS.avisosTitulo)] }),
    ...[...TEXTOS.avisos, ...(sinPlan ? [TEXTOS.avisoSinPlan] : [])].map((a) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun(limpio(a))] })),
  ];
};

export class GeneradorDocumentoDocx implements GeneradorDocumentoPort {
  async generarDeclaracion(d: DocumentoDeclaracion): Promise<DocumentoGenerado> {
    const resumen = d.resumen;
    const j = d.justificacion;
    const parrafosAlcance = (d.alcance ?? '')
      .split(/\r?\n/)
      .map((l) => limpio(l).trim())
      .filter((l) => l.length > 0);
    const lineaResumen = [
      `${TEXTOS.filas.total}: ${resumen.total}`,
      `${TEXTOS.filas.aplican}: ${resumen.aplican}`,
      `${TEXTOS.filas.noAplican}: ${resumen.noAplican}`,
      `${TEXTOS.filas.porDecidir}: ${resumen.porDecidir}`,
      `${TEXTOS.filas.sinControl}: ${resumen.sinControl}`,
      ...(j ? [`${TEXTOS.filas.conMotivo}: ${j.conMotivo}`, `${TEXTOS.filas.sinMotivo}: ${j.sinMotivo}`] : []),
    ].join(' · ');
    const tablaControles = j
      ? tabla(TEXTOS.columnasJustificadas, ANCHOS_JUSTIFICADOS, d.filas.map((f) => filaDeTabla(f, j)))
      : tabla(TEXTOS.columnas, ANCHOS, d.filas.map((f) => filaDeTabla(f, null)));

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
            new Paragraph({ children: [new TextRun(lineaResumen)] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(TEXTOS.controlesTitulo)] }),
            tablaControles,
            ...seccionTratamiento(d),
            ...seccionAvisos(d),
          ],
        },
      ],
    });
    const bytes = new Uint8Array(await Packer.toBuffer(documento));
    return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
}
