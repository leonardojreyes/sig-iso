// Empresas de DEMOSTRACIÓN: solo para pruebas y Storybook. La aplicación usa la marca real de la sesión (src/marca/).
import type { Empresa } from './marca/tipos';

export { cssDeEmpresa, esIdEmpresa, type Empresa } from './marca/tipos';

export const empresas: Record<string, Empresa> = {
  a: { id: 'a', nombre: 'SynapTech Ecuador', primario: '#0E5C42' },
  b: { id: 'b', nombre: 'Andes Logística S.A.', primario: '#1D4ED8' },
};

export const obtenerEmpresa = (id: string): Empresa | undefined =>
  /^[a-z0-9-]{1,32}$/.test(id) && Object.hasOwn(empresas, id) ? empresas[id] : undefined;
