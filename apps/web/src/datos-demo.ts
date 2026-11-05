import type { CeldaRiesgo, EstadoCumplimiento, EtapaCertificacion, ItemMadurez } from '@sig/ui';

// DATOS DE EJEMPLO. Títulos breves y guías redactadas por SynapTech con palabras propias; sin texto de las normas.
export interface RequisitoDemo {
  id: string;
  empresaId: string;
  norma: string;
  clausula: string;
  titulo: string;
  guia: string;
  estado: EstadoCumplimiento;
  controles: string[];
  tambienEn: string[];
  evidencias: { nombre: string; responsable: string; vigenteHasta: string }[];
}

export const normasDemo = ['ISO 9001', 'ISO/IEC 27001', 'ISO/IEC 42001'] as const;

const requisitosA: RequisitoDemo[] = [
  { id: 'r1', empresaId: 'a', norma: 'ISO 9001', clausula: '4.1', titulo: 'Contexto de la organización', guia: 'Documente los factores internos y externos que afectan la capacidad de la empresa de lograr sus resultados, y revíselos cada año.', estado: 'cumple', controles: ['C-001 Análisis de contexto anual'], tambienEn: ['ISO/IEC 27001 4.1', 'ISO/IEC 42001 4.1'], evidencias: [{ nombre: 'Análisis de contexto 2026.pdf', responsable: 'Ana Pérez', vigenteHasta: '2027-03-31' }] },
  { id: 'r2', empresaId: 'a', norma: 'ISO 9001', clausula: '4.2', titulo: 'Partes interesadas', guia: 'Identifique quiénes tienen expectativas sobre el sistema y qué esperan; manténgalo actualizado.', estado: 'parcial', controles: ['C-002 Registro de partes interesadas'], tambienEn: ['ISO/IEC 27001 4.2', 'ISO/IEC 42001 4.2'], evidencias: [{ nombre: 'Matriz de partes interesadas.xlsx', responsable: 'Luis Mora', vigenteHasta: '2026-12-15' }] },
  { id: 'r3', empresaId: 'a', norma: 'ISO 9001', clausula: '5.2', titulo: 'Política de calidad', guia: 'Una política aprobada por la alta dirección, comunicada y disponible para quien la necesite.', estado: 'cumple', controles: ['C-010 Política integrada'], tambienEn: ['ISO/IEC 27001 5.2'], evidencias: [{ nombre: 'Política integrada v3.pdf', responsable: 'Gerencia General', vigenteHasta: '2027-06-30' }] },
  { id: 'r4', empresaId: 'a', norma: 'ISO 9001', clausula: '9.2', titulo: 'Auditoría interna', guia: 'Programe auditorías a intervalos definidos con auditores independientes del área auditada.', estado: 'noCumple', controles: [], tambienEn: ['ISO/IEC 27001 9.2', 'ISO/IEC 42001 9.2'], evidencias: [] },
  { id: 'r5', empresaId: 'a', norma: 'ISO 9001', clausula: '10.2', titulo: 'No conformidad y acción correctiva', guia: 'Cuando algo falla, corrija, analice la causa raíz y verifique que la acción fue eficaz.', estado: 'parcial', controles: ['C-040 Gestión de no conformidades'], tambienEn: ['ISO/IEC 27001 10.2'], evidencias: [{ nombre: 'Registro NC 2026.xlsx', responsable: 'Ana Pérez', vigenteHasta: '2026-11-30' }] },
  { id: 'r6', empresaId: 'a', norma: 'ISO/IEC 27001', clausula: '6.1.2', titulo: 'Evaluación de riesgos de seguridad', guia: 'Defina un método repetible para identificar, analizar y valorar los riesgos de la información.', estado: 'parcial', controles: ['C-020 Metodología de riesgos'], tambienEn: [], evidencias: [{ nombre: 'Metodología de riesgos v2.pdf', responsable: 'CISO', vigenteHasta: '2027-01-31' }] },
  { id: 'r7', empresaId: 'a', norma: 'ISO/IEC 27001', clausula: '6.1.3', titulo: 'Tratamiento y declaración de aplicabilidad', guia: 'Decida qué controles aplica y justifique los que excluye en un documento aprobado.', estado: 'noCumple', controles: [], tambienEn: ['ISO/IEC 42001 6.1.3'], evidencias: [] },
  { id: 'r8', empresaId: 'a', norma: 'ISO/IEC 27001', clausula: 'A.5.15', titulo: 'Control de acceso', guia: 'Los accesos se otorgan según necesidad, se revisan periódicamente y se retiran a tiempo.', estado: 'cumple', controles: ['C-050 Revisión trimestral de accesos'], tambienEn: [], evidencias: [{ nombre: 'Revisión de accesos T3.csv', responsable: 'TI', vigenteHasta: '2026-12-31' }] },
  { id: 'r9', empresaId: 'a', norma: 'ISO/IEC 27001', clausula: 'A.8.28', titulo: 'Desarrollo seguro', guia: 'Aplique prácticas seguras al escribir, revisar y publicar código.', estado: 'cumple', controles: ['C-060 Revisión de código y escaneos'], tambienEn: [], evidencias: [{ nombre: 'Informes del pipeline', responsable: 'Ing. Reyes', vigenteHasta: '2026-12-31' }] },
  { id: 'r10', empresaId: 'a', norma: 'ISO/IEC 42001', clausula: '6.1.4', titulo: 'Evaluación de impacto de IA', guia: 'Antes de operar un sistema de IA, analice cómo puede afectar a personas y a la organización.', estado: 'parcial', controles: ['C-070 Evaluación de impacto de IA'], tambienEn: [], evidencias: [{ nombre: 'EIA asistente v1.pdf', responsable: 'Ing. Reyes', vigenteHasta: '2027-02-28' }] },
  { id: 'r11', empresaId: 'a', norma: 'ISO/IEC 42001', clausula: '8.2', titulo: 'Inventario de sistemas de IA', guia: 'Mantenga la lista de los sistemas de IA en uso, su propósito y su responsable.', estado: 'noAplica', controles: [], tambienEn: [], evidencias: [] },
  { id: 'r12', empresaId: 'a', norma: 'ISO/IEC 42001', clausula: '9.3', titulo: 'Revisión por la dirección', guia: 'La alta dirección revisa el desempeño del sistema con entradas definidas y deja decisiones registradas.', estado: 'parcial', controles: ['C-080 Acta de revisión'], tambienEn: ['ISO 9001 9.3', 'ISO/IEC 27001 9.3'], evidencias: [{ nombre: 'Acta revisión 2026-S1.pdf', responsable: 'Gerencia General', vigenteHasta: '2027-06-30' }] },
];

