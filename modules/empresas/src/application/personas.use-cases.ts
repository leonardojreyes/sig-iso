// Personas de una empresa y solicitudes de acceso (ADR 036, MVP M7). Orden en todo caso de uso del administrador: permiso (403) →
// validación (400) → unidad atómica (404 y 409 adentro). La API decide los permisos; aquí nada confía en lo que dice el cliente.
// Nombre y correo son datos personales: los escribe el administrador al aprobar, nunca vienen del token ni van a la bitácora.
import type { EventoBitacora } from '@sig/auditoria';
import { esRol, type Rol } from '@sig/autorizacion';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { validarDatosPersona } from '../domain/datos-persona.js';
import { generarCodigo, TOPE_SOLICITUDES_VIGENTES, VIDA_SOLICITUD_MS, type Aleatorio } from '../domain/solicitud-acceso.js';
import type { PermisoDePersonas, PermisoPersonasPort, PersonaDto, SolicitudDto, UnidadDeTrabajoPersonasPort } from './personas.port.js';

/** Quien intenta hacerlo no tiene permiso. El registro del rechazo lo hace el filtro de la API. */
export class SinPermisoPersonasError extends Error {
  constructor(readonly permiso: PermisoDePersonas) {
    super('Sin permiso para gestionar personas');
    this.name = 'SinPermisoPersonasError';
  }
}

/** Un identificador, un rol o una versión mal formados. No repite el valor. La API lo responde como 400. */
export class PeticionDePersonasNoValidaError extends Error {
  constructor() {
    super('La petición de personas no es válida');
    this.name = 'PeticionDePersonasNoValidaError';
  }
}

/** La solicitud no existe, ya se resolvió, venció o es de otra empresa (indistinguibles). La API lo responde como 404. */
export class SolicitudNoEncontradaError extends Error {
  constructor() {
    super('Solicitud de acceso no encontrada');
    this.name = 'SolicitudNoEncontradaError';
  }
}

/** La persona no existe en la empresa o está dada de baja (indistinguibles). La API lo responde como 404. */
export class PersonaDeLaEmpresaNoEncontradaError extends Error {
  constructor() {
    super('Persona no encontrada');
    this.name = 'PersonaDeLaEmpresaNoEncontradaError';
  }
}

export type MotivoConflictoDePersonas =
  'ya_tiene_acceso' | 'demasiadas_solicitudes' | 'correo_repetido' | 'version_vieja' | 'ultimo_administrador';

/** El estado actual impide hacerlo. El motivo es de una lista cerrada y no repite datos. La API lo responde como 409. */
export class ConflictoDePersonasError extends Error {
  constructor(readonly motivo: MotivoConflictoDePersonas) {
    super('El estado actual de las personas impide esta operación');
    this.name = 'ConflictoDePersonasError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VERSION_MAX = 2_147_483_647;
const INTENTOS_DE_CODIGO = 5;

const uuid = (valor: unknown): string => {
  const v = typeof valor === 'string' ? valor.toLowerCase() : '';
  if (!UUID.test(v)) throw new PeticionDePersonasNoValidaError();
  return v;
};
const rolValido = (valor: unknown): Rol => {
  if (!esRol(valor)) throw new PeticionDePersonasNoValidaError();
  return valor;
};
const versionValida = (valor: unknown): number => {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > VERSION_MAX)
    throw new PeticionDePersonasNoValidaError();
  return valor;
};

/** Valida la persona que actúa (viene del token) y su permiso. El permiso se decide ANTES que la forma del cuerpo. */
const exigir = async (
  permisos: PermisoPersonasPort,
  permiso: PermisoDePersonas,
  empresaId: EmpresaId,
  usuarioId: unknown,
): Promise<string> => {
  const actor = typeof usuarioId === 'string' ? usuarioId.toLowerCase() : '';
  if (!UUID.test(actor)) throw new Error('El identificador de la persona no es un UUID válido');
  if (!(await permisos.puede(actor, permiso, empresaId))) throw new SinPermisoPersonasError(permiso);
  return actor;
};

const conTraza = (traceId: string | undefined): { traceId?: string } => (traceId === undefined ? {} : { traceId });

/** Una persona pide acceso: recibe un código corto para entregárselo al administrador. No necesita rol (todavía no lo tiene). */
export class SolicitarAccesoUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPersonasPort,
    private readonly aleatorio: Aleatorio,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(e: {
    readonly empresaId: EmpresaId;
    readonly usuarioId: string;
    readonly ahora: Date;
    readonly traceId?: string;
  }): Promise<{ codigo: string; venceEn: Date; nueva: boolean }> {
    const empresaId = crearEmpresaId(e.empresaId);
    const usuarioId = uuid(e.usuarioId);
    return this.unidad.ejecutar(empresaId, async ({ personas, solicitudes, bitacora }) => {
      await solicitudes.vencerVencidas(e.ahora);
      const persona = await personas.obtener(usuarioId);
      if (persona !== null && persona.rol !== null) throw new ConflictoDePersonasError('ya_tiene_acceso');
      const vigente = await solicitudes.vigenteDe(usuarioId, e.ahora);
      if (vigente !== null) return { codigo: vigente.codigo, venceEn: vigente.venceEn, nueva: false };
      if ((await solicitudes.contarVigentes(e.ahora)) >= TOPE_SOLICITUDES_VIGENTES)
        throw new ConflictoDePersonasError('demasiadas_solicitudes');

      const venceEn = new Date(e.ahora.getTime() + VIDA_SOLICITUD_MS);
      for (let intento = 0; intento < INTENTOS_DE_CODIGO; intento++) {
        const id = this.nuevoId();
        const codigo = generarCodigo(this.aleatorio);
        if ((await solicitudes.crear({ id, usuarioId, codigo, creadaEn: e.ahora, venceEn })) === 'creada') {
          await bitacora.registrar({
            empresaId,
            actor: { tipo: 'usuario', usuarioId },
            accion: 'acceso.solicitado',
            resultado: 'ok',
            objeto: `solicitud:${id}`,
            ...conTraza(e.traceId),
          } satisfies EventoBitacora);
          return { codigo, venceEn, nueva: true };
        }
        // Conflicto: o la persona ya tiene una vigente (otra petición se adelantó) o el código lo usa otra vigente. Se mira cuál fue.
        const ganadora = await solicitudes.vigenteDe(usuarioId, e.ahora);
        if (ganadora !== null) return { codigo: ganadora.codigo, venceEn: ganadora.venceEn, nueva: false };
      }
      throw new Error('No se pudo generar un código de solicitud sin repetir');
    });
  }
}

