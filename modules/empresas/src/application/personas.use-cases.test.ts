import type { EventoBitacora } from '@sig/auditoria';
import type { Rol } from '@sig/autorizacion';
import { crearEmpresaId, type EmpresaId } from '@sig/tenancy';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorDatosPersona } from '../domain/datos-persona';
import { VIDA_SOLICITUD_MS } from '../domain/solicitud-acceso';
import type {
  ContextoPersonas,
  PermisoDePersonas,
  PermisoPersonasPort,
  PersonaDto,
  SolicitudDto,
  UnidadDeTrabajoPersonasPort,
} from './personas.port';
import {
  AprobarSolicitudUseCase,
  CambiarRolUseCase,
  ConflictoDePersonasError,
  DarDeBajaUseCase,
  DescartarSolicitudUseCase,
  ListarPersonasUseCase,
  PeticionDePersonasNoValidaError,
  PersonaDeLaEmpresaNoEncontradaError,
  SinPermisoPersonasError,
  SolicitarAccesoUseCase,
  SolicitudNoEncontradaError,
} from './personas.use-cases';

// Identificadores deterministas con forma de UUID (la capa de aplicación no importa módulos de Node).
let contadorUid = 0;
const uid = (): string => `10000000-0000-4000-8000-${String(++contadorUid).padStart(12, '0')}`;

const EMPRESA = crearEmpresaId(uid());
const ADMIN = uid();
const OTRO_ADMIN = uid();
const PERSONA = uid();
const AHORA = new Date('2026-11-16T15:00:00.000Z');
const MAS = (ms: number) => new Date(AHORA.getTime() + ms);

/** Una empresa en memoria: lo que la base guardaría para UNA empresa, con las mismas reglas que sus restricciones. */
class Mundo {
  personas = new Map<string, PersonaDto>();
  solicitudes = new Map<string, SolicitudDto & { estado: string }>();
  bitacora: EventoBitacora[] = [];
  empresasUsadas: EmpresaId[] = [];
  forzarConflictoDeCodigo = 0;
  permitido = new Set<string>(); // `usuario|permiso`

  persona(rol: Rol | null, id = uid(), correo = `${id.slice(0, 6)}@example.test`): PersonaDto {
    const p: PersonaDto = { id, nombre: `Persona ${id.slice(0, 4)}`, correo, rol, bajaEn: null, version: 1 };
    this.personas.set(id, p);
    return p;
  }
  admins = () => [...this.personas.values()].filter((p) => p.rol === 'administrador_sig').length;

