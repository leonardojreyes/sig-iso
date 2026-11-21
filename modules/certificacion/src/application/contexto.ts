import type { EventoBitacora } from '@sig/auditoria';
import type { AuditoriaRepositoryPort, AyudasRepositoryPort, HallazgoRepositoryPort, InformeRepositoryPort, ItemRepositoryPort, ProcesoRepositoryPort, ProgramaRepositoryPort, RelacionRepositoryPort } from './auditoria.port.js';
import type { DestinatarioRepositoryPort, DirectorioPersonasPort, DocumentoRepositoryPort, LecturaRepositoryPort, RetencionRepositoryPort, VersionDocumentoRepositoryPort, VinculoDocumentoRepositoryPort } from './documentos.port.js';
import type { AlcanceRepositoryPort, ControlRepositoryPort, DeclaracionRepositoryPort, EvaluacionRepositoryPort, EvidenciaRepositoryPort, MapeoRepositoryPort, MotivoRepositoryPort, ReferenciaRepositoryPort, RiesgoRepositoryPort, VinculoRiesgoRepositoryPort } from './repositorios.port.js';

/** Registra un hecho en la bitácora DENTRO de la misma unidad de trabajo que la acción (si falla, la acción se revierte). */
export interface RegistradorBitacora {
  registrar(evento: EventoBitacora): Promise<void>;
}

/** Lo que reciben los casos de uso dentro de la unidad de trabajo, todo ligado a la misma transacción y empresa. */
export interface ContextoCertificacion {
  readonly evaluaciones: EvaluacionRepositoryPort;
  readonly alcances: AlcanceRepositoryPort;
  readonly controles: ControlRepositoryPort;
  readonly mapeos: MapeoRepositoryPort;
  readonly riesgos: RiesgoRepositoryPort;
  readonly vinculosRiesgo: VinculoRiesgoRepositoryPort;
  readonly motivos: MotivoRepositoryPort;
  readonly referencias: ReferenciaRepositoryPort;
  readonly evidencias: EvidenciaRepositoryPort;
  readonly declaraciones: DeclaracionRepositoryPort;
  // Control documental (ADR 039)
  readonly documentos: DocumentoRepositoryPort;
  readonly versionesDocumento: VersionDocumentoRepositoryPort;
  readonly destinatarios: DestinatarioRepositoryPort;
  readonly lecturas: LecturaRepositoryPort;
  readonly vinculosDocumento: VinculoDocumentoRepositoryPort;
  readonly retenciones: RetencionRepositoryPort;
  readonly personas: DirectorioPersonasPort;
  // Auditoría interna (ADR 040)
  readonly procesos: ProcesoRepositoryPort;
  readonly relaciones: RelacionRepositoryPort;
  readonly programas: ProgramaRepositoryPort;
  readonly auditorias: AuditoriaRepositoryPort;
  readonly ayudas: AyudasRepositoryPort;
  readonly items: ItemRepositoryPort;
  readonly hallazgos: HallazgoRepositoryPort;
  readonly informes: InformeRepositoryPort;
  readonly bitacora: RegistradorBitacora;
}

export type Reloj = () => Date;