/** El administrador ve las personas y las solicitudes vigentes (con su código). */
export class ListarPersonasUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPersonasPort,
    private readonly permisos: PermisoPersonasPort,
  ) {}

  async ejecutar(e: {
    readonly empresaId: EmpresaId;
    readonly usuarioId: string;
    readonly ahora: Date;
  }): Promise<{ personas: readonly PersonaDto[]; solicitudes: readonly SolicitudDto[] }> {
    const empresaId = crearEmpresaId(e.empresaId);
    await exigir(this.permisos, 'personas.ver', empresaId, e.usuarioId);
    return this.unidad.ejecutar(empresaId, async ({ personas, solicitudes }) => ({
      personas: [...(await personas.listar())].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id)),
      solicitudes: [...(await solicitudes.listarVigentes(e.ahora))].sort(
        (a, b) => a.creadaEn.getTime() - b.creadaEn.getTime() || a.id.localeCompare(b.id),
      ),
    }));
  }
}

/** Aprueba una solicitud: crea (o reactiva) a la persona con el rol, el nombre y el correo que escribe el administrador. */
export class AprobarSolicitudUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPersonasPort,
    private readonly permisos: PermisoPersonasPort,
  ) {}

  async ejecutar(e: {
    readonly empresaId: EmpresaId;
    readonly usuarioId: string;
    readonly solicitudId: unknown;
    readonly nombre: unknown;
    readonly correo: unknown;
    readonly rol: unknown;
    readonly ahora: Date;
    readonly traceId?: string;
  }): Promise<PersonaDto> {
    const empresaId = crearEmpresaId(e.empresaId);
    const admin = await exigir(this.permisos, 'personas.gestionar', empresaId, e.usuarioId);
    const solicitudId = uuid(e.solicitudId);
    const rol = rolValido(e.rol);
    const { nombre, correo } = validarDatosPersona({ nombre: e.nombre, correo: e.correo });

    return this.unidad.ejecutar(empresaId, async ({ personas, solicitudes, bitacora }) => {
      await solicitudes.vencerVencidas(e.ahora);
      const solicitud = await solicitudes.obtenerVigente(solicitudId, e.ahora);
      if (solicitud === null) throw new SolicitudNoEncontradaError();
      const existente = await personas.obtener(solicitud.usuarioId);
      if (existente !== null && existente.rol !== null) throw new ConflictoDePersonasError('ya_tiene_acceso');

      const resultado =
        existente === null
          ? await personas.insertar({ id: solicitud.usuarioId, nombre, correo, rol })
          : await personas.reactivar({ id: solicitud.usuarioId, nombre, correo, rol, versionEsperada: existente.version });
      if (resultado !== 'ok') throw new ConflictoDePersonasError(resultado);
      // Si otra petición ya la resolvió, todo se revierte (el alta incluida).
      if (!(await solicitudes.resolver(solicitud.id, 'aprobada', admin, e.ahora))) throw new SolicitudNoEncontradaError();

      await bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId: admin },
        accion: 'usuario.alta',
        resultado: 'ok',
        objeto: `usuario:${solicitud.usuarioId}`,
        ...conTraza(e.traceId),
        despues: { rol },
      } satisfies EventoBitacora);
      const persona = await personas.obtener(solicitud.usuarioId);
      if (persona === null) throw new Error('La persona aprobada no se encuentra');
      return persona;
    });
  }
}

