// Personas y solicitudes para las pruebas de la API (M7, ADR 036): casos de uso REALES sobre un almacén en memoria que se comporta
// como la base: cada empresa ve y cambia solo lo suyo, el hecho de la bitácora va en la MISMA unidad y, si algo falla, todo se revierte.
import { validarEvento, type EventoBitacora } from '@sig/auditoria';
import {
  AprobarSolicitudUseCase,
  CambiarRolUseCase,
  DarDeBajaUseCase,
  DescartarSolicitudUseCase,
  ListarPersonasUseCase,
  SolicitarAccesoUseCase,
  type ContextoPersonas,
  type PermisoPersonasPort,
  type PersonaDto,
  type SolicitudDto,
  type UnidadDeTrabajoPersonasPort,
} from '@sig/empresas';
import type { EmpresaId } from '@sig/tenancy';
import type { OpcionesPersonasApi } from '../personas-api.module.js';

type Solicitud = SolicitudDto & { estado: string };
interface DatosDeEmpresa {
  personas: Map<string, PersonaDto>;
  solicitudes: Map<string, Solicitud>;
}

export const personasDePrueba = (permisos: PermisoPersonasPort) => {
  const estado = { empresas: new Map<string, DatosDeEmpresa>(), eventos: [] as EventoBitacora[], fallaBitacora: false, ahora: new Date('2026-11-16T15:00:00.000Z') };
  const de = (e: string): DatosDeEmpresa => {
    let d = estado.empresas.get(e);
    if (!d) estado.empresas.set(e, (d = { personas: new Map(), solicitudes: new Map() }));
    return d;
  };
  const sembrar = (empresaId: string, p: Partial<PersonaDto> & { id: string }): void => {
    de(empresaId).personas.set(p.id, { nombre: `Persona ${p.id.slice(0, 4)}`, correo: `${p.id.slice(0, 8)}@example.test`, rol: 'colaborador', bajaEn: null, version: 1, ...p });
  };

  const contexto = (empresaId: string): ContextoPersonas => {
    const d = de(empresaId);
    const vigentes = (ahora: Date) => [...d.solicitudes.values()].filter((s) => s.estado === 'pendiente' && s.venceEn > ahora);
    return {
      personas: {
        obtener: async (id) => d.personas.get(id) ?? null,
        listar: async () => [...d.personas.values()],
        contarAdministradores: async () => [...d.personas.values()].filter((p) => p.rol === 'administrador_sig').length,
        insertar: async (p) => {
          if ([...d.personas.values()].some((x) => x.correo === p.correo)) return 'correo_repetido';
          d.personas.set(p.id, { ...p, bajaEn: null, version: 1 });
          return 'ok';
        },
        reactivar: async (p) => {
          const a = d.personas.get(p.id);
          if (!a || a.version !== p.versionEsperada) return 'version_vieja';
          if ([...d.personas.values()].some((x) => x.id !== p.id && x.correo === p.correo)) return 'correo_repetido';
          d.personas.set(p.id, { ...a, nombre: p.nombre, correo: p.correo, rol: p.rol, bajaEn: null, version: a.version + 1 });
          return 'ok';
        },
        cambiarRol: async (id, rol, v) => {
          const p = d.personas.get(id);
          if (!p || p.rol === null || p.version !== v) return false;
          d.personas.set(id, { ...p, rol, version: p.version + 1 });
          return true;
        },
        darDeBaja: async (id, v, ahora) => {
          const p = d.personas.get(id);
          if (!p || p.rol === null || p.version !== v) return false;
          d.personas.set(id, { ...p, rol: null, bajaEn: ahora, version: p.version + 1 });
          return true;
        },
      },
      solicitudes: {
        vencerVencidas: async (ahora) => {
          for (const [id, s] of d.solicitudes) if (s.estado === 'pendiente' && s.venceEn <= ahora) d.solicitudes.set(id, { ...s, estado: 'vencida' });
        },
        vigenteDe: async (u, ahora) => vigentes(ahora).find((s) => s.usuarioId === u) ?? null,
        obtenerVigente: async (id, ahora) => vigentes(ahora).find((s) => s.id === id) ?? null,
        listarVigentes: async (ahora) => vigentes(ahora),
        contarVigentes: async (ahora) => vigentes(ahora).length,
        crear: async (s) => {
          if (vigentes(new Date(0)).some((x) => x.usuarioId === s.usuarioId || x.codigo === s.codigo)) return 'conflicto';
          d.solicitudes.set(s.id, { ...s, estado: 'pendiente' });
          return 'creada';
        },
        resolver: async (id, e) => {
          const s = d.solicitudes.get(id);
          if (!s || s.estado !== 'pendiente') return false;
          d.solicitudes.set(id, { ...s, estado: e });
          return true;
        },
      },
      bitacora: {
        registrar: async (e) => {
          if (estado.fallaBitacora) throw new Error('bitácora caída');
          if (e.empresaId !== empresaId) throw new Error('RLS: el registro no es de la empresa del contexto');
          validarEvento(e); // el catálogo real de la bitácora: lo que no cumple, falla la prueba
          estado.eventos.push(e);
        },
      },
    };
  };

  const unidad: UnidadDeTrabajoPersonasPort = {
    ejecutar: async <T>(empresaId: EmpresaId, fn: (c: ContextoPersonas) => Promise<T>): Promise<T> => {
      const d = de(empresaId);
      const copia = { personas: new Map(d.personas), solicitudes: new Map(d.solicitudes) };
      const copiaEventos = [...estado.eventos];
      try {
        return await fn(contexto(empresaId));
      } catch (error) {
        d.personas = copia.personas;
        d.solicitudes = copia.solicitudes;
        estado.eventos = copiaEventos;
        throw error;
      }
    },
  };

  let n = 0;
  let semilla = 7;
  const aleatorio = (cuantos: number) => Uint8Array.from({ length: cuantos }, () => ((semilla = (Math.imul(semilla, 1103515245) + 12345) & 0x7fffffff) >>> 16) & 0xff);
  const nuevoId = () => `20000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const opciones: OpcionesPersonasApi = {
    solicitarAcceso: new SolicitarAccesoUseCase(unidad, aleatorio, nuevoId),
    listarPersonas: new ListarPersonasUseCase(unidad, permisos),
    aprobarSolicitud: new AprobarSolicitudUseCase(unidad, permisos),
    descartarSolicitud: new DescartarSolicitudUseCase(unidad, permisos),
    cambiarRol: new CambiarRolUseCase(unidad, permisos),
    darDeBaja: new DarDeBajaUseCase(unidad, permisos),
    reloj: () => estado.ahora,
  };
  return { opciones, estado, sembrar, de };
};
