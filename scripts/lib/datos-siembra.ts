// Datos de prueba del corte 0.6: dos empresas (A y B), cada una con un administrador SIG y un colaborador.
// Son FICTICIOS: correos de dominio reservado para pruebas (`example.test`), identificadores fijos para que la siembra sea
// idempotente y para que Keycloak (8.x) y OpenFGA (9.x) usen los mismos. Sin contraseñas: las genera `keycloak-dev`.
import { ROLES, type Rol } from '@sig/autorizacion';

export interface EmpresaSiembra {
  readonly id: string;
  readonly slug: string;
  readonly nombre: string;
  readonly colorPrimario: string;
  readonly logoUrl: string | null;
}

export interface UsuarioSiembra {
  /** Nombre corto de la cuenta (para el realm de Keycloak y la documentación). */
  readonly alias: string;
  readonly id: string;
  readonly empresaId: string;
  readonly nombre: string;
  readonly correo: string;
  /** Rol que recibirá en OpenFGA (tarea 9.3). No se guarda en la base de datos de la aplicación. */
  readonly rol: Rol;
}

export interface DatosSiembra {
  empresas: EmpresaSiembra[];
  usuarios: UsuarioSiembra[];
}

const EMPRESA_A = 'a5eed000-0000-4000-8000-00000000000a';
const EMPRESA_B = 'b5eed000-0000-4000-8000-00000000000b';

export const DATOS_SIEMBRA: DatosSiembra = {
  empresas: [
    { id: EMPRESA_A, slug: 'empresa-a', nombre: 'Empresa A (prueba)', colorPrimario: '#0b5fff', logoUrl: null },
    { id: EMPRESA_B, slug: 'empresa-b', nombre: 'Empresa B (prueba)', colorPrimario: '#b45309', logoUrl: null },
  ],
  usuarios: [
    { alias: 'admin-a', id: '5eed0001-0000-4000-8000-0000000000a1', empresaId: EMPRESA_A, nombre: 'Administradora A', correo: 'admin-a@example.test', rol: 'administrador_sig' },
    { alias: 'colab-a', id: '5eed0002-0000-4000-8000-0000000000a2', empresaId: EMPRESA_A, nombre: 'Colaborador A', correo: 'colab-a@example.test', rol: 'colaborador' },
    { alias: 'admin-b', id: '5eed0003-0000-4000-8000-0000000000b1', empresaId: EMPRESA_B, nombre: 'Administrador B', correo: 'admin-b@example.test', rol: 'administrador_sig' },
    { alias: 'colab-b', id: '5eed0004-0000-4000-8000-0000000000b2', empresaId: EMPRESA_B, nombre: 'Colaboradora B', correo: 'colab-b@example.test', rol: 'colaborador' },
  ],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_NULO = '00000000-0000-0000-0000-000000000000';
const SLUG = /^[a-z0-9-]{1,32}$/;
const COLOR = /^#[0-9A-Fa-f]{6}$/;

const repetidos = (valores: readonly string[]): boolean => new Set(valores).size !== valores.length;
const exigirUuid = (valor: string): void => {
  if (!UUID.test(valor) || valor === UUID_NULO) throw new Error('Identificador que no es un UUID válido en los datos de siembra');
};

/** Comprueba los datos antes de tocar la base. Los mensajes no repiten los valores. */
export const validarDatosSiembra = (d: DatosSiembra): void => {
  if (d.empresas.length === 0 || d.usuarios.length === 0) throw new Error('Los datos de siembra no pueden estar vacíos');
  d.empresas.forEach((e) => {
    exigirUuid(e.id);
    if (!SLUG.test(e.slug)) throw new Error('Slug de empresa no válido en los datos de siembra');
    if (!COLOR.test(e.colorPrimario)) throw new Error('Color de empresa no válido (se espera #RRGGBB) en los datos de siembra');
  });
  d.usuarios.forEach((u) => {
    exigirUuid(u.id);
    exigirUuid(u.empresaId);
    if (!u.correo.endsWith('@example.test')) throw new Error('Los correos de siembra deben ser del dominio de pruebas example.test');
    if (!(ROLES as readonly string[]).includes(u.rol)) throw new Error('Rol desconocido en los datos de siembra');
  });
  if (repetidos(d.empresas.map((e) => e.id)) || repetidos(d.usuarios.map((u) => u.id))) throw new Error('Identificador repetido en los datos de siembra');
  if (repetidos(d.empresas.map((e) => e.slug))) throw new Error('Slug repetido en los datos de siembra');
  if (repetidos(d.usuarios.map((u) => u.alias))) throw new Error('Alias repetido en los datos de siembra');
  const ids = new Set(d.empresas.map((e) => e.id));
  if (d.usuarios.some((u) => !ids.has(u.empresaId))) throw new Error('Hay personas de una empresa que no existe en los datos de siembra');
  if (repetidos(d.usuarios.map((u) => `${u.empresaId}|${u.correo}`))) throw new Error('Correo repetido dentro de una misma empresa en los datos de siembra');
};

const LOCALES = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** La siembra solo corre contra una base de esta máquina y nunca con NODE_ENV=production. No incluye la URL en el error. */
export const exigirBaseLocal = (urlBase: string, env: Readonly<Record<string, string | undefined>>): void => {
  if (env.NODE_ENV === 'production') throw new Error('La siembra no se ejecuta en producción');
  let host = '';
  try {
    host = new URL(urlBase).hostname;
  } catch {
    throw new Error('La base de datos no es local: la URL no es válida y no se puede comprobar');
  }
  if (!LOCALES.has(host)) throw new Error('La base de datos no es local: la siembra solo corre contra 127.0.0.1 o localhost');
};