  contexto = (): ContextoPersonas => ({
    personas: {
      obtener: async (id) => this.personas.get(id) ?? null,
      listar: async () => [...this.personas.values()],
      contarAdministradores: async () => this.admins(),
      insertar: async (p) => {
        if ([...this.personas.values()].some((x) => x.correo === p.correo)) return 'correo_repetido';
        this.personas.set(p.id, { ...p, bajaEn: null, version: 1 });
        return 'ok';
      },
      reactivar: async (p) => {
        const actual = this.personas.get(p.id);
        if (!actual || actual.version !== p.versionEsperada) return 'version_vieja';
        if ([...this.personas.values()].some((x) => x.id !== p.id && x.correo === p.correo)) return 'correo_repetido';
        this.personas.set(p.id, { ...actual, nombre: p.nombre, correo: p.correo, rol: p.rol, bajaEn: null, version: actual.version + 1 });
        return 'ok';
      },
      cambiarRol: async (id, rol, v) => {
        const p = this.personas.get(id);
        if (!p || p.rol === null || p.version !== v) return false;
        this.personas.set(id, { ...p, rol, version: p.version + 1 });
        return true;
      },
      darDeBaja: async (id, v, ahora) => {
        const p = this.personas.get(id);
        if (!p || p.rol === null || p.version !== v) return false;
        this.personas.set(id, { ...p, rol: null, bajaEn: ahora, version: p.version + 1 });
        return true;
      },
    },
    solicitudes: {
      vencerVencidas: async (ahora) => {
        for (const [id, s] of this.solicitudes)
          if (s.estado === 'pendiente' && s.venceEn <= ahora) this.solicitudes.set(id, { ...s, estado: 'vencida' });
      },
      vigenteDe: async (usuarioId, ahora) =>
        [...this.solicitudes.values()].find((s) => s.estado === 'pendiente' && s.usuarioId === usuarioId && s.venceEn > ahora) ?? null,
      obtenerVigente: async (id, ahora) => {
        const s = this.solicitudes.get(id);
        return s && s.estado === 'pendiente' && s.venceEn > ahora ? s : null;
      },
      listarVigentes: async (ahora) => [...this.solicitudes.values()].filter((s) => s.estado === 'pendiente' && s.venceEn > ahora),
      contarVigentes: async (ahora) => [...this.solicitudes.values()].filter((s) => s.estado === 'pendiente' && s.venceEn > ahora).length,
      crear: async (s) => {
        if (this.forzarConflictoDeCodigo > 0) {
          this.forzarConflictoDeCodigo--;
          return 'conflicto';
        }
        const pendientes = [...this.solicitudes.values()].filter((x) => x.estado === 'pendiente');
        if (pendientes.some((x) => x.usuarioId === s.usuarioId || x.codigo === s.codigo)) return 'conflicto';
        this.solicitudes.set(s.id, { ...s, estado: 'pendiente' });
        return 'creada';
      },
      resolver: async (id, estado) => {
        const s = this.solicitudes.get(id);
        if (!s || s.estado !== 'pendiente') return false;
        this.solicitudes.set(id, { ...s, estado });
        return true;
      },
    },
    bitacora: { registrar: async (e) => void this.bitacora.push(e) },
  });

  // Como una transacción: si el caso de uso falla, se restaura todo lo que había (personas, solicitudes y bitácora).
  unidad: UnidadDeTrabajoPersonasPort = {
    ejecutar: async (empresaId, fn) => {
      this.empresasUsadas.push(empresaId);
      const personas = new Map(this.personas);
      const solicitudes = new Map(this.solicitudes);
      const bitacora = [...this.bitacora];
      try {
        return await fn(this.contexto());
      } catch (error) {
        this.personas = personas;
        this.solicitudes = solicitudes;
        this.bitacora = bitacora;
        throw error;
      }
    },
  };
  permisos: PermisoPersonasPort = { puede: async (u, p: PermisoDePersonas) => this.permitido.has(`${u}|${p}`) };
}

let m: Mundo;
let aleatorio: (n: number) => Uint8Array;
// Aleatoriedad determinista (generador congruencial): repetible, pero con espacio de sobra para 50 códigos distintos.
const secuencia = () => {
  let estado = 12345;
  return (cuantos: number) =>
    Uint8Array.from({ length: cuantos }, () => {
      estado = (Math.imul(estado, 1103515245) + 12345) & 0x7fffffff;
      return (estado >>> 16) & 0xff;
    });
};
let ids = 0;
const nuevoId = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;

beforeEach(() => {
  m = new Mundo();
  aleatorio = secuencia();
  m.permitido = new Set([`${ADMIN}|personas.ver`, `${ADMIN}|personas.gestionar`]);
  m.persona('administrador_sig', ADMIN);
});

const solicitar = (usuarioId = PERSONA, ahora = AHORA) =>
  new SolicitarAccesoUseCase(m.unidad, (n) => aleatorio(n), nuevoId).ejecutar({ empresaId: EMPRESA, usuarioId, ahora, traceId: 'trace-1' });
const textoDeLaBitacora = () => JSON.stringify(m.bitacora);

