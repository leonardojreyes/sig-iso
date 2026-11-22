import { createHash } from 'node:crypto';
import { AlignmentType, Document, Footer, Header, HeadingLevel, Packer, PageNumber, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { DocumentoDeclaracion, DocumentoGenerado, DocumentoInformeAuditoria, GeneradorDocumentoPort, JustificacionDocumento } from '../application/generador-documento.port.js';
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
  edicion: 'Controles del Anexo A de ISO/IEC 27001, edición 2022.',
  alcanceDelDocumento: 'Registro simplificado: este documento no está listo para presentarse a un auditor sin completar lo indicado en «Lo que este documento no cubre» (al final) y sin la aprobación de la dirección.',
  notaRiesgos: 'Nota: los controles de esta declaración se determinan a partir del tratamiento de riesgos de seguridad de la información de la organización. El análisis de riesgos y el plan de tratamiento son documentos externos a este sistema y deben citarse al presentar la declaración.',
  alcance: 'Alcance',
  sinAlcance: 'No se registró un alcance para esta norma.',
  resumen: 'Resumen',
  filas: { total: 'Controles', aplican: 'Aplican', noAplican: 'No aplican', porDecidir: 'Por decidir', sinControl: 'Aplican sin control asignado', conMotivo: 'Aplican con motivo', sinMotivo: 'Aplican sin motivo' },
  controlesTitulo: 'Controles',
  columnas: ['Control', 'Título', 'Grupo', 'Aplicabilidad', 'Estado de implementación (según el Diagnóstico)', 'Controles de la empresa', 'Evidencia', 'Justificación'],
  columnasJustificadas: ['Control', 'Título', 'Grupo', 'Aplicabilidad', 'Estado de implementación (según el Diagnóstico)', 'Controles de la empresa', 'Evidencia', 'Motivo de inclusión', 'Riesgos', 'Justificación de exclusión'],
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
  equivalencias: 'Equivalencias con los términos de la norma (a confirmar con su ejemplar): mitigar = modificar el riesgo; aceptar = retener; transferir = compartir; evitar = evitar.',
  escalaTitulo: 'Escala del nivel de riesgo',
  escala: (max: number) => `Probabilidad e impacto de 1 a ${max}; el nivel inicial es la probabilidad por el impacto y es el del riesgo antes del tratamiento (no es el riesgo residual). Es el método por omisión de la herramienta y no es el criterio de aceptación de la empresa.`,
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
  aprobacionTitulo: 'Aprobación',
  aprobacionTexto: 'La aprobación de la dirección de la organización y la de los responsables de los riesgos no están registradas en el sistema. Anexe su constancia o complete:',
  aprobacionCampos: ['Nombre: ______________________________', 'Cargo: ______________________________', 'Fecha: ______________________________', 'Firma: ______________________________'],
  avisoSinPlan: 'Hay riesgos con decisión «mitigar» y no se registró la referencia al plan de tratamiento.',
} as const;

// Caracteres que XML no admite (y que en un documento no tienen sentido): se quitan, sin cambiar el resto.
// Y los invisibles o de dirección (ancho cero, U+202E…): no tienen sentido en el documento y sirven para disfrazar un texto.
const NO_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff￾￿]/g;
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
    salida.push(texto(TEXTOS.equivalencias, { cursiva: true }));
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