const requisitosB: RequisitoDemo[] = [
  { id: 'r1', empresaId: 'b', norma: 'ISO 9001', clausula: '4.3', titulo: 'Alcance del sistema', guia: 'Defina qué sedes, procesos y productos entran en el sistema y justifique lo que queda fuera.', estado: 'parcial', controles: ['L-001 Documento de alcance'], tambienEn: [], evidencias: [{ nombre: 'Alcance v1.pdf', responsable: 'Marcela Ortiz', vigenteHasta: '2027-04-30' }] },
  { id: 'r2', empresaId: 'b', norma: 'ISO 9001', clausula: '8.4', titulo: 'Control de proveedores', guia: 'Evalúe y vigile a quienes le entregan productos o servicios que afectan su calidad.', estado: 'noCumple', controles: [], tambienEn: [], evidencias: [] },
  { id: 'r3', empresaId: 'b', norma: 'ISO/IEC 27001', clausula: 'A.7.2', titulo: 'Acceso físico a instalaciones', guia: 'Controle quién entra a las bodegas y áreas con información sensible, y registre los accesos.', estado: 'cumple', controles: ['L-020 Bitácora de accesos físicos'], tambienEn: [], evidencias: [{ nombre: 'Bitácora bodega Quito.csv', responsable: 'Seguridad', vigenteHasta: '2027-01-15' }] },
];

export interface PanelDemo {
  madurez: ItemMadurez[];
  riesgos: CeldaRiesgo[];
  etapas: EtapaCertificacion[];
  vencimientos: { evidencia: string; vence: string; responsable: string }[];
  cumplimientoPorNorma: { norma: string; porcentaje: number }[];
}

const etapasA: EtapaCertificacion[] = [
  { codigo: 'E0', nombre: 'Decisión y alcance', estado: 'completada', fecha: 'mar 2026' },
  { codigo: 'E1', nombre: 'Diagnóstico', estado: 'completada', fecha: 'may 2026' },
  { codigo: 'E2', nombre: 'Plan de implementación', estado: 'completada', fecha: 'jun 2026' },
  { codigo: 'E3', nombre: 'Diseño del sistema', estado: 'enCurso', fecha: 'nov 2026' },
  { codigo: 'E4', nombre: 'Implementación y operación', estado: 'pendiente' },
  { codigo: 'E5', nombre: 'Evaluación', estado: 'pendiente' },
  { codigo: 'E6', nombre: 'Mejora', estado: 'pendiente' },
  { codigo: 'E7', nombre: 'Certificación externa', estado: 'pendiente' },
  { codigo: 'E8', nombre: 'Mantenimiento (ciclo de 3 años)', estado: 'pendiente' },
];

