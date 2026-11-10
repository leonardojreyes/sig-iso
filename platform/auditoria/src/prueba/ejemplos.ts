// Eventos válidos de ejemplo, uno por acción. Las pruebas parten de ellos y estropean un campo cada vez.
import { crearEmpresaId } from '@sig/tenancy';
import type { AccionBitacora, EventoBitacora } from '../dominio/tipos';

export const EMPRESA = crearEmpresaId('3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c');
export const USUARIO = '11111111-2222-4333-8444-555555555555';
export const HUELLA = 'a'.repeat(64);

export const ejemplos: Record<AccionBitacora, EventoBitacora> = {
  'login.ok': { empresaId: EMPRESA, actor: { tipo: 'usuario', usuarioId: USUARIO }, accion: 'login.ok', resultado: 'ok' },
  'login.fallido': { empresaId: null, actor: { tipo: 'proceso' }, accion: 'login.fallido', resultado: 'rechazado', motivo: 'cuenta_inexistente', origenId: 'kc:evento:abc123' },
  logout: { empresaId: EMPRESA, actor: { tipo: 'usuario', usuarioId: USUARIO }, accion: 'logout', resultado: 'ok' },
  'sesion.expirada': { empresaId: EMPRESA, actor: { tipo: 'sistema', usuarioId: USUARIO }, accion: 'sesion.expirada', resultado: 'ok', motivo: 'sesion_inactiva' },
  'libreria.adoptada': {
    empresaId: EMPRESA,
    actor: { tipo: 'usuario', usuarioId: USUARIO },
    accion: 'libreria.adoptada',
    resultado: 'ok',
    objeto: 'libreria:ejemplo-estructura-armonizada',
    objetoVersion: '1.0.0',
    antes: { adoptada: false },
    despues: { adoptada: true, entradas: 21 },
  },
  'evaluacion.cambiada': {
    empresaId: EMPRESA,
    actor: { tipo: 'usuario', usuarioId: USUARIO },
    accion: 'evaluacion.cambiada',
    resultado: 'ok',
    objeto: 'evaluacion:iso-27001-2022-anexo-a.a27-5-1',
    antes: { estado: 'sin_evaluar' },
    despues: { estado: 'parcial' },
  },
  'alcance.cambiado': { empresaId: EMPRESA, actor: { tipo: 'usuario', usuarioId: USUARIO }, accion: 'alcance.cambiado', resultado: 'ok', objeto: 'alcance:iso-iec-27001', antes: { aprobado: true }, despues: { aprobado: false } },
  'alcance.aprobado': { empresaId: EMPRESA, actor: { tipo: 'usuario', usuarioId: USUARIO }, accion: 'alcance.aprobado', resultado: 'ok', objeto: 'alcance:iso-iec-27001' },
  'acceso.denegado': { empresaId: EMPRESA, actor: { tipo: 'usuario', usuarioId: USUARIO }, accion: 'acceso.denegado', resultado: 'rechazado', motivo: 'sin_permiso', objeto: 'accion:adoptar_libreria' },
  'acceso.cruzado': { empresaId: EMPRESA, actor: { tipo: 'usuario', usuarioId: USUARIO }, accion: 'acceso.cruzado', resultado: 'rechazado', motivo: 'empresa_distinta', objeto: 'libreria:otra' },
  'token.invalido': { empresaId: null, actor: { tipo: 'sistema' }, accion: 'token.invalido', resultado: 'rechazado', motivo: 'token_vencido' },
  'catalogo.cargado': { empresaId: null, actor: { tipo: 'plataforma' }, accion: 'catalogo.cargado', resultado: 'ok', objeto: 'libreria:ejemplo-estructura-armonizada', objetoVersion: HUELLA, despues: { entradas: 21 } },
  'rol.cambiado': { empresaId: EMPRESA, actor: { tipo: 'proceso' }, accion: 'rol.cambiado', resultado: 'ok', objeto: `usuario:${USUARIO}`, antes: { rol: 'colaborador' }, despues: { rol: 'administrador_sig' }, origenId: 'kc:admin:xyz' },
  'usuario.alta': { empresaId: EMPRESA, actor: { tipo: 'plataforma' }, accion: 'usuario.alta', resultado: 'ok', objeto: `usuario:${USUARIO}` },
  'usuario.baja': { empresaId: EMPRESA, actor: { tipo: 'plataforma' }, accion: 'usuario.baja', resultado: 'ok', objeto: `usuario:${USUARIO}` },
  'datos_iniciales.cargados': { empresaId: null, actor: { tipo: 'plataforma' }, accion: 'datos_iniciales.cargados', resultado: 'ok', motivo: 'carga_inicial', despues: { empresas: 2, usuarios: 4 } },
  'bitacora.verificacion': { empresaId: null, actor: { tipo: 'sistema' }, accion: 'bitacora.verificacion', resultado: 'error', motivo: 'ancla_perdida', despues: { problemas: 1 } },
};