// Informe de auditoría interna (ADR 040): sale SIEMPRE de la copia congelada que se emitió, con su huella. Solo texto plano.
const INFORME = {
  titulo: 'Informe de auditoría interna',
  aviso: 'Informe de auditoría interna: no es un certificado ni lo emite un organismo de certificación.',
  congelada: (huella: string) => `Copia congelada e inmutable. Huella SHA-256 de la copia: ${huella}.`,
  emitido: (el: string, por: string) => `Emitido el ${el} por ${por}.`,
  generada: (el: string) => `Documento generado el ${el}.`,
  datos: 'Datos de la auditoría',
  programa: (anio: number, objetivo: string) => `Programa anual ${anio}: ${objetivo}`,
  objetivo: (o: string) => `Objetivo: ${o}`,
  fechas: (i: string, f: string) => `Fechas: del ${i} al ${f}.`,
  reuniones: (a: string | null, c: string | null) => `Reunión de apertura: ${a ?? 'sin fecha'}. Reunión de cierre: ${c ?? 'sin fecha'}.`,
  criterios: 'Criterios',
  combinada: 'Auditoría combinada: los criterios abarcan más de una norma.',
  alcance: 'Alcance',
  procesos: 'Procesos auditados',
  capitulos: 'Capítulos o temas indicados',
  todosCapitulos: 'Todos los capítulos y temas de las normas elegidas.',
  transversal: 'proceso transversal',
  equipo: 'Equipo auditor',
  lider: 'Líder',
  auditor: 'Auditor',
  excepcionTitulo: 'Excepción de independencia',
  excepcion: (motivo: string, medida: string) => `Motivo: ${motivo}. Medida compensatoria: ${medida}.`,
  autoautorizada: 'La excepción la autorizó la misma persona designada (único administrador activo).',
  resultados: 'Resultados de la lista de verificación',
  etiquetas: { conforme: 'Conformes', no_conforme: 'No conformes', observacion: 'Observaciones', oportunidad: 'Oportunidades de mejora', no_aplica: 'No aplica', no_verificado: 'No verificadas', por_evaluar: 'Por evaluar' } as const,
  cobertura: (c: number, t: number) => `Filas evaluadas de verdad (conforme, no conforme, observación, oportunidad o no aplica justificado): ${c} de ${t}.`,
  conclusion: 'Conclusión del auditor líder',
  limitaciones: 'Limitaciones',
  sinLimitaciones: 'No se registraron limitaciones.',
  noVerificadas: 'Lo que no se verificó',
  hallazgos: 'Hallazgos',
  sinHallazgos: 'No se registraron hallazgos.',
  columnasHallazgos: ['Código', 'Tipo', 'Proceso', 'Requisito', 'Enunciado', 'Evidencia objetiva', 'Gravedad', 'Estado'],
  tipos: { nc_mayor: 'No conformidad mayor', nc_menor: 'No conformidad menor', observacion: 'Observación', oportunidad: 'Oportunidad de mejora' } as const,
  estadoHallazgo: { abierto: 'Abierto', anulado: 'Anulado' } as const,
  tratamiento: 'El tratamiento de las no conformidades (causa raíz, acciones y verificación de eficacia) se hace en el módulo de no conformidades; los hallazgos siguen abiertos hasta entonces.',
  lista: 'Detalle de la lista de verificación',
  columnasLista: ['Requisito', 'Título', 'Resultado', 'Nota'],
  resultado: { conforme: 'Conforme', no_conforme: 'No conforme', observacion: 'Observación', oportunidad: 'Oportunidad', no_aplica: 'No aplica', no_verificado: 'No verificado', por_evaluar: 'Por evaluar' } as const,
  datosPersonales: 'Este informe puede contener datos personales de textos escritos por la empresa. Trátelo según la política de privacidad.',
  pie: 'Página',
  autor: 'SIG ISO',
} as const;
const ANCHOS_HALLAZGOS = [7, 11, 7, 14, 21, 24, 10, 6] as const;
const ANCHOS_LISTA = [20, 30, 12, 38] as const;

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
            new Paragraph({ children: [new TextRun(TEXTOS.edicion)] }),
            new Paragraph({ children: [new TextRun({ text: TEXTOS.alcanceDelDocumento, bold: true })] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(TEXTOS.alcance)] }),
            ...(parrafosAlcance.length > 0 ? parrafosAlcance.map((l) => new Paragraph({ children: [new TextRun(l)] })) : [new Paragraph({ children: [new TextRun({ text: TEXTOS.sinAlcance, italics: true })] })]),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(TEXTOS.resumen)] }),
            new Paragraph({ children: [new TextRun(lineaResumen)] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(TEXTOS.controlesTitulo)] }),
            tablaControles,
            ...seccionTratamiento(d),
            ...seccionAvisos(d),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(TEXTOS.aprobacionTitulo)] }),
            texto(TEXTOS.aprobacionTexto),
            ...TEXTOS.aprobacionCampos.map((c) => texto(c)),
          ],
        },
      ],
    });
    const bytes = new Uint8Array(await Packer.toBuffer(documento));
    return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  async generarInformeAuditoria(d: DocumentoInformeAuditoria): Promise<DocumentoGenerado> {
    const c = d.contenido;
    const t = (x: string, o: { negrita?: boolean; cursiva?: boolean } = {}): Paragraph => texto(limpio(x), o);
    const liderYEquipo = c.equipo.flatMap((m) => [
      t(`${m.rol === 'lider' ? INFORME.lider : INFORME.auditor}: ${enUnaLinea(m.nombre)}`),
      ...(m.excepcion ? [t(`${INFORME.excepcionTitulo}. ${INFORME.excepcion(enUnaLinea(m.excepcionMotivo ?? ''), enUnaLinea(m.excepcionMedida ?? ''))}${m.autoautorizada ? ' ' + INFORME.autoautorizada : ''}`, { negrita: true })] : []),
    ]);
    const conteos = (Object.keys(INFORME.etiquetas) as (keyof typeof INFORME.etiquetas)[]).filter((k) => k !== 'por_evaluar' || c.conteos.por_evaluar > 0).map((k) => `${INFORME.etiquetas[k]}: ${c.conteos[k]}`);
    const documento = new Document({
      creator: INFORME.autor,
      title: `${INFORME.titulo} ${c.auditoria.codigo}`,
      sections: [
        {
          headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${INFORME.titulo} · ${c.auditoria.codigo}`, size: 16 })] })] }) },
          footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [`${INFORME.pie} `, PageNumber.CURRENT], size: 16 })] })] }) },
          children: [
            new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(INFORME.titulo)] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(c.auditoria.codigo)] }),
            t(INFORME.aviso, { negrita: true }),
            t(INFORME.emitido(c.emitidoEn.slice(0, 10), enUnaLinea(c.emitidoPor.nombre))),
            t(INFORME.congelada(d.huella)),
            t(INFORME.generada(d.generadaEl)),
            titulo1(INFORME.datos),
            t(INFORME.programa(c.programa.anio, enUnaLinea(c.programa.objetivo))),
            t(INFORME.objetivo(enUnaLinea(c.auditoria.objetivo))),
            t(INFORME.fechas(c.auditoria.inicio, c.auditoria.fin)),
            t(INFORME.reuniones(c.auditoria.reunionApertura, c.auditoria.reunionCierre)),
            titulo1(INFORME.criterios),
            t(c.auditoria.normas.map(enUnaLinea).join(', ')),
            ...(c.auditoria.combinada ? [t(INFORME.combinada, { cursiva: true })] : []),
            titulo1(INFORME.alcance),
            t(`${INFORME.procesos}: ${c.auditoria.procesos.length === 0 ? '—' : c.auditoria.procesos.map((p) => `${enUnaLinea(p.codigo)} ${enUnaLinea(p.nombre)}${p.transversal ? ` (${INFORME.transversal})` : ''}`).join('; ')}`),
            t(c.auditoria.capitulos.length === 0 ? INFORME.todosCapitulos : `${INFORME.capitulos}: ${c.auditoria.capitulos.map((k) => `${enUnaLinea(k.libreriaCodigo)} ${enUnaLinea(k.capitulo)}`).join('; ')}`),
            titulo1(INFORME.equipo),
            ...liderYEquipo,
            titulo1(INFORME.resultados),
            t(conteos.join(' · ')),
            t(INFORME.cobertura(c.conteos.cubiertas, c.conteos.total)),
            titulo1(INFORME.conclusion),
            ...limpio(c.conclusion).split(/\r?\n/).map((l) => t(l)),
            titulo1(INFORME.limitaciones),
            ...(c.limitaciones ? limpio(c.limitaciones).split(/\r?\n/).map((l) => t(l)) : [t(INFORME.sinLimitaciones, { cursiva: true })]),
            ...(c.noVerificadas.length > 0
              ? [t(INFORME.noVerificadas, { negrita: true }), ...c.noVerificadas.map((n) => t(`${enUnaLinea(n.libreriaCodigo)} ${enUnaLinea(n.idEstable)}: ${enUnaLinea(n.nota ?? '')}`))]
              : []),
            titulo1(INFORME.hallazgos),
            ...(c.hallazgos.length === 0
              ? [t(INFORME.sinHallazgos, { cursiva: true })]
              : [
                  tabla(
                    INFORME.columnasHallazgos,
                    ANCHOS_HALLAZGOS,
                    c.hallazgos.map((h) => [h.codigo, INFORME.tipos[h.tipo], h.proceso ?? '—', h.requisito ?? '—', h.enunciado, h.evidencia, h.justificacionGravedad ?? '—', INFORME.estadoHallazgo[h.estado]]),
                  ),
                  t(INFORME.tratamiento, { cursiva: true }),
                ]),
            titulo1(INFORME.lista),
            tabla(
              INFORME.columnasLista,
              ANCHOS_LISTA,
              c.filas.map((f) => [`${f.libreriaCodigo} ${f.idEstable}`, f.titulo ?? '—', INFORME.resultado[f.resultado], f.nota ?? '']),
            ),
            t(INFORME.datosPersonales, { cursiva: true }),
          ],
        },
      ],
    });
    const bytes = new Uint8Array(await Packer.toBuffer(documento));
    return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
}