const panelA: PanelDemo = {
  madurez: [
    { clausula: '4', titulo: 'Contexto', porcentaje: 85 },
    { clausula: '5', titulo: 'Liderazgo', porcentaje: 78 },
    { clausula: '6', titulo: 'Planificación', porcentaje: 52 },
    { clausula: '7', titulo: 'Apoyo', porcentaje: 64 },
    { clausula: '8', titulo: 'Operación', porcentaje: 41 },
    { clausula: '9', titulo: 'Evaluación del desempeño', porcentaje: 33 },
    { clausula: '10', titulo: 'Mejora', porcentaje: 58 },
  ],
  riesgos: [
    { probabilidad: 5, impacto: 4, cantidad: 1 }, { probabilidad: 4, impacto: 4, cantidad: 2 }, { probabilidad: 3, impacto: 3, cantidad: 5 },
    { probabilidad: 2, impacto: 4, cantidad: 3 }, { probabilidad: 2, impacto: 2, cantidad: 6 }, { probabilidad: 1, impacto: 2, cantidad: 4 },
    { probabilidad: 4, impacto: 2, cantidad: 2 }, { probabilidad: 3, impacto: 5, cantidad: 1 },
  ],
  etapas: etapasA,
  vencimientos: [
    { evidencia: 'Registro NC 2026.xlsx', vence: '2026-11-30', responsable: 'Ana Pérez' },
    { evidencia: 'Matriz de partes interesadas.xlsx', vence: '2026-12-15', responsable: 'Luis Mora' },
    { evidencia: 'Revisión de accesos T3.csv', vence: '2026-12-31', responsable: 'TI' },
  ],
  cumplimientoPorNorma: [
    { norma: 'ISO 9001', porcentaje: 68 },
    { norma: 'ISO/IEC 27001', porcentaje: 54 },
    { norma: 'ISO/IEC 42001', porcentaje: 37 },
  ],
};

const panelB: PanelDemo = {
  madurez: [
    { clausula: '4', titulo: 'Contexto', porcentaje: 45 },
    { clausula: '5', titulo: 'Liderazgo', porcentaje: 30 },
    { clausula: '6', titulo: 'Planificación', porcentaje: 22 },
    { clausula: '7', titulo: 'Apoyo', porcentaje: 38 },
    { clausula: '8', titulo: 'Operación', porcentaje: 60 },
    { clausula: '9', titulo: 'Evaluación del desempeño', porcentaje: 10 },
    { clausula: '10', titulo: 'Mejora', porcentaje: 15 },
  ],
  riesgos: [{ probabilidad: 3, impacto: 3, cantidad: 4 }, { probabilidad: 2, impacto: 5, cantidad: 2 }, { probabilidad: 1, impacto: 1, cantidad: 7 }],
  etapas: etapasA.map((e, i) => ({ ...e, estado: i === 0 ? 'completada' : i === 1 ? 'enCurso' : 'pendiente', fecha: i === 0 ? 'oct 2026' : undefined })),
  vencimientos: [{ evidencia: 'Bitácora bodega Quito.csv', vence: '2027-01-15', responsable: 'Seguridad' }],
  cumplimientoPorNorma: [
    { norma: 'ISO 9001', porcentaje: 31 },
    { norma: 'ISO/IEC 27001', porcentaje: 44 },
  ],
};

const porEmpresa: Record<string, { requisitos: RequisitoDemo[]; panel: PanelDemo }> = {
  a: { requisitos: requisitosA, panel: panelA },
  b: { requisitos: requisitosB, panel: panelB },
};

const datosDe = (empresaId: string) => (Object.hasOwn(porEmpresa, empresaId) ? porEmpresa[empresaId] : undefined);

/** Requisitos de UNA empresa. Nunca devuelve datos de otra (en 0.6 lo impone RLS con `empresa_id`). */
export const requisitosDe = (empresaId: string): RequisitoDemo[] => datosDe(empresaId)?.requisitos ?? [];

export const requisitoDe = (empresaId: string, id: string): RequisitoDemo | undefined =>
  requisitosDe(empresaId).find((r) => r.id === id && r.empresaId === empresaId);

export const panelDe = (empresaId: string): PanelDemo | undefined => datosDe(empresaId)?.panel;
