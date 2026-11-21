import { Bitacora, BitacoraKysely } from '@sig/auditoria';
import { UnidadDeTrabajoKysely } from '@sig/db';
import type { Kysely } from 'kysely';
import type { ContextoCertificacion } from '../application/contexto.js';
import { AlcanceKysely } from './alcance-kysely.adapter.js';
import { ProcesoKysely, RelacionKysely } from './auditoria-kysely.adapter.js';
import { ControlKysely } from './control-kysely.adapter.js';
import { DeclaracionKysely } from './declaracion-kysely.adapter.js';
import { DestinatarioKysely, DirectorioPersonasKysely, DocumentoKysely, LecturaKysely, RetencionKysely, VersionDocumentoKysely, VinculoDocumentoKysely } from './documento-kysely.adapter.js';
import { EvaluacionKysely } from './evaluacion-kysely.adapter.js';
import { EvidenciaKysely } from './evidencia-kysely.adapter.js';
import { MapeoKysely } from './mapeo-kysely.adapter.js';
import { MotivoKysely } from './motivo-kysely.adapter.js';
import { ReferenciaKysely } from './referencia-kysely.adapter.js';
import { RiesgoKysely } from './riesgo-kysely.adapter.js';
import { VinculoRiesgoKysely } from './vinculo-riesgo-kysely.adapter.js';

/**
 * Unidad de trabajo del módulo sobre PostgreSQL. `db` debe ser el pool del rol de la aplicación. En cada ejecución se abre una
 * transacción con la empresa fijada y repositorios y bitácora quedan ligados a ELLA: todo se confirma o se revierte junto.
 */
export const crearUnidadDeTrabajoCertificacion = (db: Kysely<unknown>): UnidadDeTrabajoKysely<ContextoCertificacion> =>
  new UnidadDeTrabajoKysely<ContextoCertificacion>(db, (trx, empresaId) => ({
    evaluaciones: new EvaluacionKysely(trx, empresaId),
    alcances: new AlcanceKysely(trx, empresaId),
    controles: new ControlKysely(trx, empresaId),
    mapeos: new MapeoKysely(trx, empresaId),
    riesgos: new RiesgoKysely(trx, empresaId),
    vinculosRiesgo: new VinculoRiesgoKysely(trx, empresaId),
    motivos: new MotivoKysely(trx, empresaId),
    referencias: new ReferenciaKysely(trx, empresaId),
    evidencias: new EvidenciaKysely(trx, empresaId),
    declaraciones: new DeclaracionKysely(trx, empresaId),
    documentos: new DocumentoKysely(trx, empresaId),
    versionesDocumento: new VersionDocumentoKysely(trx, empresaId),
    destinatarios: new DestinatarioKysely(trx, empresaId),
    lecturas: new LecturaKysely(trx, empresaId),
    vinculosDocumento: new VinculoDocumentoKysely(trx, empresaId),
    retenciones: new RetencionKysely(trx, empresaId),
    personas: new DirectorioPersonasKysely(trx, empresaId),
    procesos: new ProcesoKysely(trx, empresaId),
    relaciones: new RelacionKysely(trx, empresaId),
    bitacora: new Bitacora(BitacoraKysely.enTransaccion(trx)),
  }));