describe('SolicitarAcceso', () => {
  it('crea la solicitud con un código y un plazo de 7 días, y lo deja en la bitácora SIN el código', async () => {
    const r = await solicitar();
    expect(r.nueva).toBe(true);
    expect(r.codigo).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(r.venceEn).toEqual(MAS(VIDA_SOLICITUD_MS));
    expect(m.bitacora).toHaveLength(1);
    expect(m.bitacora[0]).toMatchObject({
      accion: 'acceso.solicitado',
      resultado: 'ok',
      empresaId: EMPRESA,
      actor: { tipo: 'usuario', usuarioId: PERSONA },
    });
    expect(m.bitacora[0]!.objeto).toMatch(/^solicitud:[0-9a-f-]{36}$/);
    expect(textoDeLaBitacora()).not.toContain(r.codigo);
  });

  it('es idempotente: pedir de nuevo devuelve el mismo código y no repite el hecho', async () => {
    const a = await solicitar();
    const b = await solicitar(PERSONA, MAS(3600_000));
    expect(b).toEqual({ codigo: a.codigo, venceEn: a.venceEn, nueva: false });
    expect(m.solicitudes.size).toBe(1);
    expect(m.bitacora).toHaveLength(1);
  });

  it('vencida a los 7 días, libera a la persona y al código: la nueva solicitud es otra', async () => {
    const a = await solicitar();
    const b = await solicitar(PERSONA, MAS(VIDA_SOLICITUD_MS + 1000));
    expect(b.nueva).toBe(true);
    expect(b.codigo).not.toBe(a.codigo);
    expect([...m.solicitudes.values()].map((s) => s.estado).sort()).toEqual(['pendiente', 'vencida']);
  });

  it('quien ya tiene un rol en la empresa no necesita pedir acceso (conflicto)', async () => {
    m.persona('colaborador', PERSONA);
    await expect(solicitar()).rejects.toMatchObject({ motivo: 'ya_tiene_acceso' });
    expect(m.solicitudes.size).toBe(0);
    expect(m.bitacora).toHaveLength(0);
  });

  it('quien fue dado de baja SÍ puede pedir acceso otra vez', async () => {
    m.personas.set(PERSONA, { ...m.persona(null, PERSONA), bajaEn: AHORA });
    expect((await solicitar()).nueva).toBe(true);
  });

  it('con 50 solicitudes vigentes no acepta más', async () => {
    for (let i = 0; i < 50; i++) await solicitar(uid());
    await expect(solicitar(uid())).rejects.toMatchObject({ motivo: 'demasiadas_solicitudes' });
    expect(m.solicitudes.size).toBe(50);
  });

  it('si el código choca con otro vigente, genera uno nuevo; si choca siempre, se rinde sin dejar nada a medias', async () => {
    m.forzarConflictoDeCodigo = 2;
    expect((await solicitar()).nueva).toBe(true);
    m.forzarConflictoDeCodigo = 99;
    await expect(solicitar(uid())).rejects.toThrow(/código/i);
    expect(m.bitacora).toHaveLength(1);
  });

  it('el identificador de la persona debe ser un UUID', async () => {
    await expect(solicitar('no-es-uuid')).rejects.toBeInstanceOf(PeticionDePersonasNoValidaError);
  });

  it('actúa solo en la empresa del token', async () => {
    await solicitar();
    expect(m.empresasUsadas).toEqual([EMPRESA]);
  });
});

describe('ListarPersonas', () => {
  const listar = (u = ADMIN) =>
    new ListarPersonasUseCase(m.unidad, m.permisos).ejecutar({ empresaId: EMPRESA, usuarioId: u, ahora: AHORA });

  it('devuelve las personas y SOLO las solicitudes vigentes', async () => {
    await solicitar();
    await solicitar(uid(), MAS(-VIDA_SOLICITUD_MS)); // vencida respecto de AHORA
    const r = await listar();
    expect(r.personas.map((p) => p.id)).toContain(ADMIN);
    expect(r.solicitudes).toHaveLength(1);
    expect(r.solicitudes[0]!.usuarioId).toBe(PERSONA);
  });

  it('sin el permiso personas.ver no toca la base de datos', async () => {
    const colaborador = uid();
    m.persona('colaborador', colaborador);
    await expect(listar(colaborador)).rejects.toBeInstanceOf(SinPermisoPersonasError);
    expect(m.empresasUsadas).toEqual([]);
  });
});

