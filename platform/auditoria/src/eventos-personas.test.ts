import { describe, expect, it } from 'vitest';
import { EventoBitacoraInvalidoError } from './dominio/errores';
import { validarEvento } from './dominio/validacion';
import { ejemplos, USUARIO } from './prueba/ejemplos';

// Eventos de las personas (MVP, M7, ADR 036): solicitud de acceso, alta, cambio de rol y baja. La bitácora guarda identificadores
// opacos y roles de una lista cerrada; NUNCA el nombre, el correo ni el código de la solicitud.
const rechaza = (e: unknown) => expect(() => validarEvento(e)).toThrow(EventoBitacoraInvalidoError);
const SOLICITUD = '8f3a2c1e-5b7d-4e90-9a12-3c4d5e6f7a8b';

const ACCIONES = ['acceso.solicitado', 'acceso.rechazado', 'usuario.alta', 'rol.cambiado', 'usuario.baja'] as const;

describe.each(ACCIONES)('%s', (accion) => {
  const e = ejemplos[accion];
  it('acepta su ejemplo', () => expect(() => validarEvento(e)).not.toThrow());
  it('exige empresa y objeto', () => {
    rechaza({ ...e, empresaId: null });
    rechaza({ ...e, objeto: undefined });
  });
  it('solo registra hechos que salieron bien', () => {
    rechaza({ ...e, resultado: 'rechazado', motivo: 'sin_permiso' });
  });
  it('NUNCA admite el nombre, el correo, el código ni otro texto', () => {
    for (const clave of ['nombre', 'correo', 'email', 'codigo', 'texto', 'comentario', 'telefono']) {
      rechaza({ ...e, despues: { [clave]: 'algo' } });
      rechaza({ ...e, antes: { [clave]: 'algo' } });
    }
  });
});

describe('quién actúa', () => {
  it('pedir acceso y descartar una solicitud los hace una persona (la que pide y quien administra), no el sistema', () => {
    for (const accion of ['acceso.solicitado', 'acceso.rechazado'] as const) {
      expect(() => validarEvento({ ...ejemplos[accion], actor: { tipo: 'usuario', usuarioId: USUARIO } })).not.toThrow();
      rechaza({ ...ejemplos[accion], actor: { tipo: 'sistema' } });
      rechaza({ ...ejemplos[accion], actor: { tipo: 'plataforma' } });
    }
  });
  it('el alta, el cambio de rol y la baja ahora también los hace una persona (el administrador SIG), además del mantenimiento', () => {
    for (const accion of ['usuario.alta', 'rol.cambiado', 'usuario.baja'] as const) {
      expect(() => validarEvento({ ...ejemplos[accion], actor: { tipo: 'usuario', usuarioId: USUARIO } })).not.toThrow();
      expect(() => validarEvento({ ...ejemplos[accion], actor: { tipo: 'plataforma' } })).not.toThrow();
      rechaza({ ...ejemplos[accion], actor: { tipo: 'sistema' } });
    }
  });
});

describe('qué se guarda', () => {
  it('la solicitud se nombra por su identificador, nunca por su código', () => {
    expect(() => validarEvento({ ...ejemplos['acceso.solicitado'], objeto: `solicitud:${SOLICITUD}` })).not.toThrow();
    rechaza({ ...ejemplos['acceso.solicitado'], objeto: 'solicitud:K7F2 9QXM' });
  });
  it('el alta registra el rol dado, y la baja y el cambio, el rol anterior; solo de la lista de roles', () => {
    const base = { ...ejemplos['usuario.alta'], actor: { tipo: 'usuario', usuarioId: USUARIO } };
    expect(() => validarEvento({ ...base, despues: { rol: 'colaborador' } })).not.toThrow();
    rechaza({ ...base, despues: { rol: 'superadministrador' } });
    rechaza({ ...base, despues: { rol: 'Ana Pérez' } });
    const baja = { ...ejemplos['usuario.baja'], actor: { tipo: 'usuario', usuarioId: USUARIO } };
    expect(() => validarEvento({ ...baja, antes: { rol: 'auditor_interno' } })).not.toThrow();
    rechaza({ ...baja, antes: { rol: 'ana@example.test' } });
  });
});