/** Descarta una solicitud (no se borra: queda resuelta como descartada). */
export class DescartarSolicitudUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPersonasPort,
    private readonly permisos: PermisoPersonasPort,
  ) {}

  async ejecutar(e: {
    readonly empresaId: EmpresaId;
    readonly usuarioId: string;
    readonly solicitudId: unknown;
    readonly ahora: Date;
    readonly traceId?: string;
  }): Promise<void> {
    const empresaId = crearEmpresaId(e.empresaId);
    const admin = await exigir(this.permisos, 'personas.gestionar', empresaId, e.usuarioId);
    const solicitudId = uuid(e.solicitudId);
    await this.unidad.ejecutar(empresaId, async ({ solicitudes, bitacora }) => {
      await solicitudes.vencerVencidas(e.ahora);
      const solicitud = await solicitudes.obtenerVigente(solicitudId, e.ahora);
      if (solicitud === null || !(await solicitudes.resolver(solicitud.id, 'descartada', admin, e.ahora)))
        throw new SolicitudNoEncontradaError();
      await bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId: admin },
        accion: 'acceso.rechazado',
        resultado: 'ok',
        objeto: `solicitud:${solicitud.id}`,
        ...conTraza(e.traceId),
      } satisfies EventoBitacora);
    });
  }
}

/** Cambia el rol de una persona con acceso. Con la versión que vio el administrador (concurrencia optimista). */
export class CambiarRolUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPersonasPort,
    private readonly permisos: PermisoPersonasPort,
  ) {}

  async ejecutar(e: {
    readonly empresaId: EmpresaId;
    readonly usuarioId: string;
    readonly personaId: unknown;
    readonly rol: unknown;
    readonly versionEsperada: unknown;
    readonly traceId?: string;
  }): Promise<PersonaDto> {
    const empresaId = crearEmpresaId(e.empresaId);
    const admin = await exigir(this.permisos, 'personas.gestionar', empresaId, e.usuarioId);
    const personaId = uuid(e.personaId);
    const rol = rolValido(e.rol);
    const versionEsperada = versionValida(e.versionEsperada);

    return this.unidad.ejecutar(empresaId, async ({ personas, bitacora }) => {
      const actual = await personas.obtener(personaId);
      // Una persona dada de baja no tiene rol que cambiar: para volver necesita una solicitud nueva.
      if (actual === null || actual.rol === null) throw new PersonaDeLaEmpresaNoEncontradaError();
      if (actual.version !== versionEsperada) throw new ConflictoDePersonasError('version_vieja');
      if (actual.rol === rol) return actual;
      if (actual.rol === 'administrador_sig' && (await personas.contarAdministradores()) <= 1)
        throw new ConflictoDePersonasError('ultimo_administrador');
      if (!(await personas.cambiarRol(personaId, rol, versionEsperada))) throw new ConflictoDePersonasError('version_vieja');
      await bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId: admin },
        accion: 'rol.cambiado',
        resultado: 'ok',
        objeto: `usuario:${personaId}`,
        ...conTraza(e.traceId),
        antes: { rol: actual.rol },
        despues: { rol },
      } satisfies EventoBitacora);
      const nueva = await personas.obtener(personaId);
      if (nueva === null) throw new Error('La persona no se encuentra tras cambiarle el rol');
      return nueva;
    });
  }
}

/** Da de baja a una persona: deja el rol en nulo y anota la baja; la fila se conserva (la autoría la referencia). */
export class DarDeBajaUseCase {
  constructor(
    private readonly unidad: UnidadDeTrabajoPersonasPort,
    private readonly permisos: PermisoPersonasPort,
  ) {}

  async ejecutar(e: {
    readonly empresaId: EmpresaId;
    readonly usuarioId: string;
    readonly personaId: unknown;
    readonly versionEsperada: unknown;
    readonly ahora: Date;
    readonly traceId?: string;
  }): Promise<PersonaDto> {
    const empresaId = crearEmpresaId(e.empresaId);
    const admin = await exigir(this.permisos, 'personas.gestionar', empresaId, e.usuarioId);
    const personaId = uuid(e.personaId);
    const versionEsperada = versionValida(e.versionEsperada);

    return this.unidad.ejecutar(empresaId, async ({ personas, bitacora }) => {
      const actual = await personas.obtener(personaId);
      if (actual === null || actual.rol === null) throw new PersonaDeLaEmpresaNoEncontradaError();
      if (actual.version !== versionEsperada) throw new ConflictoDePersonasError('version_vieja');
      if (actual.rol === 'administrador_sig' && (await personas.contarAdministradores()) <= 1)
        throw new ConflictoDePersonasError('ultimo_administrador');
      if (!(await personas.darDeBaja(personaId, versionEsperada, e.ahora))) throw new ConflictoDePersonasError('version_vieja');
      await bitacora.registrar({
        empresaId,
        actor: { tipo: 'usuario', usuarioId: admin },
        accion: 'usuario.baja',
        resultado: 'ok',
        objeto: `usuario:${personaId}`,
        ...conTraza(e.traceId),
        antes: { rol: actual.rol },
      } satisfies EventoBitacora);
      const nueva = await personas.obtener(personaId);
      if (nueva === null) throw new Error('La persona no se encuentra tras darla de baja');
      return nueva;
    });
  }
}