describe('AprobarSolicitud', () => {
  const aprobar = (
    e: Partial<{ usuarioId: string; solicitudId: string; nombre: unknown; correo: unknown; rol: unknown; ahora: Date }> = {},
  ) =>
    new AprobarSolicitudUseCase(m.unidad, m.permisos).ejecutar({
      empresaId: EMPRESA,
      usuarioId: ADMIN,
      solicitudId: [...m.solicitudes.keys()][0] ?? uid(),
      nombre: 'Laura Mena',
      correo: 'Laura.Mena@Example.test',
      rol: 'colaborador',
      ahora: AHORA,
      traceId: 'trace-2',
      ...e,
    });

  it('da de alta a la persona con el rol, el nombre y el correo del administrador, resuelve la solicitud y lo deja en la bitácora', async () => {
    await solicitar();
    const p = await aprobar();
    expect(p).toMatchObject({ id: PERSONA, nombre: 'Laura Mena', correo: 'laura.mena@example.test', rol: 'colaborador', version: 1 });
    expect(m.personas.get(PERSONA)).toMatchObject({ rol: 'colaborador' });
    expect([...m.solicitudes.values()][0]!.estado).toBe('aprobada');
    const alta = m.bitacora.find((e) => e.accion === 'usuario.alta')!;
    expect(alta).toMatchObject({
      resultado: 'ok',
      empresaId: EMPRESA,
      objeto: `usuario:${PERSONA}`,
      actor: { tipo: 'usuario', usuarioId: ADMIN },
      despues: { rol: 'colaborador' },
    });
    expect(textoDeLaBitacora()).not.toMatch(/Laura|Mena|example\.test/i);
  });

  it('reactiva a una persona dada de baja (misma fila, rol nuevo, sin fecha de baja)', async () => {
    m.personas.set(PERSONA, { ...m.persona(null, PERSONA, 'vieja@example.test'), bajaEn: AHORA, version: 3 });
    await solicitar();
    const p = await aprobar({ rol: 'auditor_interno' });
    expect(p).toMatchObject({ id: PERSONA, rol: 'auditor_interno', bajaEn: null, version: 4, correo: 'laura.mena@example.test' });
  });

  it('el correo de otra persona de la empresa es un conflicto y la solicitud sigue vigente', async () => {
    await solicitar();
    m.persona('colaborador', uid(), 'laura.mena@example.test');
    await expect(aprobar()).rejects.toMatchObject({ motivo: 'correo_repetido' });
    expect([...m.solicitudes.values()][0]!.estado).toBe('pendiente');
    expect(m.bitacora.some((e) => e.accion === 'usuario.alta')).toBe(false);
  });

  it('una solicitud inexistente, vencida o ya resuelta es «no encontrada»', async () => {
    await expect(aprobar({ solicitudId: uid() })).rejects.toBeInstanceOf(SolicitudNoEncontradaError);
    await solicitar();
    await expect(aprobar({ ahora: MAS(VIDA_SOLICITUD_MS + 1000) })).rejects.toBeInstanceOf(SolicitudNoEncontradaError);
    await aprobar();
    await expect(aprobar()).rejects.toBeInstanceOf(SolicitudNoEncontradaError);
  });

  it('si la persona ya tiene rol (otra vía) no se pisa: conflicto', async () => {
    await solicitar();
    m.persona('colaborador', PERSONA);
    await expect(aprobar()).rejects.toMatchObject({ motivo: 'ya_tiene_acceso' });
  });

  it.each([
    ['rol que no existe', { rol: 'superadministrador' }],
    ['rol «ninguno»', { rol: 'ninguno' }],
    ['rol que no es texto', { rol: 7 }],
    ['nombre vacío', { nombre: '  ' }],
    ['correo mal formado', { correo: 'no-es-correo' }],
    ['solicitud que no es UUID', { solicitudId: 'abc' }],
  ])('rechaza %s (400) antes de tocar la base de datos', async (_c, mala) => {
    await solicitar();
    m.empresasUsadas = [];
    await expect(aprobar(mala as never)).rejects.toSatisfy(
      (e) => e instanceof PeticionDePersonasNoValidaError || e instanceof ErrorDatosPersona,
    );
    expect(m.empresasUsadas).toEqual([]);
  });

  it('sin el permiso personas.gestionar no toca la base de datos (ni siquiera el administrador que solo puede ver)', async () => {
    m.permitido = new Set([`${ADMIN}|personas.ver`]);
    await expect(aprobar()).rejects.toBeInstanceOf(SinPermisoPersonasError);
    expect(m.empresasUsadas).toEqual([]);
  });
});

describe('DescartarSolicitud', () => {
  const descartar = (solicitudId: string, usuarioId = ADMIN) =>
    new DescartarSolicitudUseCase(m.unidad, m.permisos).ejecutar({ empresaId: EMPRESA, usuarioId, solicitudId, ahora: AHORA });

  it('la resuelve como descartada y lo deja en la bitácora con su identificador', async () => {
    await solicitar();
    const id = [...m.solicitudes.keys()][0]!;
    await descartar(id);
    expect(m.solicitudes.get(id)!.estado).toBe('descartada');
    expect(m.bitacora.at(-1)).toMatchObject({
      accion: 'acceso.rechazado',
      objeto: `solicitud:${id}`,
      actor: { tipo: 'usuario', usuarioId: ADMIN },
    });
    await expect(descartar(id)).rejects.toBeInstanceOf(SolicitudNoEncontradaError);
  });

  it('exige el permiso y un UUID', async () => {
    await expect(descartar('abc')).rejects.toBeInstanceOf(PeticionDePersonasNoValidaError);
    await expect(descartar(uid(), uid())).rejects.toBeInstanceOf(SinPermisoPersonasError);
  });
});

describe('CambiarRol', () => {
  const cambiar = (personaId: string, rol: unknown, versionEsperada: unknown = 1, usuarioId = ADMIN) =>
    new CambiarRolUseCase(m.unidad, m.permisos).ejecutar({
      empresaId: EMPRESA,
      usuarioId,
      personaId,
      rol,
      versionEsperada,
      traceId: 'trace-3',
    });

  it('cambia el rol, sube la versión y deja el rol anterior y el nuevo en la bitácora', async () => {
    const p = m.persona('colaborador');
    const r = await cambiar(p.id, 'auditor_interno');
    expect(r).toMatchObject({ rol: 'auditor_interno', version: 2 });
    expect(m.bitacora.at(-1)).toMatchObject({
      accion: 'rol.cambiado',
      objeto: `usuario:${p.id}`,
      antes: { rol: 'colaborador' },
      despues: { rol: 'auditor_interno' },
      actor: { tipo: 'usuario', usuarioId: ADMIN },
    });
  });

  it('el mismo rol no cambia nada ni deja rastro', async () => {
    const p = m.persona('colaborador');
    expect(await cambiar(p.id, 'colaborador')).toMatchObject({ rol: 'colaborador', version: 1 });
    expect(m.bitacora).toHaveLength(0);
  });

  it('una versión vieja es un conflicto (alguien cambió a la persona a la vez)', async () => {
    const p = m.persona('colaborador');
    await cambiar(p.id, 'auditor_interno');
    await expect(cambiar(p.id, 'alta_direccion', 1)).rejects.toMatchObject({ motivo: 'version_vieja' });
    expect(m.personas.get(p.id)!.rol).toBe('auditor_interno');
  });

  it('no deja a la empresa sin administrador SIG, tampoco quien se lo quita a sí mismo', async () => {
    await expect(cambiar(ADMIN, 'colaborador')).rejects.toMatchObject({ motivo: 'ultimo_administrador' });
    expect(m.personas.get(ADMIN)!.rol).toBe('administrador_sig');
    m.persona('administrador_sig', OTRO_ADMIN);
    await expect(cambiar(ADMIN, 'colaborador')).resolves.toMatchObject({ rol: 'colaborador' });
    expect(m.admins()).toBe(1);
  });

  it('una persona dada de baja o inexistente es «no encontrada»: para volver necesita una solicitud nueva', async () => {
    const baja = m.persona(null);
    await expect(cambiar(baja.id, 'colaborador')).rejects.toBeInstanceOf(PersonaDeLaEmpresaNoEncontradaError);
    await expect(cambiar(uid(), 'colaborador')).rejects.toBeInstanceOf(PersonaDeLaEmpresaNoEncontradaError);
  });

  it.each([
    ['rol que no existe', 'jefe'],
    ['rol «ninguno»', 'ninguno'],
    ['rol vacío', ''],
    ['versión que no es entero', '1; drop table usuario'],
  ])('rechaza %s (400) sin tocar la base de datos', async (_c, malo) => {
    const p = m.persona('colaborador');
    m.empresasUsadas = [];
    const esVersion = _c.startsWith('versión');
    await expect(cambiar(p.id, esVersion ? 'colaborador' : malo, esVersion ? malo : 1)).rejects.toBeInstanceOf(
      PeticionDePersonasNoValidaError,
    );
    expect(m.empresasUsadas).toEqual([]);
  });

  it('sin permiso no toca la base de datos', async () => {
    const colaborador = m.persona('colaborador');
    await expect(cambiar(colaborador.id, 'administrador_sig', 1, colaborador.id)).rejects.toBeInstanceOf(SinPermisoPersonasError);
    expect(m.empresasUsadas).toEqual([]);
  });
});

describe('DarDeBaja', () => {
  const baja = (personaId: string, versionEsperada: unknown = 1, usuarioId = ADMIN) =>
    new DarDeBajaUseCase(m.unidad, m.permisos).ejecutar({
      empresaId: EMPRESA,
      usuarioId,
      personaId,
      versionEsperada,
      ahora: AHORA,
      traceId: 'trace-4',
    });

  it('deja el rol en nulo, anota la baja, conserva la fila y registra el rol que tenía', async () => {
    const p = m.persona('auditor_interno');
    const r = await baja(p.id);
    expect(r).toMatchObject({ id: p.id, rol: null, bajaEn: AHORA, version: 2 });
    expect(m.personas.has(p.id)).toBe(true);
    expect(m.bitacora.at(-1)).toMatchObject({
      accion: 'usuario.baja',
      objeto: `usuario:${p.id}`,
      antes: { rol: 'auditor_interno' },
      actor: { tipo: 'usuario', usuarioId: ADMIN },
    });
    expect(textoDeLaBitacora()).not.toMatch(/example\.test|Persona/);
  });

  it('no da de baja al último administrador SIG', async () => {
    await expect(baja(ADMIN)).rejects.toMatchObject({ motivo: 'ultimo_administrador' });
    m.persona('administrador_sig', OTRO_ADMIN);
    await expect(baja(ADMIN)).resolves.toMatchObject({ rol: null });
  });

  it('versión vieja = conflicto; ya de baja o inexistente = «no encontrada»', async () => {
    const p = m.persona('colaborador');
    await expect(baja(p.id, 7)).rejects.toMatchObject({ motivo: 'version_vieja' });
    await baja(p.id);
    await expect(baja(p.id, 2)).rejects.toBeInstanceOf(PersonaDeLaEmpresaNoEncontradaError);
    await expect(baja(uid())).rejects.toBeInstanceOf(PersonaDeLaEmpresaNoEncontradaError);
  });

  it('exige el permiso y valida la versión', async () => {
    const p = m.persona('colaborador');
    await expect(baja(p.id, 1, p.id)).rejects.toBeInstanceOf(SinPermisoPersonasError);
    await expect(baja(p.id, 'x')).rejects.toBeInstanceOf(PeticionDePersonasNoValidaError);
  });
});

describe('conflictos', () => {
  it('un ConflictoDePersonasError lleva un motivo de una lista cerrada y no repite datos', () => {
    const e = new ConflictoDePersonasError('correo_repetido');
    expect(e.motivo).toBe('correo_repetido');
    expect(e.message).not.toMatch(/@/);
  });
});
